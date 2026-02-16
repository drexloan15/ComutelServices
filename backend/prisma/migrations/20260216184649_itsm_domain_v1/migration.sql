-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT', 'REQUESTER');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('INCIDENT', 'SERVICE_REQUEST', 'PROBLEM', 'CHANGE', 'TASK');

-- CreateEnum
CREATE TYPE "TicketImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('PUBLIC_NOTE', 'INTERNAL_NOTE', 'WORKLOG');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('HARDWARE', 'SOFTWARE', 'SERVICE', 'NETWORK', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('IN_USE', 'AVAILABLE', 'MAINTENANCE', 'RETIRED', 'LOST');

-- CreateEnum
CREATE TYPE "AssetLinkType" AS ENUM ('AFFECTED', 'RELATED', 'ROOT_CAUSE');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'BREACHED', 'MET');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "impact" "TicketImpact" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "slaPolicyId" TEXT,
ADD COLUMN     "type" "TicketType" NOT NULL DEFAULT 'INCIDENT',
ADD COLUMN     "urgency" "TicketUrgency" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "department" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'REQUESTER';

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "CommentType" NOT NULL DEFAULT 'PUBLIC_NOTE',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssetType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_USE',
    "serialNumber" TEXT,
    "vendor" TEXT,
    "modelName" TEXT,
    "location" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAsset" (
    "ticketId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "linkedById" TEXT,
    "linkType" "AssetLinkType" NOT NULL DEFAULT 'AFFECTED',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAsset_pkey" PRIMARY KEY ("ticketId","assetId")
);

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "responseTimeMinutes" INTEGER NOT NULL,
    "resolutionTimeMinutes" INTEGER NOT NULL,
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSlaTracking" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "slaPolicyId" TEXT NOT NULL,
    "responseDeadlineAt" TIMESTAMP(3) NOT NULL,
    "resolutionDeadlineAt" TIMESTAMP(3) NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "breachedAt" TIMESTAMP(3),
    "status" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSlaTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketStatusHistory_ticketId_createdAt_idx" ON "TicketStatusHistory"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE INDEX "Asset_status_type_idx" ON "Asset"("status", "type");

-- CreateIndex
CREATE INDEX "TicketAsset_assetId_idx" ON "TicketAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_name_key" ON "SlaPolicy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSlaTracking_ticketId_key" ON "TicketSlaTracking"("ticketId");

-- CreateIndex
CREATE INDEX "TicketSlaTracking_status_idx" ON "TicketSlaTracking"("status");

-- CreateIndex
CREATE INDEX "Ticket_status_priority_idx" ON "Ticket"("status", "priority");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_idx" ON "Ticket"("requesterId");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAsset" ADD CONSTRAINT "TicketAsset_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAsset" ADD CONSTRAINT "TicketAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAsset" ADD CONSTRAINT "TicketAsset_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSlaTracking" ADD CONSTRAINT "TicketSlaTracking_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSlaTracking" ADD CONSTRAINT "TicketSlaTracking_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
