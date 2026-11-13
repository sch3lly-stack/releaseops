import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildApp, type BuildAppOptions } from "../src/app.js";
import { AppError } from "../src/plugins/errors.js";

async function buildTestApp(overrides: Partial<BuildAppOptions> = {}): Promise<FastifyInstance> {
  const app = await buildApp({
    webOrigin: "http://localhost:5173",
    service: "releaseops-api",
    version: "0.1.0",
    logLevel: "silent",
    ...overrides,
  });

  app.get("/__test/conflict", async () => {
    throw new AppError(409, "CONFLICT", "Already exists", { field: "slug" });
  });
  app.get("/__test/invalid", async () => {
    z.object({ name: z.string() }).parse({});
  });
  app.get("/__test/crash", async () => {
    throw new Error("database password is hunter2");
  });

  return app;
}

describe("http skeleton", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("reports liveness", async () => {
    app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "releaseops-api",
      version: "0.1.0",
    });
  });

  it("allows the configured web origin", async () => {
    app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
      headers: { origin: "http://localhost:5173" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("reports ready when the check passes", async () => {
    app = await buildTestApp({ checkReady: async () => undefined });
    const response = await app.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("reports not ready without leaking the underlying error", async () => {
    app = await buildTestApp({
      checkReady: async () => {
        throw new Error("password=super-secret at postgres:5432");
      },
    });
    const response = await app.inject({ method: "GET", url: "/readyz" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "not_ready",
      service: "releaseops-api",
    });
    expect(response.body).not.toContain("super-secret");
  });

  it("returns the error envelope for unknown routes", async () => {
    app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route GET /missing not found" },
    });
  });

  it("returns application errors with details", async () => {
    app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/__test/conflict" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: "CONFLICT", message: "Already exists", details: { field: "slug" } },
    });
  });

  it("returns validation errors from Zod", async () => {
    app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/__test/invalid" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("hides unexpected error messages from the client", async () => {
    app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/__test/crash" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
    expect(response.body).not.toContain("hunter2");
  });
});
