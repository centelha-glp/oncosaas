import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentSuggestionCard } from '../agent-suggestion-card';

const MSG_ID = 'msg-uuid-1';
const PATIENT_ID = 'patient-uuid-1';
const SUGGESTED_TEXT = 'Olá, como posso ajudar você hoje?';

const defaultProps = {
  messageId: MSG_ID,
  patientId: PATIENT_ID,
  suggestedText: SUGGESTED_TEXT,
  onAccept: vi.fn(),
  onEdit: vi.fn(),
  onReject: vi.fn(),
};

describe('AgentSuggestionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o texto da sugestão', () => {
    render(<AgentSuggestionCard {...defaultProps} />);
    expect(screen.getByText(SUGGESTED_TEXT)).toBeInTheDocument();
  });

  it('exibe o badge "Sugestão do Agente IA"', () => {
    render(<AgentSuggestionCard {...defaultProps} />);
    expect(screen.getByText('Sugestão do Agente IA')).toBeInTheDocument();
  });

  it('clique em "Enviar" chama onAccept com messageId e patientId', async () => {
    const onAccept = vi.fn();
    render(<AgentSuggestionCard {...defaultProps} onAccept={onAccept} />);

    await userEvent.click(screen.getByRole('button', { name: /aceitar sugestão e enviar/i }));

    expect(onAccept).toHaveBeenCalledOnce();
    expect(onAccept).toHaveBeenCalledWith(MSG_ID, PATIENT_ID);
  });

  it('clique em "Rejeitar" chama onReject com messageId e patientId', async () => {
    const onReject = vi.fn();
    render(<AgentSuggestionCard {...defaultProps} onReject={onReject} />);

    await userEvent.click(screen.getByRole('button', { name: /rejeitar sugestão/i }));

    expect(onReject).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledWith(MSG_ID, PATIENT_ID);
  });

  it('clique em "Editar" exibe textarea com o texto da sugestão', async () => {
    render(<AgentSuggestionCard {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /editar sugestão antes de enviar/i }));

    const textarea = screen.getByRole('textbox', { name: /editar sugestão do agente/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(SUGGESTED_TEXT);
  });

  it('em modo edição, "Confirmar e Enviar" chama onEdit com texto editado', async () => {
    const onEdit = vi.fn();
    render(<AgentSuggestionCard {...defaultProps} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole('button', { name: /editar sugestão antes de enviar/i }));

    const textarea = screen.getByRole('textbox', { name: /editar sugestão do agente/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Texto ajustado pela enfermeira');

    await userEvent.click(screen.getByRole('button', { name: /confirmar edição e enviar/i }));

    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(MSG_ID, PATIENT_ID, 'Texto ajustado pela enfermeira');
  });

  it('em modo edição, "Cancelar" restaura o texto original e oculta a textarea', async () => {
    render(<AgentSuggestionCard {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /editar sugestão antes de enviar/i }));

    const textarea = screen.getByRole('textbox', { name: /editar sugestão do agente/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Texto qualquer');

    await userEvent.click(screen.getByRole('button', { name: /cancelar edição/i }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(SUGGESTED_TEXT)).toBeInTheDocument();
  });

  it('estado de loading desabilita todos os botões de ação', () => {
    render(<AgentSuggestionCard {...defaultProps} isLoading={true} />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('estado de loading não chama onAccept ao tentar clicar em Enviar', async () => {
    const onAccept = vi.fn();
    render(<AgentSuggestionCard {...defaultProps} onAccept={onAccept} isLoading={true} />);

    const sendButton = screen.getByRole('button', { name: /aceitar sugestão e enviar/i });
    await userEvent.click(sendButton);

    expect(onAccept).not.toHaveBeenCalled();
  });
});
