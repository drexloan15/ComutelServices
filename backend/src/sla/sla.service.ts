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
  TicketActivityType,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/types/current-user.type';
import { getRuntimeConfig } from '../config/runtime-config';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessCalendarDto } from './dto/create-business-calendar.dto';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { SlaPredictionQueryDto } from './dto/sla-prediction-query.dto';
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

  findCalendars() {
    return this.prisma.businessHoursCalendar.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createCalendar(dto: CreateBusinessCalendarDto) {
    if (dto.isDefault) {
      await this.prisma.businessHoursCalendar.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.businessHoursCalendar.create({
      data: {
        name: dto.name,
        timezone: dto.timezone ?? 'America/Lima',
        openWeekdays: dto.openWeekdays ?? [1, 2, 3, 4, 5],
        startHour: dto.startHour ?? 9,
        endHour: dto.endHour ?? 18,
        holidays: (dto.holidays ?? []).map((value) => new Date(value)),
        isDefault: dto.isDefault ?? false,
      },
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
        calendarId: dto.calendarId,
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
        calendarId: dto.calendarId,
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

  async pauseTracking(
    ticketId: string,
    currentUser: CurrentUser,
    reason?: string,
  ) {
    const tracking = await this.prisma.ticketSlaTracking.findUnique({
      where: { ticketId },
      include: {
        ticket: {
          select: { id: true, code: true, title: true },
        },
      },
    });
    if (!tracking) {
      throw new NotFoundException('SLA tracking no encontrado');
    }
    if (tracking.pausedAt) {
      return tracking;
    }

    const now = new Date();
    const updated = await this.prisma.ticketSlaTracking.update({
      where: { ticketId },
      data: {
        pausedAt: now,
      },
    });

    await this.prisma.ticketActivity.create({
      data: {
        ticketId: tracking.ticket.id,
        actorId: currentUser.sub,
        type: TicketActivityType.SLA_PAUSED,
        title: 'SLA pausado',
        detail: reason,
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.SLA_PAUSED,
      resource: 'ticket_sla_tracking',
      resourceId: updated.id,
      details: { ticketId, reason },
    });

    return updated;
  }

  async resumeTracking(
    ticketId: string,
    currentUser: CurrentUser,
    reason?: string,
  ) {
    const tracking = await this.prisma.ticketSlaTracking.findUnique({
      where: { ticketId },
      include: {
        ticket: {
          select: { id: true, code: true, title: true },
        },
      },
    });
    if (!tracking) {
      throw new NotFoundException('SLA tracking no encontrado');
    }
    if (!tracking.pausedAt) {
      return tracking;
    }

    const now = new Date();
    const pausedMs = now.getTime() - tracking.pausedAt.getTime();
    const pausedMinutes = Math.max(1, Math.round(pausedMs / 60_000));
    const shiftMs = pausedMinutes * 60_000;

    const updated = await this.prisma.ticketSlaTracking.update({
      where: { ticketId },
      data: {
        pausedAt: null,
        pausedAccumulatedMinutes:
          tracking.pausedAccumulatedMinutes + pausedMinutes,
        responseDeadlineAt: new Date(
          tracking.responseDeadlineAt.getTime() + shiftMs,
        ),
        resolutionDeadlineAt: new Date(
          tracking.resolutionDeadlineAt.getTime() + shiftMs,
        ),
        nextEscalationAt: tracking.nextEscalationAt
          ? new Date(tracking.nextEscalationAt.getTime() + shiftMs)
          : null,
        predictedBreachAt: tracking.predictedBreachAt
          ? new Date(tracking.predictedBreachAt.getTime() + shiftMs)
          : null,
      },
    });

    await this.prisma.ticketActivity.create({
      data: {
        ticketId: tracking.ticket.id,
        actorId: currentUser.sub,
        type: TicketActivityType.SLA_RESUMED,
        title: 'SLA reanudado',
        detail: reason ?? `Pausa acumulada: ${pausedMinutes} minutos`,
      },
    });

    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.SLA_RESUMED,
      resource: 'ticket_sla_tracking',
      resourceId: updated.id,
      details: { ticketId, pausedMinutes, reason },
    });

    return updated;
  }

  async getBreachPredictions(query: SlaPredictionQueryDto) {
    const windowHours = query.windowHours ?? 24;
    const now = new Date();
    const toDate = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

    const rows = await this.prisma.ticketSlaTracking.findMany({
      where: {
        resolvedAt: null,
        pausedAt: null,
        status: { in: [SlaStatus.ON_TRACK, SlaStatus.AT_RISK] },
        resolutionDeadlineAt: {
          gte: now,
          lte: toDate,
        },
      },
      include: {
        ticket: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            assignee: {
              select: { id: true, fullName: true, email: true },
            },
            supportGroup: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
      orderBy: { resolutionDeadlineAt: 'asc' },
      take: 200,
    });

    return {
      generatedAt: now.toISOString(),
      windowHours,
      data: rows.map((row) => {
        const remainingMs = row.resolutionDeadlineAt.getTime() - now.getTime();
        const remainingMinutes = Math.max(0, Math.round(remainingMs / 60_000));
        const riskScore = Math.max(
          0,
          Math.min(
            100,
            Math.round(100 - (remainingMinutes / (windowHours * 60)) * 100),
          ),
        );
        return {
          trackingId: row.id,
          ticket: row.ticket,
          status: row.status,
          resolutionDeadlineAt: row.resolutionDeadlineAt,
          predictedBreachAt: row.predictedBreachAt ?? row.resolutionDeadlineAt,
          riskScore,
          remainingMinutes,
        };
      }),
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
        slaPolicy: {
          include: {
            calendar: true,
          },
        },
        supportGroup: {
          select: {
            id: true,
            users: {
              select: { id: true },
            },
          },
        },
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
      const responseDeadlineAt = this.addMinutesConsideringCalendar(
        ticket.createdAt,
        policy.responseTimeMinutes,
        policy.businessHoursOnly,
        policy.calendar ?? null,
      );
      const resolutionDeadlineAt = this.addMinutesConsideringCalendar(
        ticket.createdAt,
        policy.resolutionTimeMinutes,
        policy.businessHoursOnly,
        policy.calendar ?? null,
      );

      const firstResponseAt =
        ticket.comments.find(
          (comment) =>
            comment.author.role === UserRole.ADMIN ||
            comment.author.role === UserRole.AGENT,
        )?.createdAt ?? null;

      const resolvedAt = ticket.resolvedAt ?? ticket.closedAt ?? null;
      const nextStatus = existingTracking?.pausedAt
        ? existingTracking.status
        : this.resolveSlaStatus({
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
      const nextEscalationAt =
        existingTracking?.pausedAt || nextStatus === SlaStatus.BREACHED
          ? null
          : new Date(now.getTime() + 15 * 60_000);
      const predictedBreachAt = resolvedAt
        ? null
        : firstResponseAt
          ? resolutionDeadlineAt
          : responseDeadlineAt;

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
          pausedAt: existingTracking?.pausedAt ?? null,
          pausedAccumulatedMinutes:
            existingTracking?.pausedAccumulatedMinutes ?? 0,
          nextEscalationAt,
          predictedBreachAt,
          status: nextStatus,
        },
        update: {
          slaPolicyId: policy.id,
          responseDeadlineAt,
          resolutionDeadlineAt,
          firstResponseAt,
          resolvedAt,
          breachedAt,
          pausedAt: existingTracking?.pausedAt ?? null,
          pausedAccumulatedMinutes:
            existingTracking?.pausedAccumulatedMinutes ?? 0,
          nextEscalationAt,
          predictedBreachAt,
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
        const adminIds = this.prisma.user
          ? await this.prisma.user.findMany({
              where: { role: UserRole.ADMIN, isActive: true },
              select: { id: true },
            })
          : [];
        const groupUserIds =
          ticket.supportGroup?.users.map((user) => user.id) ?? [];
        const notificationResult = await this.notificationsService.broadcast({
          actorUserId,
          recipientUserIds: [
            ticket.requesterId,
            ticket.assigneeId ?? '',
            ...adminIds.map((admin) => admin.id),
            ...groupUserIds,
          ],
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

  private addMinutesConsideringCalendar(
    startDate: Date,
    minutes: number,
    businessHoursOnly: boolean,
    calendar: {
      timezone: string;
      openWeekdays: number[] | null;
      startHour: number;
      endHour: number;
      holidays: Date[];
    } | null,
  ) {
    if (!businessHoursOnly || !calendar) {
      return new Date(startDate.getTime() + minutes * 60_000);
    }

    const holidays = new Set(
      (calendar.holidays ?? []).map((holiday) =>
        holiday.toISOString().slice(0, 10),
      ),
    );
    const openWeekdays = new Set(
      (calendar.openWeekdays ?? [1, 2, 3, 4, 5]).map((day) => Number(day)),
    );

    let cursor = new Date(startDate);
    let remaining = minutes;

    while (remaining > 0) {
      const weekday = cursor.getDay();
      const normalizedWeekday = weekday === 0 ? 7 : weekday;
      const dayKey = cursor.toISOString().slice(0, 10);
      const isOpenDay =
        openWeekdays.has(normalizedWeekday) && !holidays.has(dayKey);

      const dayStart = new Date(cursor);
      dayStart.setHours(calendar.startHour, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(calendar.endHour, 0, 0, 0);

      if (!isOpenDay || cursor >= dayEnd) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(calendar.startHour, 0, 0, 0);
        continue;
      }

      if (cursor < dayStart) {
        cursor = new Date(dayStart);
      }

      const availableMs = dayEnd.getTime() - cursor.getTime();
      const availableMinutes = Math.floor(availableMs / 60_000);
      if (availableMinutes <= 0) {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(calendar.startHour, 0, 0, 0);
        continue;
      }

      const consume = Math.min(remaining, availableMinutes);
      cursor = new Date(cursor.getTime() + consume * 60_000);
      remaining -= consume;
    }

    return cursor;
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
