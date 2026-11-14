import type { Db } from 'mongodb';
import type { TransactionContext } from '../../platform/database/index.ts';
import type { Clock, EventBus, UnitOfWork } from '../../shared/application/index.ts';
import {
  ApplyPatientCountChange,
  DoctorsPublicApi,
  GetDoctorQuery,
  ListDoctorsQuery,
  RegisterDoctorHandler,
} from './application/index.ts';
import { MongoDoctorRepository } from './infrastructure/mongo-doctor-repository.ts';
import { PatientCountConsumer } from './infrastructure/patient-count.consumer.ts';
import { doctorRoutes } from './presentation/doctor.routes.ts';

export interface DoctorsDeps {
  db: Db;
  transactions: TransactionContext;
  uow: UnitOfWork;
  eventBus: EventBus;
  clock: Clock;
}

export function createDoctorsModule(deps: DoctorsDeps) {
  const repository = new MongoDoctorRepository(deps.db, deps.transactions);
  return {
    routes: doctorRoutes({
      register: new RegisterDoctorHandler(repository, deps.uow, deps.eventBus, deps.clock),
      listDoctors: new ListDoctorsQuery(repository),
      getDoctor: new GetDoctorQuery(repository),
    }),
    consumers: [new PatientCountConsumer(new ApplyPatientCountChange(repository))],
    api: new DoctorsPublicApi(repository),
  };
}

export type DoctorsModule = ReturnType<typeof createDoctorsModule>;
