import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'engineer', 'operator', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  name: z.string(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const DeviceSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  type: z.string(),
  apiKeyHash: z.string(),
  lastSeenAt: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).default('offline'),
  createdAt: z.string(),
});
export type Device = z.infer<typeof DeviceSchema>;
