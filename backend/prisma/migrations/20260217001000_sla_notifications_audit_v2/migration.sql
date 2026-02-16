-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SLA_AT_RISK', 'SLA_BREACHED', 'SLA_MET', 'SYSTEM');

-- AlterEnum (idempotent-safe for reruns in dev)
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'SLA_ENGINE_RUN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'SLA_STATUS_CHANGED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_CREATED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_READ';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'NOTIFICATION_READ_ALL';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_isRead_createdAt_idx" ON "Notification"("recipientUserId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "TicketSlaTracking_responseDeadlineAt_idx" ON "TicketSlaTracking"("responseDeadlineAt");

-- CreateIndex
CREATE INDEX "TicketSlaTracking_resolutionDeadlineAt_idx" ON "TicketSlaTracking"("resolutionDeadlineAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
