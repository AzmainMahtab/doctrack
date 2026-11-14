import { AggregateRoot } from '../../../shared/domain/index.ts';
import { utcDay } from '../../../shared/time/index.ts';
import { DoctorRegistered } from './events.ts';

export interface DoctorProps {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface NewDoctor {
  id: string;
  name: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  now: Date;
}

export class Doctor extends AggregateRoot {
  constructor(readonly props: DoctorProps) {
    super();
  }

  static register(input: NewDoctor): Doctor {
    const doctor = new Doctor({
      id: input.id,
      name: input.name.trim(),
      specialization: input.specialization.trim(),
      hospital: input.hospital.trim(),
      phone: input.phone,
      email: input.email.trim().toLowerCase(),
      patientCount: 0,
      isActive: true,
      createdAt: input.now,
    });
    doctor.record(
      new DoctorRegistered(input.id, {
        specialization: doctor.props.specialization,
        hospital: doctor.props.hospital,
        registeredOn: utcDay(input.now),
      }),
    );
    return doctor;
  }
}
