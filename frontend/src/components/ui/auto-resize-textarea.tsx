'use client';

import * as React from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  return (node: T | null) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

export interface AutoResizeTextareaProps extends TextareaProps {
  /** Linhas mínimas visíveis antes de crescer com o conteúdo (aprox. line-height do tema). */
  minRows?: number;
}

export const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, onChange, minRows: minRowsProp = 3, style, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const mergedRef = React.useMemo(() => mergeRefs(innerRef, ref), [ref]);

  const adjustHeight = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    adjustHeight();
  }, [adjustHeight, props.value]);

  return (
    <Textarea
      ref={mergedRef}
      {...props}
      rows={1}
      onChange={(e) => {
        adjustHeight();
        onChange?.(e);
      }}
      style={{
        minHeight: `${minRowsProp * 1.5}rem`,
        ...style,
      }}
      className={cn('resize-none overflow-hidden', className)}
    />
  );
});
AutoResizeTextarea.displayName = 'AutoResizeTextarea';
