import { DeterministicRandom } from './generator.js';
import { TelemetryPayload } from '@nexusflow/shared';

export type ScenarioType = 'normal' | 'breach' | 'flapping' | 'burst' | 'silence';

export interface DeviceSimulationConfig {
  deviceId: string;
  scenario: ScenarioType;
  baseTemperature?: number;
  seed?: number;
}

export class ScenarioGenerator {
  private rng: DeterministicRandom;
  private sequence: number = 0;
  private tick: number = 0;
  private config: DeviceSimulationConfig;

  constructor(config: DeviceSimulationConfig) {
    this.config = config;
    this.rng = new DeterministicRandom(config.seed ?? 100);
  }

  generateNext(timestamp: string = new Date().toISOString()): TelemetryPayload | null {
    this.tick++;
    this.sequence++;

    const baseTemp = this.config.baseTemperature ?? 68.0;

    let tempValue = baseTemp;
    let vibration = 1.2 + this.rng.gaussian(0, 0.1);

    switch (this.config.scenario) {
      case 'silence':
        // Returns no telemetry after tick 2
        if (this.tick > 2) {
          return null;
        }
        tempValue = baseTemp + this.rng.gaussian(0, 0.5);
        break;

      case 'breach':
        // Normal until tick 4, then ramps smoothly up to 92°C (exceeding 80°C threshold)
        if (this.tick <= 3) {
          tempValue = baseTemp + this.rng.gaussian(0, 0.8);
        } else {
          tempValue = Math.min(95, baseTemp + (this.tick - 3) * 4.5 + this.rng.gaussian(0, 0.5));
          vibration = 3.5 + this.rng.gaussian(0, 0.3);
        }
        break;

      case 'flapping':
        // Sinusoidal oscillation around 80°C (e.g., 76°C to 84°C)
        tempValue = 80.0 + 5.0 * Math.sin(this.tick * 0.8) + this.rng.gaussian(0, 0.3);
        break;

      case 'burst':
      case 'normal':
      default:
        // Hover around normal operating values
        tempValue = baseTemp + this.rng.gaussian(0, 1.0);
        break;
    }

    return {
      deviceId: this.config.deviceId,
      timestamp,
      measurements: {
        temperature: {
          value: Math.round(tempValue * 10) / 10,
          unit: 'celsius',
        },
        vibration: {
          value: Math.round(Math.max(0, vibration) * 100) / 100,
          unit: 'mm/s',
        },
        rpm: {
          value: Math.round(3000 + this.rng.gaussian(0, 25)),
          unit: 'rpm',
        },
      },
      eventId: `evt-${this.config.deviceId}-${this.sequence}`,
      sequence: this.sequence,
    };
  }

  generateBatch(count: number, intervalMs: number = 1000): TelemetryPayload[] {
    const payloads: TelemetryPayload[] = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const ts = new Date(now - (count - 1 - i) * intervalMs).toISOString();
      const reading = this.generateNext(ts);
      if (reading) {
        payloads.push(reading);
      }
    }
    return payloads;
  }
}
