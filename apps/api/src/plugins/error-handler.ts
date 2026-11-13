import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError, errorBody } from "./errors.js";

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = error.statusCode;
    if (typeof statusCode === "number") return statusCode;
  }
  return undefined;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(errorBody(error.code, error.message, error.details));
    }

    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send(errorBody("VALIDATION_ERROR", "Request validation failed", error.flatten()));
    }

    const statusCode = statusCodeOf(error) ?? 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.status(statusCode).send(errorBody("INTERNAL_ERROR", "Internal server error"));
    }

    const message = error instanceof Error ? error.message : "Request failed";
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "REQUEST_ERROR";
    return reply.status(statusCode).send(errorBody(code, message));
  });

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(errorBody("NOT_FOUND", `Route ${request.method} ${request.url} not found`));
  });
}
