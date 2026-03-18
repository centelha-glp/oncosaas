'use client';

import * as React from 'react';
import { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Allow typing a value not in the list (e.g. "Outro") */
  allowCustomValue?: boolean;
  /** Optional placeholder for the list when no results */
  emptyMessage?: string;
  /** Optional className for the trigger/input container */
  className?: string;
  /** Optional className for the popover content */
  contentClassName?: string;
  disabled?: boolean;
  /** Optional id for accessibility */
  id?: string;
  /** Optional aria-label */
  'aria-label'?: string;
}

const filterOptions = (
  options: SearchableSelectOption[],
  query: string
): SearchableSelectOption[] => {
  if (!query.trim()) return options;
  const q = query.toLowerCase().trim();
  return options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
  );
};

export function SearchableSelect({
  options,
  value = '',
  onChange,
  placeholder = 'Buscar ou selecionar...',
  allowCustomValue = false,
  emptyMessage = 'Nenhum resultado encontrado.',
  className,
  contentClassName,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );
  const displayValue = selectedOption ? selectedOption.label : value || '';

  const filteredOptions = useMemo(
    () => filterOptions(options, inputValue),
    [options, inputValue]
  );

  // Derive the display label for the current value — recomputed synchronously.
  const labelForValue = selectedOption?.label ?? value ?? '';

  // "setState during render" — React will discard the render and re-render once
  // synchronously when value/selectedOption changes, avoiding a cascading effect.
  const [prevValue, setPrevValue] = React.useState(value);
  const [prevSelectedLabel, setPrevSelectedLabel] = React.useState(labelForValue);
  if (prevValue !== value || prevSelectedLabel !== labelForValue) {
    setPrevValue(value);
    setPrevSelectedLabel(labelForValue);
    setInputValue(labelForValue);
  }

  const syncInputFromValue = useCallback(() => {
    setInputValue(labelForValue);
  }, [labelForValue]);

  // DOM side-effect only: focus the input when the popover opens.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = useCallback(
    (option: SearchableSelectOption) => {
      onChange(option.value);
      setInputValue(option.label);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    setOpen(true);
    setHighlightedIndex(0);
    if (allowCustomValue) {
      onChange(v);
    }
  };

  const handleBlur = () => {
    if (!allowCustomValue && !selectedOption && value) {
      setInputValue(displayValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) =>
          i < filteredOptions.length - 1 ? i + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) =>
          i > 0 ? i - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (allowCustomValue && inputValue.trim()) {
          onChange(inputValue.trim());
          setOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        syncInputFromValue();
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const item = el.querySelector(`[data-index="${highlightedIndex}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      syncInputFromValue();
      setHighlightedIndex(0);
    } else {
      syncInputFromValue();
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Input
            ref={inputRef}
            id={id}
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={open ? 'searchable-select-list' : undefined}
            aria-activedescendant={
              open && filteredOptions[highlightedIndex]
                ? `searchable-select-option-${highlightedIndex}`
                : undefined
            }
            role="combobox"
            placeholder={placeholder}
            value={open ? inputValue : displayValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="pr-8"
            autoComplete="off"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        id="searchable-select-list"
        role="listbox"
        className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ul
          ref={listRef}
          className="max-h-48 overflow-auto py-1"
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <li
              role="option"
              aria-selected={false}
              className="px-3 py-2 text-sm text-muted-foreground"
            >
              {emptyMessage}
            </li>
          ) : (
            filteredOptions.map((option, index) => (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`searchable-select-option-${index}`}
                  aria-selected={value === option.value}
                  data-index={index}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent focus:bg-accent focus:outline-none',
                    value === option.value && 'bg-accent',
                    index === highlightedIndex && 'bg-accent'
                  )}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
