import { registerIndexes } from '../../../platform/database/index.ts';
import { DOCTORS } from './mongo-doctor-repository.ts';

registerIndexes({
  collection: DOCTORS,
  indexes: [
    { key: { email: 1 }, name: 'email_unique', unique: true },
    { key: { createdAt: -1, _id: -1 }, name: 'created' },
    { key: { specialization: 1, createdAt: -1, _id: -1 }, name: 'specialization_created' },
    { key: { hospital: 1, createdAt: -1, _id: -1 }, name: 'hospital_created' },
    { key: { patientCount: -1, _id: -1 }, name: 'patient_count' },
    { key: { nameLower: 1, _id: 1 }, name: 'name' },
    { key: { searchTokens: 1 }, name: 'search_tokens' },
  ],
});
