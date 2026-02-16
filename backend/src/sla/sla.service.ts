import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  NotificationType,
  SlaStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { getRuntimeConfig } from '../config/runtime-config';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { SlaTrackingQueryDto } from './dto/sla-tracking-query.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';

type EngineTrigger = 'manual' | 'auto';

@Injectable()
export class SlaService implements OnModuleInit, OnModuleDestroy {
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    const config = getRuntimeConfig();
    if (!config.slaEngineAutoRunEnabled) {
      return;
    }

    this.intervalRef = setInterval(() => {
      void this.runEngine(undefined, 'auto');
    }, config.slaEngineIntervalMs);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  findPolicies() {
    return this.prisma.slaPolicy.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  createPolicy(dto: CreateSlaPolicyDto) {
    return this.prisma.slaPolicy.create({
      data: {
        name: dto.name,
        description: dto.description,
        responseTimeMinutes: dto.responseTimeMinutes,
        resolutionTimeMinutes: dto.resolutionTimeMinutes,
        businessHoursOnly: dto.businessHoursOnly ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePolicy(id: string, dto: UpdateSlaPolicyDto) {
    const existing = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`SLA policy ${id} no existe`);
    }

    return this.prisma.slaPolicy.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        responseTimeMinutes: dto.responseTimeMinutes,
        resolutionTimeMinutes: dto.resolutionTimeMinutes,
        businessHoursOnly: dto.businessHoursOnly,
        isActive: dto.isActive,
      },
    });
  }

  async findTracking(query: SlaTrackingQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.status ? { status: query.status } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ticketSlaTracking.findMany({
        where,
        include: {
          ticket: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              priority: true,
              requester: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
              assignee: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
          },
          slaPolicy: true,
        },
        orderBy: [{ status: 'asc' }, { resolutionDeadlineAt: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.ticketSlaTracking.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async runEngine(actorUserId?: string, trigger: EngineTrigger = 'manual') {
    const now = new Date();
    const defaultPolicy = await this.prisma.slaPolicy.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    let autoAssignedPolicyCount = 0;
    if (defaultPolicy) {
      const assigned = await this.prisma.ticket.updateMany({
        where: {
          slaPolicyId: null,
          status: {
            in: [
              TicketStatus.OPEN,
              TicketStatus.IN_PROGRESS,
              TicketStatus.PENDING,
            ],
          },
        },
        data: {
          slaPolicyId: defaultPolicy.id,
        },
      });
      autoAssignedPolicyCount = assigned.count;
    }

    const tickets = await this.prisma.ticket.findMany({
      where: {
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.PENDING,
            TicketStatus.RESOLVED,
            TicketStatus.CLOSED,
          ],
        },
        slaPolicyId: { not: null },
      },
      include: {
        slaPolicy: true,
        comments: {
          include: {
            author: {
              select: {
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const ticketIds = tickets.map((ticket) => ticket.id);
    const existingTrackings = ticketIds.length
      ? await this.prisma.ticketSlaTracking.findMany({
          where: { ticketId: { in: ticketIds } },
        })
      : [];
    const trackingByTicketId = new Map(
      existingTrackings.map((tracking) => [tracking.ticketId, tracking]),
    );

    let changedStatusCount = 0;
    let createdTrackingCount = 0;
    let updatedTrackingCount = 0;
    let notificationsCreated = 0;

    for (const ticket of tickets) {
      const policy = ticket.slaPolicy;
      if (!policy || !policy.isActive) {
        continue;
      }

      const existingTracking = trackingByTicketId.get(ticket.id);
      const responseDeadlineAt = new Date(
        ticket.createdAt.getTime() + policy.responseTimeMinutes * 60_000,
      );
      const resolutionDeadlineAt = new Date(
        ticket.createdAt.getTime() + policy.resolutionTimeMinutes * 60_000,
      );

      const firstResponseAt =
        ticket.comments.find(
          (comment) =>
            comment.author.role === UserRole.ADMIN ||
            comment.author.role === UserRole.AGENT,
        )?.createdAt ?? null;

      const resolvedAt = ticket.resolvedAt ?? ticket.closedAt ?? null;
      const nextStatus = this.resolveSlaStatus({
        now,
        responseDeadlineAt,
        resolutionDeadlineAt,
        firstResponseAt,
        resolvedAt,
      });

      const breachedAt =
        nextStatus === SlaStatus.BREACHED
          ? (existingTracking?.breachedAt ?? now)
          : null;

      const tracking = await this.prisma.ticketSlaTracking.upsert({
        where: { ticketId: ticket.id },
        create: {
          ticketId: ticket.id,
          slaPolicyId: policy.id,
          responseDeadlineAt,
          resolutionDeadlineAt,
          firstResponseAt,
          resolvedAt,
          breachedAt,
          status: nextStatus,
        },
        update: {
          slaPolicyId: policy.id,
          responseDeadlineAt,
          resolutionDeadlineAt,
          firstResponseAt,
          resolvedAt,
          breachedAt,
          status: nextStatus,
        },
      });

      if (existingTracking) {
        updatedTrackingCount += 1;
      } else {
        createdTrackingCount += 1;
      }

      if (!existingTracking || existingTracking.status === nextStatus) {
        continue;
      }

      changedStatusCount += 1;

      const notificationType = this.mapStatusToNotificationType(nextStatus);
      if (notificationType) {
        const notificationResult = await this.notificationsService.broadcast({
          actorUserId,
          recipientUserIds: [ticket.requesterId, ticket.assigneeId ?? ''],
          type: notificationType,
          title: `SLA ${this.formatStatusLabel(nextStatus)}: ${ticket.code}`,
          body: `Ticket ${ticket.code} (${ticket.title}) paso de ${existingTracking.status} a ${nextStatus}.`,
          resource: 'ticket',
          resourceId: ticket.id,
          metadata: {
            previousStatus: existingTracking.status,
            nextStatus,
            trackingId: tracking.id,
            trigger,
          },
        });
        notificationsCreated += notificationResult.created;
      }

      await this.auditService.log({
        actorUserId: actorUserId ?? null,
        action: AuditAction.SLA_STATUS_CHANGED,
        resource: 'ticket_sla_tracking',
        resourceId: tracking.id,
        details: {
          ticketId: ticket.id,
          ticketCode: ticket.code,
          previousStatus: existingTracking.status,
          nextStatus,
          trigger,
        },
      });
    }

    const summary = {
      trigger,
      ranAt: now.toISOString(),
      defaultPolicyId: defaultPolicy?.id ?? null,
      autoAssignedPolicyCount,
      processedTickets: tickets.length,
      createdTrackingCount,
      updatedTrackingCount,
      changedStatusCount,
      notificationsCreated,
    };

    await this.auditService.log({
      actorUserId: actorUserId ?? null,
      action: AuditAction.SLA_ENGINE_RUN,
      resource: 'sla_engine',
      success: true,
      details: summary,
    });

    return summary;
  }

  async runEngineByCurrentUser(currentUser: CurrentUser) {
    return this.runEngine(currentUser.sub, 'manual');
  }

  private resolveSlaStatus(input: {
    now: Date;
    responseDeadlineAt: Date;
    resolutionDeadlineAt: Date;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
  }): SlaStatus {
    if (input.resolvedAt) {
      return input.resolvedAt <= input.resolutionDeadlineAt
        ? SlaStatus.MET
        : SlaStatus.BREACHED;
    }

    if (!input.firstResponseAt && input.now > input.responseDeadlineAt) {
      return SlaStatus.BREACHED;
    }

    if (input.now > input.resolutionDeadlineAt) {
      return SlaStatus.BREACHED;
    }

    const responseRiskThresholdMs = 10 * 60_000;
    const resolutionRiskThresholdMs = 20 * 60_000;

    const responseRiskStart = new Date(
      input.responseDeadlineAt.getTime() - responseRiskThresholdMs,
    );
    const resolutionRiskStart = new Date(
      input.resolutionDeadlineAt.getTime() - resolutionRiskThresholdMs,
    );

    if (!input.firstResponseAt && input.now >= responseRiskStart) {
      return SlaStatus.AT_RISK;
    }

    if (input.now >= resolutionRiskStart) {
      return SlaStatus.AT_RISK;
    }

    return SlaStatus.ON_TRACK;
  }

  private mapStatusToNotificationType(
    status: SlaStatus,
  ): NotificationType | null {
    if (status === SlaStatus.AT_RISK) return NotificationType.SLA_AT_RISK;
    if (status === SlaStatus.BREACHED) return NotificationType.SLA_BREACHED;
    if (status === SlaStatus.MET) return NotificationType.SLA_MET;
    return null;
  }

  private formatStatusLabel(status: SlaStatus) {
    if (status === SlaStatus.AT_RISK) return 'en riesgo';
    if (status === SlaStatus.BREACHED) return 'incumplido';
    if (status === SlaStatus.MET) return 'cumplido';
    return status;
  }
}
