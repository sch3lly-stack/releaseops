import { z } from "zod";
import { userRoles } from "./permissions.js";

export const emailSchema = z.string().trim().max(320).toLowerCase().pipe(z.email());

export const registerBodySchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(200),
  inviteToken: z.string().trim().min(20).max(200).optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const createInviteBodySchema = z.object({
  email: emailSchema,
  role: z.enum(userRoles),
});

export const updateUserBodySchema = z
  .object({
    role: z.enum(userRoles).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Provide a role or an active flag",
  });

export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.enum(userRoles),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
});

export const authUserResponseSchema = z.object({
  user: publicUserSchema,
});

export const userListResponseSchema = z.object({
  data: z.array(publicUserSchema),
});

export const setupResponseSchema = z.object({
  needsInvite: z.boolean(),
});

export const inviteResponseSchema = z.object({
  email: z.email(),
  role: z.enum(userRoles),
  expiresAt: z.string().min(1),
  token: z.string().min(1),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type CreateInviteBody = z.infer<typeof createInviteBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
