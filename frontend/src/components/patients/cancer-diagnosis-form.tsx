'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  cancerDiagnosisSchema,
  CancerDiagnosisFormData,
} from '@/lib/validations/cancer-diagnosis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  T_STAGE_VALUES,
  N_STAGE_VALUES,
  M_STAGE_VALUES,
  GRADE_VALUES,
  HER2_STATUS_VALUES,
  ER_PR_STATUS_VALUES,
  MUTATION_STATUS_VALUES,
  REARRANGEMENT_STATUS_VALUES,
  MSI_STATUS_VALUES,
} from '@/lib/validations/cancer-diagnosis';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CancerDiagnosis } from '@/lib/api/patients';
import {
  CANCER_TYPE_LABELS,
  getCancerTypeKey,
} from '@/lib/utils/patient-cancer-type';
import {
  ICD10_OPTIONS,
  ICD10_OTHER_VALUE,
  HISTOLOGICAL_TYPE_OPTIONS,
} from '@/lib/utils/diagnosis-options';

interface CancerDiagnosisFormProps {
  patientId: string;
  diagnosis?: CancerDiagnosis;
  /** Ao preencher, o formulário cria um diagnóstico metastático vinculado a este primário */
  primaryDiagnosisId?: string;
  onSubmit: (data: CancerDiagnosisFormData) => Promise<void>;
  onCancel?: () => void;
}

export function CancerDiagnosisForm({
  patientId,
  diagnosis,
  primaryDiagnosisId,
  onSubmit,
  onCancel,
}: CancerDiagnosisFormProps) {
  const isMetastaticForm = !!primaryDiagnosisId && !diagnosis;

  const form = useForm<CancerDiagnosisFormData>({
    resolver: zodResolver(cancerDiagnosisSchema),
    defaultValues: diagnosis
      ? {
          cancerType: getCancerTypeKey(diagnosis.cancerType) ?? diagnosis.cancerType,
          icd10Code: diagnosis.icd10Code || undefined,
          tStage: (diagnosis.tStage as any) || undefined,
          nStage: (diagnosis.nStage as any) || undefined,
          mStage: (diagnosis.mStage as any) || undefined,
          grade: (diagnosis.grade as any) || undefined,
          stagingDate: diagnosis.stagingDate
            ? typeof diagnosis.stagingDate === 'string' &&
              diagnosis.stagingDate.includes('T')
              ? diagnosis.stagingDate
              : new Date(diagnosis.stagingDate).toISOString()
            : undefined,
          histologicalType: diagnosis.histologicalType || undefined,
          diagnosisDate:
            typeof diagnosis.diagnosisDate === 'string' &&
            diagnosis.diagnosisDate.includes('T')
              ? diagnosis.diagnosisDate
              : new Date(diagnosis.diagnosisDate).toISOString(),
          diagnosisConfirmed: diagnosis.diagnosisConfirmed,
          pathologyReport: diagnosis.pathologyReport || undefined,
          confirmedBy: diagnosis.confirmedBy || undefined,
          her2Status: (diagnosis.her2Status as any) || undefined,
          erStatus: (diagnosis.erStatus as any) || undefined,
          prStatus: (diagnosis.prStatus as any) || undefined,
          ki67Percentage: diagnosis.ki67Percentage || undefined,
          egfrMutation: (diagnosis.egfrMutation as any) || undefined,
          alkRearrangement: (diagnosis.alkRearrangement as any) || undefined,
          ros1Rearrangement: (diagnosis.ros1Rearrangement as any) || undefined,
          brafMutation: (diagnosis.brafMutation as any) || undefined,
          krasMutation: (diagnosis.krasMutation as any) || undefined,
          nrasMutation: (diagnosis.nrasMutation as any) || undefined,
          pdl1Expression: diagnosis.pdl1Expression || undefined,
          msiStatus: (diagnosis.msiStatus as any) || undefined,
          psaBaseline: diagnosis.psaBaseline || undefined,
          gleasonScore: diagnosis.gleasonScore || undefined,
          ceaBaseline: diagnosis.ceaBaseline || undefined,
          ca199Baseline: diagnosis.ca199Baseline || undefined,
          ca125Baseline: diagnosis.ca125Baseline || undefined,
          ca153Baseline: diagnosis.ca153Baseline || undefined,
          afpBaseline: diagnosis.afpBaseline || undefined,
          hcgBaseline: diagnosis.hcgBaseline || undefined,
          isPrimary: diagnosis.isPrimary,
          isActive: diagnosis.isActive,
        }
      : {
          cancerType: '',
          diagnosisDate: new Date().toISOString(),
          diagnosisConfirmed: true,
          isPrimary: isMetastaticForm ? false : true,
          isActive: true,
          primaryDiagnosisId: primaryDiagnosisId || undefined,
        },
  });

  useEffect(() => {
    if (primaryDiagnosisId && !diagnosis) {
      form.setValue('primaryDiagnosisId', primaryDiagnosisId);
      form.setValue('isPrimary', false);
    }
  }, [primaryDiagnosisId, diagnosis, form]);

  const cancerType = form.watch('cancerType');
  const isBreastCancer =
    cancerType?.toLowerCase().includes('mama') || cancerType === 'breast';
  const isLungCancer =
    cancerType?.toLowerCase().includes('pulmão') ||
    cancerType?.toLowerCase().includes('pulmao') ||
    cancerType === 'lung';
  const isColorectalCancer =
    cancerType?.toLowerCase().includes('colorretal') ||
    cancerType?.toLowerCase().includes('cólon') ||
    cancerType === 'colorectal';
  const isProstateCancer =
    cancerType?.toLowerCase().includes('próstata') ||
    cancerType?.toLowerCase().includes('prostata') ||
    cancerType === 'prostate';

  const handleSubmit = async (data: CancerDiagnosisFormData) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic">Básicos</TabsTrigger>
            <TabsTrigger value="tnm">TNM</TabsTrigger>
            <TabsTrigger value="histology">Histologia</TabsTrigger>
            <TabsTrigger value="biomarkers">Biomarcadores</TabsTrigger>
            <TabsTrigger value="markers">Marcadores</TabsTrigger>
          </TabsList>

          {/* Aba 1: Dados Básicos */}
          <TabsContent value="basic" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados Básicos do Diagnóstico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="cancerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Câncer *</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={(v) => field.onChange(v || undefined)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo de câncer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CANCER_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="icd10Code"
                  render={({ field }) => {
                    const isPreset = field.value && ICD10_OPTIONS.some((o) => o.value === field.value);
                    const selectValue = isPreset ? field.value! : (field.value ? ICD10_OTHER_VALUE : '');
                    return (
                      <FormItem>
                        <FormLabel>Código CID-10</FormLabel>
                        <Select
                          value={selectValue}
                          onValueChange={(v) => {
                            if (v === ICD10_OTHER_VALUE || v === '') {
                              field.onChange('');
                            } else {
                              field.onChange(v);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione ou digite depois" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ICD10_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                            <SelectItem value={ICD10_OTHER_VALUE}>
                              Outro (digite abaixo)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {selectValue === ICD10_OTHER_VALUE && (
                          <FormControl>
                            <Input
                              placeholder="Ex: C50.9"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                              className="mt-2"
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="diagnosisDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data de Diagnóstico *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', {
                                  locale: ptBR,
                                })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 z-[200] bg-background border border-border shadow-lg overflow-visible"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) =>
                              field.onChange(date?.toISOString())
                            }
                            disabled={(date) =>
                              date > new Date() || date < new Date('1900-01-01')
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-4 pt-2">
                <FormField
                  control={form.control}
                  name="diagnosisConfirmed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Diagnóstico Confirmado</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                {!primaryDiagnosisId && (
                  <FormField
                    control={form.control}
                    name="isPrimary"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Diagnóstico Primário</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 2: Estadiamento TNM */}
          <TabsContent value="tnm" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Estadiamento TNM</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="tStage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>T</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(v) => field.onChange(v || undefined)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="T" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {T_STAGE_VALUES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nStage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>N</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(v) => field.onChange(v || undefined)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="N" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {N_STAGE_VALUES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mStage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>M</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(v) => field.onChange(v || undefined)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="M" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {M_STAGE_VALUES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grau</FormLabel>
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(v) => field.onChange(v || undefined)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="G" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GRADE_VALUES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="stagingDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data de Estadiamento</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', {
                                  locale: ptBR,
                                })
                              ) : (
                                <span>Selecione uma data</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 z-[200] bg-background border border-border shadow-lg overflow-visible"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={
                              field.value ? new Date(field.value) : undefined
                            }
                            onSelect={(date) =>
                              field.onChange(date?.toISOString())
                            }
                            disabled={(date) =>
                              date > new Date() || date < new Date('1900-01-01')
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 3: Tipo Histológico */}
          <TabsContent value="histology" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tipo Histológico e Patologia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="histologicalType"
                  render={({ field }) => {
                    const optionValues = HISTOLOGICAL_TYPE_OPTIONS.map((o) => o.value);
                    const isPreset = field.value && optionValues.includes(field.value);
                    const selectValue = isPreset ? field.value! : (field.value ? 'outro' : '');
                    return (
                      <FormItem>
                        <FormLabel>Tipo Histológico</FormLabel>
                        <Select
                          value={selectValue}
                          onValueChange={(v) => {
                            if (v === 'outro' || v === '') {
                              field.onChange(field.value && !optionValues.includes(field.value) ? field.value : '');
                            } else {
                              field.onChange(v);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo histológico" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HISTOLOGICAL_TYPE_OPTIONS.filter((o) => o.value !== 'outro').map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="outro">Outro (especificar)</SelectItem>
                          </SelectContent>
                        </Select>
                        {(selectValue === 'outro' || (field.value && !optionValues.includes(field.value))) && (
                          <FormControl>
                            <Input
                              placeholder="Ex: carcinoma adenoescamoso"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value || undefined)}
                              className="mt-2"
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="pathologyReport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Laudo Histopatológico</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes do laudo anatomopatológico"
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmedBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmado Por</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nome do médico patologista"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 4: Biomarcadores */}
          <TabsContent value="biomarkers" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Biomarcadores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Biomarcadores - Câncer de Mama */}
                {isBreastCancer && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">Câncer de Mama</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="her2Status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HER2</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {HER2_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="erStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ER (Receptor de Estrogênio)</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ER_PR_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="prStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PR (Receptor de Progesterona)</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ER_PR_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ki67Percentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ki-67 (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0-100"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value
                                      ? parseFloat(e.target.value)
                                      : undefined
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Biomarcadores - Câncer de Pulmão/Colorretal */}
                {(isLungCancer || isColorectalCancer) && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">
                      Câncer de Pulmão/Colorretal
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="egfrMutation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>EGFR</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MUTATION_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="alkRearrangement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ALK</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {REARRANGEMENT_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ros1Rearrangement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ROS1</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {REARRANGEMENT_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="brafMutation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>BRAF</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MUTATION_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="krasMutation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>KRAS</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MUTATION_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nrasMutation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>NRAS</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MUTATION_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="pdl1Expression"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PD-L1 (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="0-100"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value
                                      ? parseFloat(e.target.value)
                                      : undefined
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="msiStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MSI</FormLabel>
                            <Select
                              value={field.value ?? ''}
                              onValueChange={(v) => field.onChange(v || undefined)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {MSI_STATUS_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Biomarcadores - Câncer de Próstata */}
                {isProstateCancer && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">Câncer de Próstata</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="psaBaseline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PSA Basal (ng/mL)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                placeholder="PSA inicial"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value
                                      ? parseFloat(e.target.value)
                                      : undefined
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gleasonScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gleason Score</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 3+4=7" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 5: Marcadores Tumorais */}
          <TabsContent value="markers" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Marcadores Tumorais (Basal)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ceaBaseline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEA (ng/mL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="CEA inicial"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ca199Baseline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CA 19-9 (U/mL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="CA 19-9 inicial"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ca125Baseline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CA 125 (U/mL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="CA 125 inicial"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ca153Baseline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CA 15-3 (U/mL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="CA 15-3 inicial"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="afpBaseline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AFP (ng/mL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="AFP inicial"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hcgBaseline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>β-HCG (mUI/mL)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="β-HCG inicial"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseFloat(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4 pt-6">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
