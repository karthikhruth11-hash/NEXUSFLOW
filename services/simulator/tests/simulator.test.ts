import { describe, it, expect } from 'vitest';
import { ScenarioGenerator } from '../src/scenarios.js';

describe('Deterministic Simulator Engine', () => {
  it('generates reproducible values given the same seed', () => {
    const gen1 = new ScenarioGenerator({
      deviceId: 'turbine-A',
      scenario: 'normal',
      seed: 42,
    });
    const gen2 = new ScenarioGenerator({
      deviceId: 'turbine-A',
      scenario: 'normal',
      seed: 42,
    });

    const reading1 = gen1.generateNext('2026-10-09T12:00:00.000Z');
    const reading2 = gen2.generateNext('2026-10-09T12:00:00.000Z');

    expect(reading1).not.toBeNull();
    expect(reading2).not.toBeNull();
    expect(reading1?.measurements.temperature.value).toBe(reading2?.measurements.temperature.value);
    expect(reading1?.measurements.vibration.value).toBe(reading2?.measurements.vibration.value);
  });

  it('breach scenario ramps temperature past 80°C threshold', () => {
    const gen = new ScenarioGenerator({
      deviceId: 'turbine-breach',
      scenario: 'breach',
      baseTemperature: 68.0,
      seed: 99,
    });

    const readings = [];
    for (let i = 0; i < 8; i++) {
      const r = gen.generateNext();
      if (r) readings.push(r);
    }

    const lastTemp = readings[readings.length - 1].measurements.temperature.value;
    expect(lastTemp).toBeGreaterThan(80.0);
  });

  it('silence scenario ceases emitting after tick 2', () => {
    const gen = new ScenarioGenerator({
      deviceId: 'turbine-silent',
      scenario: 'silence',
      seed: 123,
    });

    const r1 = gen.generateNext();
    const r2 = gen.generateNext();
    const r3 = gen.generateNext();

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r3).toBeNull();
  });
});
