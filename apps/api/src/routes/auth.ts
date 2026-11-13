import { loginBodySchema, registerBodySchema } from "@releaseops/shared";
import type { FastifyInstance } from "fastify";
import {
  SESSION_COOKIE,
  clearSessionCookieOptions,
  sessionCookieOptions,
  sessionIdFromCookie,
} from "../auth/cookies.js";
import { requestMeta } from "../auth/request.js";
import type { AuthService } from "../auth/service.js";
import { AppError } from "../plugins/errors.js";
import { registerUserRoutes } from "./users.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: { service: AuthService; secureCookies: boolean },
) {
  const { service, secureCookies } = options;

  app.addHook("onRequest", async (request, reply) => {
    const sessionId = sessionIdFromCookie(request.cookies?.[SESSION_COOKIE]);
    const current = await service.currentUser(sessionId);
    request.user = current?.user ?? null;
    if (current?.refresh && sessionId) {
      reply.setCookie(SESSION_COOKIE, sessionId, sessionCookieOptions(secureCookies));
    }
  });

  app.get("/api/v1/auth/setup", async () => service.setup());

  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const result = await service.register(body, requestMeta(request));
    reply
      .code(201)
      .setCookie(SESSION_COOKIE, result.sessionId, sessionCookieOptions(secureCookies));
    return { user: result.user };
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await service.login(body, requestMeta(request));
    reply.setCookie(SESSION_COOKIE, result.sessionId, sessionCookieOptions(secureCookies));
    return { user: result.user };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const sessionId = sessionIdFromCookie(request.cookies?.[SESSION_COOKIE]);
    await service.logout(sessionId, requestMeta(request));
    reply.clearCookie(SESSION_COOKIE, clearSessionCookieOptions(secureCookies));
    return reply.status(204).send();
  });

  app.get("/api/v1/auth/me", async (request) => {
    if (!request.user) {
      throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
    }
    return { user: request.user };
  });

  registerUserRoutes(app, service);
}
