import { ForbiddenException } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prismaMock = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const auditMock = {
    log: jest.fn(),
  };

  let service: NotificationsService;
  const currentUser: CurrentUser = {
    sub: 'user-1',
    email: 'user1@example.com',
    role: UserRole.REQUESTER,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('bloquea marcar como leida una notificacion de otro usuario', async () => {
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'n-1',
      recipientUserId: 'other-user',
      isRead: false,
    });

    await expect(service.markAsRead('n-1', currentUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('deduplica recipients y solo notifica usuarios activos', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-1' }, { id: 'u-3' }]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 2 });

    const result = await service.broadcast({
      recipientUserIds: ['u-1', 'u-1', 'u-2', 'u-3'],
      type: NotificationType.SLA_AT_RISK,
      title: 'SLA alerta',
      body: 'Riesgo detectado',
      resource: 'ticket',
      resourceId: 't-1',
      actorUserId: 'admin-1',
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['u-1', 'u-2', 'u-3'] },
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
    expect(result).toEqual({ created: 2 });
  });

  it('markAllAsRead devuelve contador actualizado', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markAllAsRead(currentUser);

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recipientUserId: 'user-1',
          isRead: false,
        },
      }),
    );
    expect(result).toEqual({ success: true, updatedCount: 3 });
  });

  it('create registra auditoria de notificacion', async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: 'n-22',
      recipientUserId: 'u-1',
      type: NotificationType.SYSTEM,
      title: 'Titulo',
      body: 'Body',
      resource: 'ticket',
      resourceId: 't-1',
    });

    const result = await service.create({
      recipientUserId: 'u-1',
      type: NotificationType.SYSTEM,
      title: 'Titulo',
      body: 'Body',
      resource: 'ticket',
      resourceId: 't-1',
      metadata: { source: 'test' },
    });

    expect(result.id).toBe('n-22');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTIFICATION_CREATED',
        resourceId: 'n-22',
      }),
    );
  });

  it('findMine aplica filtros y retorna meta paginada', async () => {
    const rows = [{ id: 'n-1' }, { id: 'n-2' }];
    prismaMock.$transaction.mockResolvedValue([rows, 8, 4]);

    const result = await service.findMine(currentUser, {
      page: 2,
      pageSize: 2,
      unreadOnly: true,
      type: NotificationType.SYSTEM,
    });

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      data: rows,
      total: 8,
      page: 2,
      pageSize: 2,
      totalPages: 4,
      unreadCount: 4,
    });
  });

  it('broadcast retorna cero cuando no hay usuarios activos', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await service.broadcast({
      recipientUserIds: ['u-1', 'u-2'],
      type: NotificationType.SLA_BREACHED,
      title: 'Alerta',
      body: 'Body',
    });

    expect(result).toEqual({ created: 0 });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });
});
