import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class UpsertConsultationAgendaConfigDto {
  @IsInt()
  @Min(5)
  @Max(120)
  defaultConsultationDurationMinutes!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxConsultationsPerDay?: number | null;

  @IsObject()
  weeklyPattern!: Record<string, unknown>;

  /** Horas antes da consulta para enviar a confirmação por WhatsApp (0 = imediato ao registar). */
  @IsInt()
  @Min(0)
  @Max(336)
  whatsappConfirmationLeadHours!: number;
}
