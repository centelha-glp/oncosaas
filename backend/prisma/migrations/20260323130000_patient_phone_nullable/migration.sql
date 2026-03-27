-- Permite pacientes sem telefone (dados legados / importação); alinha com valores NULL existentes
ALTER TABLE "patients" ALTER COLUMN "phone" DROP NOT NULL;
