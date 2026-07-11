# Rovauto Server

The Rovauto server is an Express 5 API for customer booking, garage operations, staff/support portals, payments and wallets, maps/tracking, media, notifications, and platform monitoring. All application endpoints are mounted below `/api/v1`; PostgreSQL is the source of truth and Prisma 7 is the data-access layer.

This README is backend-specific. See the repository [`README.md`](../README.md) for the full-stack quick start and `Detailed Schema.md` at the repository root for the standalone beginner guide.

## Stack

| Area | Current implementation |
| --- | --- |
| Runtime/API | Node.js 20+, CommonJS, Express 5 |
| Database | PostgreSQL, PostGIS, Prisma 7, `@prisma/adapter-pg` |
| Auth/security | JWT cookies, Argon2, revocable database sessions, CSRF, Helmet, CORS, rate limits |
| Validation | Express Validator plus service-level invariants |
| Payments | Cashfree order, verification, webhook, customer wallet, and garage wallet flows |
| Media | Multer memory storage, signature validation, Cloudinary |
| Maps | Google Places, Geocoding, Routes, Route Matrix, Roads, Address Validation, and Route Optimization paths |
| Messaging | Firebase Admin, Resend, generic/Fast2SMS SMS, Meta/generic WhatsApp, Web Push |
| AI | Groq for the support chatbot and address correction fallback |
| Cache | Redis/ioredis with fail-soft cache helpers; PostgreSQL remains authoritative |
| HTTP utilities | Axios, compression, cookie-parser, Morgan, UUID |

The `zod` package is installed but no current server source imports it. Active request schemas use Express Validator.

## Runtime architecture

```mermaid
flowchart TD
    App[src/app.js] --> Middleware[Global middleware]
    Middleware --> Router[src/routes/index.routes.js]
    Router --> Controllers[Controllers]
    Controllers --> Services[Domain services]
    Services --> Prisma[src/config/prisma.js]
    Prisma --> DB[("PostgreSQL + PostGIS")]
    Services --> Providers[External providers]
    Services --> Cache[(Redis)]
    Server[src/server.js] --> App
    Server --> GarageWorker[Garage-search interval]
    Server --> IssueWorker[Issue auto-resolver interval]
```

There is no repository abstraction. Controllers call services, and services call Prisma directly. There is also no external job queue; background work runs inside the API process.

## Source layout

```text
server/
|-- prisma/
|   |-- migrations/                 Squashed baseline plus incremental SQL migrations
|   `-- schema.prisma               52 models and 29 enums
|-- scripts/
|   `-- resetServiceComingSoon.js   Standalone catalog maintenance helper
|-- src/
|   |-- admin/                      Admin/intern controllers, routes, services, validations
|   |-- config/                     Cookies, providers, CORS helper, env validation, Prisma, Redis
|   |-- constants/                  Shared status/type constants
|   |-- controllers/                Cross-role/public garage, city, push, and issue controllers
|   |-- customer/                   Customer auth/booking/profile/support domain
|   |-- customerSupport/            Dedicated support-account portal domain
|   |-- garage/                     Garage application, owner, wallet, and email domain
|   |-- maps/                       Maps controller/routes/services/validations
|   |-- middlewares/                Auth, CSRF, role, rate limit, upload, validation, errors
|   |-- routes/                     Root router and mixed/public route modules
|   |-- scripts/                    Operational/cleanup/approval scripts
|   |-- seed/                       Admin seed (intern seed target is currently missing)
|   |-- services/                   Cross-domain booking/garage/public/issue/push services
|   |-- utils/                      Errors, responses, cache, JWT, uploads, pricing, phone, etc.
|   |-- validations/                Cross-domain request validation
|   |-- app.js                      Express application and middleware order
|   `-- server.js                   Environment validation, DB connection, workers, HTTP listen
|-- .env.example                    Starting environment template; not a complete active inventory
|-- Dockerfile                      Node 20 Alpine image
|-- prisma.config.ts                Prisma CLI schema/migration path and `DIRECT_URL`
|-- package.json                    Scripts, engines, and dependencies
`-- README.md                       This file
```

## Setup

### Requirements

- Node.js 20+
- npm 10+
- PostgreSQL with permission to install/use PostGIS
- Redis for production under the current startup policy; optional in development

Install dependencies:

```bash
npm ci
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in Bash). Minimum useful development values:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-with-at-least-32-random-bytes
CLIENT_URL=http://127.0.0.1:8080
FRONTEND_URL=http://127.0.0.1:8080
ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080
CASHFREE_ENV=sandbox

# Required only when running npm run seed:admin
ADMIN_LOGIN_ID=local-admin
ADMIN_NAME=Local Admin
ADMIN_PASSWORD=replace-with-a-strong-local-password
```

Provider credentials can remain unset in development until the matching feature is used. Never commit the real `.env`.

Prepare Prisma and the database:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed:admin
```

`prisma:migrate` is for development. In a release environment, apply existing migrations with `npm run prisma:deploy`; `prisma:generate` alone does not update the database.

Start the API:

```bash
npm run dev
```

```text
Root:       http://localhost:5000/
Health:     http://localhost:5000/health
API base:   http://localhost:5000/api/v1
CSRF seed:  http://localhost:5000/api/v1/csrf-token
```

## Application startup and request lifecycle

`src/server.js` performs this sequence:

1. Load `.env`.
2. Run production-only validation from `src/config/env.js`.
3. Create the Express app.
4. Connect Prisma; startup fails if PostgreSQL is unavailable.
5. Start the garage-search and system-issue-resolver intervals.
6. Listen on `PORT` (default `5000`).
7. On `SIGINT`/`SIGTERM`, stop workers, close HTTP, and disconnect Prisma.

Uncaught exceptions and unhandled rejections are logged and sent to the system-issue reporter where possible.

A normal request passes through:

```text
request ID -> proxy/security headers -> CORS -> compression/cookies/body parsing
-> CSRF check -> route middleware -> validation -> controller -> service -> Prisma/provider
-> controller response -> centralized error middleware when needed
```

`GET /health` returns `{ "status": "ok" }`. It does not execute a fresh database query; database readiness is checked during process startup.

## Layers and responsibilities

| Layer | Responsibility |
| --- | --- |
| Routes | HTTP method/path, access middleware, rate limit, upload policy, validation chain |
| Controllers | Extract request input, call a service, select status code, format response |
| Services | Business rules, transactions, provider calls, cache invalidation, Prisma queries |
| Validations | Express Validator schemas for bodies, params, and queries |
| Middleware | Authentication, roles, CSRF, rate limiting, upload checks, validation output, errors |
| Prisma schema/migrations | Database shape, relations, constraints, indexes, and deployable evolution |

Because services access Prisma directly, cross-service changes need particular care around transactions and cache invalidation.

## Endpoint catalog

All paths below start with `/api/v1`. Access abbreviations: **P** public/mixed, **C** customer, **G** garage owner, **A** admin, **I** intern, **S** customer-support account. Some mixed routes perform more specific ownership checks inside their services.

### Authentication, public, maps, and shared endpoints

| Prefix | Access | Methods and paths |
| --- | --- | --- |
| `/auth` | P/authenticated | `POST /signup`, `/verify-otp`, `/resend-otp`, `/send-otp`, `/login`, `/google`, `/logout`, `/forgot-password`, `/reset-password`; `POST /verify-phone-otp`; `GET /me`; `POST /change-password`; `POST /support/login`, `/support/logout`; `GET /support/me` |
| Compatibility OTP | P | `POST /send-otp`, `POST /verify-otp` |
| `/public` | P | `GET /stats` |
| `/system-issues` | P | `POST /report` (rate limited and sanitized) |
| `/cities` | P/A/I | `GET /`; staff `GET /admin`; admin `POST /admin`, `PATCH /admin/:cityId` |
| `/maps` | P/authenticated | P: `GET /config`, `GET /places/:placeId`, `POST /autocomplete`, `POST /validate-address`; authenticated: `POST /route`, `/route-matrix`, `/roads/snap`; booking tracking GET/start/location/stop; admin `POST /optimize-routes` |
| `/contact` | P | `POST /` |
| `/vehicle-meta` | P | `GET /brands`, `GET /brands/:brandId/models` |
| `/services` | P/mixed | `GET /categories`, `GET /`, `GET /:id`, `GET /:serviceId/media`; admin media `POST /:serviceId/media`, `PATCH /media/:mediaId`, `DELETE /media/:mediaId` |
| `/garages` | P/C/G/A | P: `GET /`, `GET /:id`, `GET /:id/services`, `GET /media/:imageId`; C/A: `GET /nearby`; G/A: `GET /me`, `GET /me/services`, `PUT /me`; G: `DELETE /me`; G/A upload: `POST /:garageId/media` |
| `/garage/applications` | P | `GET /geocode`, `POST /` multipart application |
| `/reviews` | Authenticated | `POST /`, `GET /my`, `PATCH /:id`, `DELETE /:id` |
| `/whatsapp` and `/webhooks/whatsapp` | P/provider | `GET /webhook`, `POST /webhook`, `GET /health` |
| `/webhooks/cashfree` | Provider | `POST /` |

### Customer endpoints

The root router applies `protectUser` and the `CUSTOMER` role to these groups.

| Prefix | Methods and paths |
| --- | --- |
| `/customer` | `POST /onboarding`; `GET /profile`; `PATCH /profile`, `/change-password`; `DELETE /delete-account` |
| `/vehicles` | `GET/POST /`; `GET/PATCH/DELETE /:id`; `PATCH /:id/default` |
| `/locations` | `GET /geocode`, `/reverse-geocode`; `GET/POST /`; `GET/PATCH/DELETE /:id`; `PATCH /:id/default` |
| `/bookings` | `POST /checkout`; `GET /`, `/service-history`, `/pending-payment`, `/:id`, `/:id/success`; `POST /:id/accept-delivery`, `/:id/handover-otp/regenerate`; `PATCH /:id/cancel` |
| `/payments` | `GET /`; `POST /create-order`, `/verify`, `/cancel` |
| `/wallet` | `GET /`, `/transactions`; `POST /recharge` |
| `/dashboard` | `GET /customer` |
| `/notifications` | `GET /`; `PATCH /read-all`, `/:id/read` |
| `/push` | `GET /public-key`; `POST/DELETE /subscriptions` |
| `/activities` | `GET/POST /` |
| `/chatbot` | `GET /history`; `POST /ask`; `DELETE /history` |
| `/complaints` | `POST /` multipart; `GET /my`, `/:id` |
| `/support-tickets` | `GET /bookings`, `/my`, `/:ticketId`; `POST /`, `/:ticketId/replies`; `PATCH /:ticketId/close` |
| `/sos` | `POST /`; `GET /:id` |

### Garage endpoints

| Prefix | Access | Methods and paths |
| --- | --- | --- |
| `/garage/requests` | G/A | `GET /`, `GET /:requestId`; `POST /:requestId/accept`, `/reject`, `/verify-handover-otp`, `/mark-delivered` |
| `/garage/wallet` | G/A | `GET /`, `/transactions`; `POST /recharge/order`, `/recharge/verify` |
| `/garage/wallet-legacy` | G/A | Older `GET /`, `/transactions`, `POST /recharge` compatibility API |

### Customer-support portal endpoints

All `/customer-support` routes use the separate `supportAccessToken` cookie.

```text
GET    /push/public-key
POST   /push/subscriptions
DELETE /push/subscriptions
GET    /dashboard
GET    /tickets
GET    /tickets/:ticketId
POST   /tickets/:ticketId/claim
POST   /tickets/:ticketId/release
POST   /tickets/:ticketId/replies
PATCH  /tickets/:ticketId
POST   /notifications/send
GET    /notify
PATCH  /notify/read-all
PATCH  /notify/:notificationId/read
GET    /notifications
PATCH  /notifications/read-all
PATCH  /notifications/:notificationId/read
GET    /email-users
POST   /emails
GET    /emails/history
```

`/notify` is the canonical database model/table name. `/notifications` remains as a compatibility alias to the same support notification service.

### Admin and intern endpoints

| Prefix | Access | Methods and paths |
| --- | --- | --- |
| `/admin` | A/I unless noted | `GET /stats`, `/operations`, `/customers`, `/customers/:userId/profile`, `/bookings`, `/bookings/:bookingId`, `/payments`; booking status/garage/notes mutations; admin-only `DELETE /bookings/all` |
| `/admin/cars` | A/I reads; A writes | Brands/models list/create/update/deactivate and logo upload |
| `/admin/services` | A/I reads; A writes | Categories/services CRUD and thumbnail upload |
| `/admin/garages` | A/I reads; A writes | List/detail/assignable services; bulk delete; service assignment/removal |
| `/admin/garage-applications` | A/I reads; A writes | List/detail; approve/request changes/deny; bulk delete |
| `/admin/city-service-price-ranges` | A/I reads; A writes | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `/admin/system-issues` | A/I reads/updates; A deletes | Stats/list/detail/status plus delete/clear-resolved |
| `/admin/support-tickets` | A | Staff list, ticket list/detail/update/reply |
| `/admin/customer-support-accounts` | A | List/create/activate-update/password reset |
| `/admin/intern-accounts` | A | List/create/activate-update/password reset |
| `/admin/dangerous` | A + step-up password | Command list, download, and run |

## Authentication, sessions, and authorization

### Account types

| Account storage | Roles | Cookie/session table |
| --- | --- | --- |
| `User` | `CUSTOMER`, `GARAGE_OWNER` | `accessToken` + `UserSession` |
| `StaffAccount` | `ADMIN`, `INTERN` | `accessToken` + `StaffSession` |
| `CustomerSupportAccount` | Presented as `CUSTOMER_SUPPORT` | `supportAccessToken` + `CustomerSupportSession` |

`User` email and phone uniqueness is scoped by role, allowing distinct customer and garage-owner identities with the same contact data. Staff login IDs and support emails are globally unique in their own tables.

### Session behavior

- JWTs contain account type, role, account ID, and session ID.
- Middleware verifies the JWT, reloads the active account, checks `passwordChangedAt`, verifies the database session, and updates `lastSeenAt`.
- Revoked, expired, disabled, or deleted accounts lose access immediately on the next protected request.
- Legacy user JWTs without a session ID can be bridged into a `UserSession`; staff/support tokens require session IDs.
- Password changes invalidate older tokens through timestamps and session revocation.
- Garage owners must replace the temporary password before authorized garage operations.

Cookie policy from `src/config/authCookie.js`:

- authentication cookies are HttpOnly
- development uses `SameSite=Lax`; production uses `SameSite=None` and `Secure`
- the CSRF cookie is readable by JavaScript
- a long-lived HttpOnly device ID groups/replaces sessions for the same browser

Authorization middleware remains authoritative even when the frontend hides a screen.

## Global middleware and security

`src/app.js` installs middleware in this order:

1. Request correlation ID (`X-Request-ID`).
2. Reverse-proxy trust and disabled `X-Powered-By`.
3. Helmet security headers.
4. Exact-origin CORS with credentials; production removes localhost origins.
5. Compression and cookie parsing.
6. JSON/urlencoded parsing with 10 MB limits; JSON raw bytes are retained for webhook signatures.
7. CSRF protection for unsafe cookie-authenticated requests, excluding webhook paths.
8. Morgan in development.
9. Root/health/CSRF endpoints and the `/api/v1` router.
10. JSON 404 and centralized error middleware.

Additional protections include Redis-backed/fallback rate limits, upload MIME plus content-signature checks, Cashfree timestamp/signature verification, WhatsApp signature verification, step-up passwords for dangerous actions, and system-issue metadata redaction.

## Validation and errors

- Route validation is implemented with Express Validator files under each domain's `validations/` folder.
- `validate.middleware.js` joins validation messages and returns an operational 400 error.
- Services enforce database ownership, state transitions, price availability, provider results, and transaction invariants that cannot be expressed by field schemas alone.
- Multer errors become safe 400 responses.
- Server errors return a generic message plus `referenceId`; development also returns a stack.
- 5xx request errors are captured in `SystemIssue` unless the failing request is itself an issue report.

Controllers use `asyncHandler` so rejected promises reach the central error middleware.

## Database integration

`src/config/prisma.js` uses `DATABASE_URL` with the PostgreSQL driver adapter. `prisma.config.ts` uses `DIRECT_URL` for Prisma CLI migrations. This supports a pooled runtime URL and a direct migration URL when the database provider recommends that split.

The schema currently contains **52 models** and **29 enums**.

### Model groups

| Domain | Models |
| --- | --- |
| Accounts/sessions | `User`, `UserSession`, `StaffAccount`, `StaffSession`, `CustomerSupportAccount`, `CustomerSupportSession` |
| Signup/profile | `PendingSignup`, `Otp`, `EmailOtp`, `PhoneOtp`, `CustomerProfile`, `CustomerLocation`, `Vehicle` |
| Catalog/pricing | `City`, `VehicleBrand`, `VehicleModel`, `ServiceCategory`, `Service`, `ServiceMedia`, `CityServicePriceRange` |
| Garage | `Garage`, `GarageImage`, `GarageVideo`, `GarageService`, `GarageApplication`, `GarageApplicationImage` |
| Booking/tracking | `Booking`, `BookingService`, `GarageBroadcastRequest`, `BookingInspectionImage`, `BookingTrackingPoint`, `AdminBookingEvent` |
| Money | `Payment`, `Wallet`, `WalletTransaction`, `GarageWallet`, `GarageWalletTransaction` |
| Support/engagement | `SupportTicket`, `SupportTicketMessage`, `SupportTicketAttachment`, `Complaint`, `ComplaintImage`, `Review`, `Notification`, `Notify`, `PushSubscription`, `CustomerSupportPushSubscription`, `CustomerSupportEmailLog`, `CustomerActivity`, `ChatbotConversation`, `ChatbotMessage` |
| Operations | `SystemIssue` |

### Important relationships and invariants

- A `User` owns vehicles, locations, bookings, wallet, sessions, tickets, activities, notifications, and optionally garages.
- A `Booking` belongs to one user and vehicle, begins without a garage, snapshots the address/pricing, and has child service, payment, broadcast, tracking, inspection, complaint, review, support-ticket, and audit rows.
- `BookingService` snapshots estimated price ranges so later catalog changes do not rewrite the original estimate.
- `GarageService` is unique per garage/service/vehicle-brand/vehicle-model combination.
- `Payment` and `Review` are one-to-one with a booking.
- Customer and garage wallets have separate transaction ledgers; mutations should always update balance and ledger in one transaction.
- A partial database unique index permits only one active booking per vehicle. A PostgreSQL advisory transaction lock reduces race windows before insert.
- `GarageBroadcastRequest` is unique per booking/garage. Conditional updates make the first valid acceptance win and expire other sent requests.
- PostGIS provides the active-garage geography index and `ST_DWithin`/`ST_Distance` queries.
- Most owned child records cascade on deletion; optional links such as support booking/assignee use `SET NULL` where the schema specifies it.

Not every identifier-like field is a Prisma relation: `AdminBookingEvent.staffId`, several `SystemIssue` actor IDs, and `CustomerSupportEmailLog.userId` are scalar audit references. `Garage.applicationId` and `GarageApplication.approvedGarageId` link the approval flow without a declared Prisma relation.

### PostgreSQL-specific migrations

- `20260708210000_add_garage_geo_index` enables PostGIS and creates spatial/garage lookup indexes.
- `20260711193000_add_active_vehicle_booking_guard` creates the partial unique active-booking index, which is not represented by `@@unique` in Prisma schema syntax.
- Recent migrations add tracking, push subscriptions, revocable sessions, admin booking events, support tickets, the support portal, and separate staff/support sessions.

Use migrations, not `db push`, to preserve these SQL-only constraints and indexes.

## Booking and garage lifecycle

Normal booking states are:

```text
PENDING_PAYMENT -> SEARCHING_GARAGE -> CONFIRMED -> IN_PROGRESS -> COMPLETED
```

`GARAGE_ASSIGNED` remains in the enum and compatibility checks, while current acceptance writes `CONFIRMED` directly. Terminal alternatives are `CANCELLED` and `EXPIRED`.

Confirmed flow:

1. Checkout verifies customer ownership of the vehicle, active city, available services, contextual price ranges, and the one-active-booking rule.
2. A transaction inserts `Booking` in `PENDING_PAYMENT` plus `BookingService` snapshots.
3. Cashfree/customer-wallet payment covers the platform fee; the final service amount is paid to the garage outside the platform flow.
4. Verified payment writes `Payment=PAID`, updates wallet entries when used, changes the booking to `SEARCHING_GARAGE`, and starts a two-minute search round.
5. Eligible verified garages are ranked by location/service/vehicle scope and receive `GarageBroadcastRequest` rows in batches.
6. Acceptance conditionally claims both the request and booking, deducts the garage acceptance fee, expires competitors, and creates the handover OTP.
7. The garage verifies the OTP with exactly five pickup images, moving the booking to `IN_PROGRESS`.
8. The garage uploads exactly five delivery images and marks delivery.
9. The customer confirms the final amount and accepts delivery, moving the booking to `COMPLETED`.

The frontend's highlighted garage on `/booking/garage` is a preview only; `Booking.garageId` remains null until an eligible garage accepts.

## Background workers, caching, and rate limiting

### Garage-search worker

`src/services/garageSearchWorker.service.js` runs immediately after DB connection and then at `GARAGE_SEARCH_WORKER_INTERVAL_MS` (default 10 seconds, minimum 5 seconds). Each pass processes up to 100 oldest `SEARCHING_GARAGE` bookings and prevents overlapping runs. Search batch size inside the request service defaults to five garages.

### System-issue auto-resolver

`src/services/systemIssueAutoResolver.service.js` is enabled by default. It periodically finds quiet open/investigating issues, performs safe GET/HEAD probes where possible, accepts configured 401/403 responses for protected endpoints, and resolves verified/quiet-only candidates. It will reopen through the reporter if the fingerprint occurs again.

Both timers call `unref()` and stop during graceful shutdown. They are not durable queues; another API replica may run the same interval, so their database claims are designed to be conditional/idempotent.

### Redis

Redis is used for fail-soft caches and distributed rate-limit counters. Cache helpers time out quickly and fall back to PostgreSQL/direct provider calls. Development logs a warning when `REDIS_URL` is missing. Production startup currently rejects a missing Redis URL.

Common caches cover dashboard/public statistics, cities, locations, service price ranges, reviews, booking reads, and selected Google Maps responses.

## External integrations

| Integration | Purpose | Main modules |
| --- | --- | --- |
| Cashfree | Booking platform-fee orders, verification/webhooks, customer/garage wallet recharge | `config/cashfree.js`, customer/garage payment services |
| Cloudinary | Garage, catalog, complaint, support, and inspection media | `config/cloudinary.js`, `utils/cloudinaryUpload.js`, upload services |
| Google Maps Platform | Autocomplete, place details, address validation, routes, matrices, roads, geocoding, route optimization | `src/maps/`, customer geocoding service |
| Firebase Admin | Verify Google ID tokens during Google sign-in | `config/firebase.js`, auth service |
| Resend | OTP, contact, garage application, handover, and support email | domain email services |
| SMS | Phone OTP through Fast2SMS or configured generic provider | `customer/services/sms.service.js` |
| WhatsApp/Meta | Garage leads, customer updates, webhook | `garageWhatsapp.service.js`, `routes/whatsapp.routes.js` |
| Web Push | Customer/garage/support browser subscriptions and notifications | `services/webPush.service.js`, push controllers |
| Groq | Chatbot completion and failed-address correction | chatbot service, `utils/addressCorrection.js` |

The legacy `GEOCODER_PROVIDER`/Nominatim example variables are not referenced by current source; active geocoding uses Google, with Groq correction when configured.

## Environment variables

Never expose values in documentation or commit `.env`. Defaults below describe code behavior, not recommended production secrets.

### Core, database, origins, and sessions

| Variables | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT` | Runtime mode and HTTP port |
| `DATABASE_URL` | Required runtime PostgreSQL URL |
| `DIRECT_URL` | Required by Prisma CLI configuration |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_COOKIE_MAX_AGE_MS` | JWT signing and cookie lifetime |
| `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS` | Redirect/origin allowlist |
| `PUBLIC_API_URL`, `API_BASE_URL`, `BACKEND_URL` | Provider links and issue-resolver probe base where referenced |
| `APP_TIME_ZONE` | WhatsApp date/time formatting (service-hours checks are currently fixed to `Asia/Kolkata`) |
| `ADMIN_LOGIN_ID`, `ADMIN_NAME`, `ADMIN_PASSWORD` | `seed:admin` input only |

### Cashfree and Cloudinary

```text
CASHFREE_APP_ID
CASHFREE_SECRET_KEY
CASHFREE_ENV
CASHFREE_NOTIFY_URL
CASHFREE_PAYMENT_SESSION_REUSE_MS
CASHFREE_WEBHOOK_SECRET
CASHFREE_WEBHOOK_SIGNATURE_REQUIRED
CASHFREE_WEBHOOK_MAX_AGE_MS
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

### Redis, cache, and rate limiting

```text
REDIS_URL
REDIS_CONNECT_TIMEOUT_MS
REDIS_COMMAND_TIMEOUT_MS
CACHE_TIMEOUT_MS
DASHBOARD_CACHE_TTL
PUBLIC_STATS_CACHE_TTL
BOOKING_READ_CACHE_TTL_SECONDS
CITY_CACHE_TTL_SECONDS
LOCATIONS_CACHE_TTL_SECONDS
PRICE_RANGE_CACHE_TTL_SECONDS
REVIEW_CACHE_TTL_SECONDS
RATE_LIMIT_KEY_PREFIX
```

### Firebase, Google Maps, tracking, and geocoding

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_HOSTING_URL
GOOGLE_MAPS_API_KEY
GOOGLE_MAPS_BROWSER_KEY
GOOGLE_MAPS_MAP_ID
GOOGLE_MAPS_LANGUAGE
GOOGLE_MAPS_TIMEOUT_MS
GOOGLE_MAPS_REGION_CODE
GOOGLE_MAPS_REGION_CODES
GOOGLE_MAPS_DEFAULT_LATITUDE
GOOGLE_MAPS_DEFAULT_LONGITUDE
GOOGLE_PLACES_BIAS_RADIUS_M
GOOGLE_GEOCODING_TIMEOUT_MS
GOOGLE_GEOCODING_LANGUAGE
GOOGLE_GEOCODING_REGION
GOOGLE_GEOCODING_MAX_CANDIDATES
GOOGLE_ROUTE_MATRIX_ENABLED
GOOGLE_ROUTE_MATRIX_GARAGE_LIMIT
GOOGLE_TRAFFIC_AWARE
GOOGLE_ROADS_ENABLED
GOOGLE_TRACKING_ROUTE_REFRESH_SECONDS
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_ROUTE_OPTIMIZATION_CLIENT_EMAIL
GOOGLE_ROUTE_OPTIMIZATION_PRIVATE_KEY
GOOGLE_OPTIMIZATION_TIMEOUT
GOOGLE_OPTIMIZATION_STOP_SECONDS
PUBLIC_GARAGE_RADIUS_KM
GARAGE_GEO_LOOKUP_RADIUS_KM
GARAGE_ETA_SPEED_KMPH
GARAGE_ETA_BUFFER_MINUTES
```

### Groq/chatbot, email, SMS, WhatsApp, and push

```text
GROQ_API_KEY
GROQ_MODEL
GROQ_TIMEOUT_MS
CHATBOT_GROQ_MODEL
CHATBOT_GROQ_TIMEOUT_MS
CHATBOT_RATE_LIMIT_PER_MINUTE
RESEND_API_KEY
RESEND_FROM_EMAIL
EMAIL_FROM
EMAIL_OTP_DELIVERY
CONTACT_INBOX
SMS_PROVIDER
FAST2SMS_API_KEY
SMS_PROVIDER_URL
SMS_PROVIDER_TOKEN
SMS_SENDER_ID
DEFAULT_COUNTRY_CODE
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_GRAPH_VERSION
WHATSAPP_VERIFY_TOKEN
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_APP_SECRET
META_APP_SECRET
WHATSAPP_PROVIDER_URL
WHATSAPP_PROVIDER_TOKEN
WHATSAPP_SENDER_ID
WHATSAPP_DEFAULT_COUNTRY_CODE
WHATSAPP_SEND_TIMEOUT_MS
WHATSAPP_USE_TEMPLATES
WHATSAPP_TEMPLATE_LANGUAGE
WHATSAPP_GARAGE_REQUEST_TEMPLATE
WHATSAPP_GARAGE_ACCEPTED_DETAILS_TEMPLATE
WHATSAPP_DEBUG_LOGS
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_VAPID_SUBJECT
```

### Booking, workers, issues, and operations

```text
SERVICE_PRICE_RANGE_DELTA
HANDOVER_OTP_TTL_MINUTES
HANDOVER_OTP_RESEND_COOLDOWN_SECONDS
GARAGE_REQUEST_ACCEPT_PATH
GARAGE_SEARCH_BATCH_SIZE
GARAGE_SEARCH_TIMEOUT_SECONDS
GARAGE_SEARCH_WORKER_INTERVAL_MS
SYSTEM_ISSUE_AUTO_RESOLVE_ENABLED
SYSTEM_ISSUE_AUTO_RESOLVE_INTERVAL_MS
SYSTEM_ISSUE_AUTO_RESOLVE_QUIET_MS
SYSTEM_ISSUE_AUTO_RESOLVE_BATCH
SYSTEM_ISSUE_QUIET_ONLY_AUTO_RESOLVE_ENABLED
SYSTEM_ISSUE_PROBE_BASE_URL
SYSTEM_ISSUE_PROBE_TIMEOUT_MS
SYSTEM_ISSUE_PROTECTED_PROBE_OK_STATUSES
RENDER_GIT_COMMIT
SQLITE3_BIN
SQLITE_BACKUP_TIMEOUT_MS
SQLITE_BACKUP_PAGE_SIZE
```

The SQLite variables are used only by dangerous-operation backup/download compatibility code, not as the main database.

### Production startup requirements

When `NODE_ENV=production`, `src/config/env.js` requires:

- a 32+ byte `JWT_SECRET`
- a 24+ byte `CASHFREE_WEBHOOK_SECRET`
- `DATABASE_URL`, `REDIS_URL`, Cashfree app/secret/HTTPS notify URL, Cloudinary credentials, Firebase Admin credentials, `RESEND_API_KEY`, and both Web Push keys
- at least one email sender (`EMAIL_FROM` or `RESEND_FROM_EMAIL`)
- at least one HTTPS frontend URL (`CLIENT_URL` or `FRONTEND_URL`)
- `CASHFREE_ENV=production`, signature verification enabled, and WhatsApp debug logs disabled

`server/.env.example` is not a complete inventory: it omits multiple active tuning variables and `NODE_ENV`, duplicates `HANDOVER_OTP_TTL_MINUTES`, and retains unreferenced legacy Nominatim/provider entries. Use this section with the source validator when preparing production.

## Scripts

### Runtime and Prisma

| Command | Purpose |
| --- | --- |
| `npm run dev` | nodemon `src/server.js` |
| `npm start` | Node `src/server.js` |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:format` | Format schema |
| `npm run prisma:validate` | Validate schema/config |
| `npm run prisma:migrate` | Development migration workflow |
| `npm run prisma:deploy` | Apply checked-in migrations |
| `npm run prisma:status` | Show migration status |
| `npm run prisma:studio` | Start Prisma Studio |

### Seeds and push

| Command | Status |
| --- | --- |
| `npm run seed:admin` | Active; reads `ADMIN_*` variables |
| `npm run seed:intern` | **Broken:** target `src/seed/seedIntern.js` is missing |
| `npm run seed:staff`, `npm run seed:all` | **Broken:** depend on `seed:intern` |
| `npm run push:generate-vapid-keys` | Generates VAPID JSON; protect the private key |

`node generate-secret.js` is an unregistered helper for generating a secret.

### Database and operations

```text
db:delete-user
db:delete-active-bookings
db:delete-payments
db:delete-service-history
db:delete-garages
db:delete-price-ranges
db:delete-bookings
db:delete-notifications
db:delete-support-data
db:delete-auth-sessions
db:delete-system-issues
db:nuke-users
db:approve-garage
db:activate-garage
```

These commands can mutate or erase large data sets. Read the target script, confirm its arguments/confirmation behavior, and back up the correct database first. `db:activate-garage` references `activateGarage.js`, while Git tracks `activategarage.js`; fix the capitalization before using it on Linux or another case-sensitive filesystem.

## Development and validation workflow

1. Apply migrations before exercising code that depends on new tables or SQL indexes.
2. Add paths and access middleware in a route file.
3. Keep controllers thin; implement business behavior in a service.
4. Put field validation in the matching `validations/` module and invariants/transactions in the service.
5. Invalidate affected Redis/read caches after writes.
6. Use `ApiError` for expected operational failures.
7. Run schema and syntax checks.

Windows-friendly validation:

```powershell
npm.cmd run prisma:validate
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

The repository has no automated tests, lint script, OpenAPI document, or CI workflow. Payment, wallet, auth, upload, and concurrency changes therefore need deliberate manual/integration verification.

## Docker and production deployment

Build and run directly:

```bash
docker build -t rovauto-server .
docker run --env-file .env -p 5000:5000 rovauto-server
```

The Dockerfile:

1. Uses Node 20 Alpine.
2. Installs PostgreSQL client and SQLite utilities.
3. Runs `npm install`.
4. Copies Prisma files and runs `npx prisma generate`.
5. Copies source and runs `npm start`.

It does **not** apply migrations. More importantly, the current `server/.dockerignore` does not exclude `.env`, and the later `COPY . .` can embed local secrets in an image layer. Add `.env`/`.env.*` exclusions (while preserving `.env.example` if desired) before building or distributing a production image. The repository also has no Render/platform blueprint. Configure release steps explicitly:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm start
```

Deployment checklist:

- Provision PostgreSQL with PostGIS support and apply every migration.
- Configure every production-required variable before starting.
- Use HTTPS for frontend, API, Cashfree notify URL, and cookies.
- Add exact frontend origins to CORS.
- Point provider webhooks at the public `/api/v1/webhooks/*` routes.
- Use `/health` for process health; use a separate authenticated/operational DB check if the platform needs live DB readiness.
- Keep at least one API process continuously running if in-process workers must run continuously.
- Back up PostgreSQL before cleanup/dangerous operations.
- Set provider quotas/alerts and monitor `SystemIssue` plus application logs.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| Startup says an env variable is missing | Production validation is strict; read `src/config/env.js` and the production requirements above |
| Prisma CLI uses the wrong database | Runtime uses `DATABASE_URL`; Prisma CLI uses `DIRECT_URL` from `prisma.config.ts` |
| PostGIS migration fails | Database user needs extension permission and provider must support PostGIS |
| `prisma generate` succeeds but tables are missing | Run `prisma:migrate` locally or `prisma:deploy` in release; generation does not migrate |
| Cookie exists but API returns 401 | Check session row expiry/revocation, account active state, `passwordChangedAt`, correct cookie (`supportAccessToken` for support), and JWT secret consistency |
| Browser receives 403 CORS/CSRF | Check exact origin, credentials, HTTPS/SameSite rules, `rovautoCsrf`, and `X-CSRF-Token` |
| Redis is unavailable | Development falls back with stricter local counters; production currently refuses to start without `REDIS_URL` |
| Booking stays `SEARCHING_GARAGE` | Check worker logs, coordinates/PostGIS, active city, garage verification/services/radius, request rounds, and wallet only at acceptance |
| Garage cannot accept | Check request expiry/status, competing acceptance, first-login password rule, and garage wallet fee balance |
| Cashfree webhook is rejected | Check raw-body parsing, timestamp age, signature secret/header, environment, and public notify URL |
| Upload fails | Check multipart field name, size/count, allowed MIME and file signature, then Cloudinary credentials |
| Maps endpoint fails | Verify correct Google API key, enabled API, project permissions, region/config values, Redis/provider timeout, and billing/quota |
| PowerShell blocks npm | Use `npm.cmd` or local `.cmd` binaries |

## Confirmed gaps and legacy areas

- No test suite, linter, CI, OpenAPI/Swagger specification, or repository layer exists.
- Intern seed commands are broken because the seed file is absent.
- The garage activation npm script has a filename capitalization mismatch for case-sensitive systems.
- `.env.example` is incomplete, contains a duplicate key, and retains legacy/unreferenced geocoder settings.
- `server/.dockerignore` omits `.env`, so Docker builds from a working directory containing secrets can copy them into the image.
- `src/customer/routes/support.routes.js` is empty and not mounted; active support-ticket routes live in `supportTicket.routes.js`.
- `/garage/wallet-legacy` is still mounted for compatibility alongside the newer garage wallet API.
- Garage application `garageType` and supported brands are encoded into/parsing from the free-text `description` during approval because the application model has no typed columns for them. This is active but brittle.
- Several audit/reference IDs are plain strings rather than foreign keys, so database referential integrity does not cover those links.
- There is no checked-in platform deployment manifest; production hostnames and release commands are configured outside the repository.
