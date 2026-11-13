import { describe, expect, it } from "vitest";
import { createLoginRateLimiter } from "../src/auth/rate-limit.js";

describe("login rate limiter", () => {
  it("allows five attempts per minute and then the next one", () => {
    let time = 1_000;
    const limiter = createLoginRateLimiter({ now: () => time });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.allow("127.0.0.1:a@b.com")).toBe(true);
    }
    expect(limiter.allow("127.0.0.1:a@b.com")).toBe(false);
    expect(limiter.allow("127.0.0.1:other@b.com")).toBe(true);

    time += 60_000;
    expect(limiter.allow("127.0.0.1:a@b.com")).toBe(true);
  });
});
