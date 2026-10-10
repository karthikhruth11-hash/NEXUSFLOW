# ADR-001: Selection of Native WebSockets (`ws`) over Socket.IO

## Context
NexusFlow requires bidirectional, low-latency communication between the backend engine and industrial dashboard web clients. Telemetry charts update at frequencies up to 10-50 Hz, and alert state transitions require immediate sub-100ms dispatch.

## Decision
We select standard WebSockets (`ws` library on Node.js and native `WebSocket` API in the browser) rather than Socket.IO.

## Consequences
- **Pros:**
  - Significantly lower connection memory and CPU overhead.
  - No proprietary packet handshake, polling fallback, or custom heartbeat overhead.
  - Zero lock-in: standard HTTP upgrade path, simple JWT token query/header authentication.
- **Cons:**
  - Reconnection and heartbeat monitoring must be handled explicitly in the frontend client (implemented cleanly in a standard hook `useNexusSocket`).
