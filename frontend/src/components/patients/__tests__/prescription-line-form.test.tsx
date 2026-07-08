import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PrescriptionLineForm } from '../prescription-line-form';

type MockComboboxOption = {
  id: string;
  label: string;
  data: unknown;
};

vi.mock('@/components/shared/exam-catalog-combobox', () => ({
  ExamCatalogCombobox: ({
    options,
    value,
    onValueChange,
    onSelectOption,
    placeholder,
    disabled,
  }: {
    options: MockComboboxOption[];
    value: string;
    onValueChange: (value: string) => void;
    onSelectOption: (option: MockComboboxOption) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <div>
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelectOption(option)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/lib/api/medication-catalog', () => ({
  medicationCatalogApi: {
    search: vi.fn(async () => ({
      items: [
        {
          code: 'OMEPRAZOLE',
          displayName: 'Omeprazol',
          genericName: 'Omeprazol',
          allowedRoutes: ['VO'],
        },
        {
          code: 'METFORMIN',
          displayName: 'Metformina',
          genericName: 'Metformina',
          allowedRoutes: ['VO'],
        },
      ],
      total: 2,
    })),
    listPresentations: vi.fn(async () => ({ items: [] })),
    listRoutes: vi.fn(async () => ({ routes: [{ code: 'VO', label: 'Via oral' }] })),
  },
}));

function renderForm(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <PrescriptionLineForm onSubmit={onSubmit} />
    </QueryClientProvider>
  );

  return { onSubmit };
}

describe('PrescriptionLineForm', () => {
  it('bloqueia envio quando o texto diverge do medicamento selecionado', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const drugInput = screen.getByPlaceholderText('Pesquisar medicamento...');
    await user.click(await screen.findByRole('button', { name: 'Omeprazol' }));

    expect(screen.getByRole('button', { name: /adicionar à prescrição/i })).toBeEnabled();

    await user.clear(drugInput);
    await user.type(drugInput, 'Metformina');

    const addButton = screen.getByRole('button', {
      name: /adicionar à prescrição/i,
    });
    expect(addButton).toBeDisabled();

    await user.click(addButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia o novo catalogKey após selecionar outro medicamento', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    const drugInput = screen.getByPlaceholderText('Pesquisar medicamento...');
    await user.click(await screen.findByRole('button', { name: 'Omeprazol' }));
    await user.clear(drugInput);
    await user.type(drugInput, 'Metformina');
    await user.click(screen.getByRole('button', { name: 'Metformina' }));
    await user.click(screen.getByRole('button', { name: /adicionar à prescrição/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        medicationName: 'Metformina',
        catalogKey: 'METFORMIN',
      })
    );
  });
});
