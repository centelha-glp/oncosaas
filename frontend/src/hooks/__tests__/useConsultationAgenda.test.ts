import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api/oncology-navigation', () => ({
  oncologyNavigationApi: {
    getConsultationAgenda: vi.fn(),
  },
}));

import { useConsultationAgenda } from '../useOncologyNavigation';
import { oncologyNavigationApi } from '@/lib/api/oncology-navigation';

const baseParams = {
  from: '2024-05-06',
  to: '2024-05-12',
  scope: 'consultations' as const,
  page: 1,
  limit: 50,
};

const emptyPage = {
  items: [],
  total: 0,
  page: 1,
  limit: 50,
  totalPages: 0,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

describe('useConsultationAgenda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não dispara fetch quando from ou to estão vazios', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useConsultationAgenda({
          ...baseParams,
          from: '',
        }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(oncologyNavigationApi.getConsultationAgenda).not.toHaveBeenCalled();
  });

  it('busca a agenda e usa a queryKey com os parâmetros', async () => {
    vi.mocked(oncologyNavigationApi.getConsultationAgenda).mockResolvedValue(
      emptyPage
    );

    const { Wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useConsultationAgenda(baseParams), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(oncologyNavigationApi.getConsultationAgenda).toHaveBeenCalledWith(
      baseParams
    );
    expect(
      queryClient.getQueryData(['consultation-agenda', baseParams])
    ).toEqual(emptyPage);
  });

  it('respeita enabled: false sem chamar a API', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useConsultationAgenda(baseParams, { enabled: false }),
      { wrapper: Wrapper }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(oncologyNavigationApi.getConsultationAgenda).not.toHaveBeenCalled();
  });

  it('envia q na busca por paciente quando informado', async () => {
    vi.mocked(oncologyNavigationApi.getConsultationAgenda).mockResolvedValue(
      emptyPage
    );

    const { Wrapper } = makeWrapper();
    const params = { ...baseParams, q: 'maria' };
    const { result } = renderHook(() => useConsultationAgenda(params), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(oncologyNavigationApi.getConsultationAgenda).toHaveBeenCalledWith(
      params
    );
  });

  it('expõe isError quando a API falha', async () => {
    vi.mocked(oncologyNavigationApi.getConsultationAgenda).mockRejectedValue(
      new Error('falha de rede')
    );

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useConsultationAgenda(baseParams), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('falha de rede');
  });
});
