import {
  CreateDoctorSchema,
  DoctorFacetsSchema,
  DoctorListQuerySchema,
  DoctorRowSchema,
  DoctorSchema,
  list,
  single,
  z,
  type Doctor,
} from '@doctrack/contracts';
import { API_PREFIX, defineRoute, type RouteDefinition } from '../../../platform/http/index.ts';
import type {
  GetDoctorFacets,
  GetDoctorQuery,
  ListDoctorsQuery,
  RegisterDoctorHandler,
} from '../application/index.ts';
import type { DoctorProps } from '../domain/index.ts';

export interface DoctorRouteDeps {
  register: RegisterDoctorHandler;
  listDoctors: ListDoctorsQuery;
  getDoctor: GetDoctorQuery;
  facets: GetDoctorFacets;
}

const toDoctor = (d: DoctorProps): Doctor => ({
  id: d.id,
  name: d.name,
  specialization: d.specialization,
  hospital: d.hospital,
  phone: d.phone,
  email: d.email,
  patientCount: d.patientCount,
  isActive: d.isActive,
  createdAt: d.createdAt.toISOString(),
});

export function doctorRoutes(deps: DoctorRouteDeps): RouteDefinition[] {
  const create = defineRoute({
    method: 'post',
    path: `${API_PREFIX}/doctors`,
    summary: 'Register a doctor',
    tags: ['Doctors'],
    permission: 'doctors:write',
    request: { body: CreateDoctorSchema },
    responses: {
      201: { description: 'Doctor created', schema: single(DoctorSchema) },
      409: { description: 'A doctor with this email already exists' },
    },
    handler: async ({ body }) => ({
      status: 201,
      data: toDoctor(await deps.register.execute(body)),
    }),
  });

  const index = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/doctors`,
    summary: 'List doctors with search, filters and pagination',
    tags: ['Doctors'],
    permission: 'doctors:read',
    request: { query: DoctorListQuerySchema },
    responses: { 200: { description: 'A page of doctors', schema: list(DoctorRowSchema) } },
    handler: async ({ query }) => {
      const page = await deps.listDoctors.execute(query);
      return {
        status: 200,
        data: page.items.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
        meta: page.meta,
      };
    },
  });

  const facets = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/doctors/facets`,
    summary: 'Distinct specializations and hospitals, for filter controls',
    tags: ['Doctors'],
    permission: 'doctors:read',
    responses: { 200: { description: 'Filter values', schema: single(DoctorFacetsSchema) } },
    handler: async () => ({ status: 200, data: await deps.facets.execute() }),
  });

  const show = defineRoute({
    method: 'get',
    path: `${API_PREFIX}/doctors/:id`,
    summary: 'Get one doctor',
    tags: ['Doctors'],
    permission: 'doctors:read',
    request: { params: z.object({ id: z.string().min(1).max(64) }) },
    responses: {
      200: { description: 'The doctor', schema: single(DoctorSchema) },
      404: { description: 'Doctor not found' },
    },
    handler: async ({ params }) => ({
      status: 200,
      data: toDoctor(await deps.getDoctor.execute(params.id)),
    }),
  });

  return [create, index, facets, show];
}
