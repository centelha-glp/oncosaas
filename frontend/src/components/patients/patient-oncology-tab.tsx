'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PatientDetail, CancerDiagnosis, patientsApi } from '@/lib/api/patients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, GitBranch } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CancerDiagnosisDialog } from './cancer-diagnosis-dialog';

interface PatientOncologyTabProps {
  patient: PatientDetail;
}

export function PatientOncologyTab({
  patient,
}: PatientOncologyTabProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<
    CancerDiagnosis | undefined
  >();
  const [diagnosisToDelete, setDiagnosisToDelete] = useState<
    CancerDiagnosis | null
  >(null);
  const [primaryForMetastatic, setPrimaryForMetastatic] = useState<{
    id: string;
    cancerType: string;
  } | null>(null);

  const deleteDiagnosisMutation = useMutation({
    mutationFn: ({
      patientId,
      diagnosisId,
    }: {
      patientId: string;
      diagnosisId: string;
    }) => patientsApi.deleteCancerDiagnosis(patientId, diagnosisId),
    onSuccess: (_, { patientId }) => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      setDiagnosisToDelete(null);
      toast.success('Diagnóstico excluído com sucesso.');
    },
    onError: () => {
      toast.error('Não foi possível excluir o diagnóstico.');
    },
  });

  const handleAddDiagnosis = (): void => {
    setEditingDiagnosis(undefined);
    setPrimaryForMetastatic(null);
    setShowDialog(true);
  };

  const handleAddMetastatic = (primary: CancerDiagnosis): void => {
    setEditingDiagnosis(undefined);
    setPrimaryForMetastatic({
      id: primary.id,
      cancerType: primary.cancerType || 'Tipo não especificado',
    });
    setShowDialog(true);
  };

  const handleEditDiagnosis = (diagnosis: CancerDiagnosis): void => {
    setEditingDiagnosis(diagnosis);
    setPrimaryForMetastatic(null);
    setShowDialog(true);
  };

  const handleDialogClose = (open: boolean): void => {
    if (!open) {
      setEditingDiagnosis(undefined);
      setPrimaryForMetastatic(null);
    }
    setShowDialog(open);
  };

  const renderTNMStaging = (diagnosis: CancerDiagnosis): React.ReactElement | null => {
    if (
      !diagnosis.tStage &&
      !diagnosis.nStage &&
      !diagnosis.mStage &&
      !diagnosis.grade
    ) {
      return null;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        {diagnosis.tStage && (
          <div>
            <span className="text-xs text-muted-foreground">T</span>
            <div className="font-medium">{diagnosis.tStage}</div>
          </div>
        )}
        {diagnosis.nStage && (
          <div>
            <span className="text-xs text-muted-foreground">N</span>
            <div className="font-medium">{diagnosis.nStage}</div>
          </div>
        )}
        {diagnosis.mStage && (
          <div>
            <span className="text-xs text-muted-foreground">M</span>
            <div className="font-medium">{diagnosis.mStage}</div>
          </div>
        )}
        {diagnosis.grade && (
          <div>
            <span className="text-xs text-muted-foreground">Grau</span>
            <div className="font-medium">{diagnosis.grade}</div>
          </div>
        )}
      </div>
    );
  };

  const renderBiomarkers = (diagnosis: CancerDiagnosis): React.ReactElement | null => {
    const biomarkers: Array<{ label: string; value: string | number | null }> =
      [];

    // Biomarcadores - Câncer de Mama
    if (diagnosis.her2Status) {
      biomarkers.push({ label: 'HER2', value: diagnosis.her2Status });
    }
    if (diagnosis.erStatus) {
      biomarkers.push({ label: 'ER', value: diagnosis.erStatus });
    }
    if (diagnosis.prStatus) {
      biomarkers.push({ label: 'PR', value: diagnosis.prStatus });
    }
    if (
      diagnosis.ki67Percentage !== null &&
      diagnosis.ki67Percentage !== undefined
    ) {
      biomarkers.push({
        label: 'Ki-67',
        value: `${diagnosis.ki67Percentage}%`,
      });
    }

    // Biomarcadores - Câncer de Pulmão/Colorretal
    if (diagnosis.egfrMutation) {
      biomarkers.push({ label: 'EGFR', value: diagnosis.egfrMutation });
    }
    if (diagnosis.alkRearrangement) {
      biomarkers.push({ label: 'ALK', value: diagnosis.alkRearrangement });
    }
    if (diagnosis.ros1Rearrangement) {
      biomarkers.push({ label: 'ROS1', value: diagnosis.ros1Rearrangement });
    }
    if (diagnosis.brafMutation) {
      biomarkers.push({ label: 'BRAF', value: diagnosis.brafMutation });
    }
    if (diagnosis.krasMutation) {
      biomarkers.push({ label: 'KRAS', value: diagnosis.krasMutation });
    }
    if (diagnosis.nrasMutation) {
      biomarkers.push({ label: 'NRAS', value: diagnosis.nrasMutation });
    }
    if (
      diagnosis.pdl1Expression !== null &&
      diagnosis.pdl1Expression !== undefined
    ) {
      biomarkers.push({
        label: 'PD-L1',
        value: `${diagnosis.pdl1Expression}%`,
      });
    }
    if (diagnosis.msiStatus) {
      biomarkers.push({ label: 'MSI', value: diagnosis.msiStatus });
    }

    // Biomarcadores - Câncer de Próstata
    if (diagnosis.psaBaseline !== null && diagnosis.psaBaseline !== undefined) {
      biomarkers.push({
        label: 'PSA Basal',
        value: `${diagnosis.psaBaseline} ng/mL`,
      });
    }
    if (diagnosis.gleasonScore) {
      biomarkers.push({ label: 'Gleason', value: diagnosis.gleasonScore });
    }

    if (biomarkers.length === 0) {
      return null;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
        {biomarkers.map((bm, idx) => (
          <div key={idx}>
            <span className="text-xs text-muted-foreground">{bm.label}</span>
            <div className="font-medium">{bm.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderTumorMarkers = (
    diagnosis: CancerDiagnosis
  ): React.ReactElement | null => {
    const markers: Array<{ label: string; value: number | null }> = [];

    if (diagnosis.ceaBaseline !== null && diagnosis.ceaBaseline !== undefined) {
      markers.push({ label: 'CEA', value: diagnosis.ceaBaseline });
    }
    if (
      diagnosis.ca199Baseline !== null &&
      diagnosis.ca199Baseline !== undefined
    ) {
      markers.push({ label: 'CA 19-9', value: diagnosis.ca199Baseline });
    }
    if (
      diagnosis.ca125Baseline !== null &&
      diagnosis.ca125Baseline !== undefined
    ) {
      markers.push({ label: 'CA 125', value: diagnosis.ca125Baseline });
    }
    if (
      diagnosis.ca153Baseline !== null &&
      diagnosis.ca153Baseline !== undefined
    ) {
      markers.push({ label: 'CA 15-3', value: diagnosis.ca153Baseline });
    }
    if (diagnosis.afpBaseline !== null && diagnosis.afpBaseline !== undefined) {
      markers.push({ label: 'AFP', value: diagnosis.afpBaseline });
    }
    if (diagnosis.hcgBaseline !== null && diagnosis.hcgBaseline !== undefined) {
      markers.push({ label: 'β-HCG', value: diagnosis.hcgBaseline });
    }

    if (markers.length === 0) {
      return null;
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
        {markers.map((marker, idx) => (
          <div key={idx}>
            <span className="text-xs text-muted-foreground">
              {marker.label}
            </span>
            <div className="font-medium">{marker.value}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Diagnósticos de Câncer</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os diagnósticos oncológicos do paciente
          </p>
        </div>
        <Button onClick={handleAddDiagnosis}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Diagnóstico
        </Button>
      </div>

      {/* Diagnósticos */}
      {patient.cancerDiagnoses && patient.cancerDiagnoses.length > 0 ? (
        patient.cancerDiagnoses.map((diagnosis) => (
          <div key={diagnosis.id} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {diagnosis.cancerType || 'Tipo não especificado'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {diagnosis.isPrimary && (
                      <Badge variant="outline">Primário</Badge>
                    )}
                    {diagnosis.isActive ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDiagnosis(diagnosis)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    {diagnosis.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddMetastatic(diagnosis)}
                      >
                        <GitBranch className="h-4 w-4 mr-2" />
                        Adicionar metastático
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDiagnosisToDelete(diagnosis)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informações Básicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {diagnosis.diagnosisDate && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Data de Diagnóstico
                      </span>
                      <div className="font-medium">
                        {format(
                          new Date(diagnosis.diagnosisDate),
                          'dd/MM/yyyy',
                          {
                            locale: ptBR,
                          }
                        )}
                      </div>
                    </div>
                  )}
                  {diagnosis.stagingDate && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Data de Estadiamento
                      </span>
                      <div className="font-medium">
                        {format(new Date(diagnosis.stagingDate), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  )}
                  {diagnosis.histologicalType && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Tipo Histológico
                      </span>
                      <div className="font-medium">
                        {diagnosis.histologicalType}
                      </div>
                    </div>
                  )}
                  {diagnosis.icd10Code && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        CID-10
                      </span>
                      <div className="font-medium">{diagnosis.icd10Code}</div>
                    </div>
                  )}
                  {patient.performanceStatus !== null &&
                    patient.performanceStatus !== undefined && (
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Performance Status
                        </span>
                        <div className="font-medium">
                          ECOG {patient.performanceStatus}
                        </div>
                      </div>
                    )}
                </div>

                {/* Estadiamento TNM */}
                {(diagnosis.tStage ||
                  diagnosis.nStage ||
                  diagnosis.mStage ||
                  diagnosis.grade ||
                  diagnosis.stage) && (
                  <div>
                    <h4 className="font-semibold mb-2">Estadiamento TNM</h4>
                    {diagnosis.stage && (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">
                          Estágio Completo
                        </span>
                        <div className="font-medium">{diagnosis.stage}</div>
                      </div>
                    )}
                    {renderTNMStaging(diagnosis)}
                  </div>
                )}

                {/* Biomarcadores */}
                {renderBiomarkers(diagnosis) && (
                  <div>
                    <h4 className="font-semibold mb-2">Biomarcadores</h4>
                    {renderBiomarkers(diagnosis)}
                  </div>
                )}

                {/* Marcadores Tumorais */}
                {renderTumorMarkers(diagnosis) && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      Marcadores Tumorais (Basal)
                    </h4>
                    {renderTumorMarkers(diagnosis)}
                  </div>
                )}

                {/* Laudo Histopatológico */}
                {diagnosis.pathologyReport && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      Laudo Histopatológico
                    </h4>
                    {diagnosis.histologicalType && (
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {diagnosis.histologicalType}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {diagnosis.pathologyReport}
                    </p>
                  </div>
                )}

                {/* Cânceres metastáticos associados (apenas para primários) */}
                {diagnosis.isPrimary && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      Cânceres metastáticos associados
                    </h4>
                    {diagnosis.metastaticDiagnoses &&
                    diagnosis.metastaticDiagnoses.length > 0 ? (
                      <ul className="space-y-2">
                        {diagnosis.metastaticDiagnoses.map((met) => (
                          <li
                            key={met.id}
                            className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                          >
                            <span className="font-medium">
                              {met.cancerType || 'Tipo não especificado'}
                            </span>
                            <div className="flex items-center gap-2">
                              {met.diagnosisDate && (
                                <span className="text-muted-foreground">
                                  {format(
                                    new Date(met.diagnosisDate),
                                    'dd/MM/yyyy',
                                    { locale: ptBR }
                                  )}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDiagnosis(met)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDiagnosisToDelete(met)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum diagnóstico metastático registrado.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleAddMetastatic(diagnosis)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar câncer metastático
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Nenhum diagnóstico registrado
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog para adicionar/editar diagnóstico */}
      <CancerDiagnosisDialog
        open={showDialog}
        onOpenChange={handleDialogClose}
        patientId={patient.id}
        diagnosis={editingDiagnosis}
        primaryDiagnosisId={primaryForMetastatic?.id}
        primaryCancerType={primaryForMetastatic?.cancerType}
      />

      {/* Confirmação de exclusão de diagnóstico */}
      <AlertDialog
        open={!!diagnosisToDelete}
        onOpenChange={(open) => !open && setDiagnosisToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir diagnóstico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O diagnóstico{' '}
              {diagnosisToDelete?.cancerType && (
                <strong>{diagnosisToDelete.cancerType}</strong>
              )}{' '}
              será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (diagnosisToDelete) {
                  deleteDiagnosisMutation.mutate({
                    patientId: patient.id,
                    diagnosisId: diagnosisToDelete.id,
                  });
                }
              }}
              disabled={deleteDiagnosisMutation.isPending}
            >
              {deleteDiagnosisMutation.isPending ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
