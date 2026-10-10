# NexusFlow: Visual IoT Telemetry & Rule Engine

A production-grade, visual IoT telemetry and rule-engine platform engineered for real-time edge/industrial stream processing, deterministic backtesting, and automated alert dispatch.

---

## ⚡ Quick Start (Running Locally)

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Windows / Linux / macOS** supported natively. (Embedded in-memory MongoDB fallback runs automatically if no external MongoDB instance is supplied).

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend API Server
In a terminal, start the Express API with embedded time-series engine and WebSocket server:
```bash
npm run dev:api
```
- API Server URL: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- WebSocket Server: `ws://localhost:4000/ws`

### 3. Start the Web Builder Frontend
In a second terminal, launch the Vite React Flow development server:
```bash
npm run dev:web
```
- Web Application URL: `http://localhost:5173`

### 4. Seed Demo IoT Devices & Workflow
Run the seed script against the active API server:
```bash
npm run seed:live
```
This automatically registers:
- **Tenant:** `factory-1`
- **Devices:** `turbine-01`, `turbine-02`, `pump-01`
- **Workflow:** `wf-turbine-mvp` (Turbine Sensor -> Moving Average -> Threshold Condition -> Dashboard Alert -> Mock SMS)
- Publishes Version `2` and starts live stream processing.

---

## 🏗️ Architecture & Workspaces

The platform is organized as a monorepo with strict package boundaries:

```
project1/
├── apps/
│   ├── api/                   # Express, native ws, MongoDB Time Series, REST endpoints
│   └── web/                   # React 18, @xyflow/react, Tailwind/vanilla CSS, WebSocket client
├── packages/
│   ├── shared/                # Zod schemas, TypeScript contracts (telemetry, nodes, alerts)
│   ├── workflow-engine/       # Pure stream operator DAG runtime, Kahn validator, ReplayEngine
│   └── notifiers/             # Mock, Webhook (exponential backoff/jitter), SMS adapters
├── services/
│   └── simulator/             # Mulberry32 deterministic PRNG generator & 5 industrial scenarios
├── docs/                      # Architecture Decision Records (ADRs) & telemetry specs
│   ├── adr-001-websockets.md
│   ├── adr-002-buffering.md
│   └── telemetry-contract.md
└── scripts/
    └── seed-live.mjs          # HTTP seeding script for live runtime
```

---

## 🧪 Testing

The repository contains 74 automated unit, property-based, and integration tests:

```bash
# Run all tests across monorepo packages
npm run test

# Type-check all packages
npm run typecheck
```

### Key Test Suites:
- **`packages/workflow-engine`**:
  - Kahn algorithm cycle & disconnection validation (99.65% statement coverage)
  - Mathematical property tests (`fast-check`) proving sliding window mean calculations and per-device state isolation across 100+ randomized iterations
  - Hysteresis boundary safety
- **`apps/api`**:
  - RFC 6455 WebSockets authentication & broadcast
  - Telemetry deduplication (`eventId`), out-of-order event handling, and 60s lateness quarantine
  - Alert State Machine lifecycle (`OK -> PENDING -> FIRING -> ACKNOWLEDGED -> RESOLVED`)
  - Notification dispatch failure isolation

---

## 📡 REST API & Streaming Reference

### Ingest Telemetry
```http
POST /api/telemetry?tenantId=factory-1
Headers:
  x-device-api-key: <deviceApiKey>
  Content-Type: application/json

Body:
{
  "deviceId": "turbine-01",
  "timestamp": "2026-10-10T04:47:25.847Z",
  "measurements": {
    "temperature": { "value": 92.5, "unit": "celsius" }
  }
}
```
*Returns `202 Accepted` for buffered ingestion or `201 Created` with `?durable=true`.*

### WebSockets Endpoint
Connect to `ws://localhost:4000/ws` with query params `?tenantId=factory-1` to subscribe to:
- `telemetry` (live stream readings)
- `node_execution` (real-time node badge overlays)
- `alert` (firing, acknowledged, and resolved alerts)

---

## 🛡️ License
MIT
