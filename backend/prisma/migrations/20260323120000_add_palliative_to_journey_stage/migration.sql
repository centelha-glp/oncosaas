-- Adicionar estágio PALLIATIVE ao enum JourneyStage (alinhado ao schema Prisma)
ALTER TYPE "JourneyStage" ADD VALUE 'PALLIATIVE';
