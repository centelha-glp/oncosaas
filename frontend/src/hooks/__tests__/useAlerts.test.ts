import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api/alerts', () => ({
  alertsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    acknowledge: vi.fn(),
    resolve: vi.fn(),
    dismiss: vi.fn(),
    getCriticalCount: vi.fn(),
    getOpenCount: vi.fn(),
  },
}));

import {
  useAlerts,
  useAlert,
  useCreateAlert,
  useAcknowledgeAlert,
  useResolveAlert,
  useDismissAlert,
  useCriticalAlertsCount,
  useOpenAlertsCount,
} from '../useAlerts';
import { alertsApi } from '@/lib/api/alerts';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, refetchInterval: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

const mockAlert = {
  id: 'a1',
  tenantId: 't1',
  patientId: 'p1',
  type: 'CRITICAL_SYMPTOM',
  severity: 'CRITICAL',
  message: 'Febre alta detectada',
  context: null,
  status: 'PENDING',
  acknowledgedBy: null,
  acknowledgedAt: null,
  resolvedBy: null,
  resolvedAt: null,
  dismissedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// ─── useAlerts ────────────────────────────────────────────────────────────────

describe('useAlerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca todos os alertas sem filtros', async () => {
    vi.mocked(alertsApi.getAll).mockResolvedValue([mockAlert] as never);

    const { result } = renderHook(() => useAlerts(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockAlert]);
    expect(alertsApi.getAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it('passa status e patientId como filtros para a API', async () => {
    vi.mocked(alertsApi.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAlerts('PENDING', 'p1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alertsApi.getAll).toHaveBeenCalledWith('PENDING', 'p1');
  });

  it('está desabilitado quando patientId é null (nenhum paciente selecionado)', () => {
    const { result } = renderHook(() => useAlerts(undefined, null), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(alertsApi.getAll).not.toHaveBeenCalled();
  });

  it('está habilitado quando patientId não é fornecido (busca global)', async () => {
    vi.mocked(alertsApi.getAll).mockResolvedValue([] as never);

    const { result } = renderHook(() => useAlerts(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alertsApi.getAll).toHaveBeenCalled();
  });

  it('expõe isError quando a busca falha', async () => {
    vi.mocked(alertsApi.getAll).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useAlerts(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useAlert ─────────────────────────────────────────────────────────────────

describe('useAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca alerta único pelo id', async () => {
    vi.mocked(alertsApi.getById).mockResolvedValue(mockAlert as never);

    const { result } = renderHook(() => useAlert('a1'), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAlert);
    expect(alertsApi.getById).toHaveBeenCalledWith('a1');
  });

  it('não executa quando id é string vazia', () => {
    const { result } = renderHook(() => useAlert(''), { wrapper: makeWrapper() });

    expect(result.current.fetchStatus).toBe('idle');
    expect(alertsApi.getById).not.toHaveBeenCalled();
  });
});

// ─── useCreateAlert ───────────────────────────────────────────────────────────

describe('useCreateAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama alertsApi.create com os dados fornecidos', async () => {
    vi.mocked(alertsApi.create).mockResolvedValue(mockAlert as never);
    const dto = {
      patientId: 'p1',
      type: 'CRITICAL_SYMPTOM' as const,
      severity: 'CRITICAL' as const,
      message: 'Febre alta',
    };

    const { result } = renderHook(() => useCreateAlert(), { wrapper: makeWrapper() });
    result.current.mutate(dto);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alertsApi.create).toHaveBeenCalledWith(dto);
  });
});

// ─── useAcknowledgeAlert ──────────────────────────────────────────────────────

describe('useAcknowledgeAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama alertsApi.acknowledge com o id correto', async () => {
    vi.mocked(alertsApi.acknowledge).mockResolvedValue(mockAlert as never);

    const { result } = renderHook(() => useAcknowledgeAlert(), { wrapper: makeWrapper() });
    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alertsApi.acknowledge).toHaveBeenCalledWith('a1');
  });
});

// ─── useResolveAlert ──────────────────────────────────────────────────────────

describe('useResolveAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama alertsApi.resolve com o id correto', async () => {
    vi.mocked(alertsApi.resolve).mockResolvedValue(mockAlert as never);

    const { result } = renderHook(() => useResolveAlert(), { wrapper: makeWrapper() });
    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alertsApi.resolve).toHaveBeenCalledWith('a1');
  });
});

// ─── useDismissAlert ──────────────────────────────────────────────────────────

describe('useDismissAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama alertsApi.dismiss com o id correto', async () => {
    vi.mocked(alertsApi.dismiss).mockResolvedValue(mockAlert as never);

    const { result } = renderHook(() => useDismissAlert(), { wrapper: makeWrapper() });
    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(alertsApi.dismiss).toHaveBeenCalledWith('a1');
  });
});

// ─── useCriticalAlertsCount ───────────────────────────────────────────────────

describe('useCriticalAlertsCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna contagem de alertas críticos', async () => {
    vi.mocked(alertsApi.getCriticalCount).mockResolvedValue({ count: 3 } as never);

    const { result } = renderHook(() => useCriticalAlertsCount(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ count: 3 });
    expect(alertsApi.getCriticalCount).toHaveBeenCalled();
  });

  it('expõe isError quando a busca falha', async () => {
    vi.mocked(alertsApi.getCriticalCount).mockRejectedValue(new Error('erro'));

    const { result } = renderHook(() => useCriticalAlertsCount(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useOpenAlertsCount ───────────────────────────────────────────────────────

describe('useOpenAlertsCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna contagem de alertas abertos', async () => {
    vi.mocked(alertsApi.getOpenCount).mockResolvedValue({ count: 7 } as never);

    const { result } = renderHook(() => useOpenAlertsCount(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ count: 7 });
    expect(alertsApi.getOpenCount).toHaveBeenCalled();
  });
});
