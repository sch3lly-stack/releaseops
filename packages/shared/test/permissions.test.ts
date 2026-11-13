import { describe, expect, it } from "vitest";
import { actions, can, type Action, type Principal, type UserRole } from "../src/permissions.js";

const expected: Record<Action, Record<UserRole, boolean>> = {
  read: { admin: true, developer: true, approver: true },
  "project:create": { admin: true, developer: false, approver: false },
  "project:update": { admin: true, developer: false, approver: false },
  "project:delete": { admin: true, developer: false, approver: false },
  "env:manage": { admin: true, developer: false, approver: false },
  "deployment:create": { admin: true, developer: true, approver: false },
  "deployment:approve": { admin: true, developer: false, approver: true },
  "deployment:rollback": { admin: true, developer: true, approver: false },
  "user:manage": { admin: true, developer: false, approver: false },
  "audit:read": { admin: true, developer: false, approver: true },
  "notify:manage": { admin: true, developer: false, approver: false },
};

function principal(role: UserRole, id = role): Principal {
  return { id, role, isActive: true };
}

describe("can", () => {
  it("covers every action in the matrix", () => {
    expect(new Set(actions)).toEqual(new Set(Object.keys(expected)));
  });

  it.each(actions)("grants %s only to the roles in the matrix", (action) => {
    for (const role of ["admin", "developer", "approver"] as const) {
      expect(can(principal(role), action)).toBe(expected[action][role]);
    }
  });

  it("denies every action to an inactive user", () => {
    for (const role of ["admin", "developer", "approver"] as const) {
      const user = { ...principal(role), isActive: false };
      for (const action of actions) {
        expect(can(user, action, { requestedById: "other", actorId: user.id })).toBe(false);
      }
    }
  });

  it("blocks approving your own deployment request", () => {
    const admin = principal("admin", "ada");
    const approver = principal("approver", "owen");
    expect(can(admin, "deployment:approve", { requestedById: "ada" })).toBe(false);
    expect(can(approver, "deployment:approve", { requestedById: "owen" })).toBe(false);
    expect(can(approver, "deployment:approve", { requestedById: "ada" })).toBe(true);
    expect(can(principal("developer", "dee"), "deployment:approve", { requestedById: "ada" })).toBe(
      false,
    );
  });

  it("lets a developer read only their own audit events", () => {
    const developer = principal("developer", "dee");
    expect(can(developer, "audit:read")).toBe(false);
    expect(can(developer, "audit:read", {})).toBe(false);
    expect(can(developer, "audit:read", { actorId: "dee" })).toBe(true);
    expect(can(developer, "audit:read", { actorId: "ada" })).toBe(false);
    expect(can(principal("approver"), "audit:read")).toBe(true);
    expect(can(principal("admin"), "audit:read", { actorId: "someone-else" })).toBe(true);
  });
});
