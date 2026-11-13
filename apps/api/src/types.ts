import type { PublicUser } from "@releaseops/shared";
import type { AuditWrite } from "./auth/repository.js";

declare module "fastify" {
  interface FastifyRequest {
    user: PublicUser | null;
  }

  interface FastifyInstance {
    recordAudit: (event: AuditWrite) => Promise<void>;
  }
}
