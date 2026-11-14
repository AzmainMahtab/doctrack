import type { ReactNode } from 'react';
import { Account } from '@/components/layout/account';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import { Sidebar } from '@/components/layout/sidebar';
import { Alert } from '@/components/ui/alert';
import { LinkButton } from '@/components/ui/button';
import { ApiError } from '@/lib/api/problem';
import { getSession } from '@/lib/session/server';
import { SessionProvider } from '@/lib/session/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let me;
  try {
    me = await getSession();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 429 || error.status === 503)) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 p-6">
          <Alert icon={error.status === 429 ? 'clock' : 'alert'}>
            {error.status === 429
              ? `Too many requests. Try again in ${error.retryAfter ?? 30} seconds.`
              : 'The service is unavailable. Try again in a moment.'}
          </Alert>
          <div>
            <LinkButton href="/dashboard" variant="secondary">
              Try again
            </LinkButton>
          </div>
        </main>
      );
    }
    throw error;
  }
  return (
    <SessionProvider me={me}>
      <div className="lg:flex">
        <Sidebar email={me.user.email} role={me.user.role} />
        <div className="min-w-0 flex-1">
          <MobileTopBar account={<Account email={me.user.email} role={me.user.role} />} />
          <main className="mx-auto flex w-full max-w-278 flex-col gap-6 px-5 pt-6 pb-10 md:px-8 lg:px-12 lg:pt-10">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
