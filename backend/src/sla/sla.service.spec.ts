import { SlaStatus, TicketStatus, UserRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
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
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    ticketActivity: {
      create: jest.fn(),
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

  it('pausa tracking activo y registra actividad/auditoria', async () => {
    prismaMock.ticketSlaTracking.findUnique.mockResolvedValue({
      id: 'tracking-1',
      ticketId: 'ticket-1',
      pausedAt: null,
      ticket: {
        id: 'ticket-1',
        code: 'INC-1',
        title: 'Demo',
      },
    });
    prismaMock.ticketSlaTracking.update.mockResolvedValue({
      id: 'tracking-1',
      ticketId: 'ticket-1',
      pausedAt: new Date(),
    });

    const currentUser = {
      sub: 'agent-1',
      email: 'agent@example.com',
      role: UserRole.AGENT,
    } as const;

    const result = await service.pauseTracking(
      'ticket-1',
      currentUser,
      'esperando proveedor',
    );

    expect(result.ticketId).toBe('ticket-1');
    expect(prismaMock.ticketActivity.create).toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SLA_PAUSED',
      }),
    );
  });

  it('resume tracking desplaza deadlines y acumula minutos de pausa', async () => {
    const pausedAt = new Date(Date.now() - 5 * 60_000);
    prismaMock.ticketSlaTracking.findUnique.mockResolvedValue({
      id: 'tracking-2',
      ticketId: 'ticket-2',
      pausedAt,
      pausedAccumulatedMinutes: 3,
      responseDeadlineAt: new Date('2026-02-18T10:00:00.000Z'),
      resolutionDeadlineAt: new Date('2026-02-18T11:00:00.000Z'),
      nextEscalationAt: new Date('2026-02-18T10:15:00.000Z'),
      predictedBreachAt: new Date('2026-02-18T10:50:00.000Z'),
      ticket: {
        id: 'ticket-2',
        code: 'INC-2',
        title: 'Demo 2',
      },
    });
    prismaMock.ticketSlaTracking.update.mockResolvedValue({
      id: 'tracking-2',
      ticketId: 'ticket-2',
      pausedAt: null,
      pausedAccumulatedMinutes: 8,
    });

    const currentUser = {
      sub: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    } as const;

    const result = await service.resumeTracking('ticket-2', currentUser);

    expect(result.pausedAt).toBeNull();
    expect(prismaMock.ticketSlaTracking.update).toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SLA_RESUMED',
      }),
    );
  });

  it('lanza not found al pausar tracking inexistente', async () => {
    prismaMock.ticketSlaTracking.findUnique.mockResolvedValue(null);
    const currentUser = {
      sub: 'agent-2',
      email: 'agent2@example.com',
      role: UserRole.AGENT,
    } as const;

    await expect(
      service.pauseTracking('missing-ticket', currentUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('calcula predicciones de breach', async () => {
    prismaMock.ticketSlaTracking.findMany.mockResolvedValue([
      {
        id: 'tracking-3',
        status: SlaStatus.AT_RISK,
        resolutionDeadlineAt: new Date(Date.now() + 15 * 60_000),
        predictedBreachAt: null,
        ticket: {
          id: 't-3',
          code: 'INC-3',
          title: 'Prediccion',
          status: TicketStatus.IN_PROGRESS,
          priority: 'HIGH',
          assignee: null,
          supportGroup: null,
        },
      },
    ]);

    const result = await service.getBreachPredictions({ windowHours: 1 });

    expect(result.windowHours).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      trackingId: 'tracking-3',
      status: SlaStatus.AT_RISK,
    });
    expect(typeof result.data[0].riskScore).toBe('number');
    expect(typeof result.data[0].remainingMinutes).toBe('number');
  });
});
