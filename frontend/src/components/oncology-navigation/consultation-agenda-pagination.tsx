'use client';

import { Button } from '@/components/ui/button';

export interface ConsultationAgendaPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ConsultationAgendaPagination({
  page,
  totalPages,
  onPageChange,
}: ConsultationAgendaPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 pt-4"
      aria-label="Paginação da agenda"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
