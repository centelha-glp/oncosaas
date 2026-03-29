import * as XLSX from 'xlsx';
import type { ImportSpreadsheetRow } from '@/lib/api/patients';

/**
 * Labels legíveis para cada campo do ImportSpreadsheetRow.
 */
export const FIELD_LABELS: Record<keyof ImportSpreadsheetRow, string> = {
  name: 'Nome',
  medicalRecordNumber: 'Prontuário',
  birthDate: 'Nascimento',
  gender: 'Sexo',
  occupation: 'Ocupação',
  smokingHistory: 'Tabagista',
  cpf: 'CPF',
  phone: 'Telefone',
  surgeryDate: 'Data Cirurgia',
  surgeryType: 'Tipo Cirurgia',
  admissionDate: 'Internação',
  dischargeDate: 'Alta',
  aihEmissionDate: 'Emissão AIH',
  isReadmission: 'Reinternação',
  readmissionReason: 'Motivo Reint.',
  isReoperation: 'Re-Op',
  hadNeoadjuvantChemo: 'QT Neo',
  neoadjuvantChemoDetail: 'Detalhe QT Neo',
  hadUrinaryDiversion: 'Derivação',
  intraoperativeMortality: 'Mort. Intra',
  mortality30Days: 'Mort. 30 Dias',
  mortality90Days: 'Mort. 90 Dias',
  mortality90DaysDetail: 'Detalhe Mort. 90',
  diagnosis: 'Diagnóstico',
  referenceDate: 'Data Ref.',
};

/**
 * Lista de campos disponíveis para mapeamento.
 */
export const MAPPABLE_FIELDS = Object.keys(FIELD_LABELS) as (keyof ImportSpreadsheetRow)[];

/**
 * Mapeamento de cabeçalhos PT (planilha hospitalar) → campo interno.
 * As chaves são normalizadas (uppercase, sem acentos).
 */
const HEADER_MAP: Record<string, keyof ImportSpreadsheetRow> = {
  NOME: 'name',
  PRONTUARIO: 'medicalRecordNumber',
  'D. N': 'birthDate',
  'D.N': 'birthDate',
  DN: 'birthDate',
  'DATA NASCIMENTO': 'birthDate',
  'DATA DE NASCIMENTO': 'birthDate',
  IDADE: 'birthDate', // fallback — será tratado separadamente
  SEXO: 'gender',
  OCUPACAO: 'occupation',
  TABAGISTA: 'smokingHistory',
  CPF: 'cpf',
  TELEFONE: 'phone',
  CIRURGIA: 'surgeryDate',
  'TIPO DE CIRURGIA': 'surgeryType',
  INTERNACAO: 'admissionDate',
  ALTA: 'dischargeDate',
  'EMISSAO AIH': 'aihEmissionDate',
  REINTERNACAO: 'isReadmission',
  'RE-OP': 'isReoperation',
  'QT NEO': 'hadNeoadjuvantChemo',
  DERIVACAO: 'hadUrinaryDiversion',
  'MORTALIDADE INTRA': 'intraoperativeMortality',
  'MORTALIDADE 30 DIAS': 'mortality30Days',
  'MORTALIDADE 90 DIAS': 'mortality90Days',
  DIAGNOSTICO: 'diagnosis',
  DIANOSTICO: 'diagnosis', // typo na planilha
  DATA: 'referenceDate',
};

export interface MappedHeader {
  raw: string;
  mapped: keyof ImportSpreadsheetRow | null;
}

export interface ParsedSheet {
  name: string;
  rawHeaders: string[];
  mappedHeaders: MappedHeader[];
  rows: ImportSpreadsheetRow[];
  skippedEmpty: number;
  rawData: any[][];
  headerRowIdx: number;
}

/**
 * Remove acentos e normaliza para lookup no HEADER_MAP.
 */
function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Converte serial de data do Excel para string ISO (YYYY-MM-DD).
 */
function excelSerialToDate(serial: number): string {
  // Excel epoch: 1899-12-30 (ajuste para bug do Lotus 1-2-3)
  const epoch = new Date(1899, 11, 30);
  const ms = serial * 86400000;
  const date = new Date(epoch.getTime() + ms);
  return date.toISOString().split('T')[0];
}

/**
 * Tenta extrair uma data ISO de um valor de célula Excel.
 */
function parseDate(value: any): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return excelSerialToDate(value);
  const s = String(value).trim();
  // Já é ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return undefined;
}

/**
 * Parseia um valor booleano vindo da planilha (SIM/NÃO/S/N/etc).
 * Retorna { flag, detail } — detail contém texto extra (ex: "GENCITABINA + CISPLATINA").
 */
function parseBooleanCell(value: any): { flag: boolean; detail?: string } {
  if (value == null || value === '') return { flag: false };
  const s = String(value).trim().toUpperCase();
  if (s === 'NAO' || s === 'NÃO' || s === 'N' || s === '-' || s === '0')
    return { flag: false };
  if (s === 'SIM' || s === 'S' || s === '1')
    return { flag: true };
  // Valor não-vazio que não é SIM/NÃO — provavelmente detalhe (ex: "GENCITABINA")
  return { flag: true, detail: String(value).trim() };
}

/**
 * Parseia mortalidade — pode ser "NÃO", "SIM", ou "ÓBITO EM MARÇO 2024".
 */
function parseMortality(value: any): { flag: boolean; detail?: string } {
  if (value == null || value === '') return { flag: false };
  const s = String(value).trim().toUpperCase();
  if (s === 'NAO' || s === 'NÃO' || s === 'N' || s === '-' || s === '0')
    return { flag: false };
  if (s === 'SIM' || s === 'S' || s === '1')
    return { flag: true };
  // Contém "ÓBITO" ou "OBITO" → mortalidade com detalhe
  if (s.includes('OBITO') || s.includes('ÓBITO'))
    return { flag: true, detail: String(value).trim() };
  return { flag: false };
}

/**
 * Parseia reinternação — pode ser "SIM", "NÃO", ou texto descritivo com motivo.
 */
function parseReadmission(value: any): { flag: boolean; reason?: string } {
  if (value == null || value === '') return { flag: false };
  const s = String(value).trim().toUpperCase();
  if (s === 'NAO' || s === 'NÃO' || s === 'N' || s === '-' || s === '0')
    return { flag: false };
  if (s === 'SIM' || s === 'S' || s === '1')
    return { flag: true };
  // Texto descritivo = motivo da reinternação
  return { flag: true, reason: String(value).trim() };
}

/**
 * Normaliza sexo PT → EN.
 */
function parseGender(value: any): string | undefined {
  if (value == null || value === '') return undefined;
  const s = String(value).trim().toUpperCase();
  if (s === 'M' || s === 'MASCULINO' || s === 'MALE') return 'male';
  if (s === 'F' || s === 'FEMININO' || s === 'FEMALE') return 'female';
  return 'other';
}

/**
 * Constrói as rows tipadas a partir dos dados brutos e mapeamento de colunas.
 * Pode ser chamada novamente quando o usuário altera o mapeamento.
 */
export function buildRowsFromMapping(
  rawData: any[][],
  headerRowIdx: number,
  mappedHeaders: MappedHeader[],
): { rows: ImportSpreadsheetRow[]; skippedEmpty: number } {
  const rows: ImportSpreadsheetRow[] = [];
  let skippedEmpty = 0;

  for (let r = headerRowIdx + 1; r < rawData.length; r++) {
    const rawRow = rawData[r];

    // Pular linhas completamente vazias
    const nonEmpty = rawRow.filter((c: any) => c != null && String(c).trim() !== '').length;
    if (nonEmpty < 2) {
      skippedEmpty++;
      continue;
    }

    // Construir o objeto mapeado
    const mapped: Record<string, any> = {};
    for (let c = 0; c < mappedHeaders.length; c++) {
      const field = mappedHeaders[c].mapped;
      if (!field) continue;
      mapped[field] = rawRow[c];
    }

    // Pular se não tem nome
    const name = mapped.name != null ? String(mapped.name).trim() : '';
    if (name.length < 2) {
      skippedEmpty++;
      continue;
    }

    // Montar a row tipada
    const row: ImportSpreadsheetRow = { name };

    row.medicalRecordNumber = mapped.medicalRecordNumber
      ? String(mapped.medicalRecordNumber).trim()
      : undefined;

    row.birthDate = parseDate(mapped.birthDate);
    row.gender = parseGender(mapped.gender);
    row.occupation = mapped.occupation
      ? String(mapped.occupation).trim()
      : undefined;
    row.smokingHistory = mapped.smokingHistory
      ? String(mapped.smokingHistory).trim()
      : undefined;

    // Datas
    row.surgeryDate = parseDate(mapped.surgeryDate);
    row.surgeryType = mapped.surgeryType
      ? String(mapped.surgeryType).trim()
      : undefined;
    row.admissionDate = parseDate(mapped.admissionDate);
    row.dischargeDate = parseDate(mapped.dischargeDate);
    row.aihEmissionDate = parseDate(mapped.aihEmissionDate);
    row.referenceDate = parseDate(mapped.referenceDate);

    // Booleanos
    const readmission = parseReadmission(mapped.isReadmission);
    row.isReadmission = readmission.flag;
    row.readmissionReason = readmission.reason;

    const reop = parseBooleanCell(mapped.isReoperation);
    row.isReoperation = reop.flag;

    const qtneo = parseBooleanCell(mapped.hadNeoadjuvantChemo);
    row.hadNeoadjuvantChemo = qtneo.flag;
    row.neoadjuvantChemoDetail = qtneo.detail;

    const diversion = parseBooleanCell(mapped.hadUrinaryDiversion);
    row.hadUrinaryDiversion = diversion.flag;

    // Mortalidade
    const mortIntra = parseMortality(mapped.intraoperativeMortality);
    row.intraoperativeMortality = mortIntra.flag;

    const mort30 = parseMortality(mapped.mortality30Days);
    row.mortality30Days = mort30.flag;

    const mort90 = parseMortality(mapped.mortality90Days);
    row.mortality90Days = mort90.flag;
    row.mortality90DaysDetail = mort90.detail;

    row.diagnosis = mapped.diagnosis
      ? String(mapped.diagnosis).trim()
      : undefined;

    rows.push(row);
  }

  return { rows, skippedEmpty };
}

/**
 * Gera e faz download do template XLSX para importação de pacientes.
 * Inclui todos os campos mapeáveis com exemplos e uma aba de instruções.
 */
export function downloadXlsxTemplate(): void {
  const wb = XLSX.utils.book_new();

  // ── Aba 1: Dados ──────────────────────────────────────────────────────────
  const headers = [
    'NOME',
    'PRONTUÁRIO',
    'D. N',
    'SEXO',
    'OCUPAÇÃO',
    'TABAGISTA',
    'CPF',
    'TELEFONE',
    'INTERNAÇÃO',
    'ALTA',
    'EMISSÃO AIH',
    'CIRURGIA',
    'TIPO DE CIRURGIA',
    'REINTERNAÇÃO',
    'RE-OP',
    'QT NEO',
    'DERIVAÇÃO',
    'MORTALIDADE INTRA',
    'MORTALIDADE 30 DIAS',
    'MORTALIDADE 90 DIAS',
    'DIAGNÓSTICO',
    'DATA',
  ];

  const examples = [
    [
      'MARIA SILVA SANTOS',
      '33918861',
      '15/05/1965',
      'F',
      'PROFESSORA',
      'NÃO',
      '12345678900',
      '27999991234',
      '08/01/2024',
      '12/01/2024',
      '05/01/2024',
      '10/01/2024',
      'RTU',
      'NÃO',
      'NÃO',
      'GENCITABINA + CISPLATINA',
      'NÃO',
      'NÃO',
      'NÃO',
      'NÃO',
      'Carcinoma urotelial de bexiga',
      '10/01/2024',
    ],
    [
      'JOÃO OLIVEIRA COSTA',
      '33971706',
      '22/11/1958',
      'M',
      'APOSENTADO',
      'SIM',
      '',
      '27988885678',
      '07/01/2024',
      '20/01/2024',
      '02/01/2024',
      '09/01/2024',
      'Cistectomia radical',
      'INFECÇÃO DE SÍTIO CIRÚRGICO',
      'SIM',
      'NÃO',
      'SIM',
      'NÃO',
      'NÃO',
      'NÃO',
      'Carcinoma urotelial T2N0M0',
      '09/01/2024',
    ],
    [
      'ANA BEATRIZ FERREIRA',
      '34200987',
      '03/08/1972',
      'F',
      'COMERCIANTE',
      'NÃO',
      '',
      '',
      '',
      '',
      '',
      '30/01/2024',
      'Biópsia transuretral',
      'NÃO',
      'NÃO',
      'BCG',
      'NÃO',
      'NÃO',
      'NÃO',
      'ÓBITO EM MARÇO 2024',
      'Carcinoma in situ de bexiga',
      '30/01/2024',
    ],
  ];

  const wsData = XLSX.utils.aoa_to_sheet([headers, ...examples]);

  // Larguras de coluna
  wsData['!cols'] = [
    { wch: 30 }, // NOME
    { wch: 14 }, // PRONTUÁRIO
    { wch: 12 }, // D. N
    { wch: 6 },  // SEXO
    { wch: 16 }, // OCUPAÇÃO
    { wch: 10 }, // TABAGISTA
    { wch: 14 }, // CPF
    { wch: 14 }, // TELEFONE
    { wch: 12 }, // INTERNAÇÃO
    { wch: 12 }, // ALTA
    { wch: 14 }, // EMISSÃO AIH
    { wch: 12 }, // CIRURGIA
    { wch: 22 }, // TIPO DE CIRURGIA
    { wch: 32 }, // REINTERNAÇÃO
    { wch: 7 },  // RE-OP
    { wch: 26 }, // QT NEO
    { wch: 10 }, // DERIVAÇÃO
    { wch: 16 }, // MORTALIDADE INTRA
    { wch: 18 }, // MORTALIDADE 30 DIAS
    { wch: 22 }, // MORTALIDADE 90 DIAS
    { wch: 32 }, // DIAGNÓSTICO
    { wch: 12 }, // DATA
  ];

  XLSX.utils.book_append_sheet(wb, wsData, 'Pacientes');

  // ── Aba 2: Instruções ─────────────────────────────────────────────────────
  const instructions = [
    ['Campo', 'Cabeçalho na Planilha', 'Obrigatório', 'Formato / Valores aceitos', 'Exemplo'],
    ['Nome', 'NOME', 'SIM', 'Texto (mín. 2 caracteres)', 'MARIA SILVA SANTOS'],
    ['Prontuário', 'PRONTUÁRIO', 'Recomendado', 'Número ou texto — usado para deduplicação', '33918861'],
    ['Data de Nascimento', 'D. N', 'Não', 'DD/MM/AAAA ou AAAA-MM-DD', '15/05/1965'],
    ['Sexo', 'SEXO', 'Não', 'M / F / MASCULINO / FEMININO', 'F'],
    ['Ocupação', 'OCUPAÇÃO', 'Não', 'Texto livre', 'PROFESSORA'],
    ['Tabagista', 'TABAGISTA', 'Não', 'SIM / NÃO / S / N', 'SIM'],
    ['CPF', 'CPF', 'Não', 'Somente dígitos', '12345678900'],
    ['Telefone', 'TELEFONE', 'Não', 'Somente dígitos com DDD', '27999991234'],
    ['Data de Internação', 'INTERNAÇÃO', 'Não', 'DD/MM/AAAA', '08/01/2024'],
    ['Data de Alta', 'ALTA', 'Não', 'DD/MM/AAAA', '12/01/2024'],
    ['Emissão AIH', 'EMISSÃO AIH', 'Não', 'DD/MM/AAAA', '05/01/2024'],
    ['Data da Cirurgia', 'CIRURGIA', 'Não', 'DD/MM/AAAA', '10/01/2024'],
    ['Tipo de Cirurgia', 'TIPO DE CIRURGIA', 'Não', 'Texto livre', 'RTU / Cistectomia radical'],
    ['Reinternação', 'REINTERNAÇÃO', 'Não', 'SIM / NÃO — ou texto descritivo como motivo', 'INFECÇÃO DE SÍTIO CIRÚRGICO'],
    ['Reoperação', 'RE-OP', 'Não', 'SIM / NÃO / S / N', 'SIM'],
    ['QT Neoadjuvante', 'QT NEO', 'Não', 'SIM / NÃO — ou nome do protocolo', 'GENCITABINA + CISPLATINA'],
    ['Derivação Urinária', 'DERIVAÇÃO', 'Não', 'SIM / NÃO / S / N', 'SIM'],
    ['Mortalidade Intraop.', 'MORTALIDADE INTRA', 'Não', 'SIM / NÃO', 'NÃO'],
    ['Mortalidade 30 dias', 'MORTALIDADE 30 DIAS', 'Não', 'SIM / NÃO', 'NÃO'],
    ['Mortalidade 90 dias', 'MORTALIDADE 90 DIAS', 'Não', 'SIM / NÃO — ou texto descritivo', 'ÓBITO EM MARÇO 2024'],
    ['Diagnóstico', 'DIAGNÓSTICO', 'Não', 'Texto livre (histologia, estadio)', 'Carcinoma urotelial T2N0M0'],
    ['Data de Referência', 'DATA', 'Não', 'DD/MM/AAAA — data do diagnóstico ou cirurgia', '10/01/2024'],
    [],
    ['Obs:', '', '', 'Pacientes com o mesmo PRONTUÁRIO serão atualizados (nova cirurgia adicionada). Tipo de câncer: bexiga (padrão MVP).'],
  ];

  const wsInst = XLSX.utils.aoa_to_sheet(instructions);
  wsInst['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 12 },
    { wch: 52 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções');

  XLSX.writeFile(wb, 'template_importacao_pacientes.xlsx');
}

/**
 * Parseia o arquivo XLSX e retorna as sheets com dados mapeados.
 */
export function parseXlsxFile(buffer: ArrayBuffer): { sheets: ParsedSheet[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rawData.length < 2) continue; // Sem dados

    // Encontrar a linha de cabeçalho (primeira com >= 3 colunas não-vazias)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const nonEmpty = rawData[i].filter((c: any) => c != null && String(c).trim() !== '').length;
      if (nonEmpty >= 3) {
        headerRowIdx = i;
        break;
      }
    }

    const rawHeaders: string[] = rawData[headerRowIdx].map((h: any) => String(h).trim());
    const normalizedHeaders = rawHeaders.map(normalizeHeader);

    // Mapear headers automaticamente
    const mappedHeaders: MappedHeader[] = rawHeaders.map((raw, i) => ({
      raw,
      mapped: HEADER_MAP[normalizedHeaders[i]] || null,
    }));

    const { rows, skippedEmpty } = buildRowsFromMapping(rawData, headerRowIdx, mappedHeaders);

    sheets.push({
      name: sheetName,
      rawHeaders,
      mappedHeaders,
      rows,
      skippedEmpty,
      rawData,
      headerRowIdx,
    });
  }

  return { sheets };
}
