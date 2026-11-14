import type { DoctorPatientListQuery, PatientListQuery } from '@doctrack/contracts';
import type { Collection, Db } from 'mongodb';
import { sessionOptions, type TransactionContext } from '../../../platform/database/index.ts';
import { Page, PaginationParams } from '../../../shared/pagination/index.ts';
import { countMatching } from '../../../platform/database/index.ts';
import { searchTokens, sortKey } from '../../../shared/text/index.ts';
import { Patient, type PatientProps } from '../domain/patient.ts';
import { PatientRepository, type PatientRow } from '../domain/ports.ts';
import { buildPatientFilter, patientSort, type PatientFilterInput } from './patient-queries.ts';

export const PATIENTS = 'patients';

export interface PatientDoc extends Omit<PatientProps, 'id'> {
  _id: string;
  nameLower: string;
  searchTokens: string[];
}

const ROW_PROJECTION = { name: 1, condition: 1, doctorId: 1, doctorName: 1, admittedAt: 1 };

const toDoc = (p: PatientProps): PatientDoc => {
  const { id, ...rest } = p;
  return {
    ...rest,
    _id: id,
    nameLower: sortKey(p.name),
    searchTokens: searchTokens(p.name, p.diagnosis),
  };
};

const toProps = (doc: PatientDoc): PatientProps => ({
  id: doc._id,
  doctorId: doc.doctorId,
  doctorName: doc.doctorName,
  name: doc.name,
  dateOfBirth: doc.dateOfBirth,
  gender: doc.gender,
  phone: doc.phone,
  email: doc.email,
  condition: doc.condition,
  diagnosis: doc.diagnosis,
  admittedAt: doc.admittedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export class MongoPatientRepository extends PatientRepository {
  private readonly patients: Collection<PatientDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.patients = db.collection<PatientDoc>(PATIENTS);
  }

  async insert(patient: Patient): Promise<void> {
    await this.patients.insertOne(toDoc(patient.props), sessionOptions(this.context));
  }

  async save(patient: Patient): Promise<void> {
    const { _id, ...rest } = toDoc(patient.props);
    await this.patients.replaceOne({ _id }, rest, sessionOptions(this.context));
  }

  async delete(id: string): Promise<void> {
    await this.patients.deleteOne({ _id: id }, sessionOptions(this.context));
  }

  async findById(id: string): Promise<Patient | null> {
    const doc = await this.patients.findOne({ _id: id }, sessionOptions(this.context));
    return doc ? new Patient(toProps(doc)) : null;
  }

  list(query: PatientListQuery): Promise<Page<PatientRow>> {
    return this.page(buildPatientFilter(query), query);
  }

  listForDoctor(doctorId: string, query: DoctorPatientListQuery): Promise<Page<PatientRow>> {
    const input: PatientFilterInput = { ...query, doctorId };
    return this.page(buildPatientFilter(input), query);
  }

  private async page(
    filter: ReturnType<typeof buildPatientFilter>,
    query: { page: number; limit: number; sort: PatientListQuery['sort'] },
  ): Promise<Page<PatientRow>> {
    const params = new PaginationParams(query.page, query.limit);
    const [docs, total] = await Promise.all([
      this.patients
        .find(filter, { projection: ROW_PROJECTION })
        .sort(patientSort(query.sort))
        .skip(params.offset)
        .limit(params.limit)
        .toArray(),
      countMatching(this.patients, filter),
    ]);
    return Page.of(
      docs.map((d) => ({
        id: d._id,
        name: d.name,
        condition: d.condition,
        doctorId: d.doctorId,
        doctorName: d.doctorName,
        admittedAt: d.admittedAt,
      })),
      total,
      params,
    );
  }
}
