import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHealth } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchHealth", () => {
  it("parses a healthy response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", service: "releaseops-api", version: "0.1.0" }),
      }),
    );

    await expect(fetchHealth("http://localhost:3001")).resolves.toMatchObject({
      status: "ok",
      service: "releaseops-api",
    });
  });

  it("throws when the API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    await expect(fetchHealth("http://api.test")).rejects.toThrow(/503/);
  });

  it("throws when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

    await expect(fetchHealth("http://api.test")).rejects.toThrow(
      /unreachable at http:\/\/api\.test/,
    );
  });
});
