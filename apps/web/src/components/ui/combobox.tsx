'use client';

import { ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface ComboOption {
  id: string;
  label: string;
}

export function Combobox({
  label,
  placeholder,
  selected,
  options,
  loading,
  onQuery,
  onSelect,
  className,
}: {
  label: string;
  placeholder: string;
  selected: ComboOption | null;
  options: readonly ComboOption[];
  loading?: boolean;
  onQuery: (text: string) => void;
  onSelect: (option: ComboOption | null) => void;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (option: ComboOption) => {
    onSelect(option);
    setText('');
    onQuery('');
    setOpen(false);
  };

  return (
    <div ref={root} className={cn('relative', className)}>
      <div className="flex h-10 items-center gap-2 rounded-ui border border-border-input bg-bg px-3 focus-within:border-accent max-md:h-11">
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[active] ? `${id}-${options[active].id}` : undefined
          }
          value={open ? text : (selected?.label ?? '')}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
            setOpen(true);
            onQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(options.length - 1, i + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === 'Enter' && open && options[active]) {
              event.preventDefault();
              choose(options[active]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink focus-visible:outline-none"
        />
        {selected ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              onSelect(null);
              setText('');
            }}
            className="text-ink-subtle hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : (
          <ChevronDown className="size-4 text-ink-subtle" aria-hidden />
        )}
      </div>
      {open ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-ui border border-border bg-bg p-1"
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${id}-${option.id}`}
              role="option"
              aria-selected={option.id === selected?.id}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                'flex h-9 cursor-pointer items-center rounded-ui px-3 text-body text-ink',
                index === active && 'bg-bg-sunken',
              )}
            >
              <span className="truncate">{option.label}</span>
            </li>
          ))}
          {options.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-small text-ink-subtle">
              {loading ? 'Searching…' : 'No matches'}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
