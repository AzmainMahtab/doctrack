import type { DoctorRow } from '@doctrack/contracts';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

type Sort = 'createdAt' | '-createdAt' | 'name' | '-name' | '-patientCount';

const HEAD = 'py-3 text-caption font-semibold tracking-[0.05em] text-ink-muted uppercase';

function SortHeader({
  label,
  asc,
  desc,
  current,
  hrefFor,
  right,
  className,
}: {
  label: string;
  asc?: Sort;
  desc: Sort;
  current: Sort;
  hrefFor: (sort: Sort) => string;
  right?: boolean;
  className?: string;
}) {
  const active = current === asc || current === desc;
  const next = current === desc && asc ? asc : desc;
  const Icon = current === asc ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (current === asc ? 'ascending' : 'descending') : 'none'}
      className={cn(HEAD, right && 'text-right', className)}
    >
      <Link
        href={hrefFor(next)}
        scroll={false}
        className={cn('inline-flex items-center gap-1 hover:text-ink', right && 'flex-row-reverse')}
      >
        {label}
        {active ? <Icon className="size-3.5" aria-hidden /> : null}
      </Link>
    </th>
  );
}

export function DoctorsTable({
  rows,
  sort,
  hrefForSort,
}: {
  rows: readonly DoctorRow[];
  sort: Sort;
  hrefForSort: (sort: Sort) => string;
}) {
  return (
    <table className="hidden w-full table-fixed border-collapse text-left md:table">
      <caption className="sr-only">Doctors on the register</caption>
      <colgroup>
        <col />
        <col className="w-48" />
        <col className="hidden w-56 lg:table-column" />
        <col className="w-24" />
        <col className="hidden w-32 lg:table-column" />
        <col className="w-10" />
      </colgroup>
      <thead>
        <tr className="border-b border-border">
          <SortHeader label="Doctor" asc="name" desc="-name" current={sort} hrefFor={hrefForSort} />
          <th scope="col" className={HEAD}>
            Specialization
          </th>
          <th scope="col" className={cn(HEAD, 'hidden lg:table-cell')}>
            Hospital
          </th>
          <SortHeader
            label="Patients"
            desc="-patientCount"
            current={sort}
            hrefFor={hrefForSort}
            right
          />
          <SortHeader
            label="Registered"
            asc="createdAt"
            desc="-createdAt"
            current={sort}
            hrefFor={hrefForSort}
            className="hidden pl-6 lg:table-cell"
          />
          <th scope="col" className={HEAD}>
            <span className="sr-only">Open</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((doctor) => (
          <tr
            key={doctor.id}
            className="relative h-13 border-b border-border transition-colors duration-120 ease-(--ease-standard) hover:bg-bg-sunken"
          >
            <td className="truncate pr-4">
              <Link
                href={`/doctors/${doctor.id}`}
                title={doctor.name}
                className="text-body font-medium text-ink before:absolute before:inset-0 before:content-['']"
              >
                {doctor.name}
              </Link>
            </td>
            <td className="truncate pr-4 text-body text-ink-muted">{doctor.specialization}</td>
            <td className="hidden truncate pr-4 text-body text-ink-muted lg:table-cell">
              {doctor.hospital}
            </td>
            <td className="text-right text-body font-medium text-ink tabular-nums">
              {doctor.patientCount}
            </td>
            <td className="hidden pl-6 text-body text-ink-muted lg:table-cell">
              {formatDate(doctor.createdAt)}
            </td>
            <td className="text-right">
              <ChevronRight className="ml-auto size-[18px] text-ink-subtle" aria-hidden />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DoctorEntries({ rows }: { rows: readonly DoctorRow[] }) {
  return (
    <ul className="flex flex-col md:hidden">
      {rows.map((doctor) => (
        <li key={doctor.id} className="border-b border-border">
          <Link href={`/doctors/${doctor.id}`} className="flex flex-col gap-1 py-3">
            <span className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
                {doctor.name}
              </span>
              <span className="text-body font-medium text-ink tabular-nums">
                {doctor.patientCount}
              </span>
              <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
            </span>
            <span className="truncate text-small text-ink-muted">
              {doctor.specialization} · {doctor.hospital}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
