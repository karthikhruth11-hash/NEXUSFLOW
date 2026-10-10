import { z } from 'zod';

export const MeasurementValueSchema = z.object({
  value: z.number({
    required_error: 'Measurement value is required',
    invalid_type_error: 'Measurement value must be numeric',
  }),
  unit: z.string().trim().max(32).optional(),
});

export const TelemetryPayloadSchema = z.object({
  deviceId: z.string().trim().min(1, 'deviceId cannot be empty').max(128),
  timestamp: z.string().datetime({ message: 'timestamp must be a valid UTC ISO-8601 string' }),
  measurements: z.record(z.string().min(1).max(64), MeasurementValueSchema).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'measurements must contain at least one metric' }
  ),
  eventId: z.string().trim().max(128).optional(),
  sequence: z.number().int().nonnegative().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const BatchTelemetryPayloadSchema = z.object({
  readings: z.array(TelemetryPayloadSchema).min(1).max(500),
});

export type MeasurementValue = z.infer<typeof MeasurementValueSchema>;
export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;
export type BatchTelemetryPayload = z.infer<typeof BatchTelemetryPayloadSchema>;

export interface IngestedTelemetryRecord extends TelemetryPayload {
  tenantId: string;
  ingestTimestamp: string;
  late?: boolean;
}
