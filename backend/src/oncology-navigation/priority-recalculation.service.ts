import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAiServiceConfig } from '../common/utils/ai-service.util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Serviço que recalcula o score de prioridade de um paciente usando o modelo ML do AI Service.
 * Usado pelo agente (tool) e por triggers quando dados clínicos, exames ou questionários são coletados.
 */
@Injectable()
export class PriorityRecalculationService {
  private readonly logger = new Logger(PriorityRecalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Recalcula e persiste o score de prioridade do paciente.
   * Usa dados reais: último ESAS, observações (dor/náusea/fadiga), diagnóstico, tratamentos.
   */
  async recalculate(patientId: string, tenantId: string): Promise<boolean> {
    try {
      const patient = await this.prisma.patient.findFirst({
        where: { id: patientId, tenantId },
        select: {
          id: true,
          cancerType: true,
          stage: true,
          performanceStatus: true,
          birthDate: true,
          lastInteraction: true,
          questionnaireResponses: {
            where: { questionnaire: { type: 'ESAS' } },
            orderBy: { completedAt: 'desc' },
            take: 1,
            select: { scores: true, responses: true },
          },
          observations: {
            where: {
              code: {
                in: [
                  'symptom_dor',
                  'symptom_nausea',
                  'symptom_fadiga',
                  'symptom_febre',
                ],
              },
            },
            orderBy: { effectiveDateTime: 'desc' },
            take: 10,
            select: { code: true, valueString: true },
          },
          treatments: {
            where: { status: 'ACTIVE', isActive: true },
            orderBy: { startDate: 'desc' },
            take: 1,
            select: { currentCycle: true },
          },
        },
      });

      if (!patient) {
        this.logger.warn(`Patient ${patientId} not found for priority recalc`);
        return false;
      }

      const age = patient.birthDate
        ? Math.floor(
            (Date.now() - new Date(patient.birthDate).getTime()) /
              (365.25 * 24 * 3600 * 1000),
          )
        : 60;

      let painScore = 0;
      let nauseaScore = 0;
      let fatigueScore = 0;

      // Extrair do último ESAS
      const lastEsas = patient.questionnaireResponses[0];
      if (lastEsas?.scores && typeof lastEsas.scores === 'object') {
        const s = lastEsas.scores as Record<string, number>;
        painScore = Math.round(s.pain ?? s.dor ?? 0);
        nauseaScore = Math.round(s.nausea ?? s.nausea_level ?? 0);
        fatigueScore = Math.round(s.fatigue ?? s.cansaco ?? s.fadiga ?? 0);
      } else if (lastEsas?.responses && typeof lastEsas.responses === 'object') {
        const r = lastEsas.responses as Record<string, unknown>;
        painScore = Number(r.pain ?? r.dor ?? 0) || 0;
        nauseaScore = Number(r.nausea ?? 0) || 0;
        fatigueScore = Number(r.fatigue ?? r.cansaco ?? r.fadiga ?? 0) || 0;
      }

      // Fallback: observações de sintomas
      let hasFever = false;
      for (const obs of patient.observations) {
        const val = parseInt(obs.valueString ?? '0', 10) || 0;
        if (obs.code === 'symptom_dor' && val > painScore) {painScore = val;}
        if (obs.code === 'symptom_nausea' && val > nauseaScore) {nauseaScore = val;}
        if (obs.code === 'symptom_fadiga' && val > fatigueScore) {fatigueScore = val;}
        if (obs.code === 'symptom_febre') {hasFever = true;}
      }

      const now = new Date();
      const lastInteraction = patient.lastInteraction
        ? new Date(patient.lastInteraction)
        : null;
      const daysSinceLastVisit = lastInteraction
        ? Math.floor(
            (now.getTime() - lastInteraction.getTime()) / (24 * 60 * 60 * 1000),
          )
        : 30;

      const treatmentCycle =
        patient.treatments[0]?.currentCycle !== null && patient.treatments[0]?.currentCycle !== undefined
          ? Number(patient.treatments[0].currentCycle)
          : 0;

      const payload = {
        patient_id: patientId,
        cancer_type: patient.cancerType || 'other',
        stage: patient.stage || 'II',
        performance_status: patient.performanceStatus ?? 1,
        age,
        pain_score: painScore,
        nausea_score: nauseaScore,
        fatigue_score: fatigueScore,
        has_fever: hasFever,
        days_since_last_visit: daysSinceLastVisit,
        treatment_cycle: treatmentCycle,
      };

      const { aiServiceUrl, headers: aiHeaders } = getAiServiceConfig(
        this.configService,
      );

      const response = await fetch(`${aiServiceUrl}/api/v1/prioritize`, {
        method: 'POST',
        headers: aiHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(
          `AI Service retornou ${response.status} para priorização do paciente ${patientId}`,
        );
        return false;
      }

      const data = (await response.json()) as {
        priority_score: number;
        priority_category: string;
        reason: string;
      };

      const categoryMap: Record<string, string> = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW',
      };

      await this.prisma.patient.update({
        where: { id: patientId, tenantId },
        data: {
          priorityScore: Math.round(data.priority_score),
          priorityCategory: (categoryMap[data.priority_category] ||
            'LOW') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          priorityReason: data.reason,
          priorityUpdatedAt: now,
        },
      });

      this.logger.debug(
        `Prioridade recalculada para paciente ${patientId}: ${data.priority_category} (${data.priority_score})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Erro ao recalcular prioridade do paciente ${patientId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Dispara recálculo em background sem bloquear a operação principal.
   * Usado por triggers (questionário, exame, observação, diagnóstico).
   */
  triggerRecalculation(patientId: string, tenantId: string): void {
    this.recalculate(patientId, tenantId).catch((err) => {
      this.logger.warn(
        `Falha ao recalcular prioridade (trigger) para ${patientId}: ${err?.message}`,
      );
    });
  }
}
