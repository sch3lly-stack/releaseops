import { describe, expect, it } from "vitest";
import { errorBodySchema } from "../src/errors.js";
import { healthResponseSchema } from "../src/health.js";

describe("healthResponseSchema", () => {
  it("accepts a healthy payload", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        service: "releaseops-api",
        version: "0.1.0",
      }),
    ).toMatchObject({ status: "ok", version: "0.1.0" });
  });

  it("accepts a not-ready payload without a version", () => {
    expect(
      healthResponseSchema.parse({ status: "not_ready", service: "releaseops-api" }),
    ).toMatchObject({ status: "not_ready" });
  });

  it("rejects an unknown status", () => {
    expect(() =>
      healthResponseSchema.parse({ status: "maybe", service: "releaseops-api" }),
    ).toThrow();
  });
});

describe("errorBodySchema", () => {
  it("accepts the API error envelope", () => {
    expect(
      errorBodySchema.parse({
        error: { code: "NOT_FOUND", message: "Missing", details: { id: "1" } },
      }).error.code,
    ).toBe("NOT_FOUND");
  });
});
