import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { healthRoutes, type HealthRouteOptions } from "./routes/health.js";

export interface BuildAppOptions extends HealthRouteOptions {
  webOrigin: string;
  logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const logLevel = options.logLevel ?? "info";
  const app = Fastify({
    logger:
      logLevel === "silent"
        ? false
        : {
            level: logLevel,
            redact: ["req.headers.authorization", "req.headers.cookie"],
          },
  });

  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  registerErrorHandler(app);
  await app.register(healthRoutes, {
    service: options.service,
    version: options.version,
    checkReady: options.checkReady,
  });

  return app;
}
