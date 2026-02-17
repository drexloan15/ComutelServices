import { SlaStatus, TicketStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { resetRuntimeConfigCacheForTests } from '../config/runtime-config';
import { SlaService } from './sla.service';

describe('SlaService.runEngine', () => {
  const prismaMock = {
    slaPolicy: {
      findFirst: jest.fn(),
    },
    ticket: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    ticketSlaTracking: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const auditMock = {
    log: jest.fn(),
  };

  const notificationsMock = {
    broadcast: jest.fn(),
  };

  let service: SlaService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_32_chars_minimum_0001';
    process.env.JWT_REFRESH_SECRET =
      'test_refresh_secret_32_chars_minimum_0001';
    process.env.BOOTSTRAP_ADMIN_SECRET =
      'test_bootstrap_secret_32_chars_min_0001';
    process.env.SLA_ENGINE_AUTORUN_ENABLED = 'false';
    resetRuntimeConfigCacheForTests();

    service = new SlaService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
      notificationsMock as unknown as NotificationsService,
    );
  });

  it('cambia SLA a BREACHED y genera notificacion/auditoria', async () => {
    const now = new Date();
    const createdAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    prismaMock.slaPolicy.findFirst.mockResolvedValue({
      id: 'policy-1',
      responseTimeMinutes: 30,
      resolutionTimeMinutes: 90,
      isActive: true,
      createdAt: new Date(now.getTime() - 5 * 60 * 1000),
    });

    prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-1',
        code: 'INC-1',
        title: 'Incidencia critica',
        requesterId: 'requester-1',
        assigneeId: 'agent-1',
        createdAt,
        resolvedAt: null,
        closedAt: null,
        status: TicketStatus.OPEN,
        slaPolicy: {
          id: 'policy-1',
          responseTimeMinutes: 30,
          resolutionTimeMinutes: 90,
          isActive: true,
        },
        comments: [],
      },
    ]);

    prismaMock.ticketSlaTracking.findMany.mockResolvedValue([
      {
        id: 'tracking-1',
        ticketId: 'ticket-1',
        status: SlaStatus.ON_TRACK,
        breachedAt: null,
      },
    ]);

    prismaMock.ticketSlaTracking.upsert.mockResolvedValue({
      id: 'tracking-1',
      ticketId: 'ticket-1',
      status: SlaStatus.BREACHED,
    });

    notificationsMock.broadcast.mockResolvedValue({ created: 2 });

    const summary = await service.runEngine('admin-1');

    expect(summary.changedStatusCount).toBe(1);
    expect(summary.notificationsCreated).toBe(2);
    expect(notificationsMock.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SLA_BREACHED',
        resource: 'ticket',
        resourceId: 'ticket-1',
      }),
    );

    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SLA_STATUS_CHANGED',
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SLA_ENGINE_RUN',
      }),
    );
  });

  it('runEngineByCurrentUser usa el actor autenticado', async () => {
    prismaMock.slaPolicy.findFirst.mockResolvedValue(null);
    prismaMock.ticket.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticketSlaTracking.findMany.mockResolvedValue([]);

    const currentUser: CurrentUser = {
      sub: 'admin-22',
      email: 'admin22@example.com',
      role: UserRole.ADMIN,
    };

    const summary = await service.runEngineByCurrentUser(currentUser);

    expect(summary.trigger).toBe('manual');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-22',
        action: 'SLA_ENGINE_RUN',
      }),
    );
  });
});
