import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CreateInviteBody, PublicUser, UpdateUserBody, UserRole } from "@releaseops/shared";
import { AppError } from "../plugins/errors.js";
import { SESSION_TTL_MS, SLIDE_WITHIN_MS } from "./cookies.js";
import type { PasswordHasher } from "./passwords.js";
import type { RateLimiter } from "./rate-limit.js";
import {
  DuplicateRecordError,
  type AuditWrite,
  type AuthRepository,
  type StoredUser,
} from "./repository.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthServiceDeps {
  hasher: PasswordHasher;
  now: () => Date;
  rateLimit: RateLimiter;
}

export interface AuthService {
  setup(): Promise<{ needsInvite: boolean }>;
  register(
    input: { email: string; name: string; password: string; inviteToken?: string },
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; sessionId: string }>;
  login(
    input: { email: string; password: string },
    meta: RequestMeta,
  ): Promise<{ user: PublicUser; sessionId: string }>;
  logout(sessionId: string | null, meta: RequestMeta): Promise<void>;
  currentUser(sessionId: string | null): Promise<{ user: PublicUser; refresh: boolean } | null>;
  createInvite(
    actorId: string,
    input: CreateInviteBody,
    meta: RequestMeta,
  ): Promise<{ email: string; role: UserRole; expiresAt: string; token: string }>;
  listUsers(): Promise<PublicUser[]>;
  updateUser(
    actorId: string,
    userId: string,
    patch: UpdateUserBody,
    meta: RequestMeta,
  ): Promise<PublicUser>;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

function audit(meta: RequestMeta, event: AuditWrite): AuditWrite {
  return { ...event, ip: meta.ip, userAgent: meta.userAgent };
}

async function openSession(
  repository: AuthRepository,
  user: StoredUser,
  meta: RequestMeta,
  now: Date,
  action: "auth.register" | "auth.login",
): Promise<string> {
  const sessionId = randomUUID();
  await repository.insertSession({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await repository.insertAudit(
    audit(meta, {
      actorId: user.id,
      action,
      entityType: "user",
      entityId: user.id,
      after: { email: user.email, role: user.role },
    }),
  );
  return sessionId;
}

export function createAuthService(repository: AuthRepository, deps: AuthServiceDeps): AuthService {
  const { hasher, now, rateLimit } = deps;

  return {
    async setup() {
      return { needsInvite: (await repository.countUsers()) > 0 };
    },

    async register(input, meta) {
      const email = normalizeEmail(input.email);
      const name = input.name.trim();
      const passwordHash = await hasher.hash(input.password);
      const tokenHash = input.inviteToken ? hashToken(input.inviteToken) : null;

      try {
        return await repository.transaction(async (tx) => {
          await tx.lockAuthWrites();
          const createdAt = now();
          if ((await tx.countUsers()) === 0) {
            const user: StoredUser = {
              id: randomUUID(),
              email,
              name,
              passwordHash,
              role: "admin",
              isActive: true,
              createdAt,
            };
            await tx.insertUser(user);
            const sessionId = await openSession(tx, user, meta, createdAt, "auth.register");
            return { user: toPublicUser(user), sessionId };
          }

          if (!tokenHash) {
            throw new AppError(
              403,
              "REGISTRATION_CLOSED",
              "Registration is invite-only. Ask an administrator for an invite.",
            );
          }

          const invite = await tx.findInviteByTokenHash(tokenHash);
          if (
            !invite ||
            invite.acceptedAt ||
            invite.expiresAt.getTime() <= createdAt.getTime() ||
            invite.email !== email
          ) {
            throw new AppError(400, "INVITE_INVALID", "That invite is invalid or has expired.");
          }

          if (await tx.findUserByEmail(email)) {
            throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
          }

          const user: StoredUser = {
            id: randomUUID(),
            email,
            name,
            passwordHash,
            role: invite.role,
            isActive: true,
            createdAt,
          };
          await tx.insertUser(user);
          await tx.markInviteAccepted(invite.id, createdAt);
          const sessionId = await openSession(tx, user, meta, createdAt, "auth.register");
          return { user: toPublicUser(user), sessionId };
        });
      } catch (error) {
        if (error instanceof DuplicateRecordError) {
          throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
        }
        throw error;
      }
    },

    async login(input, meta) {
      const email = normalizeEmail(input.email);
      const key = `${meta.ip ?? "unknown"}:${email}`;
      if (!rateLimit.allow(key)) {
        await repository.insertAudit(
          audit(meta, {
            actorId: null,
            action: "auth.rate_limited",
            entityType: "user",
            after: { email },
          }),
        );
        throw new AppError(429, "RATE_LIMITED", "Too many login attempts. Try again in a minute.");
      }

      const user = await repository.findUserByEmail(email);
      const passwordHash = user?.passwordHash ?? (await hasher.dummyHash());
      const passwordOk = await hasher.verify(passwordHash, input.password);
      const active = user?.isActive === true && user.passwordHash !== null;
      if (!user || !passwordOk || !active) {
        const reason = !user ? "unknown" : !user.isActive ? "inactive" : "password";
        await repository.insertAudit(
          audit(meta, {
            actorId: user?.id ?? null,
            action: "auth.login_failed",
            entityType: "user",
            entityId: user?.id ?? null,
            after: { email, reason },
          }),
        );
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
      }

      const createdAt = now();
      const sessionId = await repository.transaction(async (tx) => {
        return openSession(tx, user, meta, createdAt, "auth.login");
      });
      return { user: toPublicUser(user), sessionId };
    },

    async logout(sessionId, meta) {
      if (!sessionId) return;
      const found = await repository.findSession(sessionId);
      await repository.transaction(async (tx) => {
        await tx.deleteSession(sessionId);
        if (!found) return;
        await tx.insertAudit(
          audit(meta, {
            actorId: found.user.id,
            action: "auth.logout",
            entityType: "session",
            entityId: sessionId,
          }),
        );
      });
    },

    async currentUser(sessionId) {
      if (!sessionId) return null;
      const found = await repository.findSession(sessionId);
      if (!found) return null;
      const current = now();
      if (found.session.expiresAt.getTime() <= current.getTime()) {
        await repository.deleteSession(sessionId);
        return null;
      }
      if (!found.user.isActive) {
        await repository.deleteSessionsForUser(found.user.id);
        return null;
      }
      const remaining = found.session.expiresAt.getTime() - current.getTime();
      if (remaining < SLIDE_WITHIN_MS) {
        await repository.updateSessionExpiry(
          sessionId,
          new Date(current.getTime() + SESSION_TTL_MS),
        );
        return { user: toPublicUser(found.user), refresh: true };
      }
      return { user: toPublicUser(found.user), refresh: false };
    },

    async createInvite(actorId, input, meta) {
      const email = normalizeEmail(input.email);
      const token = randomBytes(32).toString("base64url");
      const createdAt = now();
      const invite = {
        id: randomUUID(),
        email,
        role: input.role,
        tokenHash: hashToken(token),
        expiresAt: new Date(createdAt.getTime() + INVITE_TTL_MS),
        createdById: actorId,
        acceptedAt: null,
        createdAt,
      };

      await repository.transaction(async (tx) => {
        await tx.lockAuthWrites();
        if (await tx.findUserByEmail(email)) {
          throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
        }
        if (await tx.findPendingInviteByEmail(email, createdAt)) {
          throw new AppError(409, "INVITE_PENDING", "An invite is already pending for that email.");
        }
        await tx.insertInvite(invite);
        await tx.insertAudit(
          audit(meta, {
            actorId,
            action: "user.invite_created",
            entityType: "invite",
            entityId: invite.id,
            after: { email, role: input.role },
          }),
        );
      });

      return { email, role: input.role, expiresAt: invite.expiresAt.toISOString(), token };
    },

    async listUsers() {
      const users = await repository.listUsers();
      return users.map(toPublicUser);
    },

    async updateUser(actorId, userId, patch, meta) {
      if (actorId === userId) {
        throw new AppError(403, "CANNOT_EDIT_SELF", "You cannot change your own account.");
      }

      try {
        return await repository.transaction(async (tx) => {
          await tx.lockAuthWrites();
          const target = await tx.findUserById(userId);
          if (!target) {
            throw new AppError(404, "NOT_FOUND", "User not found.");
          }

          const nextRole = patch.role ?? target.role;
          const nextActive = patch.isActive ?? target.isActive;
          const losesAdmin =
            target.role === "admin" && target.isActive && (nextRole !== "admin" || !nextActive);
          if (losesAdmin) {
            const admins = (await tx.listUsers()).filter(
              (user) => user.isActive && user.role === "admin",
            );
            if (admins.length <= 1) {
              throw new AppError(
                409,
                "LAST_ADMIN",
                "The last active administrator cannot be demoted or deactivated.",
              );
            }
          }

          const updated = await tx.updateUser(userId, { role: nextRole, isActive: nextActive });
          const roleChanged = nextRole !== target.role;
          const activityChanged = nextActive !== target.isActive;
          if (roleChanged || !nextActive) {
            await tx.deleteSessionsForUser(userId);
          }
          if (roleChanged) {
            await tx.insertAudit(
              audit(meta, {
                actorId,
                action: "user.role_changed",
                entityType: "user",
                entityId: userId,
                before: { role: target.role },
                after: { role: nextRole },
              }),
            );
          }
          if (activityChanged) {
            await tx.insertAudit(
              audit(meta, {
                actorId,
                action: nextActive ? "user.reactivated" : "user.deactivated",
                entityType: "user",
                entityId: userId,
                before: { isActive: target.isActive },
                after: { isActive: nextActive },
              }),
            );
          }
          return toPublicUser(updated);
        });
      } catch (error) {
        if (error instanceof DuplicateRecordError) {
          throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
        }
        throw error;
      }
    },
  };
}
