import { z } from '../openapi.ts';
import {
  EmailSchema,
  NameSchema,
  PhoneSchema,
  DateRangeQuery,
  rangeIsOrdered,
  searchQuery,
} from '../common/fields.ts';
import { PageQuerySchema } from '../common/page.ts';

const SpecializationSchema = z.string().trim().min(2).max(80);
const HospitalSchema = z.string().trim().min(2).max(120);

export const CreateDoctorSchema = z
  .object({
    name: NameSchema,
    specialization: SpecializationSchema.openapi({ example: 'Cardiology' }),
    hospital: HospitalSchema.openapi({ example: 'St. Mary Hospital' }),
    phone: PhoneSchema,
    email: EmailSchema,
  })
  .openapi('CreateDoctor');

export const DoctorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    specialization: z.string(),
    hospital: z.string(),
    phone: z.string(),
    email: z.string(),
    patientCount: z.number().int().min(0),
    isActive: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .openapi('Doctor');

export const DoctorRowSchema = DoctorSchema.pick({
  id: true,
  name: true,
  specialization: true,
  hospital: true,
  patientCount: true,
  createdAt: true,
}).openapi('DoctorRow');

export const DOCTOR_SORTS = ['-createdAt', 'createdAt', 'name', '-name', '-patientCount'] as const;

export const DoctorListQuerySchema = PageQuerySchema.extend({
  q: searchQuery,
  specialization: SpecializationSchema.optional(),
  hospital: HospitalSchema.optional(),
  ...DateRangeQuery,
  sort: z.enum(DOCTOR_SORTS).default('-createdAt'),
}).refine(rangeIsOrdered, { message: '`from` must not be after `to`', path: ['from'] });

export type CreateDoctor = z.infer<typeof CreateDoctorSchema>;
export type Doctor = z.infer<typeof DoctorSchema>;
export type DoctorRow = z.infer<typeof DoctorRowSchema>;
export type DoctorListQuery = z.infer<typeof DoctorListQuerySchema>;
