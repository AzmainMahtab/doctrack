import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function Breadcrumb({
  parent,
  current,
}: {
  parent: { label: string; href: string };
  current: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-small">
      <Link href={parent.href} className="font-medium text-accent hover:underline">
        {parent.label}
      </Link>
      <ChevronRight className="size-3.5 text-ink-subtle" aria-hidden />
      <span aria-current="page" className="text-ink-muted">
        {current}
      </span>
    </nav>
  );
}
