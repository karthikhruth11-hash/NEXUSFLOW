import { getDb } from '../lib/db.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  TelemetryPayload,
  IngestedTelemetryRecord,
  TelemetryPayloadSchema,
  BatchTelemetryPayloadSchema,
} from '@nexusflow/shared';
import { telemetryBus } from '../adapters/TelemetryBus.js';
import { DeviceService } from './DeviceService.js';

export interface IngestionResult {
  accepted: number;
  rejected: number;
  duplicates: number;
  late: number;
  ingestTimestamp: string;
}

export class TelemetryService {
  // In-memory LRU-style set for deduplicating eventIds within memory window
  private static seenEventIds = new Map<string, number>();
  private static MAX_SEEN_EVENT_IDS = 50000;
  private static DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  private static isDuplicateEvent(eventId?: string): boolean {
    if (!eventId) return false;
    const now = Date.now();

    // Clean expired entries if map grows large
    if (this.seenEventIds.size > this.MAX_SEEN_EVENT_IDS) {
      for (const [id, ts] of this.seenEventIds.entries()) {
        if (now - ts > this.DEDUP_WINDOW_MS) {
          this.seenEventIds.delete(id);
        }
      }
    }

    if (this.seenEventIds.has(eventId)) {
      return true;
    }
    this.seenEventIds.set(eventId, now);
    return false;
  }

  static async processReadings(
    tenantId: string,
    rawPayload: unknown,
    options: { durable?: boolean } = {}
  ): Promise<IngestionResult> {
    const ingestTimestamp = new Date().toISOString();
    const nowMs = Date.now();
    const maxFutureSkewMs = 10 * 1000; // 10 seconds
    const maxLatenessMs = env.MAX_LATENESS_SECONDS * 1000;

    // 1. Normalize into array of readings
    let readings: TelemetryPayload[] = [];
    const batchResult = BatchTelemetryPayloadSchema.safeParse(rawPayload);
    if (batchResult.success) {
      readings = batchResult.data.readings;
    } else {
      const singleResult = TelemetryPayloadSchema.safeParse(rawPayload);
      if (singleResult.success) {
        readings = [singleResult.data];
      } else {
        throw singleResult.error;
      }
    }

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;
    let lateCount = 0;

    const docsToPersist: Array<{
      timestamp: Date;
      meta: { tenantId: string; deviceId: string; late?: boolean };
      measurements: Record<string, { value: number; unit?: string }>;
      eventId?: string;
      sequence?: number;
      ingestTimestamp: string;
      payloadMeta?: Record<string, unknown>;
    }> = [];

    for (const reading of readings) {
      const eventTimeMs = new Date(reading.timestamp).getTime();

      // Check future clock skew
      if (eventTimeMs - nowMs > maxFutureSkewMs) {
        logger.warn(
          { deviceId: reading.deviceId, timestamp: reading.timestamp },
          'Rejected telemetry due to future clock skew'
        );
        rejected++;
        const error = new Error(
          `Timestamp ${reading.timestamp} is more than 10 seconds in the future`
        );
        (error as unknown as { statusCode: number; code: string }).statusCode = 400;
        (error as unknown as { statusCode: number; code: string }).code = 'CLOCK_SKEW_FUTURE';
        throw error;
      }

      // Check duplicate eventId
      if (reading.eventId && this.isDuplicateEvent(reading.eventId)) {
        logger.info({ eventId: reading.eventId }, 'Idempotently dropped duplicate eventId');
        duplicates++;
        accepted++; // Treated as acknowledged/accepted idempotently
        continue;
      }

      // Check lateness
      const isLate = nowMs - eventTimeMs > maxLatenessMs;
      if (isLate) {
        lateCount++;
      }

      const ingestedRecord: IngestedTelemetryRecord = {
        ...reading,
        tenantId,
        ingestTimestamp,
        late: isLate,
      };

      // Exclude late readings from live bus to protect sliding windows
      if (!isLate) {
        telemetryBus.publish(ingestedRecord);
      }

      // Update last seen
      DeviceService.updateLastSeen(tenantId, reading.deviceId, reading.timestamp).catch((err) => {
        logger.error({ err }, 'Failed to update device lastSeen');
      });

      docsToPersist.push({
        timestamp: new Date(reading.timestamp),
        meta: {
          tenantId,
          deviceId: reading.deviceId,
          late: isLate,
        },
        measurements: reading.measurements,
        eventId: reading.eventId,
        sequence: reading.sequence,
        ingestTimestamp,
        payloadMeta: reading.meta,
      });

      accepted++;
    }

    // 2. Persist to MongoDB
    if (docsToPersist.length > 0) {
      const db = getDb();
      const col = db.collection('telemetry');
      if (options.durable) {
        await col.insertMany(docsToPersist);
      } else {
        // Asynchronous non-blocking persistence
        col.insertMany(docsToPersist).catch((err) => {
          logger.error({ err }, 'Asynchronous persistence of telemetry failed');
        });
      }
    }

    return {
      accepted,
      rejected,
      duplicates,
      late: lateCount,
      ingestTimestamp,
    };
  }

  static async queryHistorical(
    tenantId: string,
    deviceId: string,
    from?: string,
    to?: string,
    limit: number = 100
  ) {
    const db = getDb();
    const query: Record<string, unknown> = {
      'meta.tenantId': tenantId,
      'meta.deviceId': deviceId,
    };

    if (from || to) {
      const timeFilter: Record<string, Date> = {};
      if (from) timeFilter.$gte = new Date(from);
      if (to) timeFilter.$lte = new Date(to);
      query.timestamp = timeFilter;
    }

    const docs = await db
      .collection('telemetry')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(limit, 1000))
      .toArray();

    return docs.map((doc) => ({
      deviceId: doc.meta.deviceId,
      timestamp: (doc.timestamp as Date).toISOString(),
      measurements: doc.measurements,
      eventId: doc.eventId,
      sequence: doc.sequence,
      meta: doc.payloadMeta,
      late: doc.meta.late,
      ingestTimestamp: doc.ingestTimestamp,
    }));
  }
}
