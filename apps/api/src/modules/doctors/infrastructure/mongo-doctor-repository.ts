import type { DoctorListQuery } from '@doctrack/contracts';
import { MongoServerError, type Collection, type Db } from 'mongodb';
import { sessionOptions, type TransactionContext } from '../../../platform/database/index.ts';
import { AppError } from '../../../shared/errors/index.ts';
import { Page, PaginationParams } from '../../../shared/pagination/index.ts';
import { countMatching } from '../../../platform/database/index.ts';
import { searchTokens, sortKey } from '../../../shared/text/index.ts';
import type { Doctor, DoctorProps } from '../domain/doctor.ts';
import {
  DoctorRepository,
  type DayCount,
  type DoctorRow,
  type RankedDoctor,
} from '../domain/ports.ts';
import { buildDoctorFilter, doctorSort } from './doctor-queries.ts';

export const DOCTORS = 'doctors';

export interface DoctorDoc {
  _id: string;
  name: string;
  nameLower: string;
  specialization: string;
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  isActive: boolean;
  searchTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DUPLICATE_KEY = 11000;

const toProps = (doc: DoctorDoc): DoctorProps => ({
  id: doc._id,
  name: doc.name,
  specialization: doc.specialization,
  hospital: doc.hospital,
  phone: doc.phone,
  email: doc.email,
  patientCount: doc.patientCount,
  isActive: doc.isActive,
  createdAt: doc.createdAt,
});

const ROW_PROJECTION = { name: 1, specialization: 1, hospital: 1, patientCount: 1, createdAt: 1 };

export class MongoDoctorRepository extends DoctorRepository {
  private readonly doctors: Collection<DoctorDoc>;

  constructor(
    db: Db,
    private readonly context: TransactionContext,
  ) {
    super();
    this.doctors = db.collection<DoctorDoc>(DOCTORS);
  }

  async insert(doctor: Doctor): Promise<void> {
    const p = doctor.props;
    try {
      await this.doctors.insertOne(
        {
          _id: p.id,
          name: p.name,
          nameLower: sortKey(p.name),
          specialization: p.specialization,
          hospital: p.hospital,
          phone: p.phone,
          email: p.email,
          patientCount: p.patientCount,
          isActive: p.isActive,
          searchTokens: searchTokens(p.name, p.specialization, p.hospital),
          createdAt: p.createdAt,
          updatedAt: p.createdAt,
        },
        sessionOptions(this.context),
      );
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw AppError.conflict('A doctor with this email already exists.');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<DoctorProps | null> {
    const doc = await this.doctors.findOne({ _id: id }, sessionOptions(this.context));
    return doc ? toProps(doc) : null;
  }

  async list(query: DoctorListQuery): Promise<Page<DoctorRow>> {
    const params = new PaginationParams(query.page, query.limit);
    const filter = buildDoctorFilter(query);
    const [docs, total] = await Promise.all([
      this.doctors
        .find(filter, { projection: ROW_PROJECTION })
        .sort(doctorSort(query.sort))
        .skip(params.offset)
        .limit(params.limit)
        .toArray(),
      countMatching(this.doctors, filter),
    ]);
    return Page.of(
      docs.map((d) => ({
        id: d._id,
        name: d.name,
        specialization: d.specialization,
        hospital: d.hospital,
        patientCount: d.patientCount,
        createdAt: d.createdAt,
      })),
      total,
      params,
    );
  }

  async adjustPatientCount(id: string, delta: number): Promise<void> {
    await this.doctors.updateOne(
      { _id: id },
      { $inc: { patientCount: delta } },
      sessionOptions(this.context),
    );
  }

  countAll(): Promise<number> {
    return this.doctors.countDocuments({}, sessionOptions(this.context));
  }

  async registrationsByDay(): Promise<DayCount[]> {
    const rows = await this.doctors
      .aggregate<{ _id: string; count: number }>(
        [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        sessionOptions(this.context),
      )
      .toArray();
    return rows.map((r) => ({ date: r._id, count: r.count }));
  }

  async topByPatientCount(limit: number): Promise<RankedDoctor[]> {
    const docs = await this.doctors
      .find({}, { projection: { name: 1, patientCount: 1 }, ...sessionOptions(this.context) })
      .sort({ patientCount: -1, _id: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({ id: d._id, name: d.name, patientCount: d.patientCount }));
  }
}
