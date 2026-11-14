'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { loginAction, type LoginState } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [wait, setWait] = useState(0);

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
      {message ? <Alert icon={limited ? 'clock' : 'alert'}>{message}</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          defaultValue={state.email}
          error={state.fieldErrors?.email}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          hint={message ? undefined : '12 characters or more.'}
          required
        />
      </div>
      <Button type="submit" fullWidth loading={pending} disabled={wait > 0}>
        {pending ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
