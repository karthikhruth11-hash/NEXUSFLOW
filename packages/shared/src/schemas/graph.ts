import { z } from 'zod';

export const PortTypeSchema = z.enum(['number', 'boolean', 'event']);
export type PortType = z.infer<typeof PortTypeSchema>;

export const PortDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: PortTypeSchema,
  direction: z.enum(['input', 'output']),
  description: z.string().optional(),
});
export type PortDefinition = z.infer<typeof PortDefinitionSchema>;

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  config: z.record(z.string(), z.unknown()),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourcePort: z.string().min(1),
  target: z.string().min(1),
  targetPort: z.string().min(1),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const WorkflowSettingsSchema = z.object({
  cooldownSeconds: z.number().int().min(0).default(60),
  maxLatenessSeconds: z.number().int().min(0).default(60),
  deviceIds: z.array(z.string()).default([]),
});
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;

export const WorkflowDefinitionSchema = z.object({
  schemaVersion: z.literal('1.0.0').default('1.0.0'),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  settings: WorkflowSettingsSchema.default({}),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export const ValidationSeveritySchema = z.enum(['error', 'warning']);
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;

export const ValidationIssueSchema = z.object({
  code: z.string(),
  severity: ValidationSeveritySchema,
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  message: z.string(),
  fixHint: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export interface GraphValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
