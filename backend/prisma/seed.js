require('dotenv/config');
const bcrypt = require('bcrypt');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, UserRole } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no esta configurada en el entorno.');
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
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!';

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@comutel.local';
  const agentEmail = process.env.SEED_AGENT_EMAIL ?? 'agent@comutel.local';
  const requesterEmail = process.env.SEED_REQUESTER_EMAIL ?? 'requester@comutel.local';

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
