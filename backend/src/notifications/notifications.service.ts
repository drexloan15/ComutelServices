import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditAction, NotificationType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

type CreateNotificationInput = {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  resource?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue | null;
};

type BroadcastNotificationInput = {
  recipientUserIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  resource?: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue | null;
  actorUserId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findMine(currentUser: CurrentUser, query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NotificationWhereInput = {
      recipientUserId: currentUser.sub,
      ...(query.unreadOnly ? { isRead: false } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          recipientUserId: currentUser.sub,
          isRead: false,
        },
      }),
    ]);

    return {
      data: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount,
    };
  }

  async markAsRead(id: string, currentUser: CurrentUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new ForbiddenException('Notificacion no disponible');
    }
    if (notification.recipientUserId !== currentUser.sub) {
      throw new ForbiddenException('No puedes modificar esta notificacion');
    }
    if (notification.isRead) {
      return notification;
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.NOTIFICATION_READ,
      resource: 'notification',
      resourceId: id,
      details: { type: updated.type },
    });

    return updated;
  }

  async markAllAsRead(currentUser: CurrentUser) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientUserId: currentUser.sub,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.NOTIFICATION_READ_ALL,
      resource: 'notification',
      details: { affected: result.count },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        type: input.type,
        title: input.title,
        body: input.body,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: this.toNullableJsonInput(input.metadata),
      },
    });

    await this.auditService.log({
      actorUserId: null,
      action: AuditAction.NOTIFICATION_CREATED,
      resource: 'notification',
      resourceId: notification.id,
      details: {
        type: notification.type,
        recipientUserId: notification.recipientUserId,
        linkedResource: notification.resource,
        linkedResourceId: notification.resourceId,
      },
    });

    return notification;
  }

  async broadcast(input: BroadcastNotificationInput) {
    const recipientIds = [...new Set(input.recipientUserIds.filter(Boolean))];
    if (recipientIds.length === 0) {
      return { created: 0 };
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        id: {
          in: recipientIds,
        },
        isActive: true,
      },
      select: { id: true },
    });

    const activeRecipientIds = recipients.map((recipient) => recipient.id);
    if (activeRecipientIds.length === 0) {
      return { created: 0 };
    }

    const now = new Date();
    const metadata = this.toNullableJsonInput(input.metadata);
    const result = await this.prisma.notification.createMany({
      data: activeRecipientIds.map((recipientUserId) => ({
        recipientUserId,
        type: input.type,
        title: input.title,
        body: input.body,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata,
        createdAt: now,
        updatedAt: now,
      })),
    });

    await this.auditService.log({
      actorUserId: input.actorUserId ?? null,
      action: AuditAction.NOTIFICATION_CREATED,
      resource: 'notification',
      details: {
        type: input.type,
        linkedResource: input.resource,
        linkedResourceId: input.resourceId,
        recipients: activeRecipientIds,
        created: result.count,
      },
    });

    return {
      created: result.count,
    };
  }

  private toNullableJsonInput(metadata?: Prisma.InputJsonValue | null) {
    if (metadata === null) {
      return Prisma.JsonNull;
    }
    return metadata;
  }
}
