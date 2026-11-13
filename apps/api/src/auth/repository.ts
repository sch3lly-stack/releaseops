import type { UserRole } from "@releaseops/shared";

export class DuplicateRecordError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(`Duplicate ${field}`);
    this.name = "DuplicateRecordError";
    this.field = field;
  }
}

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}

export interface StoredSession {
  id: string;
  userId: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}

export interface StoredInvite {
  id: string;
  email: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
  createdById: string;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface AuditWrite {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface UserPatch {
  role?: UserRole;
  isActive?: boolean;
}

export interface AuthRepository {
  countUsers(): Promise<number>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  listUsers(): Promise<StoredUser[]>;
  insertUser(user: StoredUser): Promise<void>;
  updateUser(id: string, patch: UserPatch): Promise<StoredUser>;
  insertSession(session: StoredSession): Promise<void>;
  findSession(id: string): Promise<{ session: StoredSession; user: StoredUser } | null>;
  updateSessionExpiry(id: string, expiresAt: Date): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  insertInvite(invite: StoredInvite): Promise<void>;
  findInviteByTokenHash(tokenHash: string): Promise<StoredInvite | null>;
  findPendingInviteByEmail(email: string, now: Date): Promise<StoredInvite | null>;
  markInviteAccepted(id: string, acceptedAt: Date): Promise<void>;
  insertAudit(event: AuditWrite): Promise<void>;
  lockAuthWrites(): Promise<void>;
  transaction<T>(run: (repository: AuthRepository) => Promise<T>): Promise<T>;
}
