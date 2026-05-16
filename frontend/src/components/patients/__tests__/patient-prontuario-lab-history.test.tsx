import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  ComplementaryExam,
  ComplementaryExamResult,
  PatientDetail,
} from '@/lib/api/patients';
import { PatientProntuarioLabHistory } from '../patient-prontuario-lab-history';

vi.mock('@/components/patients/complementary-exam-chart-dialog', () => ({
  ComplementaryExamChartDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="mock-chart-dialog">
        <button type="button" onClick={() => onOpenChange(false)}>
          Fechar gráfico
        </button>
      </div>
    ) : null,
}));

function makeLabExam(overrides: Partial<ComplementaryExam> = {}): ComplementaryExam {
  return {
    id: 'exam-uuid-1',
    tenantId: 'tenant-uuid-1',
    patientId: 'patient-uuid-1',
    type: 'LABORATORY',
    name: 'Hemograma',
    code: null,
    loincCode: null,
    labCategory: 'CBC',
    isCriticalMetric: false,
    specimen: null,
    unit: 'g/dL',
    referenceRange: '12–16',
    results: [],
    ...overrides,
  };
}

/** Mock mínimo para RTL — campos extra do paciente não usados pelo histórico laboratorial */
function makePatientDetail(
  complementaryExams: ComplementaryExam[] | undefined
): PatientDetail {
  return {
    id: 'patient-uuid-1',
    tenantId: 'tenant-uuid-1',
    name: 'Paciente Teste',
    cpf: null,
    birthDate: '1980-05-10T00:00:00.000Z',
    gender: 'other',
    phone: null,
    email: null,
    cancerType: null,
    stage: null,
    diagnosisDate: null,
    performanceStatus: null,
    smokingHistory: null,
    alcoholHistory: null,
    occupationalExposure: null,
    familyHistory: null,
    clinicalDisposition: null,
    clinicalDispositionAt: null,
    clinicalDispositionReason: null,
    preferredEmergencyHospital: null,
    currentStage: 'FOLLOW_UP',
    currentSpecialty: null,
    priorityScore: 0,
    priorityCategory: 'LOW',
    priorityReason: null,
    priorityUpdatedAt: null,
    ehrPatientId: null,
    lastSyncAt: null,
    status: 'ACTIVE',
    lastInteraction: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    journey: null,
    cancerDiagnoses: [],
    navigationSteps: [],
    alerts: [],
    complementaryExams,
  } as PatientDetail;
}

describe('PatientProntuarioLabHistory (smoke)', () => {
  it('mostra mensagem vazia quando não há exames laboratoriais', () => {
    render(
      <PatientProntuarioLabHistory
        patient={makePatientDetail([
          {
            ...makeLabExam({ id: 'img-1', name: 'TC', type: 'IMAGING' }),
            labCategory: 'IMAGING_REPORT',
          },
        ])}
      />
    );
    expect(
      screen.getByText('Nenhum exame laboratorial cadastrado para este paciente.')
    ).toBeInTheDocument();
  });

  it('expande subitens quando components vem como string JSON (pai sem valueNumeric)', async () => {
    const user = userEvent.setup();
    const componentsJson = JSON.stringify([
      { name: 'Hemácias', value_numeric: 4.5, unit: '10⁶/µL' },
      { name: 'Hb', valueNumeric: 13.2, unit: 'g/dL' },
    ]);
    const exam = makeLabExam({
      results: [
        {
          id: 'res-hem-1',
          performedAt: '2024-08-01T10:00:00.000Z',
          collectionId: null,
          valueNumeric: null,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: 'Hemograma — ver subitens',
          components: componentsJson as unknown as NonNullable<
            ComplementaryExamResult['components']
          >,
        },
      ],
    });
    render(<PatientProntuarioLabHistory patient={makePatientDetail([exam])} />);

    const root = screen.getByLabelText('Histórico laboratorial');
    const expand = within(root).getByRole('button', {
      name: /Expandir subitens da coleta de 01\/08\/2024/i,
    });
    await user.click(expand);

    expect(within(root).getByRole('cell', { name: 'Hemácias' })).toBeInTheDocument();
    expect(within(root).getByRole('cell', { name: '4.5' })).toBeInTheDocument();
    expect(within(root).getByRole('cell', { name: 'Hb' })).toBeInTheDocument();
    expect(within(root).getByRole('cell', { name: '13.2' })).toBeInTheDocument();
  });

  it('expande subitens da coleta e mostra tabela de componentes', async () => {
    const user = userEvent.setup();
    const exam = makeLabExam({
      results: [
        {
          id: 'res-1',
          performedAt: '2024-06-15T12:00:00.000Z',
          collectionId: null,
          valueNumeric: 14,
          valueText: null,
          unit: 'g/dL',
          referenceRange: '12–16',
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          components: [
            { name: 'ALT', valueNumeric: 45, unit: 'U/L', referenceRange: null, isAbnormal: null },
          ],
        },
      ],
    });
    render(<PatientProntuarioLabHistory patient={makePatientDetail([exam])} />);

    const root = screen.getByLabelText('Histórico laboratorial');
    expect(within(root).getByRole('heading', { name: 'Hemograma' })).toBeInTheDocument();

    const expand = within(root).getByRole('button', {
      name: /Expandir subitens da coleta de 15\/06\/2024/i,
    });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);
    expect(expand).toHaveAttribute('aria-expanded', 'true');

    expect(within(root).getByRole('columnheader', { name: 'Subitem' })).toBeInTheDocument();
    expect(within(root).getByRole('cell', { name: 'ALT' })).toBeInTheDocument();
    expect(within(root).getByRole('cell', { name: '45' })).toBeInTheDocument();
  });

  it('abre diálogo de gráfico ao clicar em Gráfico', async () => {
    const user = userEvent.setup();
    const exam = makeLabExam({
      results: [
        {
          id: 'res-2',
          performedAt: '2024-01-10T00:00:00.000Z',
          collectionId: null,
          valueNumeric: 10,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
        },
      ],
    });
    render(<PatientProntuarioLabHistory patient={makePatientDetail([exam])} />);

    await user.click(
      screen.getByRole('button', { name: /Abrir gráfico de evolução do exame Hemograma/i })
    );
    expect(screen.getByTestId('mock-chart-dialog')).toBeInTheDocument();
  });

  it('não lista resultados com deletedAt preenchido', () => {
    const exam = makeLabExam({
      results: [
        {
          id: 'res-kept',
          performedAt: '2024-06-01T15:00:00.000Z',
          collectionId: null,
          valueNumeric: 11,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          deletedAt: null,
        },
        {
          id: 'res-deleted',
          performedAt: '2024-07-15T15:00:00.000Z',
          collectionId: null,
          valueNumeric: 99,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          deletedAt: '2024-08-01T12:00:00.000Z',
        },
      ],
    });
    render(<PatientProntuarioLabHistory patient={makePatientDetail([exam])} />);
    expect(screen.getByText('01/06/2024')).toBeInTheDocument();
    expect(screen.queryByText('15/07/2024')).not.toBeInTheDocument();
    expect(screen.queryByText('99')).not.toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('TTPa sinônimo aparece na linha principal sem subitens', () => {
    const exam = makeLabExam({
      name: 'Tempo de Tromboplastina Parcial Ativado (TTPa)',
      results: [
        {
          id: 'res-ttpa',
          performedAt: '2023-10-17T12:00:00.000Z',
          collectionId: null,
          valueNumeric: null,
          valueText: null,
          unit: null,
          referenceRange: null,
          isAbnormal: null,
          criticalHigh: null,
          criticalLow: null,
          report: null,
          components: [
            {
              name: 'TTPa',
              valueNumeric: 28.7,
              unit: 'seg',
              referenceRange: '25,4 a 33,4',
              isAbnormal: null,
            },
          ],
        },
      ],
    });
    render(<PatientProntuarioLabHistory patient={makePatientDetail([exam])} />);

    const root = screen.getByLabelText('Histórico laboratorial');
    expect(
      within(root).getByRole('heading', {
        name: 'Tempo de Tromboplastina Parcial Ativado (TTPa)',
      })
    ).toBeInTheDocument();
    expect(within(root).getByText('28.7')).toBeInTheDocument();
    expect(within(root).getByText('seg')).toBeInTheDocument();
    expect(
      within(root).queryByRole('button', {
        name: /Expandir subitens da coleta de 17\/10\/2023/i,
      })
    ).not.toBeInTheDocument();
    expect(within(root).queryByRole('columnheader', { name: 'Subitem' })).not.toBeInTheDocument();
    expect(within(root).queryByRole('cell', { name: 'TTPa' })).not.toBeInTheDocument();
  });
});
