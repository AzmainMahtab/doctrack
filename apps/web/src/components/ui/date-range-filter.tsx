'use client';

import * as Popover from '@radix-ui/react-popover';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/format';
import { Button } from './button';
import { cn } from '@/lib/cn';

export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
  className,
}: {
  label: string;
  from: string | null;
  to: string | null;
  onChange: (range: { from: string | null; to: string | null }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: from ?? '', to: to ?? '' });
  const active = Boolean(from || to);
  const summary = active
    ? `${label}: ${from ? formatDate(`${from}T00:00:00Z`) : 'start'} to ${to ? formatDate(`${to}T00:00:00Z`) : 'today'}`
    : `${label}: any time`;
  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ from: from ?? '', to: to ?? '' });
        setOpen(next);
      }}
    >
      <Popover.Trigger
        className={cn(
          'flex h-10 items-center gap-2 rounded-ui border border-border-input bg-bg px-3 text-left text-body text-ink focus-visible:border-accent max-md:h-11',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <CalendarDays className="size-4 shrink-0 text-ink-subtle" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 flex w-72 flex-col gap-4 rounded-ui border border-border bg-bg p-4"
        >
          <label className="flex flex-col gap-1.5 text-small font-medium text-ink">
            From
            <input
              type="date"
              value={draft.from}
              onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
              className="h-10 rounded-ui border border-border-input bg-bg px-3 text-body text-ink focus-visible:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-small font-medium text-ink">
            To
            <input
              type="date"
              value={draft.to}
              onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
              className="h-10 rounded-ui border border-border-input bg-bg px-3 text-body text-ink focus-visible:border-accent"
            />
          </label>
          {invalid ? (
            <p className="text-caption text-critical-ink">
              The start date must not be after the end date.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                onChange({ from: null, to: null });
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              disabled={invalid}
              onClick={() => {
                onChange({ from: draft.from || null, to: draft.to || null });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
