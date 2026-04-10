import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CLINICAL_NOTE_SECTION_KEYS,
  type ClinicalNoteSectionKey,
} from './clinical-notes.constants';
import {
  formatStoredAllergyLine,
  type StoredAllergyEntry,
} from '../patients/patient-clinical-json.util';

const TZ_SP = 'America/Sao_Paulo';

const TREATMENT_TYPE_LABELS: Record<string, string> = {
  CHEMOTHERAPY: 'Quimioterapia',
  RADIOTHERAPY: 'Radioterapia',
  SURGERY: 'Cirurgia',
  COMBINED: 'Combinado',
  IMMUNOTHERAPY: 'Imunoterapia',
  TARGETED: 'Terapia alvo',
};

const TREATMENT_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planejado',
  ACTIVE: 'Em andamento',
  COMPLETED: 'Concluído',
  SUSPENDED: 'Suspenso',
  DISCONTINUED: 'Descontinuado',
  CANCELLED: 'Cancelado',
};

const NAV_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  OVERDUE: 'Atrasada',
  CANCELLED: 'Cancelada',
  NOT_APPLICABLE: 'Não aplicável',
};

function ymdInTimeZone(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

/** Idade completa em anos no fuso informado (SP). */
export function ageYearsInTimeZone(birthDate: Date, ref: Date, timeZone: string): number {
  const b = ymdInTimeZone(birthDate, timeZone).split('-').map(Number);
  const r = ymdInTimeZone(ref, timeZone).split('-').map(Number);
  const [yB, mB, dB] = b;
  const [yR, mR, dR] = r;
  let age = yR - yB;
  if (mR < mB || (mR === mB && dR < dB)) age -= 1;
  return Math.max(0, age);
}

function genderLabelPt(gender: string | null | undefined): string {
  if (!gender) return 'Não informado';
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'Masculino';
  if (g === 'female' || g === 'f') return 'Feminino';
  if (g === 'other') return 'Outro';
  return gender;
}

function parseJsonArray(raw: Prisma.JsonValue | null | undefined): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  return [];
}

function formatDatePt(d: Date | null | undefined): string {
  if (!d) return '—';
  try {
    return d.toLocaleDateString('pt-BR', { timeZone: TZ_SP });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

@Injectable()
export class ClinicalNoteSectionSuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSectionSuggestions(
    patientId: string,
    tenantId: string
  ): Promise<Record<ClinicalNoteSectionKey, string>> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId },
      include: {
        comorbidities: { orderBy: [{ severity: 'desc' }, { name: 'asc' }] },
        medications: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        treatments: {
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
          take: 20,
          include: {
            diagnosis: { select: { cancerType: true } },
          },
        },
        navigationSteps: {
          orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
          take: 50,
        },
        complementaryExams: {
          include: {
            results: {
              where: { deletedAt: null },
              orderBy: { performedAt: 'desc' },
              take: 3,
            },
          },
          take: 25,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${patientId} not found`);
    }

    const empty = (): Record<ClinicalNoteSectionKey, string> => {
      const o = {} as Record<ClinicalNoteSectionKey, string>;
      for (const k of CLINICAL_NOTE_SECTION_KEYS) {
        o[k] = '';
      }
      return o;
    };

    const out = empty();
    const now = new Date();
    const age = ageYearsInTimeZone(patient.birthDate, now, TZ_SP);

    out.identificacao = [
      `Paciente: ${patient.name}`,
      `Idade: ${age} anos (referência de data: fuso ${TZ_SP})`,
      `Sexo: ${genderLabelPt(patient.gender)}`,
      patient.medicalRecordNumber
        ? `Prontuário hospitalar: ${patient.medicalRecordNumber}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    const hppLines: string[] = [];

    const smokingProf = patient.smokingProfile;
    if (
      smokingProf &&
      typeof smokingProf === 'object' &&
      !Array.isArray(smokingProf)
    ) {
      const o = smokingProf as Record<string, unknown>;
      const statusMap: Record<string, string> = {
        never: 'Nunca fumou',
        former: 'Ex-fumante',
        current: 'Fumante atual',
        unknown: 'Situação não informada',
      };
      const st = typeof o.status === 'string' ? o.status : '';
      if (st) {
        let line = `Tabagismo: ${statusMap[st] ?? st}`;
        if (typeof o.packYears === 'number') {
          line += ` — ${o.packYears} anos-maço`;
        }
        if (typeof o.yearsQuit === 'number') {
          line += ` — cessou há ${o.yearsQuit} ano(s)`;
        }
        hppLines.push(line);
      }
      if (typeof o.notes === 'string' && o.notes.trim()) {
        hppLines.push(`  Notas (tabagismo): ${o.notes.trim()}`);
      }
    } else if (patient.smokingHistory?.trim()) {
      hppLines.push(`Tabagismo: ${patient.smokingHistory.trim()}`);
    }

    const alc = patient.alcoholProfile;
    if (alc && typeof alc === 'object' && !Array.isArray(alc)) {
      const o = alc as Record<string, unknown>;
      const statusMap: Record<string, string> = {
        never: 'Nunca',
        occasional: 'Ocasional',
        moderate: 'Moderado',
        heavy: 'Pesado',
        unknown: 'Não informado',
      };
      const st = typeof o.status === 'string' ? o.status : '';
      if (st) {
        let line = `Etilismo: ${statusMap[st] ?? st}`;
        if (typeof o.drinksPerWeek === 'number') {
          line += ` — ~${o.drinksPerWeek} doses/semana`;
        }
        hppLines.push(line);
      }
      if (typeof o.notes === 'string' && o.notes.trim()) {
        hppLines.push(`  Notas (álcool): ${o.notes.trim()}`);
      }
    } else if (patient.alcoholHistory?.trim()) {
      hppLines.push(`Etilismo: ${patient.alcoholHistory.trim()}`);
    }

    const occList = parseJsonArray(patient.occupationalExposureEntries);
    if (occList.length > 0) {
      for (const item of occList) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const r = item as Record<string, unknown>;
          const agent = typeof r.agent === 'string' ? r.agent.trim() : '';
          if (!agent) continue;
          const yrs =
            typeof r.yearsApprox === 'number'
              ? ` (${r.yearsApprox} anos aprox.)`
              : '';
          const n =
            typeof r.notes === 'string' && r.notes.trim()
              ? ` — ${r.notes.trim()}`
              : '';
          hppLines.push(`Exposição ocupacional${yrs}: ${agent}${n}`);
        }
      }
    } else if (patient.occupationalExposure?.trim()) {
      hppLines.push(
        `Exposições ocupacionais: ${patient.occupationalExposure.trim()}`
      );
    }
    const fam = parseJsonArray(patient.familyHistory);
    for (const row of fam) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const r = row as Record<string, unknown>;
        const rel = typeof r.relationship === 'string' ? r.relationship : '';
        const ct = typeof r.cancerType === 'string' ? r.cancerType : '';
        const ageD =
          typeof r.ageAtDiagnosis === 'number' ? `${r.ageAtDiagnosis} anos` : '';
        if (rel || ct) {
          hppLines.push(
            `História familiar: ${rel || '—'} — ${ct || '—'}${ageD ? ` (idade no diagnóstico: ${ageD})` : ''}`
          );
        }
      }
    }
    for (const s of parseJsonArray(patient.priorSurgeries)) {
      if (s && typeof s === 'object' && !Array.isArray(s)) {
        const r = s as Record<string, unknown>;
        const proc = typeof r.procedureName === 'string' ? r.procedureName : '';
        if (!proc.trim()) continue;
        const y = typeof r.year === 'number' ? `${r.year}` : 'ano s/inf.';
        const inst =
          typeof r.institution === 'string' && r.institution.trim()
            ? ` — ${r.institution.trim()}`
            : '';
        const n =
          typeof r.notes === 'string' && r.notes.trim() ? ` — ${r.notes.trim()}` : '';
        hppLines.push(`Cirurgia prévia (${y}): ${proc}${inst}${n}`);
      }
    }
    for (const h of parseJsonArray(patient.priorHospitalizations)) {
      if (h && typeof h === 'object' && !Array.isArray(h)) {
        const r = h as Record<string, unknown>;
        const sum = typeof r.summary === 'string' ? r.summary : '';
        if (!sum.trim()) continue;
        const y = typeof r.year === 'number' ? `${r.year}` : '';
        const dur =
          typeof r.durationDays === 'number' ? `${r.durationDays} dia(s)` : '';
        const n =
          typeof r.notes === 'string' && r.notes.trim() ? ` — ${r.notes.trim()}` : '';
        hppLines.push(
          `Internação prévia${y ? ` (${y})` : ''}: ${sum.trim()}${dur ? ` — duração: ${dur}` : ''}${n}`
        );
      }
    }
    out.hpp = hppLines.join('\n');

    const comorbLines = patient.comorbidities.map((c) => {
      const sev = c.severity ? ` (${c.severity})` : '';
      const ctrl = c.controlled ? ', controlada' : '';
      return `• ${c.name}${sev}${ctrl}`;
    });
    out.comorbidades = comorbLines.join('\n');

    const medLines = patient.medications.map((m) => {
      const bits = [m.name];
      if (m.dosage?.trim()) bits.push(m.dosage.trim());
      if (m.frequency?.trim()) bits.push(m.frequency.trim());
      if (m.indication?.trim()) bits.push(`— ${m.indication.trim()}`);
      return `• ${bits.join(' — ')}`;
    });
    out.medicacoesEmUso = medLines.join('\n');

    const allergyBits: string[] = [];
    for (const e of parseJsonArray(patient.allergyEntries)) {
      if (e && typeof e === 'object' && !Array.isArray(e)) {
        const r = e as Record<string, unknown>;
        const sk = typeof r.substanceKey === 'string' ? r.substanceKey : '';
        if (!sk) continue;
        const ent: StoredAllergyEntry = {
          substanceKey: sk,
          customLabel:
            typeof r.customLabel === 'string' ? r.customLabel : undefined,
          reactionNotes:
            typeof r.reactionNotes === 'string' ? r.reactionNotes : undefined,
        };
        allergyBits.push(formatStoredAllergyLine(ent));
      }
    }
    if (patient.allergies?.trim()) {
      if (allergyBits.length) {
        allergyBits.push(`Observações adicionais: ${patient.allergies.trim()}`);
      } else {
        allergyBits.push(patient.allergies.trim());
      }
    }
    out.alergias = allergyBits.join('\n');

    const examChunks: string[] = [];
    for (const ex of patient.complementaryExams) {
      const last = ex.results[0];
      if (!last) continue;
      const val =
        last.valueNumeric != null
          ? String(last.valueNumeric)
          : (last.valueText?.trim() ?? '');
      const unit = last.unit?.trim() ? ` ${last.unit.trim()}` : '';
      const abn =
        last.isAbnormal === true ? ' (alterado)' : last.isAbnormal === false ? '' : '';
      examChunks.push(
        `• ${ex.name} (${formatDatePt(last.performedAt)}): ${val}${unit}${abn}`
      );
    }
    out.examesComplementares = examChunks.join('\n');

    const treatLines = patient.treatments.map((t) => {
      const type =
        TREATMENT_TYPE_LABELS[t.treatmentType] ?? t.treatmentType;
      const cancer = t.diagnosis?.cancerType
        ? ` — ${t.diagnosis.cancerType}`
        : '';
      const name = t.treatmentName?.trim() ? ` — ${t.treatmentName.trim()}` : '';
      const proto = t.protocol?.trim() ? ` — ${t.protocol.trim()}` : '';
      const start = t.startDate ? `Início: ${formatDatePt(t.startDate)}` : '';
      const status = t.status
        ? ` — ${TREATMENT_STATUS_LABELS[t.status] ?? t.status}`
        : '';
      return `• ${type}${cancer}${name}${proto}${start ? ` — ${start}` : ''}${status}`;
    });
    out.tratamentos = treatLines.join('\n');

    const navLines = patient.navigationSteps.map((s) => {
      const st = NAV_STATUS_LABELS[s.status] ?? s.status;
      const due = s.dueDate ? ` — prazo: ${formatDatePt(s.dueDate)}` : '';
      return `• ${s.stepName} (${st})${due}${s.notes?.trim() ? ` — ${s.notes.trim()}` : ''}`;
    });
    out.navegacao = navLines.join('\n');

    out.hda = '';
    out.subjetivo = '';
    out.exameFisico = '';
    out.analise = '';
    out.conduta = '';
    out.planos = '';

    return out;
  }
}
