import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface SegmentLink {
  label: string;
  href: string;
  selected: boolean;
}

export function SegmentedLinks({
  label,
  items,
  className,
}: {
  label: string;
  items: readonly SegmentLink[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'inline-flex h-8 overflow-hidden rounded-ui border border-border-input',
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          scroll={false}
          aria-current={item.selected ? 'true' : undefined}
          className={cn(
            'flex flex-1 items-center justify-center px-3 text-small whitespace-nowrap transition-colors duration-120 ease-(--ease-standard) max-md:min-h-11',
            item.selected
              ? 'bg-bg-sunken font-semibold text-ink'
              : 'bg-bg font-medium text-ink-muted hover:text-ink',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
