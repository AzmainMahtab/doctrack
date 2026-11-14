import type { ReactNode } from 'react';

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1">
        <h1 className="font-display text-h1 font-medium text-ink">{title}</h1>
        {subtitle ? <p className="text-body text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="max-md:w-full">{action}</div> : null}
    </div>
  );
}
