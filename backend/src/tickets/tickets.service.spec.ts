import { UserRole, TicketPriority, TicketStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { TicketsService } from './tickets.service';

describe('TicketsService.findAll', () => {
  type TicketsServicePrivateHelpers = {
    parseCountValue: (
      value: bigint | number | string | null | undefined,
    ) => number;
    parseDate: (value?: string) => Date | null;
    buildTicketListOrderBy: (
      sort?: 'CREATED_DESC' | 'CREATED_ASC' | 'PRIORITY_DESC' | 'PRIORITY_ASC',
    ) => Prisma.TicketOrderByWithRelationInput[];
  };
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
  const catalogMock = {
    resolveCatalogForTicketCreation: jest.fn(),
  };
  const notificationsMock = {
    broadcast: jest.fn(),
  };

  let service: TicketsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
      catalogMock as unknown as CatalogService,
      notificationsMock as unknown as NotificationsService,
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

  it('returns empty result when full-text count is zero', async () => {
    const currentUser: CurrentUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };

    queryRawMock.mockResolvedValueOnce([{ total: '0' }]);

    const result = await service.findAll(currentUser, {
      text: 'sin resultados',
      searchMode: 'FTS',
    });

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    expect(ticketFindManyMock).not.toHaveBeenCalled();
  });

  it('returns empty result when full-text id page is empty', async () => {
    const currentUser: CurrentUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    };

    queryRawMock
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([]);

    const result = await service.findAll(currentUser, {
      text: 'pagina vacia',
      searchMode: 'FTS',
      page: 2,
      pageSize: 2,
    });

    expect(result).toEqual({
      data: [],
      total: 3,
      page: 2,
      pageSize: 2,
      totalPages: 2,
    });
  });

  it('covers internal parsing helpers', () => {
    const helpers = service as unknown as TicketsServicePrivateHelpers;
    expect(helpers.parseCountValue(BigInt(7))).toBe(7);
    expect(helpers.parseCountValue(5)).toBe(5);
    expect(helpers.parseCountValue('11')).toBe(11);
    expect(helpers.parseCountValue('not-a-number')).toBe(0);
    expect(helpers.parseCountValue(undefined)).toBe(0);

    expect(helpers.parseDate('2026-02-18')).toBeInstanceOf(Date);
    expect(helpers.parseDate('invalid')).toBeNull();
  });

  it('covers order helper variants', () => {
    const helpers = service as unknown as TicketsServicePrivateHelpers;
    expect(helpers.buildTicketListOrderBy('CREATED_ASC')).toEqual([
      { createdAt: 'asc' },
    ]);
    expect(helpers.buildTicketListOrderBy('PRIORITY_ASC')).toEqual([
      { priority: 'asc' },
      { createdAt: 'desc' },
    ]);
    expect(helpers.buildTicketListOrderBy('PRIORITY_DESC')).toEqual([
      { priority: 'desc' },
      { createdAt: 'desc' },
    ]);
    expect(helpers.buildTicketListOrderBy()).toEqual([{ createdAt: 'desc' }]);
  });
});
