import {
  DuplicateRecordError,
  type AuditWrite,
  type AuthRepository,
  type StoredInvite,
  type StoredSession,
  type StoredUser,
  type UserPatch,
} from "../src/auth/repository.js";

interface MemoryState {
  users: StoredUser[];
  sessions: StoredSession[];
  invites: StoredInvite[];
  audits: AuditWrite[];
}

export interface MemoryAuthRepository extends AuthRepository {
  readonly audits: AuditWrite[];
  readonly lockCalls: number;
  failNextAudit(action: string): void;
}

function byCreatedAt(
  left: { createdAt: Date; email: string },
  right: { createdAt: Date; email: string },
) {
  return (
    left.createdAt.getTime() - right.createdAt.getTime() || left.email.localeCompare(right.email)
  );
}

export function createMemoryAuthRepository(): MemoryAuthRepository {
  const state: MemoryState = { users: [], sessions: [], invites: [], audits: [] };
  let lockCalls = 0;
  let failAuditAction: string | null = null;
  let depth = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const repository: MemoryAuthRepository = {
    get audits() {
      return state.audits;
    },
    get lockCalls() {
      return lockCalls;
    },
    failNextAudit(action) {
      failAuditAction = action;
    },
    async countUsers() {
      return state.users.length;
    },
    async findUserByEmail(email) {
      const user = state.users.find((item) => item.email === email);
      return user ? structuredClone(user) : null;
    },
    async findUserById(id) {
      const user = state.users.find((item) => item.id === id);
      return user ? structuredClone(user) : null;
    },
    async listUsers() {
      return state.users
        .slice()
        .sort(byCreatedAt)
        .map((user) => structuredClone(user));
    },
    async insertUser(user) {
      if (state.users.some((existing) => existing.email === user.email)) {
        throw new DuplicateRecordError("email");
      }
      state.users.push(structuredClone(user));
    },
    async updateUser(id, patch: UserPatch) {
      const index = state.users.findIndex((user) => user.id === id);
      const current = state.users[index];
      if (!current) throw new Error(`User ${id} was not found`);
      const updated = { ...current, ...patch };
      state.users[index] = updated;
      return structuredClone(updated);
    },
    async insertSession(session) {
      state.sessions.push(structuredClone(session));
    },
    async findSession(id) {
      const session = state.sessions.find((item) => item.id === id);
      if (!session) return null;
      const user = state.users.find((item) => item.id === session.userId);
      if (!user) return null;
      return { session: structuredClone(session), user: structuredClone(user) };
    },
    async updateSessionExpiry(id, expiresAt) {
      const session = state.sessions.find((item) => item.id === id);
      if (!session) throw new Error(`Session ${id} was not found`);
      session.expiresAt = new Date(expiresAt);
    },
    async deleteSession(id) {
      state.sessions = state.sessions.filter((session) => session.id !== id);
    },
    async deleteSessionsForUser(userId) {
      state.sessions = state.sessions.filter((session) => session.userId !== userId);
    },
    async insertInvite(invite) {
      if (state.invites.some((existing) => existing.tokenHash === invite.tokenHash)) {
        throw new DuplicateRecordError("tokenHash");
      }
      state.invites.push(structuredClone(invite));
    },
    async findInviteByTokenHash(tokenHash) {
      const invite = state.invites.find((item) => item.tokenHash === tokenHash);
      return invite ? structuredClone(invite) : null;
    },
    async findPendingInviteByEmail(email, now) {
      const invite = state.invites.find(
        (item) =>
          item.email === email &&
          item.acceptedAt === null &&
          item.expiresAt.getTime() > now.getTime(),
      );
      return invite ? structuredClone(invite) : null;
    },
    async markInviteAccepted(id, acceptedAt) {
      const invite = state.invites.find((item) => item.id === id);
      if (!invite) throw new Error(`Invite ${id} was not found`);
      invite.acceptedAt = new Date(acceptedAt);
    },
    async insertAudit(event) {
      if (failAuditAction !== null && failAuditAction === event.action) {
        failAuditAction = null;
        throw new Error(`audit write failed for ${event.action}`);
      }
      state.audits.push(structuredClone(event));
    },
    async lockAuthWrites() {
      lockCalls += 1;
    },
    async transaction(run) {
      if (depth > 0) return run(repository);
      const job = queue.then(async () => {
        const saved = structuredClone(state);
        depth += 1;
        try {
          return await run(repository);
        } catch (error) {
          state.users = saved.users;
          state.sessions = saved.sessions;
          state.invites = saved.invites;
          state.audits = saved.audits;
          throw error;
        } finally {
          depth -= 1;
        }
      });
      queue = job.then(
        () => undefined,
        () => undefined,
      );
      return job;
    },
  };

  return repository;
}
