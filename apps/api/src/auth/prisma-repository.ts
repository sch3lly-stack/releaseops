import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
  DuplicateRecordError,
  type AuditWrite,
  type AuthRepository,
  type StoredInvite,
  type StoredSession,
  type StoredUser,
  type UserPatch,
} from "./repository.js";

type UserRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: StoredUser["role"];
  isActive: boolean;
  createdAt: Date;
};

type InviteRow = {
  id: string;
  email: string;
  role: StoredInvite["role"];
  tokenHash: string;
  expiresAt: Date;
  createdById: string;
  acceptedAt: Date | null;
  createdAt: Date;
};

function toUser(user: UserRow): StoredUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function toInvite(invite: InviteRow): StoredInvite {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    tokenHash: invite.tokenHash,
    expiresAt: invite.expiresAt,
    createdById: invite.createdById,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
  };
}

function rethrowDuplicate(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    throw new DuplicateRecordError("email");
  }
  throw error;
}

function jsonValue(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return value as Prisma.InputJsonValue;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly inTransaction = false,
  ) {}

  async countUsers() {
    return this.db.user.count();
  }

  async findUserByEmail(email: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    return user ? toUser(user) : null;
  }

  async findUserById(id: string) {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? toUser(user) : null;
  }

  async listUsers() {
    const users = await this.db.user.findMany({
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    });
    return users.map(toUser);
  }

  async insertUser(user: StoredUser) {
    try {
      await this.db.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash: user.passwordHash,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      rethrowDuplicate(error);
    }
  }

  async updateUser(id: string, patch: UserPatch) {
    const user = await this.db.user.update({
      where: { id },
      data: {
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      },
    });
    return toUser(user);
  }

  async insertSession(session: StoredSession) {
    await this.db.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        ip: session.ip,
        userAgent: session.userAgent,
      },
    });
  }

  async findSession(id: string) {
    const session = await this.db.session.findUnique({ where: { id }, include: { user: true } });
    if (!session) return null;
    return {
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        ip: session.ip,
        userAgent: session.userAgent,
      },
      user: toUser(session.user),
    };
  }

  async updateSessionExpiry(id: string, expiresAt: Date) {
    await this.db.session.update({ where: { id }, data: { expiresAt } });
  }

  async deleteSession(id: string) {
    await this.db.session.deleteMany({ where: { id } });
  }

  async deleteSessionsForUser(userId: string) {
    await this.db.session.deleteMany({ where: { userId } });
  }

  async insertInvite(invite: StoredInvite) {
    try {
      await this.db.invite.create({
        data: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          tokenHash: invite.tokenHash,
          expiresAt: invite.expiresAt,
          createdById: invite.createdById,
          acceptedAt: invite.acceptedAt,
          createdAt: invite.createdAt,
        },
      });
    } catch (error) {
      rethrowDuplicate(error);
    }
  }

  async findInviteByTokenHash(tokenHash: string) {
    const invite = await this.db.invite.findUnique({ where: { tokenHash } });
    return invite ? toInvite(invite) : null;
  }

  async findPendingInviteByEmail(email: string, now: Date) {
    const invite = await this.db.invite.findFirst({
      where: { email, acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    return invite ? toInvite(invite) : null;
  }

  async markInviteAccepted(id: string, acceptedAt: Date) {
    await this.db.invite.update({ where: { id }, data: { acceptedAt } });
  }

  async insertAudit(event: AuditWrite) {
    await this.db.auditLog.create({
      data: {
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        before: jsonValue(event.before),
        after: jsonValue(event.after),
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
      },
    });
  }

  async lockAuthWrites() {
    await this.db.$executeRaw`SELECT pg_advisory_xact_lock(814271)`;
  }

  async transaction<T>(run: (repository: AuthRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return run(this);
    return this.db.$transaction((tx) => run(new PrismaAuthRepository(tx as PrismaClient, true)));
  }
}
