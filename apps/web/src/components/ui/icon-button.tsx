import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: { icon: LucideIcon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-ui text-ink-muted transition-colors duration-120 ease-(--ease-standard) hover:bg-bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 max-md:size-11',
        className,
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
