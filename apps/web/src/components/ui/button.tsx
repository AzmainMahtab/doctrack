import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'bg-bg text-ink border border-border-input hover:bg-bg-sunken',
  ghost: 'bg-transparent text-ink-muted hover:bg-bg-sunken hover:text-ink',
  danger: 'bg-danger text-danger-ink hover:bg-[#8f1d17]',
};

const base =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-ui px-4 text-body font-medium whitespace-nowrap transition-colors duration-120 ease-(--ease-standard) disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-11';

interface Common {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  icon: Icon,
  loading,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, VARIANTS[variant], fullWidth && 'w-full', className)}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'secondary',
  icon: Icon,
  fullWidth,
  className,
  children,
  href,
  ...rest
}: Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link
      href={href}
      {...rest}
      className={cn(base, VARIANTS[variant], fullWidth && 'w-full', className)}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </Link>
  );
}
