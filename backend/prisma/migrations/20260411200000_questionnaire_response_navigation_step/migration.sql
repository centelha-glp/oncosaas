-- AlterTable
ALTER TABLE "questionnaire_responses" ADD COLUMN "navigationStepId" TEXT;

-- CreateIndex
CREATE INDEX "questionnaire_responses_navigationStepId_idx" ON "questionnaire_responses"("navigationStepId");

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_navigationStepId_fkey" FOREIGN KEY ("navigationStepId") REFERENCES "navigation_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
