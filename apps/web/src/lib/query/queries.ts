import {
  DoctorListQuerySchema,
  DoctorPatientListQuerySchema,
  PatientListQuerySchema,
  TimeseriesQuerySchema,
  type ConditionCounts,
  type Doctor,
  type DoctorFacets,
  type DoctorListQuery,
  type DoctorPatientListQuery,
  type DoctorRow,
  type Me,
  type PageMeta,
  type Patient,
  type PatientListQuery,
  type PatientRow,
  type PatientsPerDoctorRow,
  type Summary,
  type Timeseries,
  type TimeseriesQuery,
} from '@doctrack/contracts';
import { queryOptions } from '@tanstack/react-query';
import type { Fetcher } from '../api/client.ts';
import { keys } from './keys.ts';

export interface One<T> {
  data: T;
}

export interface Many<T> {
  data: T[];
  meta: PageMeta;
}

type Raw = Record<string, unknown>;

export const toSearch = (query: object): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

const clean = (raw: Raw): Raw =>
  Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

export const normalizeDoctorQuery = (raw: Raw): DoctorListQuery => {
  const parsed = DoctorListQuerySchema.safeParse(clean(raw));
  return parsed.success ? parsed.data : DoctorListQuerySchema.parse({});
};

export const normalizePatientQuery = (raw: Raw): PatientListQuery => {
  const parsed = PatientListQuerySchema.safeParse(clean(raw));
  return parsed.success ? parsed.data : PatientListQuerySchema.parse({});
};

export const normalizeDoctorPatientQuery = (raw: Raw): DoctorPatientListQuery => {
  const parsed = DoctorPatientListQuerySchema.safeParse(clean(raw));
  return parsed.success ? parsed.data : DoctorPatientListQuerySchema.parse({});
};

export const normalizeTimeseriesQuery = (raw: Raw): TimeseriesQuery => {
  const parsed = TimeseriesQuerySchema.safeParse(clean(raw));
  return parsed.success ? parsed.data : TimeseriesQuerySchema.parse({});
};

export const q = {
  session: (get: Fetcher) =>
    queryOptions({ queryKey: keys.session, queryFn: () => get<One<Me>>('/auth/me') }),
  doctors: (get: Fetcher, query: DoctorListQuery) =>
    queryOptions({
      queryKey: keys.doctors.list(query),
      queryFn: () => get<Many<DoctorRow>>(`/doctors${toSearch(query)}`),
    }),
  doctor: (get: Fetcher, id: string) =>
    queryOptions({
      queryKey: keys.doctors.detail(id),
      queryFn: () => get<One<Doctor>>(`/doctors/${id}`),
    }),
  facets: (get: Fetcher) =>
    queryOptions({
      queryKey: keys.doctors.facets,
      queryFn: () => get<One<DoctorFacets>>('/doctors/facets'),
      staleTime: 5 * 60_000,
    }),
  doctorLookup: (get: Fetcher, text: string) =>
    queryOptions({
      queryKey: keys.doctors.lookup(text),
      queryFn: () =>
        get<Many<DoctorRow>>(`/doctors${toSearch({ q: text, limit: 20, sort: 'name' })}`),
    }),
  patients: (get: Fetcher, query: PatientListQuery) =>
    queryOptions({
      queryKey: keys.patients.list(query),
      queryFn: () => get<Many<PatientRow>>(`/patients${toSearch(query)}`),
    }),
  doctorPatients: (get: Fetcher, doctorId: string, query: DoctorPatientListQuery) =>
    queryOptions({
      queryKey: keys.patients.ofDoctor(doctorId, query),
      queryFn: () => get<Many<PatientRow>>(`/doctors/${doctorId}/patients${toSearch(query)}`),
    }),
  patient: (get: Fetcher, id: string) =>
    queryOptions({
      queryKey: keys.patients.detail(id),
      queryFn: () => get<One<Patient>>(`/patients/${id}`),
    }),
  summary: (get: Fetcher) =>
    queryOptions({
      queryKey: keys.dashboard.summary,
      queryFn: () => get<One<Summary>>('/dashboard/summary'),
    }),
  conditions: (get: Fetcher) =>
    queryOptions({
      queryKey: keys.dashboard.conditions,
      queryFn: () => get<One<ConditionCounts>>('/dashboard/conditions'),
    }),
  perDoctor: (get: Fetcher, limit: number) =>
    queryOptions({
      queryKey: keys.dashboard.perDoctor(limit),
      queryFn: () =>
        get<One<PatientsPerDoctorRow[]>>(`/dashboard/patients-per-doctor${toSearch({ limit })}`),
    }),
  timeseries: (get: Fetcher, query: TimeseriesQuery) =>
    queryOptions({
      queryKey: keys.dashboard.timeseries(query),
      queryFn: () => get<One<Timeseries>>(`/dashboard/timeseries${toSearch(query)}`),
    }),
};
