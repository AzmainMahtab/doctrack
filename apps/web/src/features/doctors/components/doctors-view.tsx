'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useCallback, useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { SearchField } from '@/components/ui/search-field';
import { SelectField } from '@/components/ui/select-field';
import { SkeletonRows } from '@/components/ui/skeleton-rows';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/problem';
import { listHref } from '@/lib/list-href';
import { normalizeDoctorQuery, q } from '@/lib/query/queries';
import { useCan } from '@/lib/session/session';
import { doctorParsers } from '@/lib/url-state/parsers';
import { plural } from '@/lib/format';
import { DoctorFormDrawer } from './doctor-form-drawer';
import { DoctorEntries, DoctorsTable } from './doctors-table';

const DEFAULTS = { sort: '-createdAt', page: 1 };

export function DoctorsView() {
  const canWrite = useCan('doctors:write');
  const [params, setParams] = useQueryStates(doctorParsers, {
    shallow: false,
    clearOnDefault: true,
  });
  const [drawer, setDrawer] = useState(false);
  const query = normalizeDoctorQuery(params);
  const list = useQuery({ ...q.doctors(api, query), placeholderData: keepPreviousData });
  const facets = useQuery(q.facets(api));

  const filtersActive = Boolean(
    params.q || params.specialization || params.hospital || params.from || params.to,
  );
  const hrefFor = useCallback(
    (page: number) => listHref('/doctors', { ...params, page }, DEFAULTS),
    [params],
  );
  const hrefForSort = useCallback(
    (sort: string) => listHref('/doctors', { ...params, sort, page: null }, DEFAULTS),
    [params],
  );
  const onSearch = useCallback(
    (text: string) => void setParams({ q: text || null, page: null }),
    [setParams],
  );
  const total = list.data?.meta.total;

  const error = list.error;
  const rate = error instanceof ApiError && error.status === 429;

  return (
    <>
      <PageTitle
        title="Doctors"
        subtitle={`${total === undefined ? 'Everyone' : plural(total, 'doctor')} on the register. Search, filter and open a doctor to see their patients.`}
        action={
          canWrite ? (
            <Button icon={Plus} onClick={() => setDrawer(true)} className="max-md:w-full">
              Add doctor
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-[3_1_16rem]">
          <SearchField
            label="Search doctors"
            placeholder="Search by name, specialization or hospital"
            value={params.q ?? ''}
            onChange={onSearch}
          />
        </div>
        <SelectField
          label="Specialization"
          anyLabel="Specialization"
          className="min-w-44 flex-1"
          options={(facets.data?.data.specializations ?? []).map((v) => ({ value: v, label: v }))}
          value={params.specialization}
          onChange={(value) => void setParams({ specialization: value, page: null })}
        />
        <SelectField
          label="Hospital"
          anyLabel="Hospital"
          className="min-w-44 flex-1"
          options={(facets.data?.data.hospitals ?? []).map((v) => ({ value: v, label: v }))}
          value={params.hospital}
          onChange={(value) => void setParams({ hospital: value, page: null })}
        />
        <DateRangeFilter
          label="Registered"
          from={params.from}
          to={params.to}
          className="min-w-44 flex-1"
          onChange={(range) => void setParams({ ...range, page: null })}
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            icon={X}
            onClick={() =>
              void setParams({
                q: null,
                specialization: null,
                hospital: null,
                from: null,
                to: null,
                page: null,
              })
            }
          >
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
                : "We couldn't load the doctors. Check your connection and try again."}
            </Alert>
            <Button variant="secondary" icon={RefreshCw} onClick={() => void list.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}
        {list.data && list.data.data.length === 0 ? (
          <EmptyState
            title={
              filtersActive ? 'No doctors match these filters' : 'No doctors on the register yet'
            }
            body={
              filtersActive
                ? 'Try a shorter search, or clear the filters to see everyone on the register.'
                : 'Add the first doctor to start the register.'
            }
            action={
              filtersActive ? (
                <Button
                  variant="secondary"
                  icon={X}
                  onClick={() =>
                    void setParams({
                      q: null,
                      specialization: null,
                      hospital: null,
                      from: null,
                      to: null,
                      page: null,
                    })
                  }
                >
                  Clear filters
                </Button>
              ) : canWrite ? (
                <Button icon={Plus} onClick={() => setDrawer(true)}>
                  Add doctor
                </Button>
              ) : undefined
            }
          />
        ) : null}
        {list.data && list.data.data.length > 0 ? (
          <>
            <DoctorsTable rows={list.data.data} sort={query.sort} hrefForSort={hrefForSort} />
            <DoctorEntries rows={list.data.data} />
            <Pagination meta={list.data.meta} hrefFor={hrefFor} />
          </>
        ) : null}
      </div>

      {canWrite ? <DoctorFormDrawer open={drawer} onOpenChange={setDrawer} /> : null}
    </>
  );
}
