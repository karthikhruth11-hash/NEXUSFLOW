import { z } from 'zod';
import { PortType, ValidationIssue } from '@nexusflow/shared';

export type NodeCategory = 'input' | 'processing' | 'condition' | 'logic' | 'output';

export interface PortContract {
  id: string;
  name: string;
  type: PortType;
  direction: 'input' | 'output';
  description?: string;
  maxConnections?: number; // default unlimited or 1
}

export interface ValidationContext {
  tenantId?: string;
  authorizedDeviceIds?: string[];
  maxWindowCount?: number;
  maxWindowDurationSeconds?: number;
}

export interface NodeTypeDefinition<TConfig = Record<string, unknown>> {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: PortContract[];
  outputs: PortContract[];
  configSchema: z.ZodType<TConfig, any, any>;
  defaultConfig: TConfig;
  validateConfig?: (config: TConfig, context: ValidationContext, nodeId: string) => ValidationIssue[];
}
