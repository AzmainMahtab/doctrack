'use client';

import { CONDITIONS } from '@doctrack/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RefreshCw, X } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useCallback, useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { CONDITION_LABEL } from '@/components/ui/condition-tag';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchField } from '@/components/ui/search-field';
import { SelectField } from '@/components/ui/select-field';
import { SkeletonRows } from '@/components/ui/skeleton-rows';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { plural } from '@/lib/format';
import { listHref } from '@/lib/list-href';
import { normalizePatientQuery, q } from '@/lib/query/queries';
import { useCan } from '@/lib/session/session';
import { patientParsers } from '@/lib/url-state/parsers';
import { useDeletePatient } from '../delete-patient';
import { PatientFormDrawer } from './patient-form-drawer';
import { PatientsTable } from './patients-table';

const DEFAULTS = { sort: '-createdAt', page: 1 };

export function PatientsView() {
  const canWrite = useCan('patients:write');
  const [params, setParams] = useQueryStates(patientParsers, {
    shallow: false,
    clearOnDefault: true,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string; doctorName: string } | null>(
    null,
  );
  const [lookup, setLookup] = useState('');
  const remove = useDeletePatient();

  const query = normalizePatientQuery(params);
  const list = useQuery({ ...q.patients(api, query), placeholderData: keepPreviousData });
  const doctors = useQuery(q.doctorLookup(api, lookup));
  const chosen = useQuery({
    ...q.doctor(api, params.doctorId ?? 'none'),
    enabled: Boolean(params.doctorId),
  });

  const filtersActive = Boolean(
    params.q || params.condition || params.doctorId || params.from || params.to,
  );
  const clear = () =>
    void setParams({ q: null, condition: null, doctorId: null, from: null, to: null, page: null });
  const hrefFor = useCallback(
    (page: number) => listHref('/patients', { ...params, page }, DEFAULTS),
    [params],
  );
  const onSearch = useCallback(
    (text: string) => void setParams({ q: text || null, page: null }),
    [setParams],
  );

  const error = list.error;
  const rate = error instanceof ApiError && error.status === 429;
  const total = list.data?.meta.total;

  return (
    <>
      <PageTitle
        title="Patients"
        subtitle={`${total === undefined ? 'Everyone' : plural(total, 'patient')} on the register. New patients are added from a doctor's page.`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-[3_1_16rem]">
          <SearchField
            label="Search patients"
            placeholder="Search by name or diagnosis"
            value={params.q ?? ''}
            onChange={onSearch}
          />
        </div>
        <SelectField
          label="Condition"
          anyLabel="Any condition"
          className="min-w-44 flex-1"
          options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))}
          value={params.condition}
          onChange={(value) =>
            void setParams({ condition: value as (typeof CONDITIONS)[number] | null, page: null })
          }
        />
        <Combobox
          label="Doctor"
          placeholder="Any doctor"
          className="min-w-48 flex-1"
          selected={
            params.doctorId
              ? { id: params.doctorId, label: chosen.data?.data.name ?? 'Selected doctor' }
              : null
          }
          options={(doctors.data?.data ?? []).map((d) => ({ id: d.id, label: d.name }))}
          loading={doctors.isFetching}
          onQuery={setLookup}
          onSelect={(option) => void setParams({ doctorId: option?.id ?? null, page: null })}
        />
        <DateRangeFilter
          label="Registered"
          from={params.from}
          to={params.to}
          className="min-w-44 flex-1"
          onChange={(range) => void setParams({ ...range, page: null })}
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
            <Alert icon={rate ? 'clock' : 'alert'}>
              {rate
                ? `Too many requests. Try again in ${error instanceof ApiError ? (error.retryAfter ?? 30) : 30} seconds.`
                : "We couldn't load the patients. Check your connection and try again."}
            </Alert>
            <Button variant="secondary" icon={RefreshCw} onClick={() => void list.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}
        {list.data && list.data.data.length === 0 ? (
          <EmptyState
            title={
              filtersActive ? 'No patients match these filters' : 'No patients on the register yet'
            }
            body={
              filtersActive
                ? 'Try a shorter search, or clear the filters to see everyone on the register.'
                : "Open a doctor and add the first patient from the doctor's page."
            }
            action={
              filtersActive ? (
                <Button variant="secondary" icon={X} onClick={clear}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {list.data && list.data.data.length > 0 ? (
          <>
            <PatientsTable
              rows={list.data.data}
              showDoctor
              canWrite={canWrite}
              onEdit={(row) => setEditing(row.id)}
              onDelete={(row) =>
                setDeleting({ id: row.id, name: row.name, doctorName: row.doctorName })
              }
            />
            <Pagination meta={list.data.meta} hrefFor={hrefFor} />
          </>
        ) : null}
      </div>

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
            ? `${deleting.name} will be removed from ${deleting.doctorName}'s list. This cannot be undone.`
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
