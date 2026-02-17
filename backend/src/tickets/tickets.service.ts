import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  CommentType,
  NotificationType,
  Prisma,
  TicketActivityType,
  TicketApprovalStatus,
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
  TicketUrgency,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddTicketAttachmentDto } from './dto/add-ticket-attachment.dto';
import { ApplyTicketMacroDto } from './dto/apply-ticket-macro.dto';
import { CreateTicketApprovalDto } from './dto/create-ticket-approval.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { DecideTicketApprovalDto } from './dto/decide-ticket-approval.dto';
import { TicketListQueryDto, TicketSort } from './dto/ticket-list-query.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CurrentUser } from '../auth/types/current-user.type';

type TicketCountRow = {
  total: bigint | number | string;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly catalogService: CatalogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(currentUser: CurrentUser, query: TicketListQueryDto) {
    const pageSize = query.pageSize ?? 20;
    const requestedPage = query.page ?? 1;
    const text = query.text?.trim();

    if (query.searchMode === 'FTS' && text) {
      return this.findAllWithFullText(
        currentUser,
        query,
        text,
        pageSize,
        requestedPage,
      );
    }

    return this.findAllWithContains(
      currentUser,
      query,
      pageSize,
      requestedPage,
    );
  }

  private async findAllWithContains(
    currentUser: CurrentUser,
    query: TicketListQueryDto,
    pageSize: number,
    requestedPage: number,
  ) {
    const where = this.buildTicketListWhere(currentUser, query);
    const orderBy = this.buildTicketListOrderBy(query.sort);

    const total = await this.prisma.ticket.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const skip = (page - 1) * pageSize;

    const data = await this.prisma.ticket.findMany({
      where,
      include: {
        requester: true,
        assignee: true,
        supportGroup: true,
        catalogItem: {
          select: { id: true, key: true, name: true },
        },
        impactedService: {
          select: { id: true, code: true, name: true, isCritical: true },
        },
        slaPolicy: true,
      },
      orderBy,
      skip,
      take: pageSize,
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  private async findAllWithFullText(
    currentUser: CurrentUser,
    query: TicketListQueryDto,
    text: string,
    pageSize: number,
    requestedPage: number,
  ) {
    const whereSql = this.buildTicketListFtsWhere(currentUser, query, text);
    const orderBySql = this.buildFtsOrderBySql(query.sort);

    const countRows = await this.prisma.$queryRaw<TicketCountRow[]>(
      Prisma.sql`
        SELECT COUNT(*) AS "total"
        FROM "Ticket" t
        ${whereSql}
      `,
    );
    const total = this.parseCountValue(countRows[0]?.total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const skip = (page - 1) * pageSize;

    if (total === 0) {
      return {
        data: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    const idRows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT t."id"
        FROM "Ticket" t
        ${whereSql}
        ORDER BY ${orderBySql}
        OFFSET ${skip}
        LIMIT ${pageSize}
      `,
    );
    const ids = idRows.map((row) => row.id);

    if (ids.length === 0) {
      return {
        data: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        requester: true,
        assignee: true,
        supportGroup: true,
        catalogItem: {
          select: { id: true, key: true, name: true },
        },
        impactedService: {
          select: { id: true, code: true, name: true, isCritical: true },
        },
        slaPolicy: true,
      },
    });
    const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const data = ids.flatMap((id) => {
      const ticket = ticketsById.get(id);
      return ticket ? [ticket] : [];
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: true,
        assignee: true,
        supportGroup: true,
        catalogItem: {
          include: {
            fields: {
              orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        impactedService: {
          include: {
            ownerGroup: true,
          },
        },
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { changedBy: true },
          orderBy: { createdAt: 'asc' },
        },
        approvals: {
          include: { approver: true, requestedBy: true },
          orderBy: [{ sequence: 'asc' }, { requestedAt: 'asc' }],
        },
        activities: {
          include: { actor: true },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: { uploadedBy: true },
          orderBy: { createdAt: 'asc' },
        },
        slaPolicy: true,
        slaTracking: true,
        assets: {
          include: {
            asset: {
              include: {
                serviceLinks: {
                  include: {
                    service: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        isCritical: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} no existe`);
    }
    this.assertTicketAccess(ticket.requesterId, currentUser);

    return ticket;
  }

  async create(dto: CreateTicketDto, currentUser: CurrentUser) {
    const requesterEmail =
      currentUser.role === UserRole.REQUESTER
        ? currentUser.email
        : dto.requesterEmail;
    const requesterName =
      currentUser.role === UserRole.REQUESTER
        ? await this.resolveRequesterName(currentUser.sub, dto.requesterName)
        : dto.requesterName;

    const requester = await this.prisma.user.upsert({
      where: { email: requesterEmail },
      create: {
        email: requesterEmail,
        fullName: requesterName,
      },
      update: {
        fullName: requesterName,
      },
    });

    const assignee = dto.assigneeEmail
      ? await this.prisma.user.upsert({
          where: { email: dto.assigneeEmail },
          create: {
            email: dto.assigneeEmail,
            fullName: dto.assigneeEmail.split('@')[0],
          },
          update: {},
        })
      : null;

    const catalogResolution =
      await this.catalogService.resolveCatalogForTicketCreation(
        dto.catalogItemId,
        dto.catalogFormPayload,
        currentUser,
      );
    const initialStatus = catalogResolution?.requiresApproval
      ? TicketStatus.PENDING
      : TicketStatus.OPEN;
    const defaultSlaPolicyId = await this.resolveDefaultSlaPolicyId();

    const ticketCode = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const createdTicket = await tx.ticket.create({
        data: {
          code: ticketCode,
          title: dto.title,
          description: dto.description,
          type:
            dto.type ??
            catalogResolution?.catalogItem.ticketType ??
            TicketType.INCIDENT,
          priority:
            dto.priority ??
            catalogResolution?.catalogItem.defaultPriority ??
            TicketPriority.MEDIUM,
          impact: dto.impact ?? TicketImpact.MEDIUM,
          urgency: dto.urgency ?? TicketUrgency.MEDIUM,
          status: initialStatus,
          requesterId: requester.id,
          assigneeId: assignee?.id ?? null,
          supportGroupId: null,
          catalogItemId: catalogResolution?.catalogItem.id,
          catalogFormPayload: catalogResolution
            ? catalogResolution.normalizedPayload
            : undefined,
          impactedServiceId: dto.impactedServiceId,
          slaPolicyId: defaultSlaPolicyId,
        },
        include: {
          requester: true,
          assignee: true,
          supportGroup: true,
          catalogItem: true,
          impactedService: true,
          slaPolicy: true,
        },
      });

      await tx.ticketStatusHistory.create({
        data: {
          ticketId: createdTicket.id,
          fromStatus: null,
          toStatus: initialStatus,
          reason: 'Ticket creado',
          changedById: requester.id,
        },
      });

      await this.logTicketActivity(tx, {
        ticketId: createdTicket.id,
        actorId: requester.id,
        type: TicketActivityType.CREATED,
        title: 'Ticket creado',
        detail: `Se registro ${createdTicket.code}`,
      });

      if (catalogResolution?.requiresApproval) {
        const approver = await this.pickDefaultApprover(tx);
        await tx.ticketApproval.create({
          data: {
            ticketId: createdTicket.id,
            requestedById: requester.id,
            approverId: approver?.id,
            type: catalogResolution.approvalType,
            status: TicketApprovalStatus.PENDING,
            decisionNote: 'Creada automaticamente por catalogo',
          },
        });
        await this.logTicketActivity(tx, {
          ticketId: createdTicket.id,
          actorId: requester.id,
          type: TicketActivityType.APPROVAL_REQUESTED,
          title: 'Aprobacion requerida',
          detail: `Tipo ${catalogResolution.approvalType}`,
        });
      }

      await this.applyWorkflowRules(tx, {
        actorUserId: currentUser.sub,
        ticketId: createdTicket.id,
        triggerStatus: createdTicket.status,
      });

      return createdTicket;
    });
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    currentUser: CurrentUser,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const currentTicket = await this.findOne(id, currentUser);

    let assigneeId: string | null | undefined = undefined;
    if (dto.assigneeEmail !== undefined) {
      if (!dto.assigneeEmail) {
        assigneeId = null;
      } else {
        const assignee = await this.prisma.user.upsert({
          where: { email: dto.assigneeEmail },
          create: {
            email: dto.assigneeEmail,
            fullName: dto.assigneeEmail.split('@')[0],
          },
          update: {},
        });
        assigneeId = assignee.id;
      }
    }

    const nextStatus = dto.status ?? currentTicket.status;
    const data: Prisma.TicketUpdateInput = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      type: dto.type,
      impact: dto.impact,
      urgency: dto.urgency,
      status: dto.status,
      supportGroup:
        dto.supportGroupId !== undefined
          ? dto.supportGroupId
            ? { connect: { id: dto.supportGroupId } }
            : { disconnect: true }
          : undefined,
      slaPolicy:
        dto.slaPolicyId !== undefined
          ? dto.slaPolicyId
            ? { connect: { id: dto.slaPolicyId } }
            : { disconnect: true }
          : undefined,
      impactedService:
        dto.impactedServiceId !== undefined
          ? dto.impactedServiceId
            ? { connect: { id: dto.impactedServiceId } }
            : { disconnect: true }
          : undefined,
      catalogFormPayload:
        dto.catalogFormPayload !== undefined
          ? (dto.catalogFormPayload as Prisma.InputJsonValue)
          : undefined,
      resolvedAt: nextStatus === TicketStatus.RESOLVED ? new Date() : undefined,
      closedAt: nextStatus === TicketStatus.CLOSED ? new Date() : undefined,
      ...(assigneeId !== undefined && {
        assignee: assigneeId
          ? { connect: { id: assigneeId } }
          : { disconnect: true },
      }),
    };

    return this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id },
        data,
        include: {
          requester: true,
          assignee: true,
          supportGroup: true,
          catalogItem: true,
          impactedService: true,
          slaPolicy: true,
        },
      });

      if (dto.status && dto.status !== currentTicket.status) {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId: id,
            fromStatus: currentTicket.status,
            toStatus: dto.status,
            reason: dto.statusReason ?? 'Cambio de estado',
            changedById: currentUser.sub,
          },
        });

        await this.logTicketActivity(tx, {
          ticketId: id,
          actorId: currentUser.sub,
          type: TicketActivityType.STATUS_CHANGED,
          title: `${currentTicket.status} -> ${dto.status}`,
          detail: dto.statusReason,
        });
      }

      if (dto.priority && dto.priority !== currentTicket.priority) {
        await this.logTicketActivity(tx, {
          ticketId: id,
          actorId: currentUser.sub,
          type: TicketActivityType.PRIORITY_CHANGED,
          title: `${currentTicket.priority} -> ${dto.priority}`,
          detail: 'Prioridad actualizada',
        });
      }

      const changedFields = Object.keys(dto);
      if (changedFields.length > 0) {
        await this.logTicketActivity(tx, {
          ticketId: id,
          actorId: currentUser.sub,
          type: TicketActivityType.UPDATED,
          title: 'Ticket actualizado',
          detail: `Campos: ${changedFields.join(', ')}`,
          metadata: { changedFields },
        });
      }

      await this.applyWorkflowRules(tx, {
        actorUserId: currentUser.sub,
        ticketId: id,
        triggerStatus: dto.status,
      });

      await this.auditService.log({
        actorUserId: currentUser.sub,
        action: AuditAction.TICKET_UPDATED,
        resource: 'ticket',
        resourceId: id,
        details: {
          fromStatus: currentTicket.status,
          toStatus: dto.status ?? currentTicket.status,
          changedFields,
        },
        metadata: this.getMetadata(request),
      });

      return updatedTicket;
    });
  }

  async remove(
    id: string,
    currentUser: CurrentUser,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const ticket = await this.findOne(id, currentUser);
    await this.prisma.ticket.delete({ where: { id } });
    await this.auditService.log({
      actorUserId: currentUser.sub,
      action: AuditAction.TICKET_DELETED,
      resource: 'ticket',
      resourceId: id,
      details: { code: ticket.code, status: ticket.status },
      metadata: this.getMetadata(request),
    });
    return { success: true };
  }

  async findComments(ticketId: string, currentUser: CurrentUser) {
    await this.findOne(ticketId, currentUser);

    return this.prisma.ticketComment.findMany({
      where: { ticketId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(
    ticketId: string,
    dto: CreateTicketCommentDto,
    currentUser: CurrentUser,
  ) {
    await this.findOne(ticketId, currentUser);

    if (
      currentUser.role === 'REQUESTER' &&
      dto.type &&
      dto.type !== CommentType.PUBLIC_NOTE
    ) {
      throw new ForbiddenException(
        'No tienes permisos para ese tipo de comentario',
      );
    }

    const author = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });
    if (!author) {
      throw new ForbiddenException('Usuario no valido para comentar');
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.ticketComment.create({
        data: {
          ticketId,
          authorId: author.id,
          body: dto.body,
          type:
            currentUser.role === 'REQUESTER'
              ? CommentType.PUBLIC_NOTE
              : (dto.type ?? CommentType.PUBLIC_NOTE),
        },
        include: {
          author: true,
        },
      });

      await this.logTicketActivity(tx, {
        ticketId,
        actorId: currentUser.sub,
        type: TicketActivityType.COMMENTED,
        title: `Comentario ${comment.type}`,
        detail: dto.body,
      });

      return comment;
    });
  }

  async findStatusHistory(ticketId: string, currentUser: CurrentUser) {
    await this.findOne(ticketId, currentUser);

    return this.prisma.ticketStatusHistory.findMany({
      where: { ticketId },
      include: { changedBy: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findWorkspace(ticketId: string, currentUser: CurrentUser) {
    const ticket = await this.findOne(ticketId, currentUser);

    const timeline = [
      ...ticket.statusHistory.map((entry) => ({
        id: `status:${entry.id}`,
        occurredAt: entry.createdAt,
        type: 'STATUS_HISTORY',
        title: `${entry.fromStatus ?? 'N/A'} -> ${entry.toStatus}`,
        detail: entry.reason,
        actor: entry.changedBy,
      })),
      ...ticket.comments.map((comment) => ({
        id: `comment:${comment.id}`,
        occurredAt: comment.createdAt,
        type: 'COMMENT',
        title: `${comment.type}`,
        detail: comment.body,
        actor: comment.author,
      })),
      ...ticket.activities.map((activity) => ({
        id: `activity:${activity.id}`,
        occurredAt: activity.createdAt,
        type: 'ACTIVITY',
        title: activity.title,
        detail: activity.detail,
        actor: activity.actor,
      })),
      ...ticket.attachments.map((attachment) => ({
        id: `attachment:${attachment.id}`,
        occurredAt: attachment.createdAt,
        type: 'ATTACHMENT',
        title: `Adjunto: ${attachment.fileName}`,
        detail: attachment.storageUrl,
        actor: attachment.uploadedBy,
      })),
      ...ticket.approvals.map((approval) => ({
        id: `approval:${approval.id}`,
        occurredAt: approval.decidedAt ?? approval.requestedAt,
        type: 'APPROVAL',
        title: `${approval.type}: ${approval.status}`,
        detail: approval.decisionNote,
        actor: approval.approver ?? approval.requestedBy,
      })),
    ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    return {
      ticket,
      timeline,
      comments: ticket.comments,
      history: ticket.statusHistory,
      activities: ticket.activities,
      approvals: ticket.approvals,
      attachments: ticket.attachments,
    };
  }

  async addAttachment(
    ticketId: string,
    dto: AddTicketAttachmentDto,
    currentUser: CurrentUser,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    await this.findOne(ticketId, currentUser);

    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.ticketAttachment.create({
        data: {
          ticketId,
          uploadedById: currentUser.sub,
          fileName: dto.fileName,
          storageUrl: dto.storageUrl,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
        },
        include: { uploadedBy: true },
      });

      await this.logTicketActivity(tx, {
        ticketId,
        actorId: currentUser.sub,
        type: TicketActivityType.ATTACHMENT_ADDED,
        title: `Adjunto agregado: ${dto.fileName}`,
        detail: dto.storageUrl,
      });

      await this.auditService.log({
        actorUserId: currentUser.sub,
        action: AuditAction.TICKET_ATTACHMENT_ADDED,
        resource: 'ticket_attachment',
        resourceId: attachment.id,
        details: {
          ticketId,
          fileName: dto.fileName,
        },
        metadata: this.getMetadata(request),
      });

      return attachment;
    });
  }

  listMacros(currentUser: CurrentUser) {
    return this.prisma.ticketMacro.findMany({
      where: {
        isActive: true,
        OR: [
          { availableForRole: null },
          { availableForRole: currentUser.role },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async applyMacro(
    ticketId: string,
    macroId: string,
    dto: ApplyTicketMacroDto,
    currentUser: CurrentUser,
  ) {
    if (currentUser.role === UserRole.REQUESTER) {
      throw new ForbiddenException('No autorizado para macros operativas');
    }

    const macro = await this.prisma.ticketMacro.findUnique({
      where: { id: macroId },
    });
    if (!macro || !macro.isActive) {
      throw new NotFoundException('Macro no encontrada');
    }

    const currentTicket = await this.findOne(ticketId, currentUser);
    if (!macro.setStatus && !macro.setPriority && !macro.addCommentBody) {
      throw new BadRequestException('Macro sin acciones configuradas');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: macro.setStatus ?? undefined,
          priority: macro.setPriority ?? undefined,
          resolvedAt:
            macro.setStatus === TicketStatus.RESOLVED ? new Date() : undefined,
          closedAt:
            macro.setStatus === TicketStatus.CLOSED ? new Date() : undefined,
        },
        include: {
          requester: true,
          assignee: true,
          supportGroup: true,
          catalogItem: true,
          impactedService: true,
          slaPolicy: true,
        },
      });

      if (macro.setStatus && macro.setStatus !== currentTicket.status) {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: currentTicket.status,
            toStatus: macro.setStatus,
            reason: dto.reason ?? `Macro aplicada: ${macro.name}`,
            changedById: currentUser.sub,
          },
        });
      }

      if (macro.addCommentBody) {
        await tx.ticketComment.create({
          data: {
            ticketId,
            authorId: currentUser.sub,
            body: macro.addCommentBody,
            type: CommentType.WORKLOG,
          },
        });
      }

      await this.logTicketActivity(tx, {
        ticketId,
        actorId: currentUser.sub,
        type: TicketActivityType.MACRO_APPLIED,
        title: `Macro aplicada: ${macro.name}`,
        detail: dto.reason,
      });

      return updatedTicket;
    });
  }

  async createApproval(
    ticketId: string,
    dto: CreateTicketApprovalDto,
    currentUser: CurrentUser,
  ) {
    await this.findOne(ticketId, currentUser);

    return this.prisma.$transaction(async (tx) => {
      const approval = await tx.ticketApproval.create({
        data: {
          ticketId,
          requestedById: currentUser.sub,
          approverId: dto.approverId,
          type: dto.type,
          status: TicketApprovalStatus.PENDING,
          decisionNote: dto.note,
        },
        include: {
          approver: true,
          requestedBy: true,
        },
      });

      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.PENDING },
      });

      await this.logTicketActivity(tx, {
        ticketId,
        actorId: currentUser.sub,
        type: TicketActivityType.APPROVAL_REQUESTED,
        title: `Aprobacion solicitada (${dto.type})`,
        detail: dto.note,
      });

      return approval;
    });
  }

  async decideApproval(
    ticketId: string,
    approvalId: string,
    dto: DecideTicketApprovalDto,
    currentUser: CurrentUser,
  ) {
    if (
      dto.decision !== TicketApprovalStatus.APPROVED &&
      dto.decision !== TicketApprovalStatus.REJECTED
    ) {
      throw new BadRequestException('Decision invalida para aprobacion');
    }

    await this.findOne(ticketId, currentUser);
    const approval = await this.prisma.ticketApproval.findUnique({
      where: { id: approvalId },
      include: { ticket: true },
    });
    if (!approval || approval.ticketId !== ticketId) {
      throw new NotFoundException('Aprobacion no encontrada');
    }

    if (
      currentUser.role !== UserRole.ADMIN &&
      approval.approverId &&
      approval.approverId !== currentUser.sub
    ) {
      throw new ForbiddenException('Solo el aprobador asignado puede decidir');
    }

    return this.prisma.$transaction(async (tx) => {
      const decided = await tx.ticketApproval.update({
        where: { id: approvalId },
        data: {
          status: dto.decision,
          decidedAt: new Date(),
          decisionNote: dto.note,
          approverId: approval.approverId ?? currentUser.sub,
        },
        include: {
          approver: true,
          requestedBy: true,
        },
      });

      const pendingCount = await tx.ticketApproval.count({
        where: {
          ticketId,
          status: TicketApprovalStatus.PENDING,
        },
      });

      const currentTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: {
          status: true,
          requesterId: true,
          assigneeId: true,
          code: true,
          title: true,
        },
      });
      if (!currentTicket) {
        throw new NotFoundException('Ticket no encontrado');
      }

      let nextStatus: TicketStatus | null = null;
      if (dto.decision === TicketApprovalStatus.REJECTED) {
        nextStatus = TicketStatus.CANCELLED;
      } else if (
        dto.decision === TicketApprovalStatus.APPROVED &&
        pendingCount === 0 &&
        currentTicket.status === TicketStatus.PENDING
      ) {
        nextStatus = TicketStatus.OPEN;
      }

      if (nextStatus && nextStatus !== currentTicket.status) {
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: nextStatus,
            closedAt: nextStatus === TicketStatus.CANCELLED ? new Date() : null,
          },
        });
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: currentTicket.status,
            toStatus: nextStatus,
            reason:
              dto.decision === TicketApprovalStatus.REJECTED
                ? 'Solicitud rechazada en aprobacion'
                : 'Aprobaciones completadas',
            changedById: currentUser.sub,
          },
        });
      }

      await this.logTicketActivity(tx, {
        ticketId,
        actorId: currentUser.sub,
        type: TicketActivityType.APPROVAL_DECIDED,
        title: `Aprobacion ${dto.decision}`,
        detail: dto.note,
      });

      await this.auditService.log({
        actorUserId: currentUser.sub,
        action: AuditAction.TICKET_APPROVAL_DECIDED,
        resource: 'ticket_approval',
        resourceId: approvalId,
        details: {
          ticketId,
          decision: dto.decision,
          pendingApprovals: pendingCount,
        },
      });

      await this.notificationsService.broadcast({
        actorUserId: currentUser.sub,
        recipientUserIds: [
          currentTicket.requesterId,
          currentTicket.assigneeId ?? '',
        ],
        type: NotificationType.SYSTEM,
        title: `Aprobacion ${dto.decision}: ${currentTicket.code}`,
        body: `La aprobacion del ticket ${currentTicket.code} fue marcada como ${dto.decision}.`,
        resource: 'ticket_approval',
        resourceId: approvalId,
      });

      return decided;
    });
  }

  private async applyWorkflowRules(
    tx: Prisma.TransactionClient,
    input: {
      actorUserId: string;
      ticketId: string;
      triggerStatus?: TicketStatus;
    },
  ) {
    const ticket = await tx.ticket.findUnique({
      where: { id: input.ticketId },
      include: {
        requester: true,
        assignee: true,
      },
    });
    if (!ticket) {
      return;
    }

    const rules = await tx.workflowRule.findMany({
      where: {
        isActive: true,
        OR: [{ catalogItemId: null }, { catalogItemId: ticket.catalogItemId }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const matchedRules = rules.filter((rule) => {
      if (rule.priorityEquals && rule.priorityEquals !== ticket.priority) {
        return false;
      }
      if (rule.typeEquals && rule.typeEquals !== ticket.type) {
        return false;
      }
      if (
        rule.onStatus &&
        rule.onStatus !== (input.triggerStatus ?? ticket.status)
      ) {
        return false;
      }
      return true;
    });
    if (matchedRules.length === 0) {
      return;
    }

    for (const rule of matchedRules) {
      const updateData: Prisma.TicketUpdateInput = {};
      const changedFields: string[] = [];

      if (
        rule.actionSetPriority &&
        rule.actionSetPriority !== ticket.priority
      ) {
        updateData.priority = rule.actionSetPriority;
        changedFields.push('priority');
      }

      if (
        rule.actionAssignUserId &&
        rule.actionAssignUserId !== ticket.assigneeId
      ) {
        updateData.assignee = { connect: { id: rule.actionAssignUserId } };
        changedFields.push('assigneeId');
      }

      if (
        rule.actionAssignGroupId &&
        rule.actionAssignGroupId !== ticket.supportGroupId
      ) {
        updateData.supportGroup = { connect: { id: rule.actionAssignGroupId } };
        changedFields.push('supportGroupId');
      }

      if (
        rule.actionSetSlaPolicyId &&
        rule.actionSetSlaPolicyId !== ticket.slaPolicyId
      ) {
        updateData.slaPolicy = { connect: { id: rule.actionSetSlaPolicyId } };
        changedFields.push('slaPolicyId');
      }

      if (Object.keys(updateData).length > 0) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: updateData,
        });
      }

      if (rule.actionAddComment) {
        await tx.ticketComment.create({
          data: {
            ticketId: ticket.id,
            authorId: input.actorUserId,
            body: rule.actionAddComment,
            type: CommentType.WORKLOG,
          },
        });
      }

      await this.logTicketActivity(tx, {
        ticketId: ticket.id,
        actorId: input.actorUserId,
        type: TicketActivityType.WORKFLOW_APPLIED,
        title: `Workflow aplicado: ${rule.name}`,
        detail:
          changedFields.length > 0
            ? `Campos actualizados: ${changedFields.join(', ')}`
            : 'Regla evaluada',
        metadata: { ruleId: rule.id, changedFields },
      });

      if (rule.actionNotifyAdmins) {
        const admins = await tx.user.findMany({
          where: { role: UserRole.ADMIN, isActive: true },
          select: { id: true },
        });
        await this.notificationsService.broadcast({
          actorUserId: input.actorUserId,
          recipientUserIds: admins.map((admin) => admin.id),
          type: NotificationType.SYSTEM,
          title: `Workflow ${rule.name} aplicado`,
          body: `El ticket ${ticket.code} recibio acciones automaticas.`,
          resource: 'ticket',
          resourceId: ticket.id,
        });
      }

      if (rule.actionNotifyAssignee && ticket.assigneeId) {
        await this.notificationsService.broadcast({
          actorUserId: input.actorUserId,
          recipientUserIds: [ticket.assigneeId],
          type: NotificationType.SYSTEM,
          title: `Asignacion automatica ${ticket.code}`,
          body: `Se aplico la regla ${rule.name} a tu ticket asignado.`,
          resource: 'ticket',
          resourceId: ticket.id,
        });
      }

      await this.auditService.log({
        actorUserId: input.actorUserId,
        action: AuditAction.WORKFLOW_RULE_APPLIED,
        resource: 'workflow_rule',
        resourceId: rule.id,
        details: {
          ticketId: ticket.id,
          changedFields,
        },
      });
    }
  }

  private async logTicketActivity(
    tx: Prisma.TransactionClient,
    input: {
      ticketId: string;
      actorId?: string | null;
      type: TicketActivityType;
      title: string;
      detail?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.ticketActivity.create({
      data: {
        ticketId: input.ticketId,
        actorId: input.actorId,
        type: input.type,
        title: input.title,
        detail: input.detail,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  private async resolveDefaultSlaPolicyId() {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return policy?.id;
  }

  private async pickDefaultApprover(tx: Prisma.TransactionClient) {
    return tx.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async resolveRequesterName(requesterId: string, fallback: string) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { fullName: true },
    });
    return requester?.fullName ?? fallback;
  }

  private getMetadata(request?: {
    ip?: string;
    headers?: Record<string, unknown>;
  }) {
    const rawUserAgent = request?.headers?.['user-agent'];
    return {
      ipAddress: request?.ip,
      userAgent: typeof rawUserAgent === 'string' ? rawUserAgent : undefined,
    };
  }

  private assertTicketAccess(
    ticketRequesterId: string,
    currentUser: CurrentUser,
  ) {
    if (
      currentUser.role === 'REQUESTER' &&
      ticketRequesterId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a este ticket',
      );
    }
  }

  private buildTicketListWhere(
    currentUser: CurrentUser,
    query: TicketListQueryDto,
  ): Prisma.TicketWhereInput {
    const filters: Prisma.TicketWhereInput[] = [];

    if (currentUser.role === 'REQUESTER') {
      filters.push({ requesterId: currentUser.sub });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    if (query.priority) {
      filters.push({ priority: query.priority });
    }

    const fromDate = this.parseDate(query.from);
    const toDate = this.parseDate(query.to);
    if (fromDate || toDate) {
      filters.push({
        createdAt: {
          ...(fromDate ? { gte: this.atDayStart(fromDate) } : {}),
          ...(toDate ? { lte: this.atDayEnd(toDate) } : {}),
        },
      });
    }

    const text = query.text?.trim();
    if (text) {
      filters.push({
        OR: [
          { code: { contains: text, mode: 'insensitive' } },
          { title: { contains: text, mode: 'insensitive' } },
          { description: { contains: text, mode: 'insensitive' } },
          { requester: { fullName: { contains: text, mode: 'insensitive' } } },
          { requester: { email: { contains: text, mode: 'insensitive' } } },
          { assignee: { fullName: { contains: text, mode: 'insensitive' } } },
          { assignee: { email: { contains: text, mode: 'insensitive' } } },
          { supportGroup: { name: { contains: text, mode: 'insensitive' } } },
          { catalogItem: { name: { contains: text, mode: 'insensitive' } } },
          {
            impactedService: { name: { contains: text, mode: 'insensitive' } },
          },
        ],
      });
    }

    if (filters.length === 0) {
      return {};
    }

    return { AND: filters };
  }

  private buildTicketListFtsWhere(
    currentUser: CurrentUser,
    query: TicketListQueryDto,
    text: string,
  ): Prisma.Sql {
    const clauses: Prisma.Sql[] = [];

    if (currentUser.role === 'REQUESTER') {
      clauses.push(Prisma.sql`t."requesterId" = ${currentUser.sub}`);
    }

    if (query.status) {
      clauses.push(Prisma.sql`t."status" = ${query.status}::"TicketStatus"`);
    }

    if (query.priority) {
      clauses.push(
        Prisma.sql`t."priority" = ${query.priority}::"TicketPriority"`,
      );
    }

    const fromDate = this.parseDate(query.from);
    const toDate = this.parseDate(query.to);
    if (fromDate) {
      clauses.push(Prisma.sql`t."createdAt" >= ${this.atDayStart(fromDate)}`);
    }
    if (toDate) {
      clauses.push(Prisma.sql`t."createdAt" <= ${this.atDayEnd(toDate)}`);
    }

    clauses.push(Prisma.sql`
      (
        to_tsvector(
          'spanish',
          coalesce(t."code", '') || ' ' || coalesce(t."title", '') || ' ' || coalesce(t."description", '')
        ) @@ websearch_to_tsquery('spanish', ${text})
        OR EXISTS (
          SELECT 1
          FROM "User" requester
          WHERE requester."id" = t."requesterId"
            AND to_tsvector(
              'spanish',
              coalesce(requester."fullName", '') || ' ' || coalesce(requester."email", '')
            ) @@ websearch_to_tsquery('spanish', ${text})
        )
        OR EXISTS (
          SELECT 1
          FROM "User" assignee
          WHERE assignee."id" = t."assigneeId"
            AND to_tsvector(
              'spanish',
              coalesce(assignee."fullName", '') || ' ' || coalesce(assignee."email", '')
            ) @@ websearch_to_tsquery('spanish', ${text})
        )
      )
    `);

    if (clauses.length === 0) {
      return Prisma.sql``;
    }

    return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
  }

  private buildTicketListOrderBy(
    sort?: TicketSort,
  ): Prisma.TicketOrderByWithRelationInput[] {
    switch (sort) {
      case 'CREATED_ASC':
        return [{ createdAt: 'asc' }];
      case 'PRIORITY_DESC':
        return [{ priority: 'desc' }, { createdAt: 'desc' }];
      case 'PRIORITY_ASC':
        return [{ priority: 'asc' }, { createdAt: 'desc' }];
      case 'CREATED_DESC':
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private buildFtsOrderBySql(sort?: TicketSort): Prisma.Sql {
    switch (sort) {
      case 'CREATED_ASC':
        return Prisma.sql`t."createdAt" ASC`;
      case 'PRIORITY_DESC':
        return Prisma.sql`t."priority" DESC, t."createdAt" DESC`;
      case 'PRIORITY_ASC':
        return Prisma.sql`t."priority" ASC, t."createdAt" DESC`;
      case 'CREATED_DESC':
      default:
        return Prisma.sql`t."createdAt" DESC`;
    }
  }

  private parseCountValue(
    value: bigint | number | string | null | undefined,
  ): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private atDayStart(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private atDayEnd(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }
}
