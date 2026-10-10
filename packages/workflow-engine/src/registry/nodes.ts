import { z } from 'zod';
import { NodeTypeDefinition } from './types.js';
import { ValidationIssue } from '@nexusflow/shared';

// 1. Sensor Input Node
export const SensorInputConfigSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  measurement: z.string().min(1, 'Measurement name is required'),
  unit: z.string().optional(),
});
export type SensorInputConfig = z.infer<typeof SensorInputConfigSchema>;

export const SensorInputNodeDef: NodeTypeDefinition<SensorInputConfig> = {
  type: 'sensor-input',
  label: 'Sensor Input',
  category: 'input',
  description: 'Subscribes to live telemetry stream for a specific device and metric',
  inputs: [],
  outputs: [
    { id: 'value', name: 'Value', type: 'number', direction: 'output', description: 'Numeric sensor reading' },
    { id: 'event', name: 'Event', type: 'event', direction: 'output', description: 'Raw telemetry event' },
  ],
  configSchema: SensorInputConfigSchema,
  defaultConfig: {
    deviceId: '',
    measurement: 'temperature',
    unit: 'celsius',
  },
  validateConfig: (config, context, nodeId) => {
    const issues: ValidationIssue[] = [];
    if (
      context.authorizedDeviceIds &&
      context.authorizedDeviceIds.length > 0 &&
      !context.authorizedDeviceIds.includes(config.deviceId)
    ) {
      issues.push({
        code: 'UNAUTHORIZED_DEVICE',
        severity: 'error',
        nodeId,
        message: `Device '${config.deviceId}' is not authorized for this workflow`,
        fixHint: `Select an authorized device from: ${context.authorizedDeviceIds.join(', ')}`,
      });
    }
    return issues;
  },
};

// 2. Moving Average Node
export const MovingAverageConfigSchema = z.object({
  mode: z.enum(['count', 'duration']),
  size: z.number().int().positive('Window size must be greater than 0'),
  minSamples: z.number().int().min(1, 'Minimum samples must be at least 1').default(1),
});
export type MovingAverageConfig = z.infer<typeof MovingAverageConfigSchema>;

export const MovingAverageNodeDef: NodeTypeDefinition<MovingAverageConfig> = {
  type: 'moving-average',
  label: 'Moving Average',
  category: 'processing',
  description: 'Calculates sliding mean across count or duration window',
  inputs: [
    { id: 'input', name: 'Input', type: 'number', direction: 'input', description: 'Numeric stream' },
  ],
  outputs: [
    { id: 'output', name: 'Average', type: 'number', direction: 'output', description: 'Calculated mean' },
  ],
  configSchema: MovingAverageConfigSchema,
  defaultConfig: {
    mode: 'count',
    size: 5,
    minSamples: 1,
  },
  validateConfig: (config, context, nodeId) => {
    const issues: ValidationIssue[] = [];
    const maxCount = context.maxWindowCount ?? 500;
    const maxDuration = context.maxWindowDurationSeconds ?? 3600;

    if (config.mode === 'count' && config.size > maxCount) {
      issues.push({
        code: 'WINDOW_SIZE_LIMIT_EXCEEDED',
        severity: 'error',
        nodeId,
        message: `Count window size ${config.size} exceeds maximum limit of ${maxCount}`,
        fixHint: `Reduce window size to <= ${maxCount} samples`,
      });
    }
    if (config.mode === 'duration' && config.size > maxDuration) {
      issues.push({
        code: 'WINDOW_SIZE_LIMIT_EXCEEDED',
        severity: 'error',
        nodeId,
        message: `Duration window size ${config.size}s exceeds maximum limit of ${maxDuration}s`,
        fixHint: `Reduce window duration to <= ${maxDuration} seconds`,
      });
    }
    if (config.minSamples > config.size && config.mode === 'count') {
      issues.push({
        code: 'OUT_OF_RANGE_CONFIG',
        severity: 'error',
        nodeId,
        message: `minSamples (${config.minSamples}) cannot exceed count window size (${config.size})`,
        fixHint: 'Ensure minSamples <= size',
      });
    }
    return issues;
  },
};

// 3. Min / Max / Rate of Change Node
export const WindowStatsConfigSchema = z.object({
  stat: z.enum(['min', 'max', 'rate_of_change']),
  window: z.number().int().positive('Window size must be greater than 0'),
  unit: z.enum(['count', 'seconds']).default('count'),
});
export type WindowStatsConfig = z.infer<typeof WindowStatsConfigSchema>;

export const WindowStatsNodeDef: NodeTypeDefinition<WindowStatsConfig> = {
  type: 'window-stats',
  label: 'Min / Max / Rate of Change',
  category: 'processing',
  description: 'Calculates rolling min, max, or rate of change over a window',
  inputs: [
    { id: 'input', name: 'Input', type: 'number', direction: 'input' },
  ],
  outputs: [
    { id: 'output', name: 'Result', type: 'number', direction: 'output' },
  ],
  configSchema: WindowStatsConfigSchema,
  defaultConfig: {
    stat: 'max',
    window: 10,
    unit: 'count',
  },
};

// 4. Threshold Condition Node (with Hysteresis)
export const ThresholdConditionConfigSchema = z.object({
  operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
  threshold: z.number(),
  hysteresis: z.number().optional(), // clear threshold
});
export type ThresholdConditionConfig = z.infer<typeof ThresholdConditionConfigSchema>;

export const ThresholdConditionNodeDef: NodeTypeDefinition<ThresholdConditionConfig> = {
  type: 'threshold-condition',
  label: 'Threshold Condition',
  category: 'condition',
  description: 'Compares numerical value against threshold with hysteresis support',
  inputs: [
    { id: 'input', name: 'Input', type: 'number', direction: 'input' },
  ],
  outputs: [
    { id: 'output', name: 'Condition Met', type: 'boolean', direction: 'output' },
  ],
  configSchema: ThresholdConditionConfigSchema,
  defaultConfig: {
    operator: '>',
    threshold: 80.0,
    hysteresis: 75.0,
  },
  validateConfig: (config, _context, nodeId) => {
    const issues: ValidationIssue[] = [];
    if (config.hysteresis !== undefined) {
      if ((config.operator === '>' || config.operator === '>=') && config.hysteresis >= config.threshold) {
        issues.push({
          code: 'OUT_OF_RANGE_CONFIG',
          severity: 'error',
          nodeId,
          message: `For '>' or '>=' operator, clear hysteresis threshold (${config.hysteresis}) must be lower than trigger threshold (${config.threshold})`,
          fixHint: `Set hysteresis < ${config.threshold}`,
        });
      }
      if ((config.operator === '<' || config.operator === '<=') && config.hysteresis <= config.threshold) {
        issues.push({
          code: 'OUT_OF_RANGE_CONFIG',
          severity: 'error',
          nodeId,
          message: `For '<' or '<=' operator, clear hysteresis threshold (${config.hysteresis}) must be higher than trigger threshold (${config.threshold})`,
          fixHint: `Set hysteresis > ${config.threshold}`,
        });
      }
    }
    return issues;
  },
};

// 5. For-Duration (Debounce) Node
export const ForDurationConfigSchema = z.object({
  durationSeconds: z.number().positive('Duration must be greater than 0 seconds'),
});
export type ForDurationConfig = z.infer<typeof ForDurationConfigSchema>;

export const ForDurationNodeDef: NodeTypeDefinition<ForDurationConfig> = {
  type: 'for-duration',
  label: 'For Duration (Debounce)',
  category: 'condition',
  description: 'Emits true only after condition holds continuously for specified duration',
  inputs: [
    { id: 'input', name: 'Condition', type: 'boolean', direction: 'input' },
  ],
  outputs: [
    { id: 'output', name: 'Held True', type: 'boolean', direction: 'output' },
  ],
  configSchema: ForDurationConfigSchema,
  defaultConfig: {
    durationSeconds: 10,
  },
};

// 6. Absence / Heartbeat Node
export const AbsenceHeartbeatConfigSchema = z.object({
  timeoutSeconds: z.number().int().positive('Timeout must be greater than 0 seconds'),
});
export type AbsenceHeartbeatConfig = z.infer<typeof AbsenceHeartbeatConfigSchema>;

export const AbsenceHeartbeatNodeDef: NodeTypeDefinition<AbsenceHeartbeatConfig> = {
  type: 'absence-heartbeat',
  label: 'Absence / Heartbeat',
  category: 'condition',
  description: 'Fires true if no telemetry is received for specified timeout duration',
  inputs: [
    { id: 'input', name: 'Stream', type: 'number', direction: 'input' },
  ],
  outputs: [
    { id: 'output', name: 'Is Silent', type: 'boolean', direction: 'output' },
  ],
  configSchema: AbsenceHeartbeatConfigSchema,
  defaultConfig: {
    timeoutSeconds: 30,
  },
};

// 7. Boolean AND / OR / NOT Node
export const BooleanLogicConfigSchema = z.object({
  operation: z.enum(['AND', 'OR', 'NOT']),
  alignmentPolicy: z.enum(['latest_held', 'strict_sync']).default('latest_held'),
  holdDurationSeconds: z.number().int().min(1).default(10),
});
export type BooleanLogicConfig = z.infer<typeof BooleanLogicConfigSchema>;

export const BooleanLogicNodeDef: NodeTypeDefinition<BooleanLogicConfig> = {
  type: 'boolean-logic',
  label: 'Boolean Logic',
  category: 'logic',
  description: 'Combines boolean condition signals using AND, OR, or NOT logic',
  inputs: [
    { id: 'in_a', name: 'Input A', type: 'boolean', direction: 'input' },
    { id: 'in_b', name: 'Input B', type: 'boolean', direction: 'input' },
  ],
  outputs: [
    { id: 'output', name: 'Output', type: 'boolean', direction: 'output' },
  ],
  configSchema: BooleanLogicConfigSchema,
  defaultConfig: {
    operation: 'AND',
    alignmentPolicy: 'latest_held',
    holdDurationSeconds: 10,
  },
};

// 8. Dashboard Alert Node
export const DashboardAlertConfigSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string().min(1, 'Alert title is required'),
  cooldownSeconds: z.number().int().min(0).default(60),
});
export type DashboardAlertConfig = z.infer<typeof DashboardAlertConfigSchema>;

export const DashboardAlertNodeDef: NodeTypeDefinition<DashboardAlertConfig> = {
  type: 'dashboard-alert',
  label: 'Dashboard Alert',
  category: 'output',
  description: 'Creates managed alert lifecycle record in active alerts database',
  inputs: [
    { id: 'trigger', name: 'Trigger', type: 'boolean', direction: 'input' },
  ],
  outputs: [
    { id: 'alertEvent', name: 'Alert Event', type: 'event', direction: 'output' },
  ],
  configSchema: DashboardAlertConfigSchema,
  defaultConfig: {
    severity: 'warning',
    title: 'High Temperature Detected',
    cooldownSeconds: 60,
  },
};

// 9. Notify Node
export const NotifyConfigSchema = z.object({
  channel: z.enum(['mock', 'sms', 'webhook', 'email']),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  template: z.string().min(1, 'Message template is required'),
});
export type NotifyConfig = z.infer<typeof NotifyConfigSchema>;

export const NotifyNodeDef: NodeTypeDefinition<NotifyConfig> = {
  type: 'notify',
  label: 'Notify',
  category: 'output',
  description: 'Sends external notification via SMS, Webhook, Email, or Mock adapter',
  inputs: [
    { id: 'event', name: 'Alert Event', type: 'event', direction: 'input' },
  ],
  outputs: [],
  configSchema: NotifyConfigSchema,
  defaultConfig: {
    channel: 'mock',
    recipients: ['+15550199'],
    template: 'Alert: {{title}} on device {{deviceId}} with value {{value}}',
  },
};

// 10. Logger Node
export const LoggerNodeConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn']),
  redact: z.boolean().default(true),
});
export type LoggerNodeConfig = z.infer<typeof LoggerNodeConfigSchema>;

export const LoggerNodeDef: NodeTypeDefinition<LoggerNodeConfig> = {
  type: 'logger',
  label: 'Logger / Diagnostic',
  category: 'output',
  description: 'Logs diagnostic telemetry with automatic secret redaction',
  inputs: [
    { id: 'input_num', name: 'Numeric Stream', type: 'number', direction: 'input' },
  ],
  outputs: [
    { id: 'passthrough', name: 'Passthrough', type: 'number', direction: 'output' },
  ],
  configSchema: LoggerNodeConfigSchema,
  defaultConfig: {
    level: 'info',
    redact: true,
  },
};
