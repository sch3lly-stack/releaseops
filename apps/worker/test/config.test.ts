import { describe, expect, it } from "vitest";
import { loadWorkerConfig } from "../src/config.js";

describe("loadWorkerConfig", () => {
  it("defaults the log level", () => {
    const config = loadWorkerConfig({ REDIS_URL: "redis://localhost:6379" });
    expect(config).toEqual({ redisUrl: "redis://localhost:6379", logLevel: "info" });
  });

  it("requires a redis url", () => {
    expect(() => loadWorkerConfig({})).toThrow(/REDIS_URL/);
  });

  it("rejects an unknown log level", () => {
    expect(() =>
      loadWorkerConfig({ REDIS_URL: "redis://localhost:6379", LOG_LEVEL: "loud" }),
    ).toThrow(/LOG_LEVEL/);
  });
});
