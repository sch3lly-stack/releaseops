import type { FastifyPluginAsync } from "fastify";
import { healthResponseSchema } from "@releaseops/shared";

export interface HealthRouteOptions {
  service: string;
  version: string;
  checkReady?: () => Promise<void>;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (app, opts) => {
  app.get("/healthz", async () => {
    return healthResponseSchema.parse({
      status: "ok",
      service: opts.service,
      version: opts.version,
    });
  });

  app.get("/readyz", async (request, reply) => {
    try {
      if (opts.checkReady) await opts.checkReady();
      return healthResponseSchema.parse({
        status: "ok",
        service: opts.service,
        version: opts.version,
      });
    } catch {
      request.log.warn("readiness check failed");
      return reply.code(503).send(
        healthResponseSchema.parse({
          status: "not_ready",
          service: opts.service,
        }),
      );
    }
  });
};
