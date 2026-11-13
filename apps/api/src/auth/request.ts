import type { FastifyRequest } from "fastify";
import type { RequestMeta } from "./service.js";

export function requestMeta(request: FastifyRequest): RequestMeta {
  const header = request.headers["user-agent"];
  const userAgent = Array.isArray(header) ? header[0] : header;
  return {
    ip: request.ip ? request.ip.slice(0, 200) : null,
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
  };
}
