'use client';

import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const ANY = '__any__';

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  anyLabel,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  anyLabel: string;
  options: readonly Option[];
  value: string | null;
  onChange: (next: string | null) => void;
  className?: string;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Select.Root
      value={value ?? ANY}
      onValueChange={(next) => onChange(next === ANY ? null : next)}
    >
      <Select.Trigger
        aria-label={`${label}: ${selected?.label ?? anyLabel}`}
        className={cn(
          'flex h-10 items-center gap-2 rounded-ui border border-border-input bg-bg px-3 text-left text-body text-ink focus-visible:border-accent max-md:h-11',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <Select.Value>{selected?.label ?? anyLabel}</Select.Value>
        </span>
        <Select.Icon>
          <ChevronDown className="size-4 text-ink-subtle" aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-ui border border-border bg-bg text-body shadow-none"
        >
          <Select.Viewport className="p-1">
            {[{ value: ANY, label: anyLabel }, ...options].map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative flex h-9 cursor-pointer items-center rounded-ui pr-8 pl-3 text-ink outline-none data-[highlighted]:bg-bg-sunken data-[state=checked]:font-medium"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2">
                  <Check className="size-4 text-accent" aria-hidden />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
