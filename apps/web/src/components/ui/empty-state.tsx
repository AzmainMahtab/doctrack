import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  action,
  as: Heading = 'h2',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Heading className="font-display text-h2 font-medium text-ink">{title}</Heading>
      <p className="max-w-105 text-body text-ink-muted">{body}</p>
      {action ? <div className="pt-4">{action}</div> : null}
    </div>
  );
}
