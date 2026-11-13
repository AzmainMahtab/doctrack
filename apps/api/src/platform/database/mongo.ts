import { MongoClient, type Db } from 'mongodb';
import type { AppConfig } from '../config/index.ts';
import type { Probe } from '../health/index.ts';

export interface MongoHandle {
  client: MongoClient;
  db: Db;
  probe: Probe;
  close(): Promise<void>;
}

export async function connectMongo(config: AppConfig): Promise<MongoHandle> {
  const client = new MongoClient(config.mongoUri, {
    retryWrites: true,
    writeConcern: { w: 'majority' },
    readConcernLevel: 'majority',
    serverSelectionTimeoutMS: 5000,
    appName: 'doctrack',
  });
  await client.connect();
  const db = client.db(config.mongoDb);
  return {
    client,
    db,
    probe: {
      name: 'mongo',
      check: async () => {
        const hello = await db.admin().command({ hello: 1 });
        if (!hello.isWritablePrimary) throw new Error('no writable primary');
      },
    },
    close: () => client.close(),
  };
}
