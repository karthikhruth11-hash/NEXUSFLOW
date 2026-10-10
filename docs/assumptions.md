# NexusFlow Architectural Assumptions

This document records all active engineering assumptions. Each assumption is explicit, documented, and designed to be reversible.

## 1. Monorepo Structure
- **Assumption:** Standard npm workspaces (`workspaces: ["packages/*", "apps/*", "services/*"]`) without proprietary monorepo build daemons.
- **Rationale:** Guarantees standard zero-friction builds and scripts across Windows, macOS, and Linux without native binary tool dependencies.
- **Reversibility:** High. A migration to Turborepo or pnpm can be performed without changing source code.

## 2. Ingestion Protocol & HTTP Semantics
- **Assumption:** `POST /api/telemetry` returns `202 Accepted` by default for buffered ingestion. Clients seeking synchronous durable write confirmation can supply query parameter `?durable=true` to receive `201 Created`.
- **Rationale:** Factory floor devices and gateways can produce high frequency bursts. Non-blocking ingestion prevents HTTP socket exhaustion while allowing the reactive engine to buffer and process immediately.
- **Reversibility:** High. Configurable via server policy flag.

## 3. Realtime Streaming Protocol
- **Assumption:** Standard RFC 6455 WebSockets via the `ws` package in Node.js instead of Socket.IO.
- **Rationale:** Eliminates client-server polling protocol overhead, provides minimal memory footprint per socket connection, and uses typed JSON message envelopes.
- **Reversibility:** Medium. Clean frontend hook wrapper (`useNexusSocket`) isolates protocol semantics.

## 4. Time Semantics & Lateness
- **Assumption:** Every telemetry payload must provide an ISO-8601 UTC timestamp (`timestamp`). The API server appends an `ingestTimestamp`.
- **Lateness Bound:** Telemetry with event timestamp older than `MAX_LATENESS_SECONDS` (default: 60 seconds) is stored in the MongoDB Time Series collection with `{ late: true }`, but discarded from active live streaming windows to avoid retro-active distortion of moving averages and breach states.
- **Clock Skew:** Future timestamps beyond 10 seconds from server clock are rejected (`400 Bad Request`).

## 5. Persistence & Local Fallback
- **Assumption:** Production uses MongoDB 6+ with a Time Series collection for telemetry and standard collections for relational documents. For local development or environments without a running Mongo daemon, `mongodb-memory-server` serves as an automated fallback when `MONGODB_URI` is unset or `memory://`.
- **Rationale:** Immediate developer onboarding without requiring manual service installs, plus reliable deterministic integration tests.

## 6. Engine Boundary
- **Assumption:** `packages/workflow-engine` has zero dependencies on Express, MongoDB, or React. It relies exclusively on pure TypeScript and RxJS, interacting with the system through abstract dependency-injected interfaces (`TelemetryBus`, `StateStore`, `Notifier`, `MetricCollector`).
