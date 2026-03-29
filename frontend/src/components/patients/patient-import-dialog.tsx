'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePatientImport } from '@/hooks/use-patient-import';
import { useSpreadsheetImport } from '@/hooks/use-spreadsheet-import';
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  FileSpreadsheet,
  ChevronDown,
  X,
} from 'lucide-react';
import Papa from 'papaparse';
import { csvRowSchema, CsvRow } from '@/lib/validations/import-csv';
import {
  parseXlsxFile,
  buildRowsFromMapping,
  downloadXlsxTemplate,
  FIELD_LABELS,
  MAPPABLE_FIELDS,
} from '@/lib/utils/xlsx-parser';
import type { ParsedSheet, MappedHeader } from '@/lib/utils/xlsx-parser';
import type { ImportSpreadsheetRow } from '@/lib/api/patients';

interface PatientImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type ImportMode = 'csv' | 'xlsx';

// Campos booleanos que devem ser exibidos como Sim/Não
const BOOLEAN_FIELDS = new Set<keyof ImportSpreadsheetRow>([
  'isReadmission',
  'isReoperation',
  'hadNeoadjuvantChemo',
  'hadUrinaryDiversion',
  'intraoperativeMortality',
  'mortality30Days',
  'mortality90Days',
]);

// Campos "detalhe" que são exibidos junto com o booleano pai
const DETAIL_FIELDS = new Set<keyof ImportSpreadsheetRow>([
  'readmissionReason',
  'neoadjuvantChemoDetail',
  'mortality90DaysDetail',
]);

function formatCellValue(
  row: ImportSpreadsheetRow,
  field: keyof ImportSpreadsheetRow,
): string {
  const value = row[field];
  if (value == null || value === '') return '-';

  if (BOOLEAN_FIELDS.has(field)) {
    const flag = value as boolean;
    // Verificar se tem campo detalhe associado
    if (field === 'hadNeoadjuvantChemo' && row.neoadjuvantChemoDetail) {
      return flag ? row.neoadjuvantChemoDetail : 'Não';
    }
    if (field === 'isReadmission' && row.readmissionReason) {
      return flag ? row.readmissionReason : 'Não';
    }
    if (field === 'mortality90Days' && row.mortality90DaysDetail) {
      return flag ? row.mortality90DaysDetail : 'Não';
    }
    return flag ? 'Sim' : 'Não';
  }

  return String(value);
}

export function PatientImportDialog({
  open,
  onOpenChange,
}: PatientImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode | null>(null);

  // CSV state
  const [csvPreviewData, setCsvPreviewData] = useState<CsvRow[]>([]);
  const [csvValidationErrors, setCsvValidationErrors] = useState<
    ValidationError[]
  >([]);

  // XLSX state
  const [xlsxSheets, setXlsxSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [customMappings, setCustomMappings] = useState<
    Record<number, MappedHeader[]>
  >({});

  const [showInstructions, setShowInstructions] = useState(false);
  const { mutate: importCsv, isPending: isCsvPending } = usePatientImport();
  const { mutate: importSpreadsheet, isPending: isXlsxPending } =
    useSpreadsheetImport();
  const isPending = isCsvPending || isXlsxPending;

  const resetState = () => {
    setFile(null);
    setImportMode(null);
    setCsvPreviewData([]);
    setCsvValidationErrors([]);
    setXlsxSheets([]);
    setSelectedSheetIndex(0);
    setCustomMappings({});
  };

  const selectedSheet = xlsxSheets[selectedSheetIndex];

  // Mapeamento efetivo: custom se existir, senão auto-detectado
  const effectiveMappings = useMemo(
    () =>
      customMappings[selectedSheetIndex] ||
      selectedSheet?.mappedHeaders ||
      [],
    [customMappings, selectedSheetIndex, selectedSheet],
  );

  // Reconstruir rows quando mapeamento muda
  const { rows: xlsxRows, skippedEmpty: xlsxSkippedEmpty } = useMemo(() => {
    if (!selectedSheet) return { rows: [], skippedEmpty: 0 };
    return buildRowsFromMapping(
      selectedSheet.rawData,
      selectedSheet.headerRowIdx,
      effectiveMappings,
    );
  }, [selectedSheet, effectiveMappings]);

  // Colunas visíveis no preview — somente campos mapeados (excluindo campos "detalhe")
  const visibleColumns = useMemo(() => {
    const mapped = effectiveMappings
      .filter((h) => h.mapped && !DETAIL_FIELDS.has(h.mapped))
      .map((h) => h.mapped!);
    // Deduplica mantendo ordem
    return [...new Set(mapped)];
  }, [effectiveMappings]);

  // Campos já usados em alguma coluna (para evitar mapeamento duplicado)
  const usedFields = useMemo(() => {
    const set = new Set<keyof ImportSpreadsheetRow>();
    for (const h of effectiveMappings) {
      if (h.mapped) set.add(h.mapped);
    }
    return set;
  }, [effectiveMappings]);

  const handleColumnRemap = useCallback(
    (colIndex: number, newField: keyof ImportSpreadsheetRow | '') => {
      const base =
        customMappings[selectedSheetIndex] ||
        selectedSheet?.mappedHeaders ||
        [];
      const updated = base.map((h, i) => {
        if (i !== colIndex) return h;
        return { ...h, mapped: newField || null };
      });
      setCustomMappings((prev) => ({
        ...prev,
        [selectedSheetIndex]: updated,
      }));
    },
    [customMappings, selectedSheetIndex, selectedSheet],
  );

  const downloadTemplate = () => {
    downloadXlsxTemplate();
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    resetState();
    setFile(selectedFile);

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      setImportMode('csv');
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows: CsvRow[] = [];
          const errors: ValidationError[] = [];
          results.data.forEach((row: any, index: number) => {
            try {
              const validated = csvRowSchema.parse(row);
              rows.push(validated);
            } catch (error: any) {
              if (error.errors) {
                error.errors.forEach((err: any) => {
                  errors.push({
                    row: index + 2,
                    field: err.path.join('.'),
                    message: err.message,
                  });
                });
              }
            }
          });
          setCsvPreviewData(rows);
          setCsvValidationErrors(errors);
        },
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      setImportMode('xlsx');
      const buffer = await selectedFile.arrayBuffer();
      const { sheets } = parseXlsxFile(buffer);
      setXlsxSheets(sheets);
      // Auto-selecionar a sheet com mais dados
      if (sheets.length > 0) {
        const bestIdx = sheets.reduce(
          (best, s, i) =>
            s.rows.length > sheets[best].rows.length ? i : best,
          0,
        );
        setSelectedSheetIndex(bestIdx);
      }
    }

    // Reset file input
    event.target.value = '';
  };

  const handleImport = () => {
    if (importMode === 'csv' && file) {
      importCsv(file, {
        onSuccess: () => {
          resetState();
          onOpenChange(false);
        },
      });
    } else if (importMode === 'xlsx') {
      if (xlsxRows.length === 0) return;
      importSpreadsheet(xlsxRows, {
        onSuccess: () => {
          resetState();
          onOpenChange(false);
        },
      });
    }
  };

  const totalImportable =
    importMode === 'csv' ? csvPreviewData.length : xlsxRows.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Pacientes</DialogTitle>
          <DialogDescription>
            Selecione um arquivo CSV ou planilha Excel (.xlsx) com os dados dos
            pacientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {importMode === 'xlsx' ? (
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {file
                  ? file.name
                  : 'Clique para selecionar arquivo CSV ou Excel'}
              </span>
              <span className="text-xs text-muted-foreground">
                Formatos aceitos: .csv, .xlsx, .xls
              </span>
            </label>
          </div>

          {/* Instruções CSV (toggle) */}
          {!importMode && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInstructions(!showInstructions)}
              >
                <Info className="h-4 w-4 mr-2" />
                {showInstructions ? 'Ocultar' : 'Ver'} instruções CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Template XLSX
              </Button>
            </div>
          )}

          {showInstructions && !importMode && <CsvInstructions />}

          {/* XLSX: Seleção de Sheet */}
          {importMode === 'xlsx' && xlsxSheets.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Planilha:</span>
              <div className="flex gap-2">
                {xlsxSheets.map((sheet, i) => (
                  <Button
                    key={sheet.name}
                    variant={i === selectedSheetIndex ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSheetIndex(i)}
                  >
                    {sheet.name} ({sheet.rows.length})
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* XLSX: Mapeamento de colunas editável */}
          {importMode === 'xlsx' && selectedSheet && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  Mapeamento de Colunas
                </h3>
                <span className="text-xs text-muted-foreground">
                  {effectiveMappings.filter((h) => h.mapped).length}/
                  {selectedSheet.rawHeaders.length} colunas mapeadas
                  {' · '}
                  <span className="text-muted-foreground/70">
                    clique para remapear
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {effectiveMappings.map((h, colIdx) => (
                  <ColumnMappingBadge
                    key={`${selectedSheetIndex}-${colIdx}`}
                    header={h}
                    colIndex={colIdx}
                    usedFields={usedFields}
                    onRemap={handleColumnRemap}
                  />
                ))}
              </div>
            </div>
          )}

          {/* XLSX: Preview com todos os campos */}
          {importMode === 'xlsx' && xlsxRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preview dos Dados</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {xlsxRows.length} paciente(s)
                  </div>
                  {xlsxSkippedEmpty > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({xlsxSkippedEmpty} linhas vazias ignoradas)
                    </span>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {visibleColumns.map((field) => (
                          <th
                            key={field}
                            className="px-3 py-2 text-left whitespace-nowrap text-xs"
                          >
                            {FIELD_LABELS[field]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {xlsxRows.slice(0, 15).map((row, index) => (
                        <tr key={index} className="hover:bg-muted/50">
                          {visibleColumns.map((field) => (
                            <td
                              key={field}
                              className={`px-3 py-2 whitespace-nowrap ${
                                field === 'medicalRecordNumber'
                                  ? 'font-mono text-xs'
                                  : ''
                              }`}
                            >
                              {formatCellValue(row, field)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {xlsxRows.length > 15 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted">
                    Mostrando 15 de {xlsxRows.length} linhas
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CSV: Preview */}
          {importMode === 'csv' && csvPreviewData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Preview dos Dados</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {csvPreviewData.length} valido(s)
                  </div>
                  {csvValidationErrors.length > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      {csvValidationErrors.length} erro(s)
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-left">CPF</th>
                        <th className="px-3 py-2 text-left">Tipo Cancer</th>
                        <th className="px-3 py-2 text-left">
                          Data Diagnostico
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {csvPreviewData.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.cpf || '-'}</td>
                          <td className="px-3 py-2">
                            {row.tipoCancer || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {row.dataDiagnostico || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvPreviewData.length > 10 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted">
                    Mostrando 10 de {csvPreviewData.length} linhas
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CSV: Erros */}
          {importMode === 'csv' && csvValidationErrors.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">
                Erros de Validacao
              </h3>
              <div className="border border-destructive/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2 text-sm">
                  {csvValidationErrors.map((error, index) => (
                    <div key={index} className="text-destructive">
                      <strong>Linha {error.row}</strong> - {error.field}:{' '}
                      {error.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* XLSX: Info summary */}
          {importMode === 'xlsx' && xlsxRows.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p>
                    Pacientes com o mesmo <strong>prontuario</strong> serao
                    atualizados (novas cirurgias adicionadas ao registro
                    existente). Tipo de cancer sera definido automaticamente
                    como <strong>bexiga</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Acoes */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetState();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || totalImportable === 0 || isPending}
            >
              {isPending
                ? 'Importando...'
                : `Importar ${totalImportable} paciente(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Badge de mapeamento de coluna com dropdown para remapeamento manual.
 */
function ColumnMappingBadge({
  header,
  colIndex,
  usedFields,
  onRemap,
}: {
  header: MappedHeader;
  colIndex: number;
  usedFields: Set<keyof ImportSpreadsheetRow>;
  onRemap: (colIndex: number, field: keyof ImportSpreadsheetRow | '') => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
          header.mapped
            ? 'bg-green-100 text-green-800 hover:bg-green-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        <span className="font-medium">{header.raw}</span>
        {header.mapped ? (
          <>
            <span className="text-green-500">&#8594;</span>
            <span>{FIELD_LABELS[header.mapped]}</span>
          </>
        ) : null}
        <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded-lg shadow-lg py-1 w-52 max-h-64 overflow-y-auto">
            {/* Opção: ignorar */}
            <button
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2 ${
                !header.mapped ? 'bg-gray-50 font-medium' : ''
              }`}
              onClick={() => {
                onRemap(colIndex, '');
                setIsOpen(false);
              }}
            >
              <X className="h-3 w-3 text-gray-400" />
              <span className="text-gray-500 italic">Ignorar coluna</span>
            </button>
            <div className="border-t my-1" />
            {/* Campos disponíveis */}
            {MAPPABLE_FIELDS.map((field) => {
              const isCurrentMapping = header.mapped === field;
              const isUsedElsewhere =
                usedFields.has(field) && !isCurrentMapping;
              return (
                <button
                  key={field}
                  type="button"
                  disabled={isUsedElsewhere}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                    isCurrentMapping
                      ? 'bg-green-50 text-green-800 font-medium'
                      : isUsedElsewhere
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  onClick={() => {
                    if (!isUsedElsewhere) {
                      onRemap(colIndex, field);
                      setIsOpen(false);
                    }
                  }}
                >
                  <span>{FIELD_LABELS[field]}</span>
                  {isCurrentMapping && (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  )}
                  {isUsedElsewhere && (
                    <span className="text-[10px] text-gray-400">em uso</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CsvInstructions() {
  return (
    <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
      <div className="flex items-start gap-2">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-2">
            Estrutura do Arquivo CSV
          </h3>
          <div className="bg-white rounded border border-blue-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-blue-900">
                    Coluna
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-blue-900">
                    Obrigatorio
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-blue-900">
                    Exemplo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {[
                  ['name', 'Sim', 'Maria Silva'],
                  ['cpf', 'Nao', '12345678900'],
                  ['dataNascimento', 'Nao', '1980-05-15'],
                  ['sexo', 'Nao', 'male / female / other'],
                  ['telefone', 'Nao', '27987654321'],
                  ['email', 'Nao', 'maria@email.com'],
                  ['tipoCancer', 'Nao', 'bladder'],
                  ['dataDiagnostico', 'Nao', '2024-01-10'],
                  ['estagio', 'Nao', 'II'],
                  ['oncologistaResponsavel', 'Nao', 'Dr. Santos'],
                ].map(([col, req, ex]) => (
                  <tr key={col}>
                    <td className="px-3 py-1 font-mono text-xs">{col}</td>
                    <td className="px-3 py-1">
                      <span
                        className={
                          req === 'Sim'
                            ? 'text-red-600 font-semibold'
                            : 'text-green-600'
                        }
                      >
                        {req}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-xs">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
