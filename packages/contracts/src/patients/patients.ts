import { z } from '../openapi.ts';
import {
  AdmittedAtSchema,
  ConditionSchema,
  DateOfBirthSchema,
  DateRangeQuery,
  EmailSchema,
  GenderSchema,
  NameSchema,
  PhoneSchema,
  rangeIsOrdered,
  searchQuery,
} from '../common/fields.ts';
import { PageQuerySchema } from '../common/page.ts';

const DiagnosisSchema = z.string().trim().max(500);

export const CreatePatientSchema = z
  .object({
    name: NameSchema,
    dateOfBirth: DateOfBirthSchema,
    gender: GenderSchema,
    phone: PhoneSchema,
    email: EmailSchema,
    condition: ConditionSchema,
    diagnosis: DiagnosisSchema.default(''),
    admittedAt: AdmittedAtSchema,
  })
  .openapi('CreatePatient');

export const UpdatePatientSchema = z
  .object({
    name: NameSchema,
    dateOfBirth: DateOfBirthSchema,
    gender: GenderSchema,
    phone: PhoneSchema,
    email: EmailSchema,
    condition: ConditionSchema,
    diagnosis: DiagnosisSchema,
    admittedAt: AdmittedAtSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to change',
  })
  .openapi('UpdatePatient');

export const PatientSchema = z
  .object({
    id: z.string(),
    doctorId: z.string(),
    doctorName: z.string(),
    name: z.string(),
    dateOfBirth: z.iso.date(),
    gender: GenderSchema,
    phone: z.string(),
    email: z.string(),
    condition: ConditionSchema,
    diagnosis: z.string(),
    admittedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Patient');

export const PatientRowSchema = PatientSchema.pick({
  id: true,
  name: true,
  condition: true,
  doctorId: true,
  doctorName: true,
  admittedAt: true,
}).openapi('PatientRow');

export const PATIENT_SORTS = ['-createdAt', 'createdAt', 'name', '-name', '-admittedAt'] as const;

export const PatientListQuerySchema = PageQuerySchema.extend({
  q: searchQuery,
  condition: ConditionSchema.optional(),
  doctorId: z.string().min(1).max(64).optional(),
  ...DateRangeQuery,
  sort: z.enum(PATIENT_SORTS).default('-createdAt'),
}).refine(rangeIsOrdered, { message: '`from` must not be after `to`', path: ['from'] });

export const DoctorPatientListQuerySchema = PageQuerySchema.extend({
  q: searchQuery,
  condition: ConditionSchema.optional(),
  sort: z.enum(PATIENT_SORTS).default('-createdAt'),
});

export type CreatePatient = z.infer<typeof CreatePatientSchema>;
export type UpdatePatient = z.infer<typeof UpdatePatientSchema>;
export type Patient = z.infer<typeof PatientSchema>;
export type PatientRow = z.infer<typeof PatientRowSchema>;
export type PatientListQuery = z.infer<typeof PatientListQuerySchema>;
export type DoctorPatientListQuery = z.infer<typeof DoctorPatientListQuerySchema>;
