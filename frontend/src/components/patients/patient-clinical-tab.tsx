'use client';

import React, { useState } from 'react';
import {
  PatientDetail,
  Comorbidity,
  FamilyHistory,
  CurrentMedication,
  ComplementaryExam,
  ComplementaryExamType,
  ComplementaryExamResult,
} from '@/lib/api/patients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart as LineChartIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComplementaryExamChartDialog } from './complementary-exam-chart-dialog';
import { ComplementaryExamCreateDialog } from './complementary-exam-create-dialog';
import { ComplementaryExamResultCreateDialog } from './complementary-exam-result-create-dialog';
import { ComplementaryExamResultEditDialog } from './complementary-exam-result-edit-dialog';
import { ComplementaryExamResultDeleteDialog } from './complementary-exam-result-delete-dialog';
import { PatientSymptomTimeline } from './patient-symptom-timeline';

interface PatientClinicalTabProps {
  patient: PatientDetail;
}

const SEVERITY_LABELS: Record<string, string> = {
  leve: 'Leve',
  moderada: 'Moderada',
  grave: 'Grave',
};

const SEVERITY_COLORS: Record<string, string> = {
  leve: 'bg-green-100 text-green-800 border-green-300',
  moderada: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  grave: 'bg-red-100 text-red-800 border-red-300',
};

const EXAM_TYPE_LABELS: Record<ComplementaryExamType, string> = {
  LABORATORY: 'Laboratoriais',
  ANATOMOPATHOLOGICAL: 'Anatomopatológicos',
  IMMUNOHISTOCHEMICAL: 'Imuno-histoquímicos',
  IMAGING: 'Imagem',
};

const EXAM_TYPE_ORDER: ComplementaryExamType[] = [
  'LABORATORY',
  'ANATOMOPATHOLOGICAL',
  'IMMUNOHISTOCHEMICAL',
  'IMAGING',
];

function getECOGDescription(score: number): string {
  if (score === 0) return 'Assintomático';
  if (score === 1) return 'Sintomático, mas ambulatorial';
  if (score === 2) return 'Acamado <50% do tempo';
  if (score === 3) return 'Acamado >50% do tempo';
  if (score === 4) return 'Totalmente acamado';
  return '';
}

export function PatientClinicalTab({
  patient,
}: PatientClinicalTabProps): React.ReactElement {
  const [chartExam, setChartExam] = useState<ComplementaryExam | null>(null);
  const [openAddExam, setOpenAddExam] = useState(false);
  const [examForResult, setExamForResult] = useState<ComplementaryExam | null>(
    null
  );
  const [resultToEdit, setResultToEdit] = useState<{
    exam: ComplementaryExam;
    result: ComplementaryExamResult;
  } | null>(null);
  const [resultToDelete, setResultToDelete] = useState<{
    exam: ComplementaryExam;
    result: ComplementaryExamResult;
  } | null>(null);

  const complementaryExams: ComplementaryExam[] = Array.isArray(
    patient.complementaryExams
  )
    ? patient.complementaryExams
    : [];

  const comorbidities: Comorbidity[] = Array.isArray(patient.comorbidities)
    ? patient.comorbidities
    : [];

  const familyHistory: FamilyHistory[] = Array.isArray(patient.familyHistory)
    ? patient.familyHistory
    : [];

  const currentMedications: CurrentMedication[] = [];

  return (
    <div className="space-y-6">
      {/* Performance Status (ECOG) */}
      {patient.performanceStatus !== null &&
        patient.performanceStatus !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle>Performance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    ECOG
                  </span>
                  <div className="mt-1">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {patient.performanceStatus}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {getECOGDescription(patient.performanceStatus as number)}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Medicamentos em uso */}
      <Card>
        <CardHeader>
          <CardTitle>Medicamentos em uso</CardTitle>
        </CardHeader>
        <CardContent>
          {currentMedications.length > 0 ? (
            <div className="space-y-3">
              {currentMedications.map((medication, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-1 p-3 border rounded-lg"
                >
                  <div className="font-medium">{medication.name}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {medication.dosage && (
                      <span>
                        <span className="font-medium">Dose:</span>{' '}
                        {medication.dosage}
                      </span>
                    )}
                    {medication.frequency && (
                      <span>
                        <span className="font-medium">Frequência:</span>{' '}
                        {medication.frequency}
                      </span>
                    )}
                    {medication.indication && (
                      <span>
                        <span className="font-medium">Indicação:</span>{' '}
                        {medication.indication}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum medicamento em uso registrado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exames complementares */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Exames complementares</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpenAddExam(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar exame
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {complementaryExams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum exame complementar registrado.
            </p>
          ) : (
            EXAM_TYPE_ORDER.map((type) => {
              const examsOfType = complementaryExams.filter(
                (e) => e.type === type
              );
              if (examsOfType.length === 0) return null;
              return (
                <div key={type}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                    {EXAM_TYPE_LABELS[type]}
                  </h4>
                  <div className="space-y-4">
                    {examsOfType.map((exam) => (
                      <div
                        key={exam.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-medium">{exam.name}</span>
                            {exam.code && (
                              <span className="text-muted-foreground text-sm ml-2">
                                ({exam.code})
                              </span>
                            )}
                            {(exam.specimen || exam.referenceRange) && (
                              <span className="text-muted-foreground text-xs block mt-0.5">
                                {exam.specimen && `🧪 ${exam.specimen}`}
                                {exam.specimen && exam.referenceRange && ' · '}
                                {exam.referenceRange && `Ref.: ${exam.referenceRange}${exam.unit ? ` ${exam.unit}` : ''}`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => setExamForResult(exam)}
                              title="Adicionar resultado"
                              aria-label="Adicionar resultado"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => setChartExam(exam)}
                              title="Ver gráfico de evolução"
                              aria-label="Ver gráfico de evolução"
                            >
                              <LineChartIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Timeline de resultados */}
                        <ul className="space-y-1.5 text-sm">
                          {exam.results.length === 0 ? (
                            <li className="text-muted-foreground">
                              Nenhum resultado registrado.
                            </li>
                          ) : (
                            [...exam.results]
                              .sort(
                                (a, b) =>
                                  new Date(b.performedAt).getTime() -
                                  new Date(a.performedAt).getTime()
                              )
                              .map((r) => (
                                <li
                                  key={r.id}
                                  className="py-1 border-b border-border/50 last:border-0"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-baseline justify-between gap-2 min-w-0 flex-1">
                                      <span className="text-muted-foreground shrink-0">
                                        {format(
                                          new Date(r.performedAt),
                                          'dd/MM/yyyy',
                                          { locale: ptBR }
                                        )}
                                      </span>
                                      <span className="text-right truncate min-w-0">
                                        {r.components && r.components.length > 0
                                          ? `${r.components.length} parâmetros`
                                          : r.valueNumeric != null
                                            ? `${r.valueNumeric}${r.unit ? ` ${r.unit}` : ''}`
                                            : (r.valueText ?? r.report ?? '-')}
                                        {r.isAbnormal && (
                                          <span className="text-amber-600 ml-1">
                                            (fora ref.)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Editar resultado"
                                        aria-label={`Editar resultado de ${format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR })}`}
                                        onClick={() =>
                                          setResultToEdit({ exam, result: r })
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        title="Remover resultado"
                                        aria-label={`Remover resultado de ${format(new Date(r.performedAt), 'dd/MM/yyyy', { locale: ptBR })}`}
                                        onClick={() =>
                                          setResultToDelete({ exam, result: r })
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  {r.components && r.components.length > 0 && (
                                    <div className="mt-2 border rounded-md overflow-hidden">
                                      <table className="w-full text-xs">
                                        <tbody>
                                          {r.components.map((comp, i) => (
                                            <tr
                                              key={i}
                                              className={cn(
                                                'border-b last:border-0',
                                                comp.isAbnormal && 'bg-amber-50'
                                              )}
                                            >
                                              <td className="px-2 py-1 font-medium">{comp.name}</td>
                                              <td className="px-2 py-1 text-right">
                                                {comp.valueNumeric !== undefined
                                                  ? comp.valueNumeric
                                                  : (comp.valueText ?? '—')}
                                                {comp.unit && (
                                                  <span className="text-muted-foreground ml-1">
                                                    {comp.unit}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-2 py-1 text-muted-foreground">
                                                {comp.referenceRange ?? ''}
                                              </td>
                                              {comp.isAbnormal && (
                                                <td className="px-2 py-1 text-amber-600">⚠</td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </li>
                              ))
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Linha do tempo de sintomas e questionários */}
      <PatientSymptomTimeline patientId={patient.id} />

      <ComplementaryExamCreateDialog
        open={openAddExam}
        onOpenChange={setOpenAddExam}
        patientId={patient.id}
      />

      {chartExam && (
        <ComplementaryExamChartDialog
          open={!!chartExam}
          onOpenChange={(open) => !open && setChartExam(null)}
          exam={chartExam}
        />
      )}

      {examForResult && (
        <ComplementaryExamResultCreateDialog
          open={!!examForResult}
          onOpenChange={(open) => !open && setExamForResult(null)}
          patientId={patient.id}
          exam={examForResult}
        />
      )}

      {resultToEdit && (
        <ComplementaryExamResultEditDialog
          open
          onOpenChange={(open) => {
            if (!open) setResultToEdit(null);
          }}
          patientId={patient.id}
          exam={resultToEdit.exam}
          result={resultToEdit.result}
        />
      )}

      {resultToDelete && (
        <ComplementaryExamResultDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setResultToDelete(null);
          }}
          patientId={patient.id}
          examId={resultToDelete.exam.id}
          examName={resultToDelete.exam.name}
          performedAt={resultToDelete.result.performedAt}
          resultId={resultToDelete.result.id}
        />
      )}

      {/* Comorbidades */}
      <Card>
        <CardHeader>
          <CardTitle>Comorbidades</CardTitle>
        </CardHeader>
        <CardContent>
          {comorbidities.length > 0 ? (
            <div className="space-y-3">
              {comorbidities.map((comorbidity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{comorbidity.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Severidade:{' '}
                      {SEVERITY_LABELS[comorbidity.severity] ||
                        comorbidity.severity}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={SEVERITY_COLORS[comorbidity.severity] || ''}
                    >
                      {SEVERITY_LABELS[comorbidity.severity] ||
                        comorbidity.severity}
                    </Badge>
                    {comorbidity.controlled ? (
                      <Badge variant="default" className="bg-green-600">
                        Controlada
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Não controlada</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma comorbidade registrada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fatores de Risco */}
      <Card>
        <CardHeader>
          <CardTitle>Fatores de Risco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabagismo */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Tabagismo
            </label>
            <p className="text-lg mt-1">
              {patient.smokingHistory || 'Não informado'}
            </p>
          </div>

          <Separator />

          {/* Etilismo */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Etilismo
            </label>
            <p className="text-lg mt-1">
              {patient.alcoholHistory || 'Não informado'}
            </p>
          </div>

          <Separator />

          {/* Exposição Ocupacional */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Exposição Ocupacional
            </label>
            <p className="text-lg mt-1">
              {patient.occupationalExposure || 'Não informado'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* História Familiar */}
      <Card>
        <CardHeader>
          <CardTitle>História Familiar de Câncer</CardTitle>
        </CardHeader>
        <CardContent>
          {familyHistory.length > 0 ? (
            <div className="space-y-3">
              {familyHistory.map((member, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {member.relationship || 'Familiar'}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium">Tipo de Câncer:</span>{' '}
                        {member.cancerType}
                      </div>
                      {member.ageAtDiagnosis && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium">
                            Idade no Diagnóstico:
                          </span>{' '}
                          {member.ageAtDiagnosis} anos
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum histórico familiar de câncer registrado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
