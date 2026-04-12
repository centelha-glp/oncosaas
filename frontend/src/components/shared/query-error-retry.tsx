'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface QueryErrorRetryProps {
  title: string;
  description?: string;
  onRetry: () => void;
  isFetching: boolean;
  className?: string;
}

export function QueryErrorRetry({
  title,
  description = 'Verifique sua conexão e tente novamente. Se o problema continuar, contate o suporte.',
  onRetry,
  isFetching,
  className,
}: QueryErrorRetryProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive',
        className
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-destructive/90">{description}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
        onClick={() => onRetry()}
        disabled={isFetching}
      >
        <RefreshCw
          className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')}
          aria-hidden
        />
        {isFetching ? 'Carregando...' : 'Tentar novamente'}
      </Button>
    </div>
  );
}
