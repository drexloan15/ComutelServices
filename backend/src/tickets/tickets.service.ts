import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { changedBy: true },
          orderBy: { createdAt: 'asc' },
        },
        slaPolicy: true,
        slaTracking: true,
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
