/**
 * Shared argon2 settings + hash wrapper.
 *
 * We pin parameters explicitly so a future argon2 library update can't
 * silently weaken our hashes by changing defaults. argon2id is the
 * hybrid variant recommended for password hashing — it resists both
 * GPU attacks (memory-hard) and side-channel attacks (data-independent
 * first pass). 64 MiB memory + 3 iterations + 4-way parallelism is the
 * OWASP 2024 baseline tuned for a 4-core VPS.
 *
 * Every place in the codebase that hashes a password goes through
 * `hashPassword()` so any future bump only has to touch one file.
 */
import * as argon2 from 'argon2';

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}
