import { connectDb, disconnectDb } from '../lib/db.js';
import { DeviceService } from '../services/DeviceService.js';
import { WorkflowService } from '../services/WorkflowService.js';
import { WorkflowDefinition } from '@nexusflow/shared';

export const demoMvpWorkflow: WorkflowDefinition = {
  schemaVersion: '1.0.0',
  nodes: [
    {
      id: 'node-sensor',
      type: 'sensor-input',
      label: 'Turbine Sensor',
      position: { x: 80, y: 150 },
      config: {
        deviceId: 'turbine-01',
        measurement: 'temperature',
        unit: 'celsius',
      },
    },
    {
      id: 'node-avg',
      type: 'moving-average',
      label: 'Moving Average (5 samples)',
      position: { x: 340, y: 150 },
      config: {
        mode: 'count',
        size: 5,
        minSamples: 3,
      },
    },
    {
      id: 'node-thresh',
      type: 'threshold-condition',
      label: 'Threshold Condition (> 80°C, clear 75°C)',
      position: { x: 620, y: 150 },
      config: {
        operator: '>',
        threshold: 80.0,
        hysteresis: 75.0,
      },
    },
    {
      id: 'node-alert',
      type: 'dashboard-alert',
      label: 'Dashboard Alert',
      position: { x: 920, y: 150 },
      config: {
        severity: 'critical',
        title: 'Turbine Overheat Danger',
        cooldownSeconds: 60,
      },
    },
    {
      id: 'node-notify',
      type: 'notify',
      label: 'Mock SMS Alert',
      position: { x: 1200, y: 150 },
      config: {
        channel: 'sms',
        recipients: ['+1-555-0199-FACTORY'],
        template: 'URGENT: Turbine {{deviceId}} temperature exceeded {{threshold}}°C! Observed: {{observedValue}}°C',
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'node-sensor', sourcePort: 'value', target: 'node-avg', targetPort: 'input' },
    { id: 'e2', source: 'node-avg', sourcePort: 'output', target: 'node-thresh', targetPort: 'input' },
    { id: 'e3', source: 'node-thresh', sourcePort: 'output', target: 'node-alert', targetPort: 'trigger' },
    { id: 'e4', source: 'node-alert', sourcePort: 'alertEvent', target: 'node-notify', targetPort: 'event' },
  ],
  settings: {
    cooldownSeconds: 60,
    maxLatenessSeconds: 60,
    deviceIds: ['turbine-01', 'turbine-02'],
  },
};

export async function seedDemoData() {
  console.log('🌱 Connecting to database to seed demo data...');
  await connectDb();

  console.log('Creating demo IoT devices...');
  const turbine1 = await DeviceService.createDevice({
    tenantId: 'factory-1',
    id: 'turbine-01',
    name: 'Steam Turbine Alpha (Bay 1)',
    type: 'turbine',
  });

  const turbine2 = await DeviceService.createDevice({
    tenantId: 'factory-1',
    id: 'turbine-02',
    name: 'Steam Turbine Beta (Bay 2)',
    type: 'turbine',
  });

  const pump1 = await DeviceService.createDevice({
    tenantId: 'factory-1',
    id: 'pump-01',
    name: 'Coolant Circulation Pump 1',
    type: 'pump',
  });

  console.log('Registering and publishing Demo MVP Workflow...');
  const wf = await WorkflowService.createWorkflow(
    'factory-1',
    'wf-turbine-mvp',
    'Industrial Turbine Overheat Protection',
    demoMvpWorkflow,
    'Deterministic demo workflow: Turbine Sensor -> Moving Average (last 5) -> Threshold (> 80 °C, hysteresis 75 °C) -> Dashboard Alert -> Mock SMS'
  );

  const published = await WorkflowService.publishWorkflow(
    'factory-1',
    'wf-turbine-mvp',
    'system-admin',
    'Initial seeded release v2'
  );

  console.log('\n============================================================');
  console.log('✨ NexusFlow Seed Data Initialized Successfully:');
  console.log('------------------------------------------------------------');
  console.log(`🏢 Tenant:           factory-1`);
  console.log(`⚙️  Workflow ID:      ${wf.id} (Version ${published.workflow.version})`);
  console.log(`📡 Device 1:         turbine-01`);
  console.log(`   API Key:          ${turbine1.apiKey}`);
  console.log(`📡 Device 2:         turbine-02`);
  console.log(`   API Key:          ${turbine2.apiKey}`);
  console.log(`📡 Device 3:         pump-01`);
  console.log(`   API Key:          ${pump1.apiKey}`);
  console.log('============================================================\n');

  return {
    devices: [turbine1, turbine2, pump1],
    workflow: published.workflow,
  };
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDemoData()
    .then(async () => {
      await disconnectDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
