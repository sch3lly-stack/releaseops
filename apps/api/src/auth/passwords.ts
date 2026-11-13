import { randomBytes } from "node:crypto";
import { argon2Verify, argon2id } from "hash-wasm";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  dummyHash(): Promise<string>;
}

interface Argon2Params {
  iterations: number;
  parallelism: number;
  memorySize: number;
  hashLength: number;
}

// OWASP's argon2id recommendation: 19 MiB, 2 iterations, parallelism 1.
const STANDARD: Argon2Params = {
  iterations: 2,
  parallelism: 1,
  memorySize: 19_456,
  hashLength: 32,
};

// Tests only. The encoded hash stores these parameters, so verify still matches.
const FAST: Argon2Params = {
  iterations: 1,
  parallelism: 1,
  memorySize: 8,
  hashLength: 32,
};

const DUMMY_PASSWORD = "releaseops-dummy-password";

export function createPasswordHasher(strength: "fast" | "standard"): PasswordHasher {
  const params = strength === "fast" ? FAST : STANDARD;
  let dummy: Promise<string> | undefined;

  const hash = (password: string) =>
    argon2id({
      password,
      salt: randomBytes(16),
      iterations: params.iterations,
      parallelism: params.parallelism,
      memorySize: params.memorySize,
      hashLength: params.hashLength,
      outputType: "encoded",
    });

  return {
    hash,
    async verify(encoded, password) {
      try {
        return await argon2Verify({ password, hash: encoded });
      } catch {
        return false;
      }
    },
    dummyHash: () => (dummy ??= hash(DUMMY_PASSWORD)),
  };
}
