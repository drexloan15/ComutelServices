-- CreateEnum
CREATE TYPE "CatalogFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'SELECT', 'BOOLEAN', 'DATE', 'EMAIL', 'USER');

-- CreateEnum
CREATE TYPE "TicketApprovalType" AS ENUM ('MANAGER', 'CHANGE', 'SECURITY', 'FINANCE');

-- CreateEnum
CREATE TYPE "TicketApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketActivityType" AS ENUM ('CREATED', 'UPDATED', 'COMMENTED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNED', 'APPROVAL_REQUESTED', 'APPROVAL_DECIDED', 'ATTACHMENT_ADDED', 'MACRO_APPLIED', 'WORKFLOW_APPLIED', 'SLA_PAUSED', 'SLA_RESUMED');

-- CreateEnum
CREATE TYPE "ServiceImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ServiceLinkType" AS ENUM ('PRIMARY', 'SUPPORTING', 'SHARED');

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'CATALOG_ITEM_CREATED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'WORKFLOW_RULE_APPLIED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'TICKET_APPROVAL_DECIDED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'TICKET_ATTACHMENT_ADDED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'SLA_PAUSED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'SLA_RESUMED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE 'CMDB_SERVICE_LINKED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "SlaPolicy" ADD COLUMN     "calendarId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "catalogFormPayload" JSONB,
ADD COLUMN     "catalogItemId" TEXT,
ADD COLUMN     "impactedServiceId" TEXT,
ADD COLUMN     "supportGroupId" TEXT;

-- AlterTable
ALTER TABLE "TicketSlaTracking" ADD COLUMN     "nextEscalationAt" TIMESTAMP(3),
ADD COLUMN     "pausedAccumulatedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "predictedBreachAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "supportGroupId" TEXT;

-- CreateTable
CREATE TABLE "SupportGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ticketType" "TicketType" NOT NULL DEFAULT 'SERVICE_REQUEST',
    "defaultPriority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalType" "TicketApprovalType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalogField" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CatalogFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "placeholder" TEXT,
    "helpText" TEXT,
    "optionsJson" JSONB,
    "showWhenFieldKey" TEXT,
    "showWhenValue" TEXT,
    "validationRegex" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "catalogItemId" TEXT,
    "priorityEquals" "TicketPriority",
    "typeEquals" "TicketType",
    "onStatus" "TicketStatus",
    "actionSetPriority" "TicketPriority",
    "actionAssignGroupId" TEXT,
    "actionAssignUserId" TEXT,
    "actionSetSlaPolicyId" TEXT,
    "actionAddComment" TEXT,
    "actionNotifyAdmins" BOOLEAN NOT NULL DEFAULT false,
    "actionNotifyAssignee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketApproval" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "requestedById" TEXT,
    "approverId" TEXT,
    "type" "TicketApprovalType" NOT NULL,
    "status" "TicketApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "decisionNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TicketApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketActivity" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "TicketActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMacro" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableForRole" "UserRole",
    "setStatus" "TicketStatus",
    "setPriority" "TicketPriority",
    "addCommentBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketMacro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHoursCalendar" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Lima',
    "openWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "endHour" INTEGER NOT NULL DEFAULT 18,
    "holidays" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHoursCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessService" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerGroupId" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDependency" (
    "fromServiceId" TEXT NOT NULL,
    "toServiceId" TEXT NOT NULL,
    "impactLevel" "ServiceImpactLevel" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceDependency_pkey" PRIMARY KEY ("fromServiceId","toServiceId")
);

-- CreateTable
CREATE TABLE "AssetServiceLink" (
    "assetId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "linkType" "ServiceLinkType" NOT NULL DEFAULT 'SUPPORTING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetServiceLink_pkey" PRIMARY KEY ("assetId","serviceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportGroup_code_key" ON "SupportGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogItem_key_key" ON "ServiceCatalogItem"("key");

-- CreateIndex
CREATE INDEX "ServiceCatalogField_catalogItemId_order_idx" ON "ServiceCatalogField"("catalogItemId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCatalogField_catalogItemId_key_key" ON "ServiceCatalogField"("catalogItemId", "key");

-- CreateIndex
CREATE INDEX "WorkflowRule_isActive_onStatus_priorityEquals_typeEquals_idx" ON "WorkflowRule"("isActive", "onStatus", "priorityEquals", "typeEquals");

-- CreateIndex
CREATE INDEX "WorkflowRule_catalogItemId_isActive_idx" ON "WorkflowRule"("catalogItemId", "isActive");

-- CreateIndex
CREATE INDEX "TicketApproval_ticketId_status_sequence_idx" ON "TicketApproval"("ticketId", "status", "sequence");

-- CreateIndex
CREATE INDEX "TicketApproval_approverId_status_idx" ON "TicketApproval"("approverId", "status");

-- CreateIndex
CREATE INDEX "TicketActivity_ticketId_createdAt_idx" ON "TicketActivity"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_createdAt_idx" ON "TicketAttachment"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMacro_name_key" ON "TicketMacro"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHoursCalendar_name_key" ON "BusinessHoursCalendar"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessService_code_key" ON "BusinessService"("code");

-- CreateIndex
CREATE INDEX "ServiceDependency_toServiceId_idx" ON "ServiceDependency"("toServiceId");

-- CreateIndex
CREATE INDEX "AssetServiceLink_serviceId_idx" ON "AssetServiceLink"("serviceId");

-- CreateIndex
CREATE INDEX "Ticket_supportGroupId_createdAt_idx" ON "Ticket"("supportGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_catalogItemId_createdAt_idx" ON "Ticket"("catalogItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_impactedServiceId_createdAt_idx" ON "Ticket"("impactedServiceId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketSlaTracking_nextEscalationAt_idx" ON "TicketSlaTracking"("nextEscalationAt");

-- CreateIndex
CREATE INDEX "TicketSlaTracking_predictedBreachAt_idx" ON "TicketSlaTracking"("predictedBreachAt");

-- CreateIndex
CREATE INDEX "User_supportGroupId_idx" ON "User"("supportGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supportGroupId_fkey" FOREIGN KEY ("supportGroupId") REFERENCES "SupportGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_supportGroupId_fkey" FOREIGN KEY ("supportGroupId") REFERENCES "SupportGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_impactedServiceId_fkey" FOREIGN KEY ("impactedServiceId") REFERENCES "BusinessService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "BusinessHoursCalendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCatalogField" ADD CONSTRAINT "ServiceCatalogField_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_actionAssignGroupId_fkey" FOREIGN KEY ("actionAssignGroupId") REFERENCES "SupportGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_actionAssignUserId_fkey" FOREIGN KEY ("actionAssignUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_actionSetSlaPolicyId_fkey" FOREIGN KEY ("actionSetSlaPolicyId") REFERENCES "SlaPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketApproval" ADD CONSTRAINT "TicketApproval_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketApproval" ADD CONSTRAINT "TicketApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketApproval" ADD CONSTRAINT "TicketApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessService" ADD CONSTRAINT "BusinessService_ownerGroupId_fkey" FOREIGN KEY ("ownerGroupId") REFERENCES "SupportGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDependency" ADD CONSTRAINT "ServiceDependency_fromServiceId_fkey" FOREIGN KEY ("fromServiceId") REFERENCES "BusinessService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDependency" ADD CONSTRAINT "ServiceDependency_toServiceId_fkey" FOREIGN KEY ("toServiceId") REFERENCES "BusinessService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetServiceLink" ADD CONSTRAINT "AssetServiceLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetServiceLink" ADD CONSTRAINT "AssetServiceLink_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BusinessService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
