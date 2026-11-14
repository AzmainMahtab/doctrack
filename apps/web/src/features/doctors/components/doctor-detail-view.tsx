'use client';

import { CONDITIONS } from '@doctrack/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useCallback, useState } from 'react';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CONDITION_LABEL } from '@/components/ui/condition-tag';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FactStrip } from '@/components/ui/fact-strip';
import { Pagination } from '@/components/ui/pagination';
import { SearchField } from '@/components/ui/search-field';
import { SelectField } from '@/components/ui/select-field';
import { SkeletonRows } from '@/components/ui/skeleton-rows';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { formatDate } from '@/lib/format';
import { listHref } from '@/lib/list-href';
import { normalizeDoctorPatientQuery, q } from '@/lib/query/queries';
import { useCan } from '@/lib/session/session';
import { doctorPatientParsers } from '@/lib/url-state/parsers';
import { useDeletePatient } from '@/features/patients/delete-patient';
import { PatientFormDrawer } from '@/features/patients/components/patient-form-drawer';
import { PatientsTable } from '@/features/patients/components/patients-table';

export function DoctorDetailView({ id }: { id: string }) {
  const canWrite = useCan('patients:write');
  const [params, setParams] = useQueryStates(doctorPatientParsers, {
    shallow: false,
    clearOnDefault: true,
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const remove = useDeletePatient();

  const doctor = useQuery(q.doctor(api, id));
  const query = normalizeDoctorPatientQuery(params);
  const list = useQuery({ ...q.doctorPatients(api, id, query), placeholderData: keepPreviousData });
  const hrefFor = useCallback(
    (page: number) =>
      listHref(`/doctors/${id}`, { ...params, page }, { sort: '-createdAt', page: 1 }),
    [id, params],
  );
  const onSearch = useCallback(
    (text: string) => void setParams({ q: text || null, page: null }),
    [setParams],
  );
  const filtersActive = Boolean(params.q || params.condition);
  const clear = () => void setParams({ q: null, condition: null, page: null });
  const d = doctor.data?.data;
  const error = list.error;

  return (
    <>
      <Breadcrumb parent={{ label: 'Doctors', href: '/doctors' }} current={d?.name ?? 'Doctor'} />

      <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
          <h1 className="font-display text-h1 font-medium break-words text-ink">
            {d?.name ?? ' '}
          </h1>
          <p className="text-body text-ink-muted">
            {d ? `${d.specialization} at ${d.hospital}` : ' '}
          </p>
        </div>
        <p
          className="flex items-end gap-2.5"
          aria-label={d ? `${d.patientCount} patients` : undefined}
        >
          <span className="font-display text-figure font-normal text-ink tabular-nums">
            {d?.patientCount ?? '–'}
          </span>
          <span className="pb-1 text-body text-ink-muted">
            {d?.patientCount === 1 ? 'patient' : 'patients'}
          </span>
        </p>
      </header>

      {d ? (
        <FactStrip
          facts={[
            { label: 'Phone', value: d.phone },
            { label: 'Email', value: d.email },
            { label: 'Registered', value: formatDate(d.createdAt) },
            { label: 'Status', value: d.isActive ? 'Active' : 'Inactive' },
          ]}
        />
      ) : null}

      <section aria-labelledby="doctor-patients-title" className="flex flex-col gap-6 pt-4">
        <div className="flex flex-wrap items-end gap-4">
          <h2
            id="doctor-patients-title"
            className="flex-1 font-display text-h2 font-medium text-ink"
          >
            Patients
          </h2>
          {canWrite ? (
            <Button icon={Plus} onClick={() => setAdding(true)} className="max-md:w-full">
              Add patient
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-60 flex-[3_1_16rem]">
            <SearchField
              label="Search this doctor's patients"
              placeholder="Search this doctor's patients"
              value={params.q ?? ''}
              onChange={onSearch}
            />
          </div>
          <SelectField
            label="Condition"
            anyLabel="Any condition"
            className="min-w-44 flex-1 md:max-w-48"
            options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))}
            value={params.condition}
            onChange={(value) =>
              void setParams({ condition: value as (typeof CONDITIONS)[number] | null, page: null })
            }
          />
          {filtersActive ? (
            <Button variant="ghost" icon={X} onClick={clear}>
              Clear
            </Button>
          ) : null}
        </div>

        <div aria-busy={list.isFetching}>
          {list.isPending ? <SkeletonRows /> : null}
          {error && !list.data ? (
            <div className="flex flex-col items-start gap-3">
              <Alert icon={error instanceof ApiError && error.status === 429 ? 'clock' : 'alert'}>
                {error instanceof ApiError && error.status === 429
                  ? `Too many requests. Try again in ${error.retryAfter ?? 30} seconds.`
                  : "We couldn't load the patients. Check your connection and try again."}
              </Alert>
              <Button variant="secondary" icon={RefreshCw} onClick={() => void list.refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
          {list.data && list.data.data.length === 0 ? (
            <EmptyState
              title={filtersActive ? 'No patients match these filters' : 'No patients yet'}
              body={
                filtersActive
                  ? 'Try a shorter search, or clear the filters.'
                  : 'Add the first patient under this doctor.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" icon={X} onClick={clear}>
                    Clear filters
                  </Button>
                ) : canWrite ? (
                  <Button icon={Plus} onClick={() => setAdding(true)}>
                    Add patient
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {list.data && list.data.data.length > 0 ? (
            <>
              <PatientsTable
                rows={list.data.data}
                showDoctor={false}
                canWrite={canWrite}
                onEdit={(row) => setEditing(row.id)}
                onDelete={(row) => setDeleting({ id: row.id, name: row.name })}
              />
              <Pagination meta={list.data.meta} hrefFor={hrefFor} />
            </>
          ) : null}
        </div>
      </section>

      {canWrite ? (
        <PatientFormDrawer
          target={{ mode: 'create', doctorId: id }}
          open={adding}
          onOpenChange={setAdding}
        />
      ) : null}
      {canWrite && editing ? (
        <PatientFormDrawer
          target={{ mode: 'edit', patientId: editing }}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this patient?"
        body={
          deleting
            ? `${deleting.name} will be removed from ${d?.name ?? 'this doctor'}'s list. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete patient"
        onConfirm={() => {
          if (deleting) remove(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
