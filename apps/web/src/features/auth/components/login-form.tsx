'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import type { DemoAccount, DemoRole } from '@/lib/demo';
import { loginAction, type LoginState } from '../actions';

export function LoginForm({ next, accounts }: { next: string; accounts: DemoAccount[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [wait, setWait] = useState(0);
  const [role, setRole] = useState<DemoRole>(accounts[0]?.role ?? 'admin');
  const account = accounts.find((a) => a.role === role);

  useEffect(() => {
    setWait(state.retryAfter ?? 0);
  }, [state]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const limited = state.retryAfter !== undefined;
  const message =
    limited && wait > 0
      ? `Too many attempts. Try again in ${wait} seconds.`
      : limited
        ? 'You can try again now.'
        : state.error;

  return (
    <form action={action} noValidate className="flex w-full max-w-90 flex-col gap-7">
      <span className="font-display text-h2 font-medium text-ink">Doctrack</span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-medium text-ink">Sign in</h1>
        <p className="text-body text-ink-muted">
          Use the account your clinic administrator created for you.
        </p>
      </div>
      {account ? (
        <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
          <legend className="sr-only">Demo accounts</legend>
          <div className="flex items-center justify-between gap-3">
            <span className="text-small font-medium text-ink">Demo account</span>
            <SegmentedControl
              label="Choose a role"
              options={accounts.map((a) => ({ value: a.role, label: a.label }))}
              value={role}
              onChange={setRole}
            />
          </div>
          <p className="text-small text-ink-muted">
            <span className="font-medium text-ink">{account.summary}</span>{' '}
            {account.capabilities.join('. ')}.
          </p>
        </fieldset>
      ) : null}
      {message ? <Alert icon={limited ? 'clock' : 'alert'}>{message}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus={!account}
          key={`email-${account?.role ?? 'none'}`}
          defaultValue={account ? account.email : state.email}
          error={state.fieldErrors?.email}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          key={`password-${account?.role ?? 'none'}`}
          defaultValue={account?.password}
          error={state.fieldErrors?.password}
          hint={message ? undefined : '12 characters or more.'}
          required
        />
      </div>
      <Button type="submit" fullWidth loading={pending} disabled={wait > 0}>
        {pending ? 'Signing in' : account ? `Sign in as ${account.label.toLowerCase()}` : 'Sign in'}
      </Button>
      {account ? (
        <p className="text-small text-ink-muted">
          Demo password:{' '}
          <code className="rounded-ui bg-bg-sunken px-1.5 py-0.5 font-medium text-ink">
            {account.password}
          </code>
        </p>
      ) : null}
    </form>
  );
}
