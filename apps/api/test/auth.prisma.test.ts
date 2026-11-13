import { PrismaPg } from "@prisma/adapter-pg";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaAuthRepository } from "../src/auth/prisma-repository.js";
import { buildApp } from "../src/app.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://releaseops:releaseops@localhost:5432/releaseops";
const password = "correct horse battery";

async function connect(): Promise<{ prisma: PrismaClient; pool: Pool } | null> {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1500, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { prisma, pool };
  } catch {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
    return null;
  }
}

describe("auth against postgres", () => {
  let prisma: PrismaClient | null = null;
  let pool: Pool | null = null;
  let app: FastifyInstance | null = null;
  const marker = `phase1-${Date.now()}@example.com`;
  const adminEmail = `admin-${marker}`;
  const developerEmail = `dev-${marker}`;

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await prisma.$executeRaw`DELETE FROM "audit_logs" WHERE "after"::text LIKE ${"%" + marker + "%"} OR "before"::text LIKE ${"%" + marker + "%"}`;
      await prisma.invite.deleteMany({ where: { email: { contains: marker } } });
      await prisma.user.deleteMany({ where: { email: { contains: marker } } });
      await prisma.$disconnect();
    }
    await pool?.end();
  });

  it("registers, invites, and enforces user management", async (context) => {
    const connected = await connect();
    if (!connected) {
      context.skip();
      return;
    }
    prisma = connected.prisma;
    pool = connected.pool;
    app = await buildApp({
      webOrigin: "http://localhost:5173",
      service: "releaseops-api",
      version: "0.1.0",
      logLevel: "silent",
      auth: { repository: new PrismaAuthRepository(prisma), hashing: "fast" },
    });

    const setup = await app.inject({ method: "GET", url: "/api/v1/auth/setup" });
    if (setup.json().needsInvite === true) {
      context.skip();
      return;
    }

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: adminEmail, name: "Ada", password },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().user.role).toBe("admin");
    const cookie = String(created.headers["set-cookie"]).split(";")[0];

    const closed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email: developerEmail, name: "Dee", password },
    });
    expect(closed.statusCode).toBe(403);

    const invited = await app.inject({
      method: "POST",
      url: "/api/v1/users/invites",
      headers: { cookie },
      payload: { email: developerEmail, role: "developer" },
    });
    expect(invited.statusCode).toBe(201);
    const joined = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: developerEmail,
        name: "Dee",
        password,
        inviteToken: invited.json().token,
      },
    });
    expect(joined.statusCode).toBe(201);
    const developerCookie = String(joined.headers["set-cookie"]).split(";")[0];
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/users",
      headers: { cookie: developerCookie },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("FORBIDDEN");
  });
});
