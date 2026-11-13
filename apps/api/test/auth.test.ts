import { actions, can, type PublicUser, type UserRole } from "@releaseops/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { SESSION_COOKIE } from "../src/auth/cookies.js";
import { createLoginRateLimiter } from "../src/auth/rate-limit.js";
import { buildApp } from "../src/app.js";
import { requirePermission } from "../src/plugins/permissions.js";
import { createMemoryAuthRepository, type MemoryAuthRepository } from "./memory-repository.js";

const PASSWORD = "correct horse battery";
const DAY_MS = 24 * 60 * 60 * 1000;

interface Harness {
  app: FastifyInstance;
  repo: MemoryAuthRepository;
  time: { value: number };
}

interface Account {
  user: PublicUser;
  cookie: string;
}

function setCookieHeader(response: LightMyRequestResponse): string {
  const raw = response.headers["set-cookie"];
  if (Array.isArray(raw)) return raw.join("\n");
  return typeof raw === "string" ? raw : "";
}

function sessionCookie(response: LightMyRequestResponse): string {
  const pair = setCookieHeader(response)
    .split(/[;\n]/)
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!pair) throw new Error(`missing session cookie in ${setCookieHeader(response)}`);
  return pair;
}

async function createHarness(options?: { secureCookies?: boolean }): Promise<Harness> {
  const repo = createMemoryAuthRepository();
  const time = { value: Date.parse("2026-06-01T00:00:00.000Z") };
  const app = await buildApp({
    webOrigin: "http://localhost:5173",
    service: "releaseops-api",
    version: "0.1.0",
    logLevel: "silent",
    auth: {
      repository: repo,
      hashing: "fast",
      now: () => new Date(time.value),
      rateLimit: createLoginRateLimiter({ now: () => time.value }),
      secureCookies: options?.secureCookies ?? false,
    },
  });

  app.get("/__test/can", async (request, reply) => {
    const query = z
      .object({
        action: z.enum(actions),
        requestedBy: z.string().optional(),
        actorId: z.string().optional(),
      })
      .parse(request.query);
    const resource = {
      ...(query.requestedBy ? { requestedById: query.requestedBy } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    await requirePermission(query.action, () => resource)(request, reply);
    return { ok: true };
  });

  return { app, repo, time };
}

async function register(
  app: FastifyInstance,
  input: { email: string; name: string; inviteToken?: string },
  headers?: Record<string, string>,
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers,
    payload: { password: PASSWORD, ...input },
  });
}

async function login(app: FastifyInstance, email: string, password = PASSWORD) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
}

async function invite(app: FastifyInstance, cookie: string, email: string, role: UserRole) {
  return app.inject({
    method: "POST",
    url: "/api/v1/users/invites",
    headers: { cookie },
    payload: { email, role },
  });
}

function account(response: LightMyRequestResponse): Account {
  return { user: response.json().user as PublicUser, cookie: sessionCookie(response) };
}

async function seed(app: FastifyInstance) {
  const admin = account(await register(app, { email: "ada@example.com", name: "Ada" }));
  const developerInvite = await invite(app, admin.cookie, "dee@example.com", "developer");
  const developer = account(
    await register(app, {
      email: "dee@example.com",
      name: "Dee",
      inviteToken: developerInvite.json().token as string,
    }),
  );
  const approverInvite = await invite(app, admin.cookie, "owen@example.com", "approver");
  const approver = account(
    await register(app, {
      email: "owen@example.com",
      name: "Owen",
      inviteToken: approverInvite.json().token as string,
    }),
  );
  return { admin, developer, approver };
}

describe("auth http", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    await harness.app.close();
  });

  it("keeps liveness public", async () => {
    const response = await harness.app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(200);
  });

  it("bootstraps the first user as admin and then requires an invite", async () => {
    const { app, repo } = harness;
    const setup = await app.inject({ method: "GET", url: "/api/v1/auth/setup" });
    expect(setup.json()).toEqual({ needsInvite: false });

    const created = await register(
      app,
      { email: " Ada@Example.com ", name: " Ada " },
      { "user-agent": "ReleaseOpsTest" },
    );
    expect(created.statusCode).toBe(201);
    const admin = account(created);
    expect(admin.user).toMatchObject({ email: "ada@example.com", name: "Ada", role: "admin" });
    expect(created.body).not.toContain(PASSWORD);
    expect(created.body).not.toContain("passwordHash");
    expect(setCookieHeader(created).toLowerCase()).toContain("httponly");
    expect(setCookieHeader(created).toLowerCase()).toContain("samesite=lax");
    expect(setCookieHeader(created)).toContain("Max-Age=604800");
    expect(setCookieHeader(created).toLowerCase()).not.toContain("secure");
    expect(repo.audits[0]).toMatchObject({
      action: "auth.register",
      userAgent: "ReleaseOpsTest",
      after: { email: "ada@example.com", role: "admin" },
    });
    expect(JSON.stringify(repo.audits)).not.toContain(PASSWORD);
    expect(repo.lockCalls).toBeGreaterThan(0);

    const closed = await app.inject({ method: "GET", url: "/api/v1/auth/setup" });
    expect(closed.json()).toEqual({ needsInvite: true });
    const rejected = await register(app, { email: "other@example.com", name: "Other" });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json().error.code).toBe("REGISTRATION_CLOSED");

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: admin.cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.id).toBe(admin.user.id);
    expect(me.headers["set-cookie"]).toBeUndefined();

    const missing = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(missing.statusCode).toBe(401);
    const junk = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: `${SESSION_COOKIE}=not-a-uuid` },
    });
    expect(junk.statusCode).toBe(401);
  });

  it("marks the session cookie Secure in production", async () => {
    const secure = await createHarness({ secureCookies: true });
    try {
      const created = await register(secure.app, { email: "ada@example.com", name: "Ada" });
      expect(setCookieHeader(created).toLowerCase()).toContain("secure");
    } finally {
      await secure.app.close();
    }
  });

  it("accepts an invite once and rejects a bad, mismatched, or expired token", async () => {
    const { app, repo, time } = harness;
    const admin = account(await register(app, { email: "ada@example.com", name: "Ada" }));
    const created = await invite(app, admin.cookie, "Dee@Example.com", "developer");
    expect(created.statusCode).toBe(201);
    const token = created.json().token as string;
    expect(token.length).toBeGreaterThan(20);
    expect(JSON.stringify(repo.audits)).not.toContain(token);

    const mismatch = await register(app, {
      email: "other@example.com",
      name: "Other",
      inviteToken: token,
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json().error.code).toBe("INVITE_INVALID");

    const joined = await register(app, {
      email: "dee@example.com",
      name: "Dee",
      inviteToken: token,
    });
    expect(joined.statusCode).toBe(201);
    expect(joined.json().user.role).toBe("developer");

    const reused = await register(app, {
      email: "dee@example.com",
      name: "Dee Again",
      inviteToken: token,
    });
    expect(reused.statusCode).toBe(400);

    const duplicate = await invite(app, admin.cookie, "ada@example.com", "developer");
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("EMAIL_IN_USE");

    const pending = await invite(app, admin.cookie, "new@example.com", "approver");
    const again = await invite(app, admin.cookie, "new@example.com", "approver");
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe("INVITE_PENDING");

    time.value += 8 * DAY_MS;
    const expired = await register(app, {
      email: "new@example.com",
      name: "New",
      inviteToken: pending.json().token as string,
    });
    expect(expired.statusCode).toBe(400);
    expect(expired.json().error.code).toBe("INVITE_INVALID");
  });

  it("logs in, logs out, and uses the same error for unknown and wrong passwords", async () => {
    const { app, repo } = harness;
    await register(app, { email: "ada@example.com", name: "Ada" });
    const locksBeforeLogin = repo.lockCalls;
    const signedIn = await login(app, "ADA@example.com");
    expect(signedIn.statusCode).toBe(200);
    expect(repo.lockCalls).toBe(locksBeforeLogin);
    expect(repo.audits.at(-1)?.action).toBe("auth.login");

    const unknown = await login(app, "missing@example.com");
    const wrong = await login(app, "ada@example.com", "definitely wrong");
    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
    expect(unknown.body).not.toContain("definitely wrong");
    expect(repo.audits.at(-1)).toMatchObject({
      action: "auth.login_failed",
      after: { reason: "password" },
    });

    const loggedOut = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: sessionCookie(signedIn) },
    });
    expect(loggedOut.statusCode).toBe(204);
    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: sessionCookie(signedIn) },
    });
    expect(afterLogout.statusCode).toBe(401);
    expect(repo.audits.some((event) => event.action === "auth.logout")).toBe(true);
  });

  it("rate limits login attempts without recording the password", async () => {
    const { app, repo, time } = harness;
    await register(app, { email: "ada@example.com", name: "Ada" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await login(app, "ada@example.com", "wrong password");
      expect(failed.statusCode).toBe(401);
    }
    const blocked = await login(app, "ada@example.com", PASSWORD);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe("RATE_LIMITED");
    expect(JSON.stringify(repo.audits)).not.toContain(PASSWORD);
    expect(JSON.stringify(repo.audits)).not.toContain("wrong password");
    expect(repo.audits.at(-1)?.action).toBe("auth.rate_limited");

    time.value += 60_000;
    const allowed = await login(app, "ada@example.com", PASSWORD);
    expect(allowed.statusCode).toBe(200);
  });

  it("slides the session and then expires it", async () => {
    const { app, time } = harness;
    const admin = account(await register(app, { email: "ada@example.com", name: "Ada" }));
    time.value += 2 * DAY_MS;
    const refreshed = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: admin.cookie },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(sessionCookie(refreshed)).toBe(admin.cookie);

    time.value += 7 * DAY_MS;
    const expired = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: admin.cookie },
    });
    expect(expired.statusCode).toBe(401);
  });

  it("rolls back registration when the audit write fails", async () => {
    const { app, repo } = harness;
    repo.failNextAudit("auth.register");
    const response = await register(app, { email: "ada@example.com", name: "Ada" });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("audit write failed");
    expect(await repo.countUsers()).toBe(0);
    expect(repo.audits).toHaveLength(0);
  });

  it("changes roles, deactivates users, and drops their sessions", async () => {
    const { app, repo } = harness;
    const { admin, developer } = await seed(app);
    const self = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${admin.user.id}`,
      headers: { cookie: admin.cookie },
      payload: { role: "developer" },
    });
    expect(self.statusCode).toBe(403);
    expect(self.json().error.code).toBe("CANNOT_EDIT_SELF");

    const demoted = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${developer.user.id}`,
      headers: { cookie: admin.cookie },
      payload: { role: "approver" },
    });
    expect(demoted.statusCode).toBe(200);
    expect(demoted.json().user.role).toBe("approver");
    const stale = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: developer.cookie },
    });
    expect(stale.statusCode).toBe(401);
    expect(repo.audits.some((event) => event.action === "user.role_changed")).toBe(true);

    const signedIn = account(await login(app, "dee@example.com"));
    const deactivated = await app.inject({
      method: "PATCH",
      url: `/api/v1/users/${developer.user.id}`,
      headers: { cookie: admin.cookie },
      payload: { isActive: false },
    });
    expect(deactivated.statusCode).toBe(200);
    const gone = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: signedIn.cookie },
    });
    expect(gone.statusCode).toBe(401);
    const inactiveLogin = await login(app, "dee@example.com");
    const unknown = await login(app, "nobody@example.com", "wrong password");
    expect(inactiveLogin.statusCode).toBe(401);
    expect(inactiveLogin.json()).toEqual(unknown.json());
    expect(repo.audits.some((event) => event.action === "user.deactivated")).toBe(true);
  });

  it("refuses to remove the last active administrator", async () => {
    const { app, repo } = harness;
    const admin = account(await register(app, { email: "ada@example.com", name: "Ada" }));
    const secondInvite = await invite(app, admin.cookie, "bea@example.com", "admin");
    const second = account(
      await register(app, {
        email: "bea@example.com",
        name: "Bea",
        inviteToken: secondInvite.json().token as string,
      }),
    );

    const [first, other] = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/api/v1/users/${second.user.id}`,
        headers: { cookie: admin.cookie },
        payload: { role: "developer" },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/v1/users/${admin.user.id}`,
        headers: { cookie: second.cookie },
        payload: { role: "developer" },
      }),
    ]);
    expect([first.statusCode, other.statusCode].sort()).toEqual([200, 409]);
    const denied = [first, other].find((response) => response.statusCode === 409);
    expect(denied?.json().error.code).toBe("LAST_ADMIN");
    const admins = (await repo.listUsers()).filter(
      (user) => user.role === "admin" && user.isActive,
    );
    expect(admins).toHaveLength(1);
  });

  it("proves each permission denial and records it", async () => {
    const { app, repo } = harness;
    const people = await seed(app);
    const anonymous = await app.inject({ method: "GET", url: "/__test/can?action=read" });
    expect(anonymous.statusCode).toBe(401);
    const auditsBefore = repo.audits.length;

    for (const role of ["admin", "developer", "approver"] as const) {
      const person = people[role];
      for (const action of actions) {
        const response = await app.inject({
          method: "GET",
          url: `/__test/can?action=${encodeURIComponent(action)}`,
          headers: { cookie: person.cookie },
        });
        const allowed = can({ id: person.user.id, role: person.user.role, isActive: true }, action);
        expect(response.statusCode, `${role} ${action}`).toBe(allowed ? 200 : 403);
        if (!allowed) {
          expect(repo.audits.at(-1)).toMatchObject({
            action: "auth.denied",
            actorId: person.user.id,
            after: { action },
          });
        }
      }
    }

    const own = await app.inject({
      method: "GET",
      url: `/__test/can?action=deployment:approve&requestedBy=${people.approver.user.id}`,
      headers: { cookie: people.approver.cookie },
    });
    expect(own.statusCode).toBe(403);
    const other = await app.inject({
      method: "GET",
      url: `/__test/can?action=deployment:approve&requestedBy=${people.developer.user.id}`,
      headers: { cookie: people.approver.cookie },
    });
    expect(other.statusCode).toBe(200);

    const ownAudit = await app.inject({
      method: "GET",
      url: `/__test/can?action=audit:read&actorId=${people.developer.user.id}`,
      headers: { cookie: people.developer.cookie },
    });
    expect(ownAudit.statusCode).toBe(200);
    const otherAudit = await app.inject({
      method: "GET",
      url: `/__test/can?action=audit:read&actorId=${people.admin.user.id}`,
      headers: { cookie: people.developer.cookie },
    });
    expect(otherAudit.statusCode).toBe(403);

    const users = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie: people.developer.cookie },
    });
    expect(users.statusCode).toBe(403);
    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie: people.admin.cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toHaveLength(3);
    expect(repo.audits.length).toBeGreaterThan(auditsBefore);
    expect(JSON.stringify(repo.audits)).not.toContain(PASSWORD);
  });
});
