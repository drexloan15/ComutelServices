import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogInput } from './audit.types';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        success: input.success ?? true,
        details: input.details,
        ipAddress: input.metadata?.ipAddress,
        userAgent: input.metadata?.userAgent,
      },
    });
  }

  async findMany(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const sort = query.sort ?? 'desc';
    const skip = (page - 1) * pageSize;

    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: sort },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNextPage: skip + rows.length < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async exportCsv(query: AuditLogQueryDto) {
    const where = this.buildWhere(query);
    const sort = query.sort ?? 'desc';
    const rows = await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: sort },
    });

    return this.toCsv(rows);
  }

  private buildWhere(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;

    return {
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.success !== undefined ? { success: query.success } : {}),
      ...((fromDate || toDate)
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(query.actor
        ? {
            OR: [
              { actorUserId: query.actor },
              { actor: { is: { email: { contains: query.actor, mode: 'insensitive' } } } },
              { actor: { is: { fullName: { contains: query.actor, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
  }

  private toCsv(
    rows: Array<{
      id: string;
      action: string;
      resource: string;
      resourceId: string | null;
      success: boolean;
      details: Prisma.JsonValue | null;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: Date;
      actor: { id: string; email: string; fullName: string; role: string } | null;
    }>,
  ) {
    const headers = [
      'id',
      'createdAt',
      'action',
      'resource',
      'resourceId',
      'success',
      'actorId',
      'actorEmail',
      'actorFullName',
      'actorRole',
      'ipAddress',
      'userAgent',
      'details',
    ];

    const lines = rows.map((row) =>
      [
        row.id,
        row.createdAt.toISOString(),
        row.action,
        row.resource,
        row.resourceId ?? '',
        String(row.success),
        row.actor?.id ?? '',
        row.actor?.email ?? '',
        row.actor?.fullName ?? '',
        row.actor?.role ?? '',
        row.ipAddress ?? '',
        row.userAgent ?? '',
        row.details ? JSON.stringify(row.details) : '',
      ]
        .map((value) => this.csvCell(value))
        .join(','),
    );

    return [headers.join(','), ...lines].join('\n');
  }

  private csvCell(value: string) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
