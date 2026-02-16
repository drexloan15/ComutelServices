import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CommentType,
  Prisma,
  TicketImpact,
  TicketPriority,
  TicketStatus,
  TicketType,
  TicketUrgency,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CurrentUser } from '../auth/types/current-user.type';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(currentUser: CurrentUser) {
    return this.prisma.ticket.findMany({
      where:
        currentUser.role === 'REQUESTER'
          ? { requesterId: currentUser.sub }
          : undefined,
      include: {
        requester: true,
        assignee: true,
        slaPolicy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        requester: true,
        assignee: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { changedBy: true },
          orderBy: { createdAt: 'asc' },
        },
        slaPolicy: true,
        assets: {
          include: {
            asset: true,
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

  async create(dto: CreateTicketDto) {
    const requester = await this.prisma.user.upsert({
      where: { email: dto.requesterEmail },
      create: {
        email: dto.requesterEmail,
        fullName: dto.requesterName,
      },
      update: {
        fullName: dto.requesterName,
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

    const ticketCode = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const createdTicket = await tx.ticket.create({
        data: {
          code: ticketCode,
          title: dto.title,
          description: dto.description,
          type: dto.type ?? TicketType.INCIDENT,
          priority: dto.priority ?? TicketPriority.MEDIUM,
          impact: dto.impact ?? TicketImpact.MEDIUM,
          urgency: dto.urgency ?? TicketUrgency.MEDIUM,
          status: TicketStatus.OPEN,
          requesterId: requester.id,
          assigneeId: assignee?.id ?? null,
        },
        include: {
          requester: true,
          assignee: true,
          slaPolicy: true,
        },
      });

      await tx.ticketStatusHistory.create({
        data: {
          ticketId: createdTicket.id,
          fromStatus: null,
          toStatus: TicketStatus.OPEN,
          reason: 'Ticket creado',
          changedById: requester.id,
        },
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
      resolvedAt: nextStatus === TicketStatus.RESOLVED ? new Date() : undefined,
      closedAt: nextStatus === TicketStatus.CLOSED ? new Date() : undefined,
      ...(assigneeId !== undefined && { assignee: assigneeId ? { connect: { id: assigneeId } } : { disconnect: true } }),
    };

    return this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.ticket.update({
        where: { id },
        data,
        include: {
          requester: true,
          assignee: true,
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
      }

      await this.auditService.log({
        actorUserId: currentUser.sub,
        action: AuditAction.TICKET_UPDATED,
        resource: 'ticket',
        resourceId: id,
        details: {
          fromStatus: currentTicket.status,
          toStatus: dto.status ?? currentTicket.status,
          changedFields: Object.keys(dto),
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

  async addComment(ticketId: string, dto: CreateTicketCommentDto, currentUser: CurrentUser) {
    await this.findOne(ticketId, currentUser);

    if (currentUser.role === 'REQUESTER' && dto.type && dto.type !== CommentType.PUBLIC_NOTE) {
      throw new ForbiddenException('No tienes permisos para ese tipo de comentario');
    }

    const author = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
    });
    if (!author) {
      throw new ForbiddenException('Usuario no valido para comentar');
    }

    return this.prisma.ticketComment.create({
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
  }

  async findStatusHistory(ticketId: string, currentUser: CurrentUser) {
    await this.findOne(ticketId, currentUser);

    return this.prisma.ticketStatusHistory.findMany({
      where: { ticketId },
      include: { changedBy: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private getMetadata(request?: { ip?: string; headers?: Record<string, unknown> }) {
    const rawUserAgent = request?.headers?.['user-agent'];
    return {
      ipAddress: request?.ip,
      userAgent: typeof rawUserAgent === 'string' ? rawUserAgent : undefined,
    };
  }

  private assertTicketAccess(ticketRequesterId: string, currentUser: CurrentUser) {
    if (currentUser.role === 'REQUESTER' && ticketRequesterId !== currentUser.sub) {
      throw new ForbiddenException('No tienes permisos para acceder a este ticket');
    }
  }
}
