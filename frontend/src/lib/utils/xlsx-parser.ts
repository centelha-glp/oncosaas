import * as XLSX from 'xlsx';
import type { ImportSpreadsheetRow } from '@/lib/api/patients';

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

    // Mapear headers
    const mappedHeaders: MappedHeader[] = rawHeaders.map((raw, i) => ({
      raw,
      mapped: HEADER_MAP[normalizedHeaders[i]] || null,
    }));

    // Processar linhas de dados
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
      for (let c = 0; c < rawHeaders.length; c++) {
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

    sheets.push({
      name: sheetName,
      rawHeaders,
      mappedHeaders,
      rows,
      skippedEmpty,
    });
  }

  return { sheets };
}
