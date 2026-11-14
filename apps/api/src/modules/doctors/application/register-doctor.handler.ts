import { v7 as uuidv7 } from 'uuid';
import type { CreateDoctor } from '@doctrack/contracts';
import type { Clock, EventBus, UnitOfWork } from '../../../shared/application/index.ts';
import { Doctor, type DoctorProps } from '../domain/index.ts';
import type { DoctorRepository } from '../domain/ports.ts';

export class RegisterDoctorHandler {
  constructor(
    private readonly doctors: DoctorRepository,
    private readonly uow: UnitOfWork,
    private readonly eventBus: EventBus,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateDoctor): Promise<DoctorProps> {
    const doctor = Doctor.register({ id: uuidv7(), ...input, now: this.clock.now() });
    await this.uow.withTransaction(async () => {
      await this.doctors.insert(doctor);
      await this.eventBus.publishAll(doctor.pullEvents());
    });
    return doctor.props;
  }
}
