import { v7 as uuidv7 } from 'uuid';
import type { CreatePatient, UpdatePatient } from '@doctrack/contracts';
import type { Clock, EventBus, UnitOfWork } from '../../../shared/application/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import { Patient, type PatientChanges, type PatientProps } from '../domain/index.ts';
import type { DoctorDirectory, PatientRepository } from '../domain/ports.ts';

export class AdmitPatientHandler {
  constructor(
    private readonly patients: PatientRepository,
    private readonly doctors: DoctorDirectory,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
  ) {}

  async execute(input: { doctorId: string; data: CreatePatient }): Promise<PatientProps> {
    const doctor = await this.doctors.find(input.doctorId);
    if (!doctor) throw AppError.notFound('Doctor not found.');
    const { data } = input;
    const patient = Patient.admit({
      id: uuidv7(),
      doctorId: doctor.id,
      doctorName: doctor.name,
      name: data.name,
      dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00.000Z`),
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      condition: data.condition,
      diagnosis: data.diagnosis,
      admittedAt: new Date(data.admittedAt),
      now: this.clock.now(),
    });
    await this.uow.withTransaction(async () => {
      await this.patients.insert(patient);
      await this.eventBus.publishAll(patient.pullEvents());
    });
    return patient.props;
  }
}

export class UpdatePatientHandler {
  constructor(
    private readonly patients: PatientRepository,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; changes: UpdatePatient }): Promise<PatientProps> {
    const patient = await this.patients.findById(input.id);
    if (!patient) throw AppError.notFound('Patient not found.');
    const { dateOfBirth, admittedAt, ...rest } = input.changes;
    const changes: PatientChanges = {
      ...rest,
      ...(dateOfBirth ? { dateOfBirth: new Date(`${dateOfBirth}T00:00:00.000Z`) } : {}),
      ...(admittedAt ? { admittedAt: new Date(admittedAt) } : {}),
    };
    const changed = patient.update(changes, this.clock.now());
    if (changed.length === 0) return patient.props;
    await this.uow.withTransaction(async () => {
      await this.patients.save(patient);
      await this.eventBus.publishAll(patient.pullEvents());
    });
    return patient.props;
  }
}

export class RemovePatientHandler {
  constructor(
    private readonly patients: PatientRepository,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: { id: string; doctorId?: string }): Promise<void> {
    const patient = await this.patients.findById(input.id);
    if (!patient || (input.doctorId && patient.props.doctorId !== input.doctorId)) {
      throw AppError.notFound('Patient not found.');
    }
    patient.remove();
    await this.uow.withTransaction(async () => {
      await this.patients.delete(input.id);
      await this.eventBus.publishAll(patient.pullEvents());
    });
  }
}
