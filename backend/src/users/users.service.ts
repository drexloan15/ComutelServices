import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        department: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        department: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} no existe`);
    }

    return user;
  }

  async updateRole(
    id: string,
    role: UserRole,
    actorUserId: string,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const before = await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
    await this.auditService.log({
      actorUserId,
      action: AuditAction.USER_ROLE_CHANGED,
      resource: 'user',
      resourceId: id,
      details: {
        fromRole: before.role,
        toRole: role,
      },
      metadata: this.getMetadata(request),
    });
    return updated;
  }

  async updateStatus(
    id: string,
    isActive: boolean,
    actorUserId: string,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    const before = await this.findOne(id);
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
    await this.auditService.log({
      actorUserId,
      action: AuditAction.USER_STATUS_CHANGED,
      resource: 'user',
      resourceId: id,
      details: {
        fromIsActive: before.isActive,
        toIsActive: isActive,
      },
      metadata: this.getMetadata(request),
    });
    return updated;
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
}
