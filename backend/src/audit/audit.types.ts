import { AuditAction, Prisma } from '@prisma/client';

export type AuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type CreateAuditLogInput = {
  actorUserId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string | null;
  success?: boolean;
  details?: Prisma.InputJsonValue;
  metadata?: AuditMetadata;
};
