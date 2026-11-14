'use client';

import { CreateDoctorSchema, type CreateDoctor, type Doctor } from '@doctrack/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormDrawer } from '@/components/ui/form-drawer';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { ApiError, fieldErrors } from '@/lib/api/problem';
import { keys } from '@/lib/query/keys';
import type { One } from '@/lib/query/queries';

const FIELDS = ['name', 'specialization', 'hospital', 'phone', 'email'] as const;

export function DoctorFormDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CreateDoctor>({
    resolver: zodResolver(CreateDoctorSchema),
    defaultValues: { name: '', specialization: '', hospital: '', phone: '', email: '' },
    mode: 'onSubmit',
  });

  const create = useMutation({
    mutationFn: (body: CreateDoctor) => api<One<Doctor>>('/doctors', { method: 'POST', body }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.doctors.all }),
        client.invalidateQueries({ queryKey: keys.dashboard.all }),
      ]);
      toast.show({ message: 'Doctor saved.' });
      form.reset();
      setFormError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      const mapped = fieldErrors(error);
      let placed = false;
      for (const name of FIELDS) {
        const message = mapped[name];
        if (message) {
          form.setError(name, { message });
          placed = true;
        }
      }
      if (error instanceof ApiError && error.status === 409) {
        form.setError('email', { message: 'A doctor with this email already exists.' });
        placed = true;
        form.setFocus('email');
      }
      if (!placed) {
        setFormError(
          error instanceof ApiError && error.status === 429
            ? `Too many requests. Try again in ${error.retryAfter ?? 30} seconds.`
            : "We couldn't save the doctor. Check your connection and try again.",
        );
      } else {
        const first = FIELDS.find(
          (name) =>
            mapped[name] || (name === 'email' && error instanceof ApiError && error.status === 409),
        );
        if (first) form.setFocus(first);
      }
    },
  });

  const errors = form.formState.errors;
  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          setFormError(null);
        }
        onOpenChange(next);
      }}
      title="Add doctor"
      description="Register a doctor on the register."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="doctor-form" loading={create.isPending}>
            Save doctor
          </Button>
        </>
      }
    >
      <form
        id="doctor-form"
        noValidate
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
        className="flex flex-col gap-4"
      >
        {formError ? <Alert>{formError}</Alert> : null}
        <TextField
          label="Name"
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <TextField
          label="Specialization"
          autoComplete="off"
          error={errors.specialization?.message}
          {...form.register('specialization')}
        />
        <TextField
          label="Hospital"
          autoComplete="off"
          error={errors.hospital?.message}
          {...form.register('hospital')}
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
      </form>
    </FormDrawer>
  );
}
