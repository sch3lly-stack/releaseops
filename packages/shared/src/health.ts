import { z } from "zod";

export const healthStatusSchema = z.enum(["ok", "not_ready"]);

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  service: z.string().min(1),
  version: z.string().min(1).optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
