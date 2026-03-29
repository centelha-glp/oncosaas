import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// Mockar o módulo de API antes de importar os hooks
vi.mock('@/lib/api/patients', () => ({
  patientsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  usePatients,
  usePatient,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from '../usePatients';
import { patientsApi } from '@/lib/api/patients';
import { toast } from 'sonner';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

const mockPatient = {
  id: 'p1',
  tenantId: 't1',
  name: 'Maria Silva',
  cpf: '123.456.789-00',
  priorityCategory: 'MEDIUM',
  priorityScore: 50,
  currentStage: 'DIAGNOSIS',
  cancerType: null,
  cancerDiagnoses: [],
  createdAt: '2024-01-01T00:00:00Z',
};

// ─── usePatients ─────────────────────────────────────────────────────────────

describe('usePatients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna dados ao buscar com sucesso', async () => {
    vi.mocked(patientsApi.getAll).mockResolvedValue([mockPatient] as never);

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockPatient]);
    expect(patientsApi.getAll).toHaveBeenCalledOnce();
  });

  it('fica em loading enquanto busca', () => {
    vi.mocked(patientsApi.getAll).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);
  });

  it('expõe isError quando a busca falha', async () => {
    vi.mocked(patientsApi.getAll).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('retorna lista vazia quando API retorna []', async () => {
    vi.mocked(patientsApi.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

// ─── usePatient ───────────────────────────────────────────────────────────────

describe('usePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca paciente pelo id', async () => {
    vi.mocked(patientsApi.getById).mockResolvedValue(mockPatient as never);

    const { result } = renderHook(() => usePatient('p1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPatient);
    expect(patientsApi.getById).toHaveBeenCalledWith('p1');
  });

  it('não executa a query quando id é string vazia', () => {
    const { result } = renderHook(() => usePatient(''), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(patientsApi.getById).not.toHaveBeenCalled();
  });

  it('respeita a opção enabled: false explícita', () => {
    const { result } = renderHook(
      () => usePatient('p1', { enabled: false }),
      { wrapper: makeWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(patientsApi.getById).not.toHaveBeenCalled();
  });

  it('executa a query quando enabled: true explícito', async () => {
    vi.mocked(patientsApi.getById).mockResolvedValue(mockPatient as never);

    const { result } = renderHook(
      () => usePatient('p1', { enabled: true }),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patientsApi.getById).toHaveBeenCalledWith('p1');
  });
});

// ─── useCreatePatient ─────────────────────────────────────────────────────────

describe('useCreatePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama patientsApi.create com os dados fornecidos', async () => {
    vi.mocked(patientsApi.create).mockResolvedValue(mockPatient as never);
    const dto = { name: 'João', phone: '11999999999', birthDate: '1975-03-10', currentStage: 'SCREENING' as const };

    const { result } = renderHook(() => useCreatePatient(), { wrapper: makeWrapper() });
    result.current.mutate(dto as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patientsApi.create).toHaveBeenCalledWith(dto);
  });

  it('exibe toast.success após criação bem-sucedida', async () => {
    vi.mocked(patientsApi.create).mockResolvedValue(mockPatient as never);

    const { result } = renderHook(() => useCreatePatient(), { wrapper: makeWrapper() });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalled();
  });

  it('exibe toast.error quando criação falha', async () => {
    vi.mocked(patientsApi.create).mockRejectedValue(new Error('Erro na API'));

    const { result } = renderHook(() => useCreatePatient(), { wrapper: makeWrapper() });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});

// ─── useUpdatePatient ─────────────────────────────────────────────────────────

describe('useUpdatePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama patientsApi.update com id e dados', async () => {
    const updated = { ...mockPatient, name: 'Maria Atualizada' };
    vi.mocked(patientsApi.update).mockResolvedValue(updated as never);

    const { result } = renderHook(() => useUpdatePatient(), { wrapper: makeWrapper() });
    result.current.mutate({ id: 'p1', data: { name: 'Maria Atualizada' } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patientsApi.update).toHaveBeenCalledWith('p1', { name: 'Maria Atualizada' });
    expect(toast.success).toHaveBeenCalled();
  });

  it('exibe toast.error quando atualização falha', async () => {
    vi.mocked(patientsApi.update).mockRejectedValue(new Error('Erro ao atualizar'));

    const { result } = renderHook(() => useUpdatePatient(), { wrapper: makeWrapper() });
    result.current.mutate({ id: 'p1', data: {} as never });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});

// ─── useDeletePatient ─────────────────────────────────────────────────────────

describe('useDeletePatient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama patientsApi.delete com o id correto', async () => {
    vi.mocked(patientsApi.delete).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useDeletePatient(), { wrapper: makeWrapper() });
    result.current.mutate('p1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patientsApi.delete).toHaveBeenCalledWith('p1');
    expect(toast.success).toHaveBeenCalled();
  });

  it('exibe toast.error quando remoção falha', async () => {
    vi.mocked(patientsApi.delete).mockRejectedValue(new Error('Erro ao remover'));

    const { result } = renderHook(() => useDeletePatient(), { wrapper: makeWrapper() });
    result.current.mutate('p1');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });
});
