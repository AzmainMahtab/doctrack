import { LogOut } from 'lucide-react';
import { signOutAction } from '@/features/auth/actions';

export function Account({ email, role }: { email: string; role: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border px-3 pt-4 pb-2">
      <p className="truncate text-small font-medium text-ink">{email}</p>
      <p className="text-caption text-ink-subtle capitalize">{role}</p>
      <form action={signOutAction} className="pt-2.5">
        <button
          type="submit"
          className="flex items-center gap-2 text-small font-medium text-ink-muted hover:text-ink max-md:min-h-11"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}
