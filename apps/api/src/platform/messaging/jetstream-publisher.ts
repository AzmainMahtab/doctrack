import { jetstream, type JetStreamClient } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import { MessagePublisher } from '../../shared/application/index.ts';

export class JetStreamPublisher extends MessagePublisher {
  private readonly js: JetStreamClient;

  constructor(connection: NatsConnection) {
    super();
    this.js = jetstream(connection);
  }

  async publish(subject: string, payload: Uint8Array, messageId: string): Promise<void> {
    await this.js.publish(subject, payload, { msgID: messageId });
  }
}
