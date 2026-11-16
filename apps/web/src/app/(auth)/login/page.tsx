import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/components/login-form';
import { demoAccounts } from '@/lib/demo';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh">
      <section className="flex flex-1 items-start justify-center px-5 pt-8 md:items-center md:pt-0">
        <LoginForm next={next ?? ''} accounts={demoAccounts()} />
      </section>
      <aside className="hidden flex-1 flex-col justify-end gap-4 bg-bg-sunken p-16 lg:flex">
        <p className="font-display text-display font-normal text-ink">
          Every patient, accounted for.
        </p>
        <p className="text-body text-ink-muted">
          One register for doctors and the patients under them.
        </p>
      </aside>
    </main>
  );
}
