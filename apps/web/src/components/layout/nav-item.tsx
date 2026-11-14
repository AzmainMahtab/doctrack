'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export function NavItem({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'flex h-10 items-center gap-3 rounded-ui px-3 text-body font-medium transition-colors duration-120 ease-(--ease-standard) max-md:h-11',
        active
          ? 'bg-accent-wash font-semibold text-accent'
          : 'text-ink-muted hover:bg-bg hover:text-ink',
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
      {label}
    </Link>
  );
}
