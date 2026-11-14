import {
  CreatePatientSchema,
  DoctorPatientListQuerySchema,
  PatientListQuerySchema,
  PatientRowSchema,
  PatientSchema,
  UpdatePatientSchema,
  list,
  single,
  z,
  type Patient,
} from '@doctrack/contracts';
import { API_PREFIX, defineRoute, type RouteDefinition } from '../../../platform/http/index.ts';
import type {
  AdmitPatientHandler,
  GetPatientQuery,
  ListDoctorPatientsQuery,
  ListPatientsQuery,
  RemovePatientHandler,
  UpdatePatientHandler,
} from '../application/index.ts';
import type { PatientProps, PatientRow } from '../domain/index.ts';

export interface PatientRouteDeps {
  admit: AdmitPatientHandler;
  update: UpdatePatientHandler;
  remove: RemovePatientHandler;
  listPatients: ListPatientsQuery;
  listDoctorPatients: ListDoctorPatientsQuery;
  getPatient: GetPatientQuery;
}

const toPatient = (p: PatientProps): Patient => ({
  id: p.id,
  doctorId: p.doctorId,
  doctorName: p.doctorName,
  name: p.name,
  dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
  gender: p.gender,
  phone: p.phone,
  email: p.email,
  condition: p.condition,
  diagnosis: p.diagnosis,
  admittedAt: p.admittedAt.toISOString(),
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const toRow = (r: PatientRow) => ({ ...r, admittedAt: r.admittedAt.toISOString() });

const idParam = z.object({ id: z.string().min(1).max(64) });
const doctorParam = z.object({ id: z.string().min(1).max(64) });
const doctorPatientParams = z.object({
  id: z.string().min(1).max(64),
  patientId: z.string().min(1).max(64),
});

export function patientRoutes(deps: PatientRouteDeps): RouteDefinition[] {
  const index = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/patients`,
    summary: 'List patients with search, filters and pagination',
    tags: ['Patients'],
    permission: 'patients:read',
    request: { query: PatientListQuerySchema },
    responses: { 200: { description: 'A page of patients', schema: list(PatientRowSchema) } },
    handler: async ({ query }) => {
      const page = await deps.listPatients.execute(query);
      return { status: 200, data: page.items.map(toRow), meta: page.meta };
    },
  });

  const show = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/patients/:id`,
    summary: 'Get one patient',
    tags: ['Patients'],
    permission: 'patients:read',
    request: { params: idParam },
    responses: {
      200: { description: 'The patient', schema: single(PatientSchema) },
      404: { description: 'Patient not found' },
    },
    handler: async ({ params }) => ({
      status: 200,
      data: toPatient(await deps.getPatient.execute(params.id)),
    }),
  });

  const patch = defineRoute({
    method: 'patch',
    path: `${API_PREFIX}/patients/:id`,
    summary: 'Edit a patient',
    tags: ['Patients'],
    permission: 'patients:write',
    request: { params: idParam, body: UpdatePatientSchema },
    responses: {
      200: { description: 'The updated patient', schema: single(PatientSchema) },
      404: { description: 'Patient not found' },
    },
    handler: async ({ params, body }) => ({
      status: 200,
      data: toPatient(await deps.update.execute({ id: params.id, changes: body })),
    }),
  });

  const destroy = defineRoute({
    method: 'delete',
    path: `${API_PREFIX}/patients/:id`,
    summary: 'Delete a patient',
    tags: ['Patients'],
    permission: 'patients:write',
    request: { params: idParam },
    responses: {
      204: { description: 'Deleted' },
      404: { description: 'Patient not found' },
    },
    handler: async ({ params }) => {
      await deps.remove.execute({ id: params.id });
      return { status: 204 };
    },
  });

  const byDoctor = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/doctors/:id/patients`,
    summary: "List a doctor's patients",
    tags: ['Patients'],
    permission: 'patients:read',
    request: { params: doctorParam, query: DoctorPatientListQuerySchema },
    responses: {
      200: { description: 'A page of the doctor’s patients', schema: list(PatientRowSchema) },
      404: { description: 'Doctor not found' },
    },
    handler: async ({ params, query }) => {
      const page = await deps.listDoctorPatients.execute(params.id, query);
      return { status: 200, data: page.items.map(toRow), meta: page.meta };
    },
  });

  const admit = defineRoute({
    method: 'post',
    path: `${API_PREFIX}/doctors/:id/patients`,
    summary: 'Add a patient under a doctor',
    tags: ['Patients'],
    permission: 'patients:write',
    request: { params: doctorParam, body: CreatePatientSchema },
    responses: {
      201: { description: 'Patient created', schema: single(PatientSchema) },
      404: { description: 'Doctor not found' },
    },
    handler: async ({ params, body }) => ({
      status: 201,
      data: toPatient(await deps.admit.execute({ doctorId: params.id, data: body })),
    }),
  });

  const removeFromDoctor = defineRoute({
    method: 'delete',
    path: `${API_PREFIX}/doctors/:id/patients/:patientId`,
    summary: "Remove a patient from a doctor's list",
    tags: ['Patients'],
    permission: 'patients:write',
    request: { params: doctorPatientParams },
    responses: {
      204: { description: 'Removed' },
      404: { description: 'Patient not found under this doctor' },
    },
    handler: async ({ params }) => {
      await deps.remove.execute({ id: params.patientId, doctorId: params.id });
      return { status: 204 };
    },
  });

  return [index, show, patch, destroy, byDoctor, admit, removeFromDoctor];
}
