import { describe, expect, it } from "vitest";
import { loginBodySchema, registerBodySchema, updateUserBodySchema } from "../src/auth.js";

describe("auth schemas", () => {
  it("normalizes email addresses", () => {
    expect(
      registerBodySchema.parse({ email: " A@B.com ", name: "Ada", password: "correct horse" }),
    ).toMatchObject({ email: "a@b.com", name: "Ada" });
  });

  it("rejects short passwords and empty names", () => {
    expect(() =>
      registerBodySchema.parse({ email: "a@b.com", name: "  ", password: "short" }),
    ).toThrow();
  });

  it("accepts a short login password so the check stays an auth failure", () => {
    expect(loginBodySchema.parse({ email: "a@b.com", password: "nope" }).password).toBe("nope");
  });

  it("requires a role or an active flag when updating a user", () => {
    expect(() => updateUserBodySchema.parse({})).toThrow();
    expect(updateUserBodySchema.parse({ role: "approver" }).role).toBe("approver");
  });
});
