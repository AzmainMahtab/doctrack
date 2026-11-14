'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from './icon-button';

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  formId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  formId?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-[fade-in_220ms_var(--ease-out)] bg-scrim" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full animate-[drawer-in_220ms_var(--ease-out)] flex-col border-l border-border bg-bg md:w-120"
          aria-describedby="drawer-description"
        >
          <div className="flex items-center gap-3 px-6 pt-6 pb-4">
            <Dialog.Title className="flex-1 font-display text-h2 font-medium text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" />
            </Dialog.Close>
          </div>
          <Dialog.Description id="drawer-description" className="sr-only">
            {description}
          </Dialog.Description>
          <div id={formId} className="flex-1 overflow-y-auto px-6 pt-2 pb-6">
            {children}
          </div>
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
