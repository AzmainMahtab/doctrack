import type { Db } from 'mongodb';
import type { TransactionContext } from '../../platform/database/index.ts';
import type { Clock, EventBus, UnitOfWork } from '../../shared/application/index.ts';
import type { DoctorsModule } from '../doctors/index.ts';
import {
  AdmitPatientHandler,
  GetPatientQuery,
  ListDoctorPatientsQuery,
  ListPatientsQuery,
  RemovePatientHandler,
  UpdatePatientHandler,
} from './application/index.ts';
import { DoctorDirectoryAdapter } from './infrastructure/doctor-directory.adapter.ts';
import { MongoPatientRepository } from './infrastructure/mongo-patient-repository.ts';
import { patientRoutes } from './presentation/patient.routes.ts';

export interface PatientsDeps {
  db: Db;
  transactions: TransactionContext;
  uow: UnitOfWork;
  eventBus: EventBus;
  clock: Clock;
  doctors: DoctorsModule['api'];
}

export function createPatientsModule(deps: PatientsDeps) {
  const repository = new MongoPatientRepository(deps.db, deps.transactions);
  const directory = new DoctorDirectoryAdapter(deps.doctors);
  return {
    routes: patientRoutes({
      admit: new AdmitPatientHandler(repository, directory, deps.uow, deps.eventBus, deps.clock),
      update: new UpdatePatientHandler(repository, deps.uow, deps.eventBus, deps.clock),
      remove: new RemovePatientHandler(repository, deps.uow, deps.eventBus),
      listPatients: new ListPatientsQuery(repository),
      listDoctorPatients: new ListDoctorPatientsQuery(repository, directory),
      getPatient: new GetPatientQuery(repository),
    }),
  };
}

export type PatientsModule = ReturnType<typeof createPatientsModule>;
