import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  IsArray,
  IsObject,
  Min,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import {
  Prisma,
  TreatmentType,
  TreatmentIntent,
  TreatmentStatus,
  TreatmentResponse,
} from '@generated/prisma/client';

export class CreateTreatmentDto {
  @IsUUID()
  @IsNotEmpty()
  diagnosisId: string; // ID do CancerDiagnosis

  @IsEnum(TreatmentType)
  treatmentType: TreatmentType;

  @IsString()
  @IsOptional()
  treatmentName?: string;

  @IsString()
  @IsOptional()
  protocol?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  line?: number; // Linha de tratamento (1ª, 2ª, etc.)

  @IsEnum(TreatmentIntent)
  @IsOptional()
  intent?: TreatmentIntent;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  plannedEndDate?: string;

  @IsDateString()
  @IsOptional()
  actualEndDate?: string;

  @IsDateString()
  @IsOptional()
  lastCycleDate?: string;

  @IsDateString()
  @IsOptional()
  lastApplicationDate?: string; // Data real da última infusão/aplicação (D0 para cálculo D+N)

  @IsInt()
  @IsOptional()
  @Min(1)
  currentCycle?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  totalCycles?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  cyclesCompleted?: number;

  @IsEnum(TreatmentStatus)
  @IsOptional()
  status?: TreatmentStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  discontinuationReason?: string;

  @IsArray()
  @IsOptional()
  medications?: Array<{
    name: string;
    dose: string;
    route: string;
  }>;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  administrationRoute?: string;

  @IsString()
  @IsOptional()
  institutionName?: string;

  @IsString()
  @IsOptional()
  physicianName?: string;

  @IsArray()
  @IsOptional()
  toxicities?: Array<{
    type: string;
    grade: number;
    date: string;
  }>;

  @IsArray()
  @IsOptional()
  doseReductions?: Array<{
    date: string;
    reason: string;
    newDose: string;
  }>;

  @IsArray()
  @IsOptional()
  delays?: Array<{
    date: string;
    reason: string;
    daysDelayed: number;
  }>;

  @IsEnum(TreatmentResponse)
  @IsOptional()
  response?: TreatmentResponse;

  @IsDateString()
  @IsOptional()
  responseDate?: string;

  @IsString()
  @IsOptional()
  responseNotes?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Prisma.InputJsonValue;
}
