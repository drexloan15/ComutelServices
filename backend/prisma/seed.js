require('dotenv/config');
const bcrypt = require('bcrypt');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  CatalogFieldType,
  TicketApprovalType,
  TicketPriority,
  TicketType,
  PrismaClient,
  UserRole,
} = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no esta configurada en el entorno.');
}

const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
const allowNonDevSeed = process.env.SEED_ALLOW_NON_DEV === 'true';
if (!['development', 'dev'].includes(nodeEnv) && !allowNonDevSeed) {
  throw new Error(
    'Seed bloqueado fuera de desarrollo. Usa SEED_ALLOW_NON_DEV=true solo si entiendes el riesgo.',
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function upsertUser({ email, fullName, role, password }) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role,
      isActive: true,
      passwordHash,
    },
    create: {
      email,
      fullName,
      role,
      isActive: true,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });
}

async function main() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const agentEmail = process.env.SEED_AGENT_EMAIL;
  const requesterEmail = process.env.SEED_REQUESTER_EMAIL;

  if (!defaultPassword || !adminEmail || !agentEmail || !requesterEmail) {
    throw new Error(
      'Faltan variables de seed: SEED_DEFAULT_PASSWORD, SEED_ADMIN_EMAIL, SEED_AGENT_EMAIL, SEED_REQUESTER_EMAIL.',
    );
  }

  const [admin, agent, requester] = await Promise.all([
    upsertUser({
      email: adminEmail,
      fullName: 'Comutel Admin',
      role: UserRole.ADMIN,
      password: defaultPassword,
    }),
    upsertUser({
      email: agentEmail,
      fullName: 'Comutel Agent',
      role: UserRole.AGENT,
      password: defaultPassword,
    }),
    upsertUser({
      email: requesterEmail,
      fullName: 'Comutel Requester',
      role: UserRole.REQUESTER,
      password: defaultPassword,
    }),
  ]);

  console.log('Seed completado:');
  console.log(admin);
  console.log(agent);
  console.log(requester);

  const [groupN1, groupField] = await Promise.all([
    prisma.supportGroup.upsert({
      where: { code: 'MESA_N1' },
      update: { name: 'Mesa de Ayuda N1', isActive: true },
      create: {
        code: 'MESA_N1',
        name: 'Mesa de Ayuda N1',
        description: 'Atencion inicial y triage',
      },
    }),
    prisma.supportGroup.upsert({
      where: { code: 'CAMPO' },
      update: { name: 'Soporte en Campo', isActive: true },
      create: {
        code: 'CAMPO',
        name: 'Soporte en Campo',
        description: 'Intervenciones onsite',
      },
    }),
  ]);

  await Promise.all([
    prisma.user.update({
      where: { id: admin.id },
      data: { supportGroupId: groupN1.id },
    }),
    prisma.user.update({
      where: { id: agent.id },
      data: { supportGroupId: groupField.id },
    }),
  ]);

  const calendar = await prisma.businessHoursCalendar.upsert({
    where: { name: 'Horario corporativo' },
    update: {
      timezone: 'America/Lima',
      openWeekdays: [1, 2, 3, 4, 5],
      startHour: 8,
      endHour: 18,
      isDefault: true,
    },
    create: {
      name: 'Horario corporativo',
      timezone: 'America/Lima',
      openWeekdays: [1, 2, 3, 4, 5],
      startHour: 8,
      endHour: 18,
      isDefault: true,
    },
  });

  const slaStandard = await prisma.slaPolicy.upsert({
    where: { name: 'SLA corporativo estandar' },
    update: {
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 8 * 60,
      businessHoursOnly: true,
      isActive: true,
      calendarId: calendar.id,
    },
    create: {
      name: 'SLA corporativo estandar',
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 8 * 60,
      businessHoursOnly: true,
      isActive: true,
      calendarId: calendar.id,
    },
  });

  const accessCatalog = await prisma.serviceCatalogItem.upsert({
    where: { key: 'ACCESS_REQUEST' },
    update: {
      name: 'Solicitud de acceso',
      ticketType: TicketType.SERVICE_REQUEST,
      defaultPriority: TicketPriority.MEDIUM,
      requiresApproval: true,
      approvalType: TicketApprovalType.MANAGER,
      isActive: true,
    },
    create: {
      key: 'ACCESS_REQUEST',
      name: 'Solicitud de acceso',
      description: 'Alta o modificacion de accesos a sistemas',
      ticketType: TicketType.SERVICE_REQUEST,
      defaultPriority: TicketPriority.MEDIUM,
      requiresApproval: true,
      approvalType: TicketApprovalType.MANAGER,
      isActive: true,
    },
  });

  const hardwareCatalog = await prisma.serviceCatalogItem.upsert({
    where: { key: 'HW_INCIDENT' },
    update: {
      name: 'Incidente de hardware',
      ticketType: TicketType.INCIDENT,
      defaultPriority: TicketPriority.HIGH,
      requiresApproval: false,
      isActive: true,
    },
    create: {
      key: 'HW_INCIDENT',
      name: 'Incidente de hardware',
      description: 'Fallas de equipos o perifericos',
      ticketType: TicketType.INCIDENT,
      defaultPriority: TicketPriority.HIGH,
      requiresApproval: false,
      isActive: true,
    },
  });

  const fieldSeeds = [
    {
      catalogItemId: accessCatalog.id,
      key: 'system',
      label: 'Sistema objetivo',
      fieldType: CatalogFieldType.SELECT,
      required: true,
      order: 1,
      optionsJson: { options: ['ERP', 'Correo', 'VPN', 'CRM'] },
    },
    {
      catalogItemId: accessCatalog.id,
      key: 'justification',
      label: 'Justificacion',
      fieldType: CatalogFieldType.TEXTAREA,
      required: true,
      order: 2,
    },
    {
      catalogItemId: hardwareCatalog.id,
      key: 'assetCode',
      label: 'Codigo de activo',
      fieldType: CatalogFieldType.TEXT,
      required: true,
      order: 1,
    },
    {
      catalogItemId: hardwareCatalog.id,
      key: 'onsite',
      label: 'Requiere visita en campo',
      fieldType: CatalogFieldType.BOOLEAN,
      required: false,
      order: 2,
    },
  ];

  for (const field of fieldSeeds) {
    await prisma.serviceCatalogField.upsert({
      where: {
        catalogItemId_key: {
          catalogItemId: field.catalogItemId,
          key: field.key,
        },
      },
      update: {
        label: field.label,
        fieldType: field.fieldType,
        required: field.required,
        order: field.order,
        optionsJson: field.optionsJson ?? null,
      },
      create: field,
    });
  }

  await prisma.workflowRule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      name: 'Urgente -> Grupo N1 + SLA',
      isActive: true,
      priorityEquals: TicketPriority.URGENT,
      actionAssignGroupId: groupN1.id,
      actionSetSlaPolicyId: slaStandard.id,
      actionNotifyAdmins: true,
      actionAddComment: 'Regla automatica aplicada para prioridad URGENT.',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Urgente -> Grupo N1 + SLA',
      description: 'Asegura atencion inmediata',
      isActive: true,
      priorityEquals: TicketPriority.URGENT,
      actionAssignGroupId: groupN1.id,
      actionSetSlaPolicyId: slaStandard.id,
      actionNotifyAdmins: true,
      actionAddComment: 'Regla automatica aplicada para prioridad URGENT.',
    },
  });

  await prisma.ticketMacro.upsert({
    where: { name: 'Diagnostico inicial N1' },
    update: {
      isActive: true,
      availableForRole: UserRole.AGENT,
      addCommentBody: 'Se ejecuto diagnostico inicial y se solicitan evidencias.',
    },
    create: {
      name: 'Diagnostico inicial N1',
      description: 'Respuesta rapida con checklist estandar',
      isActive: true,
      availableForRole: UserRole.AGENT,
      addCommentBody: 'Se ejecuto diagnostico inicial y se solicitan evidencias.',
    },
  });

  const service = await prisma.businessService.upsert({
    where: { code: 'CORP-EMAIL' },
    update: {
      name: 'Correo corporativo',
      isCritical: true,
      ownerGroupId: groupN1.id,
    },
    create: {
      code: 'CORP-EMAIL',
      name: 'Correo corporativo',
      description: 'Servicio de mensajeria interna',
      isCritical: true,
      ownerGroupId: groupN1.id,
    },
  });

  const asset = await prisma.asset.upsert({
    where: { code: 'LAP-001' },
    update: {
      name: 'Laptop ejecutiva 001',
      type: 'HARDWARE',
      status: 'IN_USE',
      ownerId: requester.id,
    },
    create: {
      code: 'LAP-001',
      name: 'Laptop ejecutiva 001',
      type: 'HARDWARE',
      status: 'IN_USE',
      ownerId: requester.id,
    },
  });

  await prisma.assetServiceLink.upsert({
    where: {
      assetId_serviceId: {
        assetId: asset.id,
        serviceId: service.id,
      },
    },
    update: {
      linkType: 'SUPPORTING',
    },
    create: {
      assetId: asset.id,
      serviceId: service.id,
      linkType: 'SUPPORTING',
    },
  });

  console.log('Seed enterprise inicial completado.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
