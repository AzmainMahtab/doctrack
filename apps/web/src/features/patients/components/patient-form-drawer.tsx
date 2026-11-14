'use client';

import {
  CONDITIONS,
  CreatePatientSchema,
  GENDERS,
  type Patient,
  type UpdatePatient,
  type z,
} from '@doctrack/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormDrawer } from '@/components/ui/form-drawer';
import { CONDITION_LABEL } from '@/components/ui/condition-tag';
import { NativeSelect } from '@/components/ui/native-select';
import { TextAreaField } from '@/components/ui/text-area-field';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { ApiError, fieldErrors } from '@/lib/api/problem';
import { keys } from '@/lib/query/keys';
import { q, type One } from '@/lib/query/queries';

type Values = z.input<typeof CreatePatientSchema>;

const FIELDS = [
  'name',
  'dateOfBirth',
  'gender',
  'phone',
  'email',
  'condition',
  'diagnosis',
  'admittedAt',
] as const;

const EMPTY: Values = {
  name: '',
  dateOfBirth: '',
  gender: 'female',
  phone: '',
  email: '',
  condition: 'stable',
  diagnosis: '',
  admittedAt: '',
};

export const toLocalInput = (iso: string): string => (iso ? iso.slice(0, 16) : '');
export const toIso = (value: string): string =>
  value && !value.endsWith('Z') ? new Date(`${value}:00Z`).toISOString() : value;

const fromPatient = (p: Patient): Values => ({
  name: p.name,
  dateOfBirth: p.dateOfBirth,
  gender: p.gender,
  phone: p.phone,
  email: p.email,
  condition: p.condition,
  diagnosis: p.diagnosis,
  admittedAt: toLocalInput(p.admittedAt),
});

export function changedFields(original: Values, next: Values): UpdatePatient {
  const out: Record<string, unknown> = {};
  for (const key of FIELDS) {
    if ((original[key] ?? '') !== (next[key] ?? ''))
      out[key] = key === 'admittedAt' ? toIso(next[key]) : next[key];
  }
  return out as UpdatePatient;
}

export type PatientDrawerTarget =
  { mode: 'create'; doctorId: string } | { mode: 'edit'; patientId: string };

export function PatientFormDrawer({
  target,
  open,
  onOpenChange,
}: {
  target: PatientDrawerTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const edit = target.mode === 'edit';
  const [formError, setFormError] = useState<string | null>(null);
  const baseResolver = zodResolver(CreatePatientSchema);
  const form = useForm<Values>({
    resolver: (values, context, options) =>
      baseResolver({ ...values, admittedAt: toIso(values.admittedAt) }, context, options),
    defaultValues: EMPTY,
    mode: 'onSubmit',
  });

  const existing = useQuery({
    ...q.patient(api, edit ? target.patientId : 'none'),
    enabled: open && edit,
    staleTime: 0,
  });
  const original = existing.data ? fromPatient(existing.data.data) : null;

  useEffect(() => {
    if (open && original) form.reset(original);
    if (open && !edit) form.reset(EMPTY);
  }, [open, existing.data]);

  const finish = async (message: string) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.patients.all }),
      client.invalidateQueries({ queryKey: keys.doctors.all }),
      client.invalidateQueries({ queryKey: keys.dashboard.all }),
    ]);
    toast.show({ message });
    setFormError(null);
    onOpenChange(false);
  };

  const onError = (error: unknown) => {
    const mapped = fieldErrors(error);
    let first: (typeof FIELDS)[number] | undefined;
    for (const name of FIELDS) {
      if (mapped[name]) {
        form.setError(name, { message: mapped[name] });
        first ??= name;
      }
    }
    if (first) form.setFocus(first);
    else
      setFormError(
        error instanceof ApiError && error.status === 429
          ? `Too many requests. Try again in ${error.retryAfter ?? 30} seconds.`
          : error instanceof ApiError && error.status === 404
            ? 'This patient or doctor no longer exists.'
            : "We couldn't save the patient. Check your connection and try again.",
      );
  };

  const save = useMutation({
    mutationFn: async (values: Values) => {
      if (target.mode === 'create') {
        return api<One<Patient>>(`/doctors/${target.doctorId}/patients`, {
          method: 'POST',
          body: { ...values, admittedAt: toIso(values.admittedAt) },
        });
      }
      const changes = original ? changedFields(original, values) : {};
      if (Object.keys(changes).length === 0) return null;
      return api<One<Patient>>(`/patients/${target.patientId}`, { method: 'PATCH', body: changes });
    },
    onSuccess: (result) =>
      finish(edit ? (result ? 'Changes saved.' : 'No changes to save.') : 'Patient saved.'),
    onError,
  });

  const errors = form.formState.errors;
  const loading = edit && existing.isPending;
  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) setFormError(null);
        onOpenChange(next);
      }}
      title={edit ? 'Edit patient' : 'Add patient'}
      description={
        edit ? 'Change the details of this patient.' : 'Add a patient under this doctor.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="patient-form" loading={save.isPending} disabled={loading}>
            {edit ? 'Save changes' : 'Save patient'}
          </Button>
        </>
      }
    >
      {existing.error ? (
        <Alert>We couldn&apos;t load this patient. Close the panel and try again.</Alert>
      ) : null}
      <form
        id="patient-form"
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-4"
        aria-busy={loading}
      >
        {formError ? <Alert>{formError}</Alert> : null}
        <TextField
          label="Name"
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="Date of birth"
          type="date"
          error={errors.dateOfBirth?.message}
          {...form.register('dateOfBirth')}
        />
        <NativeSelect
          label="Gender"
          error={errors.gender?.message}
          options={GENDERS.map((g) => ({ value: g, label: g[0]?.toUpperCase() + g.slice(1) }))}
          {...form.register('gender')}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="off"
          hint="International format, for example +14155550123."
          error={errors.phone?.message}
          {...form.register('phone')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <NativeSelect
          label="Condition"
          error={errors.condition?.message}
          options={CONDITIONS.map((c) => ({ value: c, label: CONDITION_LABEL[c] }))}
          {...form.register('condition')}
        />
        <TextAreaField
          label="Diagnosis"
          optional
          error={errors.diagnosis?.message}
          {...form.register('diagnosis')}
        />
        <TextField
          label="Admitted"
          type="datetime-local"
          error={errors.admittedAt?.message}
          {...form.register('admittedAt')}
        />
      </form>
    </FormDrawer>
  );
}
