export abstract class MessagePublisher {
  abstract publish(subject: string, payload: Uint8Array, messageId: string): Promise<void>;
}
