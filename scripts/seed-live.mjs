// Seed script that calls the live running API
const API_BASE = 'http://localhost:4000';

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Error POST ${path}:`, data);
  }
  return data;
}

async function main() {
  console.log('Seeding devices...');
  const dev1 = await post('/api/devices', {
    tenantId: 'factory-1',
    id: 'turbine-01',
    name: 'Steam Turbine Alpha (Bay 1)',
    type: 'turbine'
  });
  console.log('Device 1:', dev1.data?.device?.id, 'API Key:', dev1.data?.apiKey);

  const dev2 = await post('/api/devices', {
    tenantId: 'factory-1',
    id: 'turbine-02',
    name: 'Steam Turbine Beta (Bay 2)',
    type: 'turbine'
  });
  console.log('Device 2:', dev2.data?.device?.id, 'API Key:', dev2.data?.apiKey);

  const dev3 = await post('/api/devices', {
    tenantId: 'factory-1',
    id: 'pump-01',
    name: 'Coolant Circulation Pump 1',
    type: 'pump'
  });
  console.log('Device 3:', dev3.data?.device?.id, 'API Key:', dev3.data?.apiKey);

  console.log('Creating demo workflow...');
  const demoGraph = {
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

  const wf = await post('/api/workflows', {
    tenantId: 'factory-1',
    id: 'wf-turbine-mvp',
    name: 'Industrial Turbine Overheat Protection',
    description: 'Turbine Sensor -> Moving Average -> Threshold -> Dashboard Alert -> Mock SMS',
    graph: demoGraph
  });
  console.log('Workflow created:', wf.data?.id);

  console.log('Publishing workflow...');
  const pub = await post('/api/workflows/wf-turbine-mvp/publish?tenantId=factory-1', {
    publishedBy: 'system-admin',
    changeSummary: 'Initial seeded release'
  });
  console.log('Workflow published version:', pub.data?.workflow?.version);

  console.log('Starting workflow runtime...');
  const started = await post('/api/workflows/wf-turbine-mvp/start?tenantId=factory-1', {});
  console.log('Workflow started:', started.data?.status);

  console.log('Done!');
}

main().catch(console.error);
