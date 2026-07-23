# Rovauto Server

> Backend reference verified against the repository on 23 July 2026.

The server is a Node.js 22+/Express 5 API backed by PostgreSQL/PostGIS through Prisma 7. It owns authentication, authorization, marketplace state, financial reconciliation, garage dispatch, support operations, integrations, background workers, and operational recovery.

## Runtime structure

```text
src/
|-- app.js                         HTTP middleware, health, routes, errors
|-- server.js                      startup, workers, signals, shutdown
|-- config/                        Prisma, Redis, cookies, environment, providers
|-- routes/                        public/mixed/garage platform routes
|-- customer/                      customer controllers/services/routes/knowledge
|-- garage/                        applications, owners, controllers, wallets
|-- admin/                         staff administration and moderation
|-- customerSupport/               separate support portal
|-- maps/                          Google Maps and booking tracking
|-- services/                      dispatch, lifecycle, notifications, issues
|-- middlewares/                   auth, role, CSRF, validation, limits, upload
|-- scripts/                       backup, recovery, smoke, cleanup
`-- utils/                         response, errors, cache, distance, providers
```

Canonical design: [`../important/Architecture.md`](../important/Architecture.md). Schema guide: [`../important/Database.md`](../important/Database.md). Security: [`../important/security.md`](../important/security.md).

## Startup and workers

`src/server.js` validates production configuration, connects to PostgreSQL, starts HTTP, and starts four in-process workers:

1. Progressive garage search.
2. System-issue auto-resolution when enabled.
3. Garage-application email outbox.
4. Session-retention cleanup.

`SIGTERM`, `SIGINT`, uncaught exceptions, and unhandled rejections stop workers, close HTTP, disconnect Prisma/Redis, and enforce a shutdown timeout. Because workers are in-process, run only the intended API replica count until worker claiming/leader election is designed for multi-replica execution.

## API and health

```text
Root:             GET /
Liveness:         GET /health/live
Readiness:        GET /health or /health/ready
CSRF bootstrap:   GET /api/v1/csrf-token
API base:         /api/v1
```

Readiness checks PostgreSQL and Redis and returns `503` when either fails. The complete route inventory is maintained in [`../important/Architecture.md`](../important/Architecture.md).

## Authentication model

| Actor | Account table | Session table | Role/account type |
| --- | --- | --- | --- |
| Customer | `User` | `UserSession` | `CUSTOMER` / `USER` |
| Garage owner | `GarageOwner` | `GarageOwnerSession` | `GARAGE_OWNER` / `USER` |
| Garage controller | `GarageController` | `GarageControllerSession` | `GARAGE_CONTROLLER` / `GARAGE_CONTROLLER` |
| Admin/intern | `StaffAccount` | `StaffSession` | `ADMIN` or `INTERN` / `STAFF` |
| Customer support | `CustomerSupportAccount` | `CustomerSupportSession` | `CUSTOMER_SUPPORT` / `CUSTOMER_SUPPORT` |

JWTs are held in HttpOnly cookies and include a session ID. Password changes, deactivation, explicit revocation, expiry, and retention cleanup invalidate sessions. Staff/admin login uses a second-factor challenge where required.

## Core marketplace flow

1. Customer creates a `PENDING_PAYMENT` booking from a saved vehicle, confirmed location, and active/priced services.
2. Customer wallet and Cashfree pay the platform fee with idempotent reservation/finalization.
3. Confirmed payment changes the booking to `SEARCHING_GARAGE`.
4. The worker broadcasts through 5 km, 10 km, and 20 km rounds and repeats cycles.
5. The first eligible garage with sufficient acceptance-fee balance wins atomically.
6. A garage controller may be assigned; unrelated controller/customer details remain hidden.
7. Handover OTP plus pickup images changes the booking to `IN_PROGRESS`.
8. Delivery images and garage delivery checkpoint precede customer acceptance.
9. Customer acceptance records final service amount and changes the booking to `COMPLETED`.

See [`../garage-partner-flow.md`](../garage-partner-flow.md).

## Environment

Production validation requires:

- Strong `JWT_SECRET` and `CASHFREE_WEBHOOK_SECRET`.
- `DATABASE_URL`, `REDIS_URL`, Cashfree credentials/notify URL, Cloudinary credentials.
- Firebase Admin project/client/private key.
- Resend API key and a configured sender.
- `ADMIN_2FA_EMAIL`.
- WhatsApp verify token and app secret.
- Web Push public/private VAPID keys.
- HTTPS client/frontend and Cashfree callback URLs.
- `CASHFREE_ENV=production`, webhook signatures enabled, email OTP delivery enabled, and WhatsApp debug logs disabled.

Active configuration families:

| Family | Variables |
| --- | --- |
| Core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_COOKIE_MAX_AGE_MS` |
| Origins/bodies | `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `JSON_BODY_LIMIT`, `URLENCODED_BODY_LIMIT` |
| Redis/cache | `REDIS_URL`, connect/command/cache timeouts, cache TTL variables, `RATE_LIMIT_*` |
| Cashfree | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, API version, notify/webhook/signature/timeout settings |
| Maps | `GOOGLE_MAPS_*`, geocoding, places, route matrix, roads, tracking, optimization settings |
| Media | `CLOUDINARY_*`, `UPLOAD_TEMP_DIR`, complaint/support upload concurrency |
| Email/OTP | `RESEND_*`, `EMAIL_FROM`, `EMAIL_OTP_DELIVERY`, OTP/cooldown variables |
| WhatsApp/SMS | `WHATSAPP_*`, `META_APP_SECRET`, `SMS_*`, `FAST2SMS_API_KEY` |
| Push/Firebase | Firebase Admin variables and `WEB_PUSH_VAPID_*` |
| Search/workers | `GARAGE_SEARCH_*`, `GARAGE_GEO_LOOKUP_RADIUS_KM`, outbox, session cleanup, issue resolver |
| AI | `GROQ_API_KEY`, `GROQ_MODEL`, `CHATBOT_GROQ_*`, rate/timeout settings |
| Operations | `BACKUP_DIRECTORY`, `RECOVERY_TEST_DATABASE_URL`, `SMOKE_*`, shutdown/failure-report timeouts |

Do not commit `.env` or provider credentials. `VITE_*` values are browser-visible and are not server secret storage.

## Commands

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

The `db:delete-*` and `db:nuke-users` scripts are destructive. Follow [`docs/RECOVERY_RUNBOOK.md`](docs/RECOVERY_RUNBOOK.md).

## Security and API conventions

- All browser requests receive an `X-Request-ID`.
- Unsafe cookie-authenticated requests require the CSRF cookie/header pair.
- Cashfree and WhatsApp webhook paths bypass CSRF but require provider signature verification.
- Express Validator is the active validation layer; Zod is installed but not used by current source.
- Service methods enforce ownership and domain invariants; route guards alone are insufficient.
- Redis-backed limits fall back to stricter bounded in-memory buckets.
- Uploaded files have count/size/type constraints and are stored through Cloudinary.
- Operational 4xx errors may expose an allow-listed code; unexpected/5xx errors return only a reference ID.

## Tests

`npm test` runs 50 files under `test/security/` with Node's test runner. Coverage includes authorization/IDOR, CSRF, OTP/session revocation, Cashfree verification and idempotency, wallet split/refunds, price moderation, garage/controller access, city restrictions, uploads, operational logging, production hardening, and user-interface source regressions.

This is a focused regression suite, not complete integration/E2E coverage. Before release, also validate Prisma, build the client, apply migrations to a staging database, run the smoke script, and manually exercise login, booking, payment, dispatch, handover, and delivery.

## Known operational constraints

- Background workers share the web process; multi-replica safety needs explicit distributed claiming/leadership.
- Redis is required by production validation and readiness.
- The API has no external durable job queue.
- `seed:intern`, `seed:staff`, and `seed:all` reference a missing seed file.
- A code rollback should normally remain forward-compatible with the current database schema; do not down-migrate production casually.
