import { CircleAlert, Clock } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Alert({
  children,
  icon = 'alert',
  className,
}: {
  children: ReactNode;
  icon?: 'alert' | 'clock';
  className?: string;
}) {
  const Icon = icon === 'clock' ? Clock : CircleAlert;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-ui bg-danger-wash px-4 py-3 text-critical-ink',
        className,
      )}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <p className="text-body font-medium">{children}</p>
    </div>
  );
}
