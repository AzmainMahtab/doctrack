import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { PageMeta } from '@doctrack/contracts';
import { cn } from '@/lib/cn';

function Step({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    'inline-flex size-9 items-center justify-center rounded-ui text-ink-muted transition-colors duration-120 ease-(--ease-standard) max-md:size-11';
  if (!href) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className={cn(cls, 'cursor-not-allowed opacity-40')}
      >
        {children}
      </button>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(cls, 'hover:bg-bg-sunken hover:text-ink')}
      scroll={false}
    >
      {children}
    </Link>
  );
}

export function Pagination({
  meta,
  hrefFor,
}: {
  meta: PageMeta;
  hrefFor: (page: number) => string;
}) {
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.total, meta.page * meta.limit);
  return (
    <nav aria-label="Pagination" className="flex h-14 items-center gap-3">
      <p className="flex-1 text-small text-ink-muted">
        {meta.total === 0
          ? 'No results'
          : `Showing ${first} to ${last} of ${meta.total.toLocaleString('en-GB')}`}
      </p>
      <Step href={meta.page > 1 ? hrefFor(meta.page - 1) : null} label="Previous page">
        <ChevronLeft className="size-[18px]" aria-hidden />
      </Step>
      <span className="text-small font-medium text-ink tabular-nums">
        Page {meta.page} of {Math.max(1, meta.totalPages)}
      </span>
      <Step href={meta.page < meta.totalPages ? hrefFor(meta.page + 1) : null} label="Next page">
        <ChevronRight className="size-[18px]" aria-hidden />
      </Step>
    </nav>
  );
}
