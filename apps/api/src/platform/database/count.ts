import type { Collection, Document, Filter } from 'mongodb';

export function countMatching<T extends Document>(
  collection: Collection<T>,
  filter: Document,
): Promise<number> {
  if (Object.keys(filter).length === 0) return collection.estimatedDocumentCount();
  return collection.countDocuments(filter as Filter<T>);
}
