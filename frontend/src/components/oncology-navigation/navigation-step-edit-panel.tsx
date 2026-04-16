'use client';

import React, { useId } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  File,
  FileText,
  FlaskConical,
  Microscope,
  Paperclip,
  Pill,
  ScanLine,
  Stethoscope,
  Syringe,
  Upload,
  Activity,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getNavigationStepContextHint } from '@/lib/utils/navigation-step-ux-hints';
import {
  type NavStepFormVariant,
  STEP_DETAIL_FIELD_CONFIG,
  VARIANT_SECTION_TITLE,
} from '@/lib/utils/nav-step-form-variants';
import { buildSafeApiFileHref } from '@/lib/utils/safe-api-url';

export type StepFileMeta = {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedAt: string;
  uploadedBy: string;
};

export interface NavigationStepEditPanelProps {
  stepKey: string;
  /** Define quais campos específicos são exibidos (consulta = SOAP, imagem, patologia, etc.) */
  variant: NavStepFormVariant;
  /**
   * Quando definido (ex.: consultas com evolução no prontuário), substitui o bloco SOAP/metadata
   * da variante — evita modelo clínico duplicado.
   */
  variantSectionReplacement?: React.ReactNode;
  stepDetail: Record<string, string>;
  onStepDetailFieldChange: (key: string, value: string) => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
  actualDate: string;
  onActualDateChange: (v: string) => void;
  isCompleted: boolean;
  onIsCompletedChange: (v: boolean) => void;
  institutionName: string;
  onInstitutionNameChange: (v: string) => void;
  professionalName: string;
  onProfessionalNameChange: (v: string) => void;
  result: string;
  onResultChange: (v: string) => void;
  findings: string[];
  newFinding: string;
  onNewFindingChange: (v: string) => void;
  onAddFinding: () => void;
  onRemoveFinding: (index: number) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  files: StepFileMeta[];
  apiUrl: string;
  onUpload: () => void;
  uploadPending: boolean;
  formatFileSize: (bytes: number) => string;
  onSave: () => void;
  onCancel: () => void;
  savePending: boolean;
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-foreground">
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <h4 className="text-sm font-semibold tracking-tight">{children}</h4>
    </div>
  );
}

function variantSectionIcon(v: NavStepFormVariant): React.ElementType {
  switch (v) {
    case 'clinical_consultation':
      return Stethoscope;
    case 'imaging':
      return ScanLine;
    case 'pathology':
      return Microscope;
    case 'endoscopy':
      return Activity;
    case 'systemic_therapy':
      return Pill;
    case 'surgery':
      return Syringe;
    case 'screening_lab':
      return FlaskConical;
    default:
      return FlaskConical;
  }
}

export function NavigationStepEditPanel({
  stepKey,
  variant,
  variantSectionReplacement,
  stepDetail,
  onStepDetailFieldChange,
  dueDate,
  onDueDateChange,
  actualDate,
  onActualDateChange,
  isCompleted,
  onIsCompletedChange,
  institutionName,
  onInstitutionNameChange,
  professionalName,
  onProfessionalNameChange,
  result,
  onResultChange,
  findings,
  newFinding,
  onNewFindingChange,
  onAddFinding,
  onRemoveFinding,
  notes,
  onNotesChange,
  selectedFile,
  onFileChange,
  files,
  apiUrl,
  onUpload,
  uploadPending,
  formatFileSize,
  onSave,
  onCancel,
  savePending,
}: NavigationStepEditPanelProps): React.ReactElement {
  const hint = getNavigationStepContextHint(stepKey);
  const VariantIcon = variantSectionIcon(variant);
  const idPrefix = useId();
  const dueId = `${idPrefix}-due`;
  const actualId = `${idPrefix}-actual`;
  const instId = `${idPrefix}-inst`;
  const profId = `${idPrefix}-prof`;
  const findingInputId = `${idPrefix}-finding`;
  const notesId = `${idPrefix}-notes`;
  const fileInputId = `${idPrefix}-file`;

  return (
    <div
      className="mt-3 rounded-lg border border-border bg-background p-4 text-foreground shadow-sm"
      role="region"
      aria-label="Editar detalhes da etapa"
    >
      {hint ? (
        <p
          className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm leading-relaxed text-foreground"
          id={`${idPrefix}-hint`}
        >
          <span className="font-medium text-primary">Dica para esta etapa: </span>
          {hint}
        </p>
      ) : null}

      <div className="space-y-6">
        <section
          className="space-y-3 rounded-md border border-border/80 bg-muted/30 p-3"
          aria-labelledby={`${idPrefix}-sec-dates`}
        >
          <div id={`${idPrefix}-sec-dates`}>
            <SectionTitle icon={CalendarDays}>Prazos e status</SectionTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            A data limite alimenta alertas de atraso no painel. A data realizada registra quando o
            evento ocorreu de fato.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={dueId}>
                Data limite <span className="text-destructive">*</span>
              </Label>
              <Input
                id={dueId}
                type="date"
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                required
                aria-required="true"
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Obrigatória para manter o monitoramento de prazos e atrasos.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={actualId}>Data realizada</Label>
              <Input
                id={actualId}
                type="date"
                value={actualDate}
                onChange={(e) => onActualDateChange(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent p-1 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={isCompleted}
              onChange={(e) => onIsCompletedChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
              aria-describedby={`${idPrefix}-completed-help`}
            />
            <span>
              <span className="text-sm font-medium leading-snug">Marcar etapa como concluída</span>
              <span
                id={`${idPrefix}-completed-help`}
                className="mt-0.5 block text-xs text-muted-foreground"
              >
                Ao concluir, confira se a data realizada e o local estão coerentes com o atendimento.
              </span>
            </span>
          </label>
        </section>

        <Separator />

        <section
          className="space-y-3 rounded-md border border-border/80 bg-muted/30 p-3"
          aria-labelledby={`${idPrefix}-sec-place`}
        >
          <div id={`${idPrefix}-sec-place`}>
            <SectionTitle icon={Building2}>Onde e quem</SectionTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Padronize nomes (ex.: hospital + cidade) para facilitar relatórios e continuidade do
            cuidado.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={instId}>Instituição de saúde</Label>
              <Input
                id={instId}
                value={institutionName}
                onChange={(e) => onInstitutionNameChange(e.target.value)}
                placeholder="Ex.: Hospital das Clínicas — São Paulo"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={profId}>Profissional responsável / executor</Label>
              <Input
                id={profId}
                value={professionalName}
                onChange={(e) => onProfessionalNameChange(e.target.value)}
                placeholder="Nome e conselho (CRM, COREN…)"
                autoComplete="name"
              />
            </div>
          </div>
        </section>

        <Separator />

        {variantSectionReplacement != null ? (
          <div className="space-y-3">{variantSectionReplacement}</div>
        ) : variant === 'generic' ? (
          <section
            className="space-y-3 rounded-md border border-border/80 bg-muted/30 p-3"
            aria-labelledby={`${idPrefix}-sec-result`}
          >
            <div id={`${idPrefix}-sec-result`}>
              <SectionTitle icon={FlaskConical}>{VARIANT_SECTION_TITLE.generic}</SectionTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              O resultado resume o laudo; use achados para itens objetivos (ex.: &quot;Lesão 2 cm
              paredes laterais&quot;).
            </p>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-result`}>Resultado global</Label>
              <Select
                value={result ? result : undefined}
                onValueChange={onResultChange}
              >
                <SelectTrigger
                  id={`${idPrefix}-result`}
                  className="w-full"
                  aria-label="Resultado global do exame ou consulta"
                >
                  <SelectValue placeholder="Selecione o resultado…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal / dentro do esperado</SelectItem>
                  <SelectItem value="Alterado">Alterado / achados relevantes</SelectItem>
                  <SelectItem value="Pendente">Pendente / aguardando laudo</SelectItem>
                  <SelectItem value="Inconclusivo">Inconclusivo</SelectItem>
                  <SelectItem value="Outro">Outro (detalhar nas observações)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={findingInputId}>Achados (um por linha)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={findingInputId}
                  value={newFinding}
                  onChange={(e) => onNewFindingChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddFinding();
                    }
                  }}
                  placeholder="Digite um achado e pressione Enter ou use Adicionar"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 sm:w-auto"
                  onClick={onAddFinding}
                >
                  Adicionar
                </Button>
              </div>
              {findings.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-live="polite">
                  {findings.map((finding, index) => (
                    <li
                      key={`${finding}-${index}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-secondary-foreground"
                    >
                      <span className="truncate">{finding}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveFinding(index)}
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        aria-label={`Remover achado: ${finding}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum achado listado ainda.</p>
              )}
            </div>
          </section>
        ) : (
          <section
            className="space-y-4 rounded-md border border-border/80 bg-muted/30 p-3"
            aria-labelledby={`${idPrefix}-sec-variant`}
          >
            <div id={`${idPrefix}-sec-variant`}>
              <SectionTitle icon={VariantIcon}>{VARIANT_SECTION_TITLE[variant]}</SectionTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Campos específicos deste tipo de etapa. Os dados são guardados de forma estruturada para
              relatórios e continuidade do cuidado.
            </p>
            <div className="space-y-4">
              {STEP_DETAIL_FIELD_CONFIG[variant].map((field) => {
                const fid = `${idPrefix}-sd-${field.key}`;
                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={fid}>{field.label}</Label>
                    <AutoResizeTextarea
                      id={fid}
                      value={stepDetail[field.key] ?? ''}
                      onChange={(e) => onStepDetailFieldChange(field.key, e.target.value)}
                      minRows={field.rows ?? 3}
                    />
                    {field.helper ? (
                      <p className="text-xs text-muted-foreground">{field.helper}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Separator />

        <section
          className="space-y-3 rounded-md border border-border/80 bg-muted/30 p-3"
          aria-labelledby={`${idPrefix}-sec-notes`}
        >
          <div id={`${idPrefix}-sec-notes`}>
            <SectionTitle icon={FileText}>Observações e documentos</SectionTitle>
          </div>
          <div className="space-y-2">
            <Label htmlFor={notesId}>
              {variant === 'clinical_consultation'
                ? variantSectionReplacement != null
                  ? 'Notas operacionais (opcional)'
                  : 'Observações complementares (opcional)'
                : 'Observações'}
            </Label>
            <AutoResizeTextarea
              id={notesId}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={
                variant === 'clinical_consultation'
                  ? variantSectionReplacement != null
                    ? 'Lembretes internos, logística ou detalhes que não vão no prontuário…'
                    : 'Notas administrativas ou detalhes que não couberam nos campos da evolução…'
                  : 'Contexto clínico, próximos passos, orientações ao paciente…'
              }
              minRows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={fileInputId} className="inline-flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              Anexar arquivo
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id={fileInputId}
                type="file"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              {selectedFile ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onUpload}
                  disabled={uploadPending}
                  className="shrink-0 gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadPending ? 'Enviando…' : 'Enviar'}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              PDF ou imagens de laudos aceleram a revisão pela equipe.
            </p>
          </div>

          {files.length > 0 ? (
            <div className="space-y-2">
              <span className="text-sm font-medium">Arquivos anexados</span>
              <ul className="space-y-1.5">
                {files.map((file, index) => (
                  <li
                    key={`${file.filename}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{file.originalName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    {(() => {
                      const fileHref = buildSafeApiFileHref(apiUrl, file.path);
                      if (!fileHref) {
                        return (
                          <span className="shrink-0 text-xs text-muted-foreground" title="Link inválido">
                            —
                          </span>
                        );
                      }
                      return (
                        <a
                          href={fileHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Abrir
                        </a>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <div
        className={cn(
          'mt-6 flex flex-col gap-2 border-t border-border pt-4',
          'sm:sticky sm:bottom-0 sm:z-10 sm:-mx-4 sm:mt-4 sm:bg-background/95 sm:px-4 sm:pb-2 sm:pt-4 sm:backdrop-blur supports-[backdrop-filter]:bg-background/80'
        )}
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave} disabled={savePending} className="gap-2">
            <Check className="h-4 w-4" />
            {savePending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="gap-2">
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
