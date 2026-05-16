require('dotenv').config();
require('ts-node/register/transpile-only');
const { PrismaClient } = require('../generated/prisma/client.ts');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

(async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      email: true,
      tenantId: true,
      mfaEnabled: true,
      mfaSecret: true,
      tenant: { select: { name: true } },
    },
    orderBy: { email: 'asc' },
  });

  const blocked = admins.filter((u) => u.mfaEnabled);

  console.log(`Total de admins: ${admins.length}`);
  console.log(`Admins com MFA habilitado: ${blocked.length}`);
  for (const u of blocked) {
    console.log(
      ` - ${u.email}  tenant=${u.tenant?.name ?? u.tenantId}  hasSecret=${!!u.mfaSecret}`
    );
  }

  if (!APPLY) {
    console.log('\nDRY-RUN. Re-execute com --apply para desabilitar o MFA dos admins acima.');
    await prisma.$disconnect();
    return;
  }

  if (blocked.length === 0) {
    console.log('\nNada para fazer.');
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
      mfaEnabled: true,
    },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
    },
  });

  console.log(`\nMFA desabilitado em ${result.count} admin(s).`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
