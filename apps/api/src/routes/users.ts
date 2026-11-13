import { createInviteBodySchema, updateUserBodySchema } from "@releaseops/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requestMeta } from "../auth/request.js";
import type { AuthService } from "../auth/service.js";
import { AppError } from "../plugins/errors.js";
import { requirePermission } from "../plugins/permissions.js";

const userParamsSchema = z.object({ id: z.uuid() });

export function registerUserRoutes(app: FastifyInstance, service: AuthService) {
  app.get("/api/v1/users", { preHandler: requirePermission("user:manage") }, async () => ({
    data: await service.listUsers(),
  }));

  app.post(
    "/api/v1/users/invites",
    { preHandler: requirePermission("user:manage") },
    async (request, reply) => {
      const body = createInviteBodySchema.parse(request.body);
      const actor = request.user;
      if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
      reply.code(201);
      return service.createInvite(actor.id, body, requestMeta(request));
    },
  );

  app.patch(
    "/api/v1/users/:id",
    { preHandler: requirePermission("user:manage") },
    async (request) => {
      const params = userParamsSchema.parse(request.params);
      const body = updateUserBodySchema.parse(request.body);
      const actor = request.user;
      if (!actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
      return { user: await service.updateUser(actor.id, params.id, body, requestMeta(request)) };
    },
  );
}
