import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsultationAgendaOperationalBar } from '../consultation-agenda-operational-bar';

describe('ConsultationAgendaOperationalBar', () => {
  it('renderiza grupo de filtros com botões acessíveis', () => {
    render(
      <ConsultationAgendaOperationalBar active={[]} onToggle={vi.fn()} />
    );
    expect(
      screen.getByRole('group', { name: 'Filtros rápidos da lista' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Atrasadas' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', { name: 'Aguardando confirmação' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('marca filtro ativo com aria-pressed e dispara onToggle', async () => {
    const onToggle = vi.fn();
    render(
      <ConsultationAgendaOperationalBar
        active={['overdue']}
        onToggle={onToggle}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Atrasadas' })
    ).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(
      screen.getByRole('button', { name: 'Aguardando confirmação' })
    );
    expect(onToggle).toHaveBeenCalledWith('awaiting_confirmation');
  });

  it('não dispara onToggle quando desabilitado', async () => {
    const onToggle = vi.fn();
    render(
      <ConsultationAgendaOperationalBar
        active={[]}
        onToggle={onToggle}
        disabled
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Atrasadas' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
