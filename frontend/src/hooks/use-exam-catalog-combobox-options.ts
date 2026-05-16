'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { examCatalogApi, type ExamCatalogItem } from '@/lib/api/exam-catalog';
import type { ExamCatalogComboboxOption } from '@/components/shared/exam-catalog-combobox';

const EXAM_CATALOG_SEARCH_LIMIT = 800;

export type ExamCatalogSelection = {
  displayName: string;
  code?: string;
  examCatalogCode?: string;
};

export function useExamCatalogComboboxOptions(debouncedQuery: string) {
  const catalogSearchTrimmed = debouncedQuery.trim();
  const { data: catalogRemote, isPending, isError } = useQuery({
    queryKey: ['exam-catalog', 'orders', catalogSearchTrimmed],
    queryFn: () =>
      examCatalogApi.search({
        q: catalogSearchTrimmed || undefined,
        limit: EXAM_CATALOG_SEARCH_LIMIT,
        offset: 0,
      }),
    staleTime: 60 * 1000,
  });

  const catalogLoading = isPending && catalogRemote === undefined;

  const options: ExamCatalogComboboxOption<ExamCatalogSelection>[] = useMemo(() => {
    const rows = catalogRemote?.items ?? [];
    if (catalogLoading || isError || rows.length === 0) {
      return [];
    }
    return rows.map((row: ExamCatalogItem) => ({
      id: `db-${row.code}`,
      label: row.code ? `${row.name} (${row.code})` : row.name,
      subtitle: row.rolItemCode ? `Rol: ${row.rolItemCode}` : undefined,
      data: {
        displayName: row.name,
        code: row.code,
        examCatalogCode: row.code,
      },
    }));
  }, [catalogRemote, catalogLoading, isError]);

  return { options, catalogLoading, isError };
}
