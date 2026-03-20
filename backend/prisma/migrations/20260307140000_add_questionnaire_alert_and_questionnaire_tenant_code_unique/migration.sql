-- Add QUESTIONNAIRE_ALERT to AlertType enum (alerts from ESAS/PRO-CTCAE high scores)
ALTER TYPE "AlertType" ADD VALUE 'QUESTIONNAIRE_ALERT';

-- Questionnaire: change unique from (code) to (tenantId, code) so each tenant can have its own ESAS/PRO-CTCAE template
DROP INDEX IF EXISTS "questionnaires_code_key";
CREATE UNIQUE INDEX "questionnaires_tenantId_code_key" ON "questionnaires"("tenantId", "code");
