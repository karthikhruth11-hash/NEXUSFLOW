import { describe, it, expect } from 'vitest';
import {
  SensorInputOperator,
  MovingAverageOperator,
  WindowStatsOperator,
  ThresholdConditionOperator,
  ForDurationOperator,
  AbsenceHeartbeatOperator,
  BooleanLogicOperator,
  DashboardAlertOperator,
} from '../src/operators/index.js';

describe('Operators Unit Tests', () => {
  const baseMsg = (deviceId: string, value: any, timeMs: number = 1000) => ({
    deviceId,
    timestamp: new Date(timeMs).toISOString(),
    eventTimeMs: timeMs,
    value,
  });

  it('SensorInputOperator filters by deviceId and measurement', () => {
    const op = new SensorInputOperator(
      { workflowId: 'wf1', nodeId: 'sensor1' },
      { deviceId: 'turbine-01', measurement: 'temperature' }
    );

    const matchMsg = {
      ...baseMsg('turbine-01', null),
      rawEvent: {
        measurements: {
          temperature: { value: 75.5, unit: 'celsius' },
        },
      },
    };

    const mismatchMsg = {
      ...baseMsg('pump-02', null),
      rawEvent: {
        measurements: {
          temperature: { value: 75.5 },
        },
      },
    };

    const out1 = op.process('', matchMsg);
    expect(out1.length).toBe(2);
    expect(out1.find((o) => o.portId === 'value')?.message.value).toBe(75.5);

    const out2 = op.process('', mismatchMsg);
    expect(out2.length).toBe(0);
  });

  it('MovingAverageOperator calculates count window mean correctly', () => {
    const op = new MovingAverageOperator(
      { workflowId: 'wf1', nodeId: 'avg1' },
      { mode: 'count', size: 3, minSamples: 2 }
    );

    // Sample 1: length 1 < minSamples 2 -> no output
    const out1 = op.process('input', baseMsg('dev1', 10, 1000));
    expect(out1.length).toBe(0);

    // Sample 2: [10, 20] -> avg = 15
    const out2 = op.process('input', baseMsg('dev1', 20, 2000));
    expect(out2.length).toBe(1);
    expect(out2[0].message.value).toBe(15);

    // Sample 3: [10, 20, 30] -> avg = 20
    const out3 = op.process('input', baseMsg('dev1', 30, 3000));
    expect(out3[0].message.value).toBe(20);

    // Sample 4: [20, 30, 40] (10 pushed out) -> avg = 30
    const out4 = op.process('input', baseMsg('dev1', 40, 4000));
    expect(out4[0].message.value).toBe(30);
  });

  it('ThresholdConditionOperator with hysteresis prevents flickering', () => {
    // Threshold 80, hysteresis 75
    const op = new ThresholdConditionOperator(
      { workflowId: 'wf1', nodeId: 'thresh1' },
      { operator: '>', threshold: 80, hysteresis: 75 }
    );

    // Value 78: below 80 -> false
    expect(op.process('input', baseMsg('d1', 78, 1000))[0].message.value).toBe(false);

    // Value 82: exceeds 80 -> true (enters breach)
    expect(op.process('input', baseMsg('d1', 82, 2000))[0].message.value).toBe(true);

    // Value 78: drops to 78 (below threshold 80, but ABOVE clear threshold 75) -> stays true!
    expect(op.process('input', baseMsg('d1', 78, 3000))[0].message.value).toBe(true);

    // Value 74: drops below hysteresis 75 -> clears to false!
    expect(op.process('input', baseMsg('d1', 74, 4000))[0].message.value).toBe(false);

    // Value 76: below threshold 80 -> stays false
    expect(op.process('input', baseMsg('d1', 76, 5000))[0].message.value).toBe(false);
  });

  it('ForDurationOperator emits true only after condition holds continuously for duration', () => {
    const op = new ForDurationOperator(
      { workflowId: 'wf1', nodeId: 'debounce1' },
      { durationSeconds: 5 }
    );

    // At t=0s: true -> elapsed 0s < 5s -> false
    expect(op.process('input', baseMsg('d1', true, 0))[0].message.value).toBe(false);

    // At t=3s: true -> elapsed 3s < 5s -> false
    expect(op.process('input', baseMsg('d1', true, 3000))[0].message.value).toBe(false);

    // At t=5s: true -> elapsed 5s >= 5s -> true!
    expect(op.process('input', baseMsg('d1', true, 5000))[0].message.value).toBe(true);

    // At t=6s: condition resets to false -> clears
    expect(op.process('input', baseMsg('d1', false, 6000))[0].message.value).toBe(false);
  });

  it('BooleanLogicOperator executes AND with latest-held inputs', () => {
    const op = new BooleanLogicOperator(
      { workflowId: 'wf1', nodeId: 'bool1' },
      { operation: 'AND', alignmentPolicy: 'latest_held', holdDurationSeconds: 10 }
    );

    // in_a = true at t=1000
    const out1 = op.process('in_a', baseMsg('d1', true, 1000));
    expect(out1[0].message.value).toBe(false); // in_b not yet received

    // in_b = true at t=3000 (within 10s hold window)
    const out2 = op.process('in_b', baseMsg('d1', true, 3000));
    expect(out2[0].message.value).toBe(true); // both true!
  });

  it('DashboardAlertOperator suppresses alerts during cooldown', () => {
    const op = new DashboardAlertOperator(
      { workflowId: 'wf1', nodeId: 'alert1' },
      { severity: 'critical', title: 'High Temp', cooldownSeconds: 30 }
    );

    // Breach at t=0s -> alert fires
    const out1 = op.process('trigger', baseMsg('d1', true, 0));
    expect(out1.length).toBe(1);

    // Breach at t=10s (< 30s cooldown) -> suppressed!
    const out2 = op.process('trigger', baseMsg('d1', true, 10000));
    expect(out2.length).toBe(0);

    // Breach at t=35s (> 30s cooldown) -> fires new alert!
    const out3 = op.process('trigger', baseMsg('d1', true, 35000));
    expect(out3.length).toBe(1);
  });
});
