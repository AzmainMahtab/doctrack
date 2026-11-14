import { DomainEvent } from '../../../shared/domain/index.ts';

export class DoctorRegistered extends DomainEvent<{ specialization: string; hospital: string }> {
  readonly name = 'doctor.registered';
}
