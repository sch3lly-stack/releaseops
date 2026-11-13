export const userRoles = ["admin", "developer", "approver"] as const;

export type UserRole = (typeof userRoles)[number];

export const actions = [
  "read",
  "project:create",
  "project:update",
  "project:delete",
  "env:manage",
  "deployment:create",
  "deployment:approve",
  "deployment:rollback",
  "user:manage",
  "audit:read",
  "notify:manage",
] as const;

export type Action = (typeof actions)[number];

export interface Principal {
  id: string;
  role: UserRole;
  isActive: boolean;
}

export interface PermissionResource {
  requestedById?: string;
  actorId?: string;
}

const grants: Record<UserRole, ReadonlySet<Action>> = {
  admin: new Set(actions),
  developer: new Set(["read", "deployment:create", "deployment:rollback"]),
  approver: new Set(["read", "deployment:approve", "audit:read"]),
};

export function can(user: Principal, action: Action, resource?: PermissionResource): boolean {
  if (!user.isActive) return false;
  if (action === "deployment:approve" && resource?.requestedById === user.id) return false;
  if (action === "audit:read" && user.role === "developer") {
    return resource?.actorId !== undefined && resource.actorId === user.id;
  }
  return grants[user.role].has(action);
}
