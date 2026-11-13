import { connect, type NatsConnection } from '@nats-io/transport-node';
import { jetstreamManager, type JetStreamManager } from '@nats-io/jetstream';
import type { AppConfig } from '../config/index.ts';
import type { Probe } from '../health/index.ts';

export interface NatsHandle {
  connection: NatsConnection;
  jsm: JetStreamManager;
  probe: Probe;
  close(): Promise<void>;
}

export async function connectNats(config: AppConfig, name: string): Promise<NatsHandle> {
  const connection = await connect({
    servers: config.natsUrl,
    name,
    maxReconnectAttempts: -1,
    ...(config.natsUser && config.natsPassword
      ? { user: config.natsUser, pass: config.natsPassword }
      : {}),
  });
  const jsm = await jetstreamManager(connection);
  return {
    connection,
    jsm,
    probe: {
      name: 'nats',
      check: async () => {
        if (connection.isClosed()) throw new Error('connection closed');
        await jsm.getAccountInfo();
      },
    },
    close: async () => {
      await connection.drain().catch(() => undefined);
    },
  };
}
