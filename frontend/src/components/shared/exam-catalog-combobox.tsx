'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface ExamCatalogComboboxOption<T> {
  id: string;
  label: string;
  subtitle?: string;
  data: T;
}

interface ExamCatalogComboboxProps<T> {
  options: ExamCatalogComboboxOption<T>[];
  value: string;
  onValueChange: (value: string) => void;
  onSelectOption: (option: ExamCatalogComboboxOption<T>) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onBlurInput?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Campo de busca + lista em Popover; navegação ↑↓, Enter, Esc; roles listbox/option.
 */
export function ExamCatalogCombobox<T>({
  options,
  value,
  onValueChange,
  onSelectOption,
  placeholder = 'Pesquisar por nome ou código...',
  emptyText = 'Nenhum exame encontrado. Digite para buscar ou use um nome livre.',
  className,
  disabled,
  inputRef: externalInputRef,
  onBlurInput,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ExamCatalogComboboxProps<T>): React.ReactElement {
  const listId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled =
    controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen! : uncontrolledOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const innerRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.subtitle?.toLowerCase().includes(q)
    );
  }, [options, value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value, filtered.length]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-combobox-index="${highlightedIndex}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, open]);

  const selectAt = (index: number) => {
    const opt = filtered[index];
    if (!opt) return;
    onSelectOption(opt);
    setOpen(false);
  };

  const setRefs = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    const ext = externalInputRef;
    if (typeof ext === 'function') {
      ext(el);
    } else if (ext && 'current' in ext) {
      // Merge refs: padrão React para ref object + ref interno.
      // eslint-disable-next-line react-hooks/immutability -- atribuição a ref externa em callback ref
      (ext as React.MutableRefObject<HTMLInputElement | null>).current = el;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex((i) =>
        filtered.length ? Math.min(i + 1, filtered.length - 1) : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex((i) => (filtered.length ? Math.max(i - 1, 0) : 0));
    } else if (e.key === 'Enter') {
      if (open && filtered.length > 0) {
        e.preventDefault();
        selectAt(highlightedIndex);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Input
            ref={setRefs}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onValueChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              onBlurInput?.();
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && filtered[highlightedIndex]
                ? `${listId}-opt-${highlightedIndex}`
                : undefined
            }
            autoComplete="off"
            className="pr-8"
          />
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="max-h-48 overflow-auto py-1"
          aria-label="Catálogo de exames"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {emptyText}
            </li>
          ) : (
            filtered.map((opt, index) => (
              <li
                key={opt.id}
                id={`${listId}-opt-${index}`}
                role="option"
                data-combobox-index={index}
                aria-selected={index === highlightedIndex}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer',
                  index === highlightedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectAt(index)}
              >
                <div>{opt.label}</div>
                {opt.subtitle && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {opt.subtitle}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
