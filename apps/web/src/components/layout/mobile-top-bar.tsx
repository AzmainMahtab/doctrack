'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { IconButton } from '../ui/icon-button';
import { NavLinks } from './nav-links';

export function MobileTopBar({ account }: { account: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-bg-sunken px-5 md:px-8 lg:hidden">
      <span className="flex-1 font-display text-[1.375rem] leading-none font-medium tracking-[-0.01em] text-ink">
        Doctrack
      </span>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <IconButton icon={Menu} label="Open menu" />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 animate-[fade-in_160ms_var(--ease-out)] bg-scrim" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-full animate-[drawer-in_220ms_var(--ease-out)] flex-col gap-6 bg-bg-sunken px-4 py-5">
            <div className="flex items-center">
              <Dialog.Title className="flex-1 px-3 font-display text-h2 font-medium text-ink">
                Menu
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Close menu" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              Navigate between Dashboard, Doctors and Patients.
            </Dialog.Description>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="flex-1" />
            {account}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}
