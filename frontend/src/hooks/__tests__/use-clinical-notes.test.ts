import { vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api/clinical-notes', () => ({
  clinicalNotesApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    sign: vi.fn(),
    addendum: vi.fn(),
    void: vi.fn(),
    getSectionSuggestions: vi.fn(),
  },
}));

import {
  useClinicalNoteDetail,
  useClinicalNoteMutations,
  useClinicalNotesForNavigationStep,
  useClinicalNotesList,
} from '../use-clinical-notes';
import { clinicalNotesApi } from '@/lib/api/clinical-notes';

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

describe('useClinicalNotesList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não executa query sem patientId', () => {
    const { result } = renderHook(
      () => useClinicalNotesList(undefined),
      { wrapper: makeWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(clinicalNotesApi.list).not.toHaveBeenCalled();
  });

  it('chama clinicalNotesApi.list com paginação padrão quando patientId existe', async () => {
    vi.mocked(clinicalNotesApi.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    } as never);

    const { result } = renderHook(
      () => useClinicalNotesList('patient-1'),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clinicalNotesApi.list).toHaveBeenCalledWith('patient-1', {
      page: 1,
      limit: 50,
    });
  });
});

describe('useClinicalNotesForNavigationStep', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não executa query quando enabled=false', () => {
    const { result } = renderHook(
      () => useClinicalNotesForNavigationStep('p1', 'ns1', false),
      { wrapper: makeWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(clinicalNotesApi.list).not.toHaveBeenCalled();
  });

  it('não executa query quando patientId está ausente', () => {
    const { result } = renderHook(
      () => useClinicalNotesForNavigationStep(undefined, 'ns1', true),
      { wrapper: makeWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(clinicalNotesApi.list).not.toHaveBeenCalled();
  });

  it('não executa query quando navigationStepId está ausente', () => {
    const { result } = renderHook(
      () => useClinicalNotesForNavigationStep('p1', undefined, true),
      { wrapper: makeWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(clinicalNotesApi.list).not.toHaveBeenCalled();
  });

  it('chama clinicalNotesApi.list com navigationStepId quando habilitado', async () => {
    vi.mocked(clinicalNotesApi.list).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    } as never);

    const { result } = renderHook(
      () => useClinicalNotesForNavigationStep('p1', 'ns1', true),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clinicalNotesApi.list).toHaveBeenCalledWith('p1', {
      page: 1,
      limit: 50,
      navigationStepId: 'ns1',
    });
  });
});

describe('useClinicalNoteDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('não executa query sem id', () => {
    const { result } = renderHook(
      () => useClinicalNoteDetail(undefined),
      { wrapper: makeWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(clinicalNotesApi.getById).not.toHaveBeenCalled();
  });

  it('chama clinicalNotesApi.getById quando id existe', async () => {
    vi.mocked(clinicalNotesApi.getById).mockResolvedValue({ id: 'n1' } as never);

    const { result } = renderHook(
      () => useClinicalNoteDetail('n1'),
      { wrapper: makeWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(clinicalNotesApi.getById).toHaveBeenCalledWith('n1');
  });
});

describe('useClinicalNoteMutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create chama clinicalNotesApi.create com payload normalizado', async () => {
    vi.mocked(clinicalNotesApi.create).mockResolvedValue({ id: 'n1' } as never);

    const { result } = renderHook(
      () => useClinicalNoteMutations('patient-1'),
      { wrapper: makeWrapper() }
    );

    result.current.create.mutate({
      noteType: 'MEDICAL',
      navigationStepId: 'ns-1',
      sections: { hda: 'teste' },
    } as never);

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(clinicalNotesApi.create).toHaveBeenCalledWith('patient-1', {
      noteType: 'MEDICAL',
      navigationStepId: 'ns-1',
      sections: { hda: 'teste' },
    });
  });
});

