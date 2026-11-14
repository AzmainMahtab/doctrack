import type { Condition, Gender } from '@doctrack/contracts';
import { AggregateRoot } from '../../../shared/domain/index.ts';
import {
  PatientConditionChanged,
  PatientRegistered,
  PatientRemoved,
  PatientUpdated,
} from './events.ts';

export interface PatientProps {
  id: string;
  doctorId: string;
  doctorName: string;
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  email: string;
  condition: Condition;
  diagnosis: string;
  admittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PatientChanges = Partial<
  Pick<
    PatientProps,
    'name' | 'dateOfBirth' | 'gender' | 'phone' | 'email' | 'condition' | 'diagnosis' | 'admittedAt'
  >
>;

export type NewPatient = Omit<PatientProps, 'createdAt' | 'updatedAt'> & { now: Date };

const CHANGEABLE = [
  'name',
  'dateOfBirth',
  'gender',
  'phone',
  'email',
  'condition',
  'diagnosis',
  'admittedAt',
] as const satisfies readonly (keyof PatientChanges)[];

const same = (a: unknown, b: unknown): boolean =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

export class Patient extends AggregateRoot {
  private current: PatientProps;

  constructor(props: PatientProps) {
    super();
    this.current = props;
  }

  get props(): PatientProps {
    return this.current;
  }

  static admit(input: NewPatient): Patient {
    const { now, ...rest } = input;
    const patient = new Patient({
      ...rest,
      name: rest.name.trim(),
      email: rest.email.trim().toLowerCase(),
      diagnosis: rest.diagnosis.trim(),
      createdAt: now,
      updatedAt: now,
    });
    patient.record(
      new PatientRegistered(patient.current.id, {
        doctorId: patient.current.doctorId,
        condition: patient.current.condition,
        admittedAt: patient.current.admittedAt.toISOString(),
      }),
    );
    return patient;
  }

  update(changes: PatientChanges, now: Date): string[] {
    const before = this.current;
    const next: PatientProps = { ...before };
    const changed: string[] = [];
    for (const field of CHANGEABLE) {
      const value = changes[field];
      if (value === undefined) continue;
      const normalized =
        typeof value === 'string'
          ? field === 'email'
            ? value.trim().toLowerCase()
            : value.trim()
          : value;
      if (same(before[field], normalized)) continue;
      (next as unknown as Record<string, unknown>)[field] = normalized;
      changed.push(field);
    }
    if (changed.length === 0) return changed;
    next.updatedAt = now;
    this.current = next;
    this.record(new PatientUpdated(next.id, { doctorId: next.doctorId, changed }));
    if (changed.includes('condition')) {
      this.record(
        new PatientConditionChanged(next.id, {
          doctorId: next.doctorId,
          from: before.condition,
          to: next.condition,
        }),
      );
    }
    return changed;
  }

  remove(): void {
    this.record(
      new PatientRemoved(this.current.id, {
        doctorId: this.current.doctorId,
        condition: this.current.condition,
      }),
    );
  }
}
