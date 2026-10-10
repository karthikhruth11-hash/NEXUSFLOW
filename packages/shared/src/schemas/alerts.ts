import { z } from 'zod';

export const AlertStateSchema = z.enum([
  'OK',
  'PENDING',
  'FIRING',
  'ACKNOWLEDGED',
  'RESOLVED',
]);
export type AlertState = z.infer<typeof AlertStateSchema>;

export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export const AlertRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  workflowId: z.string(),
  workflowVersion: z.number().int(),
  executionId: z.string(),
  nodeId: z.string(),
  deviceId: z.string(),
  state: AlertStateSchema,
  severity: AlertSeveritySchema,
  title: z.string(),
  condition: z.string(),
  observedValue: z.number(),
  threshold: z.number(),
  dedupKey: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  firingAt: z.string().optional(),
  acknowledgedAt: z.string().optional(),
  acknowledgedBy: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  notificationSent: z.boolean().default(false),
  notificationChannel: z.string().optional(),
});
export type AlertRecord = z.infer<typeof AlertRecordSchema>;
