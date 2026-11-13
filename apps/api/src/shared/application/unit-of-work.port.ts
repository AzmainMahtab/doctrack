export abstract class UnitOfWork {
  abstract withTransaction<T>(work: () => Promise<T>): Promise<T>;
}
