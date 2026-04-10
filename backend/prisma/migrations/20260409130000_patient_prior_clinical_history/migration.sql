-- Cirurgias e internações prévias no cadastro (HPP estruturado)
ALTER TABLE "patients" ADD COLUMN "priorSurgeries" JSONB;
ALTER TABLE "patients" ADD COLUMN "priorHospitalizations" JSONB;
