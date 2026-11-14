import type { Condition } from '@doctrack/contracts';
import { DomainEvent } from '../../../shared/domain/index.ts';

export class PatientRegistered extends DomainEvent<{
  doctorId: string;
  condition: Condition;
  admittedAt: string;
}> {
  readonly name = 'patient.registered';
}

export class PatientUpdated extends DomainEvent<{ doctorId: string; changed: string[] }> {
  readonly name = 'patient.updated';
}

export class PatientConditionChanged extends DomainEvent<{
  doctorId: string;
  from: Condition;
  to: Condition;
}> {
  readonly name = 'patient.condition_changed';
}

export class PatientRemoved extends DomainEvent<{ doctorId: string; condition: Condition }> {
  readonly name = 'patient.removed';
}
