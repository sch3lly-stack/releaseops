import { describe, expect, it } from "vitest";
import { createPasswordHasher } from "../src/auth/passwords.js";

describe("password hasher", () => {
  it("stores an argon2id hash that verifies only the original password", async () => {
    const hasher = createPasswordHasher("fast");
    const encoded = await hasher.hash("correct horse battery");
    expect(encoded.startsWith("$argon2id$")).toBe(true);
    await expect(hasher.verify(encoded, "correct horse battery")).resolves.toBe(true);
    await expect(hasher.verify(encoded, "wrong horse battery")).resolves.toBe(false);
    await expect(hasher.verify("not-a-hash", "correct horse battery")).resolves.toBe(false);
  });
});
