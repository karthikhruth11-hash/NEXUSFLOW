# ADR-002: Ingestion Response Semantics (202 Accepted vs 201 Created)

## Context
Industrial IoT telemetry streams can fluctuate from low idle traffic to sudden bursts of sensor readings from hundreds of connected PLC gateways. The HTTP ingestion contract must define exact storage and processing guarantees.

## Decision
1. `POST /api/telemetry` defaults to HTTP `202 Accepted`.
   - The payload has passed schema validation, timestamp checks, and device key authorization.
   - It is immediately dispatched to the in-memory `TelemetryBus` (RxJS subject / ring buffer) for zero-latency rule processing.
   - Persistence to MongoDB Time Series occurs asynchronously via batched writes.
2. Synchronous mode is supported via query parameter `?durable=true`.
   - Returns HTTP `201 Created` only after the batch is durably acknowledged by MongoDB storage.

## Consequences
- Allows high throughput without thread blocking during normal streaming operations.
- Critical systems requiring store-and-forward confirmation can use `?durable=true`.
