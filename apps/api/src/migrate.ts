import { loadConfig } from './platform/config/index.ts';
import { connectMongo, ensureIndexes } from './platform/database/index.ts';

async function main(): Promise<void> {
  const mongo = await connectMongo(loadConfig());
  try {
    const created = await ensureIndexes(mongo.db);
    console.log(`indexes ensured: ${created}`);
  } finally {
    await mongo.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
