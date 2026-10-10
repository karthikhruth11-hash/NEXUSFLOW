import { ScenarioGenerator, ScenarioType } from './scenarios.js';

interface CliArgs {
  targetUrl: string;
  apiKey?: string;
  scenario: ScenarioType;
  deviceId: string;
  intervalMs: number;
  count: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const getArg = (name: string, fallback: string): string => {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return fallback;
  };

  return {
    targetUrl: getArg('url', 'http://localhost:4000/api/telemetry'),
    apiKey: getArg('key', ''),
    scenario: (getArg('scenario', 'normal') as ScenarioType) || 'normal',
    deviceId: getArg('device', 'turbine-sensor-01'),
    intervalMs: parseInt(getArg('interval', '1000'), 10),
    count: parseInt(getArg('count', '10'), 10),
  };
}

async function run() {
  const config = parseArgs();
  console.log(`🤖 Starting NexusFlow Telemetry Simulator:`);
  console.log(`   Device: ${config.deviceId}`);
  console.log(`   Scenario: ${config.scenario}`);
  console.log(`   Interval: ${config.intervalMs}ms | Count: ${config.count}`);
  console.log(`   Target: ${config.targetUrl}\n`);

  const generator = new ScenarioGenerator({
    deviceId: config.deviceId,
    scenario: config.scenario,
    seed: 42,
  });

  for (let i = 0; i < config.count; i++) {
    const reading = generator.generateNext();
    if (!reading) {
      console.log(`[Tick ${i + 1}] (Device in silence mode - no telemetry emitted)`);
      continue;
    }

    console.log(
      `[Tick ${i + 1}] ${reading.deviceId} | temp: ${reading.measurements.temperature.value}°C | vib: ${reading.measurements.vibration.value}mm/s`
    );

    if (config.apiKey) {
      try {
        const res = await fetch(config.targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-api-key': config.apiKey,
          },
          body: JSON.stringify(reading),
        });
        const status = res.status;
        console.log(`        -> POST ${status} ${res.statusText}`);
      } catch (err) {
        console.error(`        -> Error sending:`, err instanceof Error ? err.message : err);
      }
    }

    if (i < config.count - 1) {
      await new Promise((r) => setTimeout(r, config.intervalMs));
    }
  }

  console.log('\n✅ Simulation completed.');
}

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js')) {
  run().catch(console.error);
}

export * from './generator.js';
export * from './scenarios.js';
