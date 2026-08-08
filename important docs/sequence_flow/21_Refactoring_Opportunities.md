# 21. Refactoring Opportunities & Roadmap

## 1. Executive Summary

This document provides a prioritized refactoring roadmap to resolve technical debt, enable multi-node horizontal scaling, and improve maintainability.

---

## 2. Prioritized Refactoring Matrix

| Priority | Task Name | Affected Files | Engineering Effort | Expected Impact |
| :--- | :--- | :--- | :--- | :--- |
| **HIGH** | Decompose `bookingLifecycle.service.js` | [`services/bookingLifecycle.service.js`](file:///Users/prateek/Roavuto/server/src/services/bookingLifecycle.service.js) | 3 Days | High maintainability, easier unit testing. |
| **HIGH** | Add Redis Distributed Locks (`redlock`) to Workers | [`server.js`](file:///Users/prateek/Roavuto/server/src/server.js), `services/*Worker.js` | 1 Day | Enables multi-node horizontal scaling without duplicate dispatches. |
| **HIGH** | Deprecate & Remove Legacy Garage Wallet Routes | [`routes/index.routes.js`](file:///Users/prateek/Roavuto/server/src/routes/index.routes.js), `routes/garageWallet.routes.js` | 0.5 Days | Reduces API surface area and eliminates dead code. |
| **MEDIUM** | Migrate Live Driver Tracking to WebSockets / SSE | [`customer/controllers/booking.controller.js`](file:///Users/prateek/Roavuto/server/src/customer/controllers/booking.controller.js) | 4 Days | 80% reduction in database read queries during active tracking. |
| **MEDIUM** | Replace In-Memory Concurrency Limits with Redis | [`middlewares/concurrencyLimit.middleware.js`](file:///Users/prateek/Roavuto/server/src/middlewares/concurrencyLimit.middleware.js) | 1 Day | Global cluster-wide rate & concurrency enforcement. |
| **LOW** | Extract Worker Loops into Standalone Worker Process | `server.js`, `Dockerfile` | 2 Days | Decouples HTTP web server process from background worker loops. |

---

## 3. High-Priority Refactoring Guides

### Refactoring 1: Decomposing `bookingLifecycle.service.js`

#### Step 1: Create Dedicated Sub-Services
Extract responsibility into three distinct services inside `src/services/booking/`:
1. `bookingCreation.service.js`: Handles `initiateBookingProcess()`, validation of vehicles/locations, price estimate calculations.
2. `bookingStateTransition.service.js`: Handles state machine rules, `transitionBookingStatus()`, `BookingEvent` logging.
3. `bookingCancellation.service.js`: Handles customer & garage cancellations, automatic wallet refund triggers.

#### Step 2: Facade Pattern in `bookingLifecycle.service.js`
Maintain `bookingLifecycle.service.js` as a facade delegating to the sub-services to preserve backward compatibility for existing controller callers.

---

### Refactoring 2: Multi-Node Distributed Worker Locking (`Redlock`)

#### Implementation Pattern:
```javascript
const Redlock = require("redlock");
const redis = require("../config/redis");

const redlock = new Redlock([redis], {
  driftFactor: 0.01,
  retryCount: 0, // Fail immediately if locked by another node
});

async function runGarageSearchWorkerWithLock() {
  let lock;
  try {
    lock = await redlock.acquire(["locks:garage-search-worker"], 14000);
    await executeGarageSearchCycle();
  } catch (err) {
    // Lock held by another node - skip cycle silently
  } finally {
    if (lock) await lock.release().catch(() => {});
  }
}
```
