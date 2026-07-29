# Rovauto Server

> Backend reference verified against the repository on 28 July 2026.

The server is a Node.js 22+/Express 5 API backed by PostgreSQL/PostGIS through Prisma 7 and by Redis for cache, rate limits, and operational coordination. It owns authentication, authorization, bookings, payments, garage dispatch, tracking, evidence, worker-task links, customer warranty projections, support, integrations, and background jobs.

## Runtime structure

```text
src/
|-- app.js                          Express middleware, health, CSRF, route mount
|-- server.js                       Startup, configuration validation, shutdown
|-- routes/                         Shared/public/garage routes
|-- customer/                       Customer controllers, routes, services, knowledge
|-- garage/                         Garage application, controller, and wallet modules
|-- admin/                          Staff operations, System Health, catalogues
|-- customerSupport/                Separate support portal API
|-- maps/                           Geocoding, routing, and tracking services
|-- services/                       Cross-domain lifecycle, dispatch, worker-task services
|-- middlewares/                    Auth, CSRF, upload, limits, validation, errors
|-- config/                         Prisma, Redis, providers
|-- scripts/                        Seed, backup, recovery, cleanup, smoke tests
`-- utils/                          Errors, responses, phone, cache, security helpers
```

## Startup and background work

Production startup generates/checks the Prisma client before launching `src/server.js`. Critical configuration is validated before normal traffic. In-process jobs currently include garage search, garage-application email outbox processing, session cleanup, issue auto-resolution, and scheduled operational work.

Because workers share the web process, deployment with multiple replicas must preserve idempotency and distributed claiming. Redis is not a durable job queue.

## API and health

The API root is `/api/v1`.

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health` | PostgreSQL/Redis readiness |
| `GET /health/ready` | Readiness alias |
| `GET /api/v1/csrf-token` | Browser CSRF token |
| `GET /api/v1/warranties` | Customer completed-booking warranty projection |
| `GET /api/v1/worker-tasks/:token` | Public token-scoped worker task |
| `GET /api/v1/admin/integration-health` | Staff integration checks |
| `GET /api/v1/admin/system-issues` | Staff issue queue |

The public worker-task endpoints are rate-limited and token-scoped. Manager endpoints under `/api/v1/garage/worker-tasks` require `ADMIN`, `SUB_ADMIN`, or the assigned `GARAGE_OWNER`.

## Identity and sessions

- Customers, garage owners, and garage controllers use role-specific records and revocable sessions.
- `StaffAccount` supports `ADMIN`, `SUB_ADMIN`, and `INTERN` with database sessions and two-factor login challenges.
- Customer support has a separate account/session family and cookie.
- Browser authentication is cookie-based and requires CSRF for unsafe requests.
- The mobile client is being built around bearer tokens; production backend support for that contract must be explicitly completed and tested.
- Worker-task links are not accounts. Their authority is the hash-matched, expiring token for one booking stage.

## Marketplace flow

1. Customer selects city, vehicle, services, and fulfilment type.
2. The server validates service restrictions and approved price ranges.
3. Payment/wallet reconciliation creates or confirms the booking.
4. Progressive garage search checks distance, operational status, fulfilment, brand/model/service scopes, exclusions, and availability.
5. A compatible garage accepts atomically and pays the garage acceptance fee.
6. With controller accounts enabled, existing controller dispatch/assignment runs.
7. With controller accounts disabled, the owner/admin can create a WhatsApp worker task for `HANDOVER` or `DELIVERY`.
8. Pickup uses handover OTP plus 5-15 images and one video before switching to return-to-garage tracking. Self-drop instead lets the authenticated customer share `SELF_DROP_TO_GARAGE`; garage arrival is confirmed with the same before-service evidence and no OTP.
9. Garage arrival is confirmed, service is completed, and post-service evidence starts return delivery plus customer email/notification.
10. The garage/controller/worker shares the delivery route and confirms arrival near the customer.
11. The customer submits Cash or UPI plus the amount paid; the booking remains pending until the garage confirms receipt.
12. Payment confirmation atomically completes the booking, stops the timer, releases the controller, and activates the 30-day Warranty Center card.

## Garage capability rules

A garage is eligible only when:

- It is active, verified, operational, within the search radius, and available.
- Its `fulfillmentMode` supports the booking choice.
- Its supported brands contain the vehicle brand or `ALL`.
- Garage-wide and service-specific exclusions do not block the vehicle.
- Every selected service has an active matching `GarageService` scope.

`BMW / ALL` matches BMW X1, X3, and other BMW models. A specific model scope matches only that model. The final capability check is repeated immediately before dispatch and inside acceptance to prevent stale eligibility.

## Worker-task mode

Worker links are enabled only when `Garage.controllerAccountsEnabled` is false.

- Disabling controller accounts revokes active controller sessions.
- Enabling controller accounts revokes active/in-progress worker tasks.
- Creating a new task for the same booking and task type revokes the older active task.
- Tokens are 32 random bytes encoded with base64url; only SHA-256 hashes are stored.
- TTL is 1-48 hours; default is `WORKER_TASK_TTL_HOURS` or 12 hours.
- Public responses hide the customer phone and financial data.
- Self-drop has one customer-originated `SELF_DROP_TO_GARAGE` journey. Garage/controller/worker may view it, but only the booking customer can publish those points; no second self-drop route is created.
- Browser tracking points are linked through `workerTaskId` and partitioned into pickup-to-customer, return-to-garage, and delivery-to-customer phases.
- The worker delivery task can submit service evidence, confirm arrival near the customer, and confirm a pending final payment.

## Customer warranties

There is no `Warranty` database model. `GET /api/v1/warranties` queries the authenticated customer's completed bookings with an assigned garage and derives:

- `warrantyId` as `W-<bookingCode>`
- selected services
- vehicle and garage
- activation time
- expiry time
- active/expired status
- remaining days

Activation prefers `finalPaymentConfirmedAt`, then `customerAcceptedAt`, then `deliveredAt`, then `updatedAt`. Duration is 30 days.

## Environment families

| Family | Main variables |
| --- | --- |
| Core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` |
| Origins/bodies | `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, body limits |
| Redis | `REDIS_URL`, connection/command/cache timeouts, rate-limit settings |
| Cashfree | app ID, secret, environment, API version, webhook/signature settings |
| Maps/tracking | Google Maps/geocoding/routes/roads/tracking settings |
| Media | Cloudinary credentials, temp directory, upload concurrency |
| Email/OTP | Resend credentials/sender, OTP limits and cooldowns |
| WhatsApp | phone number ID, token, app secret, webhook, templates |
| Worker task | `WHATSAPP_WORKER_TASK_TEMPLATE`, template language, `WORKER_TASK_TTL_HOURS` |
| Push/Firebase | Firebase Admin and VAPID settings |
| Search/jobs | garage search, outbox, session cleanup, issue resolver |
| AI | Groq model, timeout, and chatbot rate settings |
| Integration Health | check cache/timeout overrides where configured |
| Recovery | backup directory, recovery database, deployment smoke variables |

Do not commit `.env`. `VITE_*` and `EXPO_PUBLIC_*` are client-visible and are not server secret storage.

## Commands

Development and validation:

```bash
npm ci
npm run prisma:validate
npm run prisma:generate
npm run prisma:check-client
npm test
npm run dev
```

Release:

```bash
npm ci
npm run prisma:deploy
npm start
```

Operational:

```bash
npm run db:backup
npm run db:recovery-drill
npm run deploy:smoke
```

The current schema contains 48 checked-in migrations. The latest migration adds garage worker-task mode:

```text
20260728090000_add_garage_worker_task_mode
```

## Security and API conventions

- Every request receives an `X-Request-ID`.
- Cookie-authenticated unsafe requests require CSRF.
- Cashfree and WhatsApp webhooks bypass CSRF only because their signatures are verified separately.
- Express Validator is the active route validation layer.
- Ownership and state invariants are enforced in services, not only route middleware.
- Redis-backed rate limits fall back to stricter bounded in-memory limits.
- Uploads use explicit count, size, and MIME constraints and are cleaned up on failure.
- Unexpected 5xx responses expose a reference ID, not a stack trace.
- Worker tokens, OTPs, provider tokens, and signed webhook bodies must never be logged.

## Tests

`npm test` runs 70 security/regression files. Recent coverage includes:

- Garage controller enable/disable behaviour
- Worker task token hashing, access, lifecycle, evidence, and tracking
- Fulfilment and vehicle/service eligibility
- Inspection image/video requirements
- Vehicle model photos
- System Health access and provider probes
- Customer warranty derivation

The suite is focused source/regression coverage, not complete integration or E2E coverage. Before production, validate Prisma, apply migrations on staging, build the client, run smoke tests, and manually exercise login, payment, dispatch, handover, tracking, delivery, and warranty display.

## Operational constraints

- Background work runs in the API process.
- Redis is required by production readiness/configuration.
- There is no external durable job queue.
- Browser live tracking may pause when the worker closes/backgrounds the page.
- `seed:intern`, `seed:staff`, and `seed:all` depend on the presence and correctness of `src/seed/seedIntern.js`; verify before use.
- Production rollback should normally keep the newer database schema and deploy forward-compatible code rather than down-migrating casually.
