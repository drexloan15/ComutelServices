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
});
