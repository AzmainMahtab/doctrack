import type { Db, IndexDescription } from 'mongodb';

export interface CollectionIndexes {
  collection: string;
  indexes: IndexDescription[];
}

const registry: CollectionIndexes[] = [];

export const registerIndexes = (definition: CollectionIndexes): void => {
  registry.push(definition);
};

export const registeredIndexes = (): readonly CollectionIndexes[] => registry;

export async function ensureIndexes(db: Db): Promise<number> {
  let created = 0;
  for (const { collection, indexes } of registry) {
    if (indexes.length === 0) continue;
    await db.collection(collection).createIndexes(indexes);
    created += indexes.length;
  }
  return created;
}
