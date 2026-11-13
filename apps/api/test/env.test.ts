import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

const valid = {
  DATABASE_URL: "postgresql://releaseops:releaseops@localhost:5432/releaseops",
  REDIS_URL: "redis://localhost:6379",
};

describe("loadEnv", () => {
  it("applies local defaults", () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3001);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.WEB_ORIGIN).toBe("http://localhost:5173");
    expect(env.APP_VERSION).toBe("0.1.0");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("rejects a missing database url", () => {
    expect(() => loadEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-numeric port", () => {
    expect(() => loadEnv({ ...valid, PORT: "nope" })).toThrow(/PORT/);
  });
});
