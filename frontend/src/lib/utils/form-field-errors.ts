import type { FieldErrors, FieldValues } from 'react-hook-form';
import type { ZodError } from 'zod';

/** Rótulos PT por segmento de path (evita toast genérico em "Required"). */
const SEGMENT_LABEL_PT: Record<string, string> = {
  name: 'Nome',
  birthDate: 'Data de nascimento',
  phone: 'Telefone',
  email: 'E-mail',
  gender: 'Sexo',
  cpf: 'CPF',
  currentStage: 'Estágio da jornada',
  cancerType: 'Tipo de câncer',
  stage: 'Estágio (TNM)',
  diagnosisDate: 'Data do diagnóstico',
  performanceStatus: 'Performance status (ECOG)',
  currentTreatment: 'Tratamento atual',
  tStage: 'TNM — T',
  nStage: 'TNM — N',
  mStage: 'TNM — M',
  grade: 'Grau',
  comorbidities: 'Comorbidades',
  currentMedications: 'Medicamentos em uso',
  allergyEntries: 'Alergia',
  allergies: 'Observações de alergias',
  familyHistory: 'História familiar',
  smokingProfile: 'Tabagismo',
  alcoholProfile: 'Álcool',
  occupationalExposureEntries: 'Exposição ocupacional',
  ehrPatientId: 'ID do paciente no EHR',
  priorSurgeries: 'Cirurgia prévia',
  priorHospitalizations: 'Internação prévia',
  relationship: 'Parentesco',
  substanceKey: 'Substância',
  customLabel: 'Nome (outra substância)',
  reactionNotes: 'Reação',
  catalogKey: 'Medicamento (catálogo)',
  dosage: 'Dose',
  frequency: 'Frequência',
  indication: 'Indicação',
  type: 'Tipo',
  severity: 'Gravidade',
  procedureName: 'Procedimento',
  summary: 'Resumo',
};

function labelForPath(path: string[]): string {
  if (path.length === 0) return 'Campo';

  if (path.length === 1) {
    const k = path[0];
    if (k === 'name') return 'Nome completo';
    return SEGMENT_LABEL_PT[k] ?? k;
  }

  const [a, b, c] = path;

  const indexed = (
    blockSingular: string,
    indexStr: string | undefined,
    leafKey?: string
  ) => {
    if (!indexStr || !/^\d+$/.test(indexStr)) return blockSingular;
    const line = Number(indexStr) + 1;
    const leaf = leafKey ? (SEGMENT_LABEL_PT[leafKey] ?? leafKey) : '';
    return leaf
      ? `${blockSingular} (linha ${line}) — ${leaf}`
      : `${blockSingular} (linha ${line})`;
  };

  if (a === 'comorbidities') return indexed('Comorbidade', b, c);
  if (a === 'familyHistory') return indexed('História familiar', b, c);
  if (a === 'allergyEntries') return indexed('Alergia', b, c);
  if (a === 'currentMedications') return indexed('Medicamento', b, c);
  if (a === 'occupationalExposureEntries')
    return indexed('Exposição ocupacional', b, c);
  if (a === 'priorSurgeries') return indexed('Cirurgia prévia', b, c);
  if (a === 'priorHospitalizations') return indexed('Internação prévia', b, c);

  const leaf = path[path.length - 1];
  return SEGMENT_LABEL_PT[leaf] ?? path.join(' › ');
}

function isZodRequiredMessage(msg: string): boolean {
  const t = msg.trim();
  if (t === 'Required' || /^required$/i.test(t)) return true;
  // Zod PT / mensagens curtas de tipo ausente
  if (/^expected/i.test(t) && /required/i.test(t)) return true;
  return false;
}

type LeafError = { path: string[]; message: string };

function collectLeafErrors(err: unknown, pathPrefix: string[]): LeafError[] {
  const out: LeafError[] = [];
  if (err == null || typeof err !== 'object') return out;

  if (Array.isArray(err)) {
    for (let i = 0; i < err.length; i++) {
      out.push(...collectLeafErrors(err[i], [...pathPrefix, String(i)]));
    }
    return out;
  }

  const rec = err as Record<string, unknown>;
  if (typeof rec.message === 'string' && rec.message.length > 0) {
    out.push({ path: pathPrefix, message: rec.message });
    return out;
  }

  // RHF: alguns resolvers guardam texto só em `types`
  if (rec.types && typeof rec.types === 'object' && !Array.isArray(rec.types)) {
    for (const v of Object.values(rec.types as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) {
        out.push({ path: pathPrefix, message: v });
      }
    }
    if (out.length > 0) return out;
  }

  for (const [k, v] of Object.entries(rec)) {
    if (k === 'ref' || k === 'type' || k === 'types') continue;
    out.push(...collectLeafErrors(v, [...pathPrefix, k]));
  }
  return out;
}

function formatLeafError(e: LeafError): string {
  const msg = e.message.trim();
  if (isZodRequiredMessage(msg)) {
    return `${labelForPath(e.path)}: preenchimento obrigatório`;
  }
  return msg;
}

/**
 * Mensagens para toast — uma entrada por campo; vários "Required" do Zod
 * viram linhas distintas com o nome do campo, em vez de um texto genérico único.
 */
export function collectAllFormErrorMessages<T extends FieldValues>(
  errs: FieldErrors<T>
): string[] {
  const leaves = collectLeafErrors(errs, []);
  const formatted = leaves.map(formatLeafError);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of formatted) {
    if (!seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

/**
 * Lista de mensagens a partir do `ZodError` (parse falhou).
 * Preferir isto no `onInvalid` do formulário: o objeto `errors` do RHF pode
 * omitir ou fundir issues; o Zod lista todas com `path` confiável.
 */
export function messagesFromZodError(zerr: ZodError): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of zerr.issues) {
    const path = issue.path.map((p) => String(p));
    const raw = issue.message.trim();
    const line = isZodRequiredMessage(raw)
      ? `${labelForPath(path)}: preenchimento obrigatório`
      : raw;
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}
