import { UserRole, TicketPriority, TicketStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { TicketsService } from './tickets.service';

describe('TicketsService.findAll', () => {
  const prismaMock = {
    $queryRaw: jest.fn(),
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
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

    prismaMock.ticket.count.mockResolvedValue(3);
    prismaMock.ticket.findMany.mockResolvedValue([{ id: 't-1' }]);

    const result = await service.findAll(currentUser, {});

    expect(prismaMock.ticket.count).toHaveBeenCalledWith({ where: {} });
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
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

    prismaMock.ticket.count.mockResolvedValue(11);
    prismaMock.ticket.findMany.mockResolvedValue([{ id: 't-99' }]);

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

    const whereArg = prismaMock.ticket.count.mock.calls[0][0].where;
    expect(whereArg).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          { requesterId: 'requester-1' },
          { status: TicketStatus.OPEN },
          { priority: TicketPriority.HIGH },
          {
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
          {
            OR: expect.arrayContaining([
              { code: { contains: 'vpn', mode: 'insensitive' } },
              { title: { contains: 'vpn', mode: 'insensitive' } },
            ]),
          },
        ]),
      }),
    );

    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
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

    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ total: BigInt(2) }])
      .mockResolvedValueOnce([{ id: 't-2' }, { id: 't-1' }]);
    prismaMock.ticket.findMany.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }]);

    const result = await service.findAll(currentUser, {
      text: 'correo vpn',
      searchMode: 'FTS',
      sort: 'CREATED_DESC',
      page: 1,
      pageSize: 10,
    });

    expect(prismaMock.ticket.count).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
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
