import { hash, verify } from '@node-rs/argon2';
import { PasswordHasher } from '../domain/ports.ts';

const ARGON2ID = 2;

export class Argon2Hasher extends PasswordHasher {
  hash(plaintext: string): Promise<string> {
    return hash(plaintext, { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async verify(passwordHash: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plaintext);
    } catch {
      return false;
    }
  }
}
