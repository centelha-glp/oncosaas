const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const patientId = '8165bd14-6a72-4074-b89c-65b5e67ddb82';
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, tenantId: true },
  });
  console.log('patient', patient);

  if (!patient) return;

  const cfg = await prisma.agentConfig.findUnique({
    where: { tenantId: patient.tenantId },
    select: {
      tenantId: true,
      llmProvider: true,
      llmModel: true,
      llmFallbackProvider: true,
      llmFallbackModel: true,
      agentLanguage: true,
      maxAutoReplies: true,
      anthropicApiKey: true,
      openaiApiKey: true,
      updatedAt: true,
    },
  });

  console.log('agentConfig', cfg ? {
    ...cfg,
    anthropicApiKey: cfg.anthropicApiKey ? '[set]' : null,
    openaiApiKey: cfg.openaiApiKey ? '[set]' : null,
  } : null);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
