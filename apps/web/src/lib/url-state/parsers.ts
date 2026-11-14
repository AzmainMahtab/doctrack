import {
  DOCTOR_SORTS,
  PATIENT_SORTS,
  TIMESERIES_ENTITIES,
  TIMESERIES_INTERVALS,
  CONDITIONS,
} from '@doctrack/contracts';
import { parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs';

export const doctorParsers = {
  q: parseAsString,
  specialization: parseAsString,
  hospital: parseAsString,
  from: parseAsString,
  to: parseAsString,
  sort: parseAsStringLiteral(DOCTOR_SORTS),
  page: parseAsInteger,
};

export const patientParsers = {
  q: parseAsString,
  condition: parseAsStringLiteral(CONDITIONS),
  doctorId: parseAsString,
  from: parseAsString,
  to: parseAsString,
  sort: parseAsStringLiteral(PATIENT_SORTS),
  page: parseAsInteger,
};

export const doctorPatientParsers = {
  q: parseAsString,
  condition: parseAsStringLiteral(CONDITIONS),
  sort: parseAsStringLiteral(PATIENT_SORTS),
  page: parseAsInteger,
};

export const timeseriesParsers = {
  entity: parseAsStringLiteral(TIMESERIES_ENTITIES),
  interval: parseAsStringLiteral(TIMESERIES_INTERVALS),
  window: parseAsInteger,
};
