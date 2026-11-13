import type { Action, PermissionResource } from "@releaseops/shared";
import { can } from "@releaseops/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { requestMeta } from "../auth/request.js";
import { AppError } from "./errors.js";

export function requirePermission(
  action: Action,
  resourceOf?: (request: FastifyRequest) => PermissionResource | undefined,
) {
  return async function permissionHook(request: FastifyRequest, _reply: FastifyReply) {
    const user = request.user;
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
    }

    const resource = resourceOf?.(request);
    if (can(user, action, resource)) return;

    await request.server.recordAudit({
      ...requestMeta(request),
      actorId: user.id,
      action: "auth.denied",
      entityType: "permission",
      after: { action, resource: resource ?? null },
    });
    throw new AppError(403, "FORBIDDEN", "You do not have permission to do that.");
  };
}
