'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Trash2 } from 'lucide-react';
import { Button } from './button';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-[fade-in_160ms_var(--ease-out)] bg-scrim" />
        <Dialog.Content className="fixed z-50 flex w-[calc(100%-2rem)] max-w-110 animate-[dialog-in_160ms_var(--ease-out)] flex-col gap-5 rounded-ui border border-border bg-bg p-6 shadow-[0_8px_24px_#0f1a2a33] max-md:bottom-4 max-md:left-4 max-md:w-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
          <Dialog.Title className="font-display text-h2 font-medium text-ink">{title}</Dialog.Title>
          <Dialog.Description className="text-body text-ink-muted">{body}</Dialog.Description>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button variant="danger" icon={Trash2} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
