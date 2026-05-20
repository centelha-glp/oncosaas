import { render, screen } from '@testing-library/react';
import { ConsultationAgendaMetricsStrip } from '../consultation-agenda-metrics-strip';

describe('ConsultationAgendaMetricsStrip', () => {
  it('exibe skeleton com aria-busy durante carregamento', () => {
    render(
      <ConsultationAgendaMetricsStrip
        periodLabel="Hoje"
        isLoading
        isError={false}
      />
    );
    expect(screen.getByLabelText('Carregando métricas da agenda')).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('exibe alerta destrutivo em erro', () => {
    render(
      <ConsultationAgendaMetricsStrip
        periodLabel="Hoje"
        isLoading={false}
        isError
        errorMessage="Falha de rede"
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha de rede');
  });

  it('renderiza KPIs agregados sem identificar pacientes', () => {
    render(
      <ConsultationAgendaMetricsStrip
        periodLabel="Últimos 7 dias"
        isLoading={false}
        isError={false}
        metrics={{
          completedAppointments: 12,
          noShows: 2,
          avgWaitingMinutes: 18.4,
          avgLateMinutes: 7.2,
          avgConsultationDurationMinutes: 32,
          sumWaitingMinutes: 220,
          sumLateMinutes: 86,
          countWaitingSample: 12,
          countLateSample: 12,
          countConsultationDurationSample: 10,
        }}
      />
    );
    const region = screen.getByRole('region', {
      name: 'Métricas da agenda — Últimos 7 dias',
    });
    expect(region).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Consultas concluídas')).toBeInTheDocument();
    expect(screen.getByText('18 min')).toBeInTheDocument();
    expect(screen.queryByText(/paciente/i)).not.toBeInTheDocument();
  });

  it('não renderiza nada quando não há métricas e não está carregando', () => {
    const { container } = render(
      <ConsultationAgendaMetricsStrip
        periodLabel="Hoje"
        isLoading={false}
        isError={false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
