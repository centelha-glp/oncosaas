-- CreateEnum
CREATE TYPE "AppointmentConfirmationStatus" AS ENUM ('NOT_APPLICABLE', 'AWAITING_RESPONSE', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "navigation_steps" ADD COLUMN     "appointmentConfirmationStatus" "AppointmentConfirmationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
