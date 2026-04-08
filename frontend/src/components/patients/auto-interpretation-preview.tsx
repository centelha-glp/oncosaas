'use client';

import React from 'react';
import { useWatch, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { computeInterpretationPreview } from '@/lib/utils/reference-range';

interface AutoInterpretationPreviewProps<T extends FieldValues> {
  control: Control<T>;
  valueName: Path<T>;
  referenceName: Path<T>;
}

export function AutoInterpretationPreview<T extends FieldValues>({
  control,
  valueName,
  referenceName,
}: AutoInterpretationPreviewProps<T>): React.ReactElement | null {
  const valueNumeric = useWatch({ control, name: valueName });
  const referenceRange = useWatch({ control, name: referenceName });
  const p = computeInterpretationPreview(valueNumeric, referenceRange);
  if (p === 'unknown') {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
      <span className="text-muted-foreground">Interpretação automática:</span>
      <Badge variant={p === 'outside' ? 'destructive' : 'secondary'}>
        {p === 'outside' ? 'Fora da referência' : 'Dentro da referência'}
      </Badge>
    </div>
  );
}
