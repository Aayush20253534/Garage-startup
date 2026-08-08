# 20. Code Quality Report

## 1. Executive Summary

This report presents a technical audit of the Rovauto backend codebase. While the platform exhibits solid architectural foundations (Prisma type safety, Argon2 password hashing, double-submit CSRF, database outbox pattern), several code smells, large service classes, duplicate routes, and concurrency risks were identified.

---

## 2. Identified Code Smells & Architectural Technical Debt

### 2.1 Fat Service Classes & Monolithic Service Responsibility
- **Finding**: [`bookingLifecycle.service.js`](file:///Users/prateek/Roavuto/server/src/services/bookingLifecycle.service.js) is 51,132 bytes (~51 KB) and handles booking creation, spatial discovery, status transitions, payment checks, and notification dispatches.
- **Finding**: [`garageRequest.service.js`](file:///Users/prateek/Roavuto/server/src/services/garageRequest.service.js) is 39,686 bytes (~39 KB) and combines broadcast state management, controller dispatching, and worker task creation.
- **Risk**: Violates Single Responsibility Principle (SRP), increases risk of regression during minor refactors, and hampers unit testing isolated business paths.

---

### 2.2 Legacy & Duplicate Route Declarations
- **Finding**: [`routes/index.routes.js:150-151`](file:///Users/prateek/Roavuto/server/src/routes/index.routes.js#L150-L151) mounts two parallel garage wallet routers:
  ```javascript
  router.use("/garage/wallet", newGarageWalletRoutes);
  router.use("/garage/wallet-legacy", garageWalletRoutes);
  ```
- **Risk**: Exposes legacy routes that can confuse API consumers, increase attack surface, and duplicate financial logic.

---

### 2.3 Single-Instance In-Memory Background Workers (Scaling Bottleneck)
- **Finding**: Background loops in [`server.js`](file:///Users/prateek/Roavuto/server/src/server.js) (`garageSearchWorker`, `systemIssueAutoResolver`, `applicationEmailOutboxWorker`) use `setInterval` inside the main process without Redis distributed locking (`redlock`).
- **Risk**: If the server is deployed across multiple horizontal instances (e.g. Render scaling instances or Kubernetes pods), workers will run concurrently on every node, producing duplicate broadcast dispatches and duplicate emails.

---

### 2.4 In-Memory Concurrency Limiters
- **Finding**: Middlewares [`concurrencyLimit.middleware.js`](file:///Users/prateek/Roavuto/server/src/middlewares/concurrencyLimit.middleware.js) and [`keyedConcurrencyLimit.middleware.js`](file:///Users/prateek/Roavuto/server/src/middlewares/keyedConcurrencyLimit.middleware.js) track active requests using local JS counters (`activeCount`).
- **Risk**: In a multi-node cluster, concurrency limits are per-node rather than global, reducing their effectiveness against traffic spikes.

---

### 2.5 REST Polling vs. WebSockets for Live Driver Tracking
- **Finding**: Vehicle pickup/drop-off tracking relies on periodic client HTTP GET requests to `/api/v1/bookings/:id/tracking`.
- **Risk**: High database read load under active tracking sessions compared to event-driven WebSockets or Server-Sent Events (SSE).
