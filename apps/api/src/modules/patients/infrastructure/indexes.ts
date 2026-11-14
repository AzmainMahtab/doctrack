import { registerIndexes } from '../../../platform/database/index.ts';
import { PATIENTS } from './mongo-patient-repository.ts';

registerIndexes({
  collection: PATIENTS,
  indexes: [
    { key: { doctorId: 1, createdAt: -1, _id: -1 }, name: 'doctor_created' },
    {
      key: { doctorId: 1, condition: 1, createdAt: -1, _id: -1 },
      name: 'doctor_condition_created',
    },
    { key: { condition: 1, createdAt: -1, _id: -1 }, name: 'condition_created' },
    { key: { createdAt: -1, _id: -1 }, name: 'created' },
    { key: { admittedAt: -1, _id: -1 }, name: 'admitted' },
    { key: { nameLower: 1, _id: 1 }, name: 'name' },
    { key: { searchTokens: 1 }, name: 'search_tokens' },
  ],
});
