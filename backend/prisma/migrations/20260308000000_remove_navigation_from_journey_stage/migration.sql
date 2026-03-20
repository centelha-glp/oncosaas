-- Remover estágio NAVIGATION do enum JourneyStage (navegação é atividade em todas as fases, não uma fase)
-- 1. Migrar dados: pacientes e etapas com NAVIGATION passam para SCREENING
UPDATE "patients" SET "currentStage" = 'SCREENING' WHERE "currentStage" = 'NAVIGATION';
UPDATE "navigation_steps" SET "journeyStage" = 'SCREENING' WHERE "journeyStage" = 'NAVIGATION';

-- 2. Criar novo tipo enum sem NAVIGATION
CREATE TYPE "JourneyStage_new" AS ENUM ('SCREENING', 'DIAGNOSIS', 'TREATMENT', 'FOLLOW_UP');

-- 3. Remover DEFAULT das colunas que usam JourneyStage (para permitir alteração de tipo)
ALTER TABLE "patients" ALTER COLUMN "currentStage" DROP DEFAULT;

-- 4. Alterar colunas para usar o novo tipo
ALTER TABLE "patients" ALTER COLUMN "currentStage" TYPE "JourneyStage_new" USING ("currentStage"::text::"JourneyStage_new");
ALTER TABLE "navigation_steps" ALTER COLUMN "journeyStage" TYPE "JourneyStage_new" USING ("journeyStage"::text::"JourneyStage_new");

-- 5. Remover tipo antigo e renomear o novo
DROP TYPE "JourneyStage";
ALTER TYPE "JourneyStage_new" RENAME TO "JourneyStage";

-- 6. Restaurar DEFAULT na coluna currentStage
ALTER TABLE "patients" ALTER COLUMN "currentStage" SET DEFAULT 'SCREENING'::"JourneyStage";
