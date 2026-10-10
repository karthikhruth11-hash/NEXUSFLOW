import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MovingAverageOperator } from '../src/operators/MovingAverageOperator.js';
import { ThresholdConditionOperator } from '../src/operators/ThresholdConditionOperator.js';

describe('Property-Based Tests (fast-check)', () => {
  it('Property: Per-device state isolation — device A readings never affect device B window', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            device: fc.constantFrom('device-A', 'device-B'),
            value: fc.float({ min: 0, max: 100, noNaN: true }),
            timeOffsetMs: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 10, maxLength: 100 }
        ),
        (events) => {
          const operator = new MovingAverageOperator(
            { workflowId: 'test-wf', nodeId: 'avg-prop' },
            { mode: 'count', size: 5, minSamples: 1 }
          );

          let expectedSamplesA: number[] = [];
          let expectedSamplesB: number[] = [];
          let currentTime = 1000;

          for (const ev of events) {
            currentTime += ev.timeOffsetMs;
            operator.process('input', {
              deviceId: ev.device,
              timestamp: new Date(currentTime).toISOString(),
              eventTimeMs: currentTime,
              value: ev.value,
            });

            if (ev.device === 'device-A') {
              expectedSamplesA.push(ev.value);
              if (expectedSamplesA.length > 5) expectedSamplesA.shift();
            } else {
              expectedSamplesB.push(ev.value);
              if (expectedSamplesB.length > 5) expectedSamplesB.shift();
            }

            // Verify actual isolated buffer against expected isolated buffer
            const actualSamplesA = operator.getWindowSamples('device-A');
            const actualSamplesB = operator.getWindowSamples('device-B');

            expect(actualSamplesA.length).toBe(expectedSamplesA.length);
            expect(actualSamplesB.length).toBe(expectedSamplesB.length);

            for (let i = 0; i < actualSamplesA.length; i++) {
              expect(actualSamplesA[i]).toBe(expectedSamplesA[i]);
            }
            for (let i = 0; i < actualSamplesB.length; i++) {
              expect(actualSamplesB[i]).toBe(expectedSamplesB[i]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Moving average window correctness — equals arithmetic mean of samples within window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // window size N
        fc.array(fc.float({ min: 10, max: 100, noNaN: true }), { minLength: 10, maxLength: 50 }),
        (windowSize, values) => {
          const operator = new MovingAverageOperator(
            { workflowId: 'test-wf', nodeId: 'avg-correct' },
            { mode: 'count', size: windowSize, minSamples: windowSize }
          );

          const slidingBuffer: number[] = [];
          let time = 1000;

          for (const val of values) {
            time += 1000;
            slidingBuffer.push(val);
            if (slidingBuffer.length > windowSize) {
              slidingBuffer.shift();
            }

            const out = operator.process('input', {
              deviceId: 'test-device',
              timestamp: new Date(time).toISOString(),
              eventTimeMs: time,
              value: val,
            });

            if (slidingBuffer.length === windowSize) {
              expect(out.length).toBe(1);
              const expectedMean =
                Math.round((slidingBuffer.reduce((a, b) => a + b, 0) / windowSize) * 1000) / 1000;
              expect(out[0].message.value).toBeCloseTo(expectedMean, 2);
            } else {
              expect(out.length).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Threshold Hysteresis — once breached, remains in breach until value strictly < hysteresis', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 50, max: 80, noNaN: true }), // hysteresis
        fc.float({ min: 81, max: 120, noNaN: true }), // threshold
        (hysteresis, threshold) => {
          const operator = new ThresholdConditionOperator(
            { workflowId: 'test-wf', nodeId: 'thresh-prop' },
            { operator: '>', threshold, hysteresis }
          );

          let time = 1000;

          // 1. Initial value below threshold
          operator.process('input', {
            deviceId: 'dev1',
            timestamp: new Date(time).toISOString(),
            eventTimeMs: time,
            value: threshold - 5,
          });
          expect(operator.isDeviceBreached('dev1')).toBe(false);

          // 2. Breach threshold
          time += 1000;
          operator.process('input', {
            deviceId: 'dev1',
            timestamp: new Date(time).toISOString(),
            eventTimeMs: time,
            value: threshold + 2,
          });
          expect(operator.isDeviceBreached('dev1')).toBe(true);

          // 3. Fluctuates between hysteresis and threshold -> MUST STAY in breach!
          const inBetweenVal = (hysteresis + threshold) / 2;
          time += 1000;
          operator.process('input', {
            deviceId: 'dev1',
            timestamp: new Date(time).toISOString(),
            eventTimeMs: time,
            value: inBetweenVal,
          });
          expect(operator.isDeviceBreached('dev1')).toBe(true);

          // 4. Value drops below hysteresis -> MUST CLEAR breach!
          time += 1000;
          operator.process('input', {
            deviceId: 'dev1',
            timestamp: new Date(time).toISOString(),
            eventTimeMs: time,
            value: hysteresis - 1,
          });
          expect(operator.isDeviceBreached('dev1')).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
