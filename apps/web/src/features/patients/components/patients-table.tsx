'use client';

import type { PatientRow } from '@doctrack/contracts';
import * as Dialog from '@radix-ui/react-dialog';
import { Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConditionTag } from '@/components/ui/condition-tag';
import { IconButton } from '@/components/ui/icon-button';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const HEAD = 'py-3 text-caption font-semibold tracking-[0.05em] text-ink-muted uppercase';

export function PatientsTable({
  rows,
  showDoctor,
  canWrite,
  onEdit,
  onDelete,
}: {
  rows: readonly PatientRow[];
  showDoctor: boolean;
  canWrite: boolean;
  onEdit: (row: PatientRow) => void;
  onDelete: (row: PatientRow) => void;
}) {
  const [sheet, setSheet] = useState<PatientRow | null>(null);
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-left md:table">
        <caption className="sr-only">Patients</caption>
        <colgroup>
          <col />
          <col className="w-44" />
          {showDoctor ? <col className="hidden w-52 md:table-column" /> : null}
          <col className="hidden w-32 lg:table-column" />
          <col className={canWrite ? 'w-24' : 'w-4'} />
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={HEAD}>
              Patient
            </th>
            <th scope="col" className={HEAD}>
              Condition
            </th>
            {showDoctor ? (
              <th scope="col" className={HEAD}>
                Doctor
              </th>
            ) : null}
            <th scope="col" className={cn(HEAD, 'hidden lg:table-cell')}>
              Admitted
            </th>
            <th scope="col" className={HEAD}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((patient) => (
            <tr key={patient.id} className="h-13 border-b border-border">
              <td className="truncate pr-4 text-body font-medium text-ink" title={patient.name}>
                {patient.name}
              </td>
              <td>
                <ConditionTag condition={patient.condition} />
              </td>
              {showDoctor ? (
                <td className="truncate pr-4 text-body text-ink-muted">{patient.doctorName}</td>
              ) : null}
              <td className="hidden text-body text-ink-muted lg:table-cell">
                {formatDate(patient.admittedAt)}
              </td>
              <td className="text-right">
                {canWrite ? (
                  <span className="inline-flex gap-1">
                    <IconButton
                      icon={Pencil}
                      label={`Edit ${patient.name}`}
                      onClick={() => onEdit(patient)}
                    />
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${patient.name}`}
                      onClick={() => onDelete(patient)}
                    />
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col md:hidden">
        {rows.map((patient) => {
          const body = (
            <>
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">
                  {patient.name}
                </span>
                <ConditionTag condition={patient.condition} />
              </span>
              <span className="truncate text-small text-ink-muted">
                {showDoctor ? `${patient.doctorName} · ` : ''}Admitted{' '}
                {formatDate(patient.admittedAt)}
              </span>
            </>
          );
          return (
            <li key={patient.id} className="border-b border-border">
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setSheet(patient)}
                  className="flex min-h-11 w-full flex-col gap-1 py-3 text-left"
                >
                  {body}
                  <span className="sr-only">Open actions</span>
                </button>
              ) : (
                <div className="flex flex-col gap-1 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog.Root open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 animate-[fade-in_160ms_var(--ease-out)] bg-scrim" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex animate-[toast-in_200ms_var(--ease-out)] flex-col gap-4 rounded-t-ui border-t border-border bg-bg p-5">
            <div className="flex items-center gap-3">
              <Dialog.Title className="flex-1 truncate font-display text-h2 font-medium text-ink">
                {sheet?.name}
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon={X} label="Close" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">
              Choose an action for this patient.
            </Dialog.Description>
            <Button
              variant="secondary"
              icon={Pencil}
              fullWidth
              onClick={() => {
                const row = sheet;
                setSheet(null);
                if (row) onEdit(row);
              }}
            >
              Edit patient
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              fullWidth
              onClick={() => {
                const row = sheet;
                setSheet(null);
                if (row) onDelete(row);
              }}
            >
              Delete patient
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
