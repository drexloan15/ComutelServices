import { UserRole, TicketPriority, TicketStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { TicketsService } from './tickets.service';

describe('TicketsService.findAll', () => {
  const queryRawMock = jest.fn<Promise<unknown[]>, [unknown]>();
  const ticketCountMock = jest.fn<Promise<number>, [unknown]>();
  const ticketFindManyMock = jest.fn<
    Promise<Array<{ id: string }>>,
    [unknown]
  >();

  const prismaMock = {
    $queryRaw: queryRawMock,
    ticket: {
      count: ticketCountMock,
      findMany: ticketFindManyMock,
    },
  };
  const auditMock = {
    log: jest.fn(),
  };

  let service: TicketsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('returns paginated metadata with default sorting', async () => {
    const currentUser: CurrentUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };

    ticketCountMock.mockResolvedValue(3);
    ticketFindManyMock.mockResolvedValue([{ id: 't-1' }]);

    const result = await service.findAll(currentUser, {});

    expect(ticketCountMock).toHaveBeenCalledWith({ where: {} });
    expect(ticketFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
    expect(result).toEqual({
      data: [{ id: 't-1' }],
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
  });

  it('applies role-based filters and clamps page to totalPages', async () => {
    const currentUser: CurrentUser = {
      sub: 'requester-1',
      email: 'requester@example.com',
      role: UserRole.REQUESTER,
    };

    ticketCountMock.mockResolvedValue(11);
    ticketFindManyMock.mockResolvedValue([{ id: 't-99' }]);

    const result = await service.findAll(currentUser, {
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      from: '2026-02-01',
      to: '2026-02-15',
      text: 'vpn',
      sort: 'PRIORITY_DESC',
      page: 99,
      pageSize: 5,
    });

    const firstCountCall = ticketCountMock.mock.calls[0]?.[0] as
      | { where?: unknown }
      | undefined;
    const whereArg = firstCountCall?.where;
    const andFilters = (
      (whereArg as { AND?: unknown[] } | undefined)?.AND ?? []
    ).filter(
      (value): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null,
    );

    expect(andFilters).toContainEqual({ requesterId: 'requester-1' });
    expect(andFilters).toContainEqual({ status: TicketStatus.OPEN });
    expect(andFilters).toContainEqual({ priority: TicketPriority.HIGH });

    const createdAtFilter = andFilters.find(
      (filter) => 'createdAt' in filter,
    ) as { createdAt?: { gte?: unknown; lte?: unknown } } | undefined;
    expect(createdAtFilter?.createdAt?.gte).toBeInstanceOf(Date);
    expect(createdAtFilter?.createdAt?.lte).toBeInstanceOf(Date);

    const textFilter = andFilters.find((filter) => 'OR' in filter) as
      | { OR?: unknown[] }
      | undefined;
    const textOrFilters = (textFilter?.OR ?? []).filter(
      (value): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null,
    );
    expect(textOrFilters).toContainEqual({
      code: { contains: 'vpn', mode: 'insensitive' },
    });
    expect(textOrFilters).toContainEqual({
      title: { contains: 'vpn', mode: 'insensitive' },
    });

    expect(ticketFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 5,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
    );
    expect(result.page).toBe(3);
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(11);
  });

  it('uses full-text mode when searchMode is FTS and keeps ordered ids', async () => {
    const currentUser: CurrentUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };

    queryRawMock
      .mockResolvedValueOnce([{ total: BigInt(2) }])
      .mockResolvedValueOnce([{ id: 't-2' }, { id: 't-1' }]);
    ticketFindManyMock.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);

    const result = await service.findAll(currentUser, {
      text: 'correo vpn',
      searchMode: 'FTS',
      sort: 'CREATED_DESC',
      page: 1,
      pageSize: 10,
    });

    expect(ticketCountMock).not.toHaveBeenCalled();
    expect(queryRawMock).toHaveBeenCalledTimes(2);
    expect(ticketFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['t-2', 't-1'] } },
      }),
    );
    expect(result).toEqual({
      data: [{ id: 't-2' }, { id: 't-1' }],
      total: 2,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
  });
});
