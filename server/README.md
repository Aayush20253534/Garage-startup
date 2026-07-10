# Rovauto Server

The Rovauto server is an Express 5 API for customer bookings, garage-partner operations, payments, wallets, catalog administration, media, notifications, location services, and platform monitoring. It uses Prisma 7 with the PostgreSQL driver adapter and exposes all application APIs below `/api/v1`.

## Stack

- Node.js  20+
- Express 5
- PostgreSQL
- Prisma 7 and `@prisma/adapter-pg`
- JWT in an HttpOnly cookie
- Argon2 password hashing
- Zod and Express Validator
- Cloudinary and Multer
- Cashfree Payments
- Firebase Admin
- Redis through ioredis, optional
- Resend email
- Configurable SMS and WhatsApp providers
- Google Geocoding
- Groq SDK
- Helmet, CORS, compression, Morgan, and cookie-parser

## Runtime Architecture

```mermaid
flowchart TD
    E[Express app] --> R[Route modules]
    R --> C[Controllers]
    C --> S[Services]
    S --> P[Prisma Client]
    P --> PG[(PostgreSQL)]

    S --> I[External integrations]
    I --> CF[Cashfree]
    I --> CL[Cloudinary]
    I --> FB[Firebase]
    I --> RS[Resend]
    I --> GM[Google Geocoding]
    I --> GQ[Groq]
    I --> WA[WhatsApp / SMS]
    S --> RD[(Optional Redis)]
```

The server starts only after `prisma.$connect()` succeeds. It then starts the recurring garage-search worker and installs graceful shutdown handlers for `SIGTERM` and `SIGINT`.

## Source Layout

```text
server/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── scripts/
│   └── resetServiceComingSoon.js
├── src/
│   ├── admin/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── validations/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── customer/
│   │   ├── controllers/
│   │   ├── knowledge/
│   │   ├── routes/
│   │   ├── services/
│   │   └── validations/
│   ├── garage/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── validations/
│   ├── middlewares/
│   ├── routes/
│   ├── scripts/
│   ├── seed/
│   ├── services/
│   ├── utils/
│   ├── validations/
│   ├── app.js
│   └── server.js
├── Dockerfile
├── prisma.config.ts
├── .env.example
└── package.json
```

## Setup

Install dependencies:

```bash
npm ci
```

Create the environment file:

```bash
cp .env.example .env
```

At minimum, configure:

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
JWT_COOKIE_MAX_AGE_MS=604800000

CLIENT_URL=http://127.0.0.1:8080
FRONTEND_URL=http://127.0.0.1:8080
ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
```

Generate Prisma Client and create/apply a development migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Start development mode:

```bash
npm run dev
```

Start production mode:

```bash
npm start
```

## Database URLs

The project intentionally uses two environment variables:

| Variable         | Used by               | Purpose                                                  |
| ---------------- | --------------------- | -------------------------------------------------------- |
| `DATABASE_URL` | Runtime Prisma client | Application database connection through`PrismaPg`      |
| `DIRECT_URL`   | Prisma CLI config     | Migrations, generation, status, and Studio configuration |

For a simple local PostgreSQL installation, both may use the same connection string. Hosted providers may supply a pooled runtime URL and a separate direct migration URL.

## Health Endpoints

```text
GET /
GET /health
```

`/health` returns the environment and timestamp and is suitable for a hosting-platform health check. It does not perform a fresh database query because the process already refuses to start when the initial Prisma connection fails.

## Authentication and Authorization

### Session model

- Successful login sets an `accessToken` cookie.
- The cookie is `httpOnly`, `sameSite=lax`, scoped to `/`, and `secure` in production.
- Default lifetime is seven days and can be overridden with `JWT_COOKIE_MAX_AGE_MS`.
- Protected middleware reads only the cookie. Authorization headers are not used by the current implementation.
- Invalid, expired, disabled, or deleted users cause the cookie to be cleared.

### Roles

```text
CUSTOMER
GARAGE_OWNER
ADMIN
```

Email and phone uniqueness are scoped by role:

```prisma
@@unique([email, role])
@@unique([phone, role])
```

This permits separate customer and garage-owner identities with the same contact information while keeping each session role explicit.

### Authentication methods

- Email/password signup and login
- Email OTP verification and resend
- Phone OTP send and verification
- Google authentication through Firebase ID tokens
- Forgot/reset password
- Garage-owner password and OTP login flows
- Admin login through the same role-aware user system

OTP endpoints have validation and rate limiting.

## CORS and Cookies

CORS is configured directly in `src/app.js`.

Allowed origins include:

- `https://rovauto.com`
- `https://www.rovauto.com`
- local ports 5173, 8080, 8081, and 8082 on `localhost` and `127.0.0.1`
- `CLIENT_URL`
- `FRONTEND_URL`
- comma-separated `ALLOWED_ORIGINS`

Requests without an `Origin` header are allowed for server-to-server clients, health checks, Postman, and webhooks.

Because authentication uses cookies:

- the browser must send credentials
- the frontend origin must match the CORS allowlist
- production frontend and backend must use HTTPS
- custom cross-site deployment arrangements may require revisiting the current `sameSite=lax` cookie policy

## Prisma Schema

The schema contains 50 models and 29 enums.

### Identity and onboarding

```text
User
UserSession
StaffAccount
CustomerSupportAccount
PendingSignup
Otp
EmailOtp
PhoneOtp
CustomerProfile
CustomerLocation
Vehicle
PushSubscription
```

### Services and garages

```text
City
VehicleBrand
VehicleModel
ServiceCategory
Service
ServiceMedia
CityServicePriceRange
Garage
GarageImage
GarageVideo
GarageService
GarageApplication
GarageApplicationImage
```

### Booking and payment

```text
Booking
BookingService
BookingInspectionImage
GarageBroadcastRequest
BookingTrackingPoint
AdminBookingEvent
Payment
Wallet
WalletTransaction
GarageWallet
GarageWalletTransaction
```

### Support and operations

```text
Review
Complaint
ComplaintImage
Notification
Notify
CustomerSupportPushSubscription
CustomerSupportEmailLog
CustomerActivity
ChatbotConversation
ChatbotMessage
SystemIssue
SupportTicket
SupportTicketMessage
SupportTicketAttachment
```

Important enum groups include booking, payment, broadcast, wallet-transaction, garage-application, complaint, notification, support-ticket, support-message, dispute-resolution, media, location, fuel, request, tracking-source, booking-photo, and system-issue statuses.

## API Route Groups

All routes below are prefixed with `/api/v1`.

| Prefix                    | Purpose                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `/auth`                 | Customer signup, verification, login, Google auth, logout, session lookup, password operations   |
| `/customer`             | Onboarding, profile, password, and account deletion                                              |
| `/vehicles`             | Customer vehicle CRUD/default operations                                                         |
| `/locations`            | Manual geocoding, reverse geocoding, and saved-location operations                               |
| `/services`             | Public service catalog and admin-protected service media                                         |
| `/vehicle-meta`         | Public vehicle brands and models                                                                 |
| `/garages`              | Garage discovery, nearby search, owner profile/services, and media                               |
| `/garage/applications`  | Garage application submission and application geocoding                                          |
| `/garage/requests`      | Garage requests, accept/reject, handover OTP, and delivery                                       |
| `/garage/wallet`        | Current garage wallet and Cashfree recharge flow                                                 |
| `/garage/wallet-legacy` | Older garage-wallet endpoints retained for compatibility                                         |
| `/bookings`             | Checkout, list/detail, service history, success/tracking data, delivery acceptance, cancellation |
| `/payments`             | Customer payment listing, Cashfree order creation, and verification                              |
| `/wallet`               | Customer wallet, transactions, and recharge                                                      |
| `/sos`                  | SOS creation and lookup                                                                          |
| `/reviews`              | Customer review create/list                                                                      |
| `/complaints`           | Complaint creation and customer complaint history                                                |
| `/support-tickets`      | Customer support tickets, disputes, replies, attachments, and close action                       |
| `/notifications`        | Notification list and read state                                                                 |
| `/dashboard`            | Customer dashboard aggregation                                                                   |
| `/chatbot`              | History, ask, and clear                                                                          |
| `/activities`           | Customer activity feed                                                                           |
| `/contact`              | Public contact submission                                                                        |
| `/cities`               | Public cities and admin city management                                                          |
| `/public/stats`         | Public statistics                                                                                |
| `/system-issues/report` | Frontend issue intake                                                                            |
| `/customer-support`     | Support-agent dashboard, ticket queue, alerts, push subscriptions, and email                     |
| `/admin/*`              | Admin operations, catalogs, garages, applications, prices, and issue management                  |
| `/whatsapp`             | Health and webhook endpoints                                                                     |
| `/webhooks/whatsapp`    | Alternate mount for the WhatsApp webhook router                                                  |

The root router also exposes compatibility OTP endpoints:

```text
POST /api/v1/send-otp
POST /api/v1/verify-otp
```

## Booking Lifecycle

Schema statuses:

```text
PENDING_PAYMENT
SEARCHING_GARAGE
GARAGE_ASSIGNED
CONFIRMED
IN_PROGRESS
COMPLETED
CANCELLED
EXPIRED
```

Normal sequence:

1. Checkout validates customer, vehicle, location, city, and selected services.
2. A booking is created in `PENDING_PAYMENT`.
3. Cashfree order creation and verification complete the platform payment step.
4. The booking enters `SEARCHING_GARAGE`.
5. Eligible garages receive `GarageBroadcastRequest` rows in batches.
6. First valid acceptance assigns the garage and expires competing requests.
7. Pickup is protected by a handover OTP and pickup inspection images.
8. The garage moves the booking through active work and delivery.
9. Delivery inspection images are recorded.
10. Customer acceptance completes the lifecycle.

Alternative outcomes include cancellation, payment failure, request expiry, and exhausted garage search.

## Garage Search Worker

`src/services/garageSearchWorker.service.js` runs after the database connection succeeds.

It:

- polls bookings in `SEARCHING_GARAGE`
- calls `ensureBookingSearchActive()` for each booking
- avoids overlapping worker runs
- records background failures in the system-issue table
- uses an unreferenced timer so it does not independently keep the Node process alive

Configuration:

```env
GARAGE_SEARCH_WORKER_INTERVAL_MS=10000
GARAGE_SEARCH_BATCH_SIZE=5
GARAGE_SEARCH_TIMEOUT_SECONDS=
GARAGE_REQUEST_ACCEPT_PATH=
```

The worker enforces a minimum interval of five seconds. Its internal database fetch currently processes up to 100 bookings per worker pass; `GARAGE_SEARCH_BATCH_SIZE` controls request/search behavior inside the garage-request service rather than that top-level fetch limit.

## Garage Applications

Application status:

```text
PENDING
CHANGES_REQUESTED
APPROVED
DENIED
```

The current onboarding flow requires 10 to 15 garage images. The client restricts onboarding images to 1 MB each, and the service rejects fewer than 10 uploaded photos.

Admin actions include:

- list/filter applications
- inspect one application
- approve
- request changes
- deny
- bulk delete through the route's supported query behavior

Approval creates or activates the garage-owner account and garage record and supports email notifications.

## Geocoding

Current geocoding implementation:

1. Build several India-scoped address candidates.
2. Query Google Geocoding with `components=country:IN`.
3. Reject coordinates outside configured India bounds.
4. When no result is found and Groq is configured, normalize/correct the address.
5. Retry Google Geocoding with the corrected address.

Reverse geocoding also uses Google and validates India coordinate bounds before calling the provider.

Primary variables:

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_GEOCODING_TIMEOUT_MS=5000
GOOGLE_GEOCODING_LANGUAGE=en
GOOGLE_GEOCODING_REGION=in
GOOGLE_GEOCODING_MAX_CANDIDATES=2
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GROQ_TIMEOUT_MS=12000
```

`GEOCODER_PROVIDER`, `NOMINATIM_TIMEOUT_MS`, and `NOMINATIM_USER_AGENT` remain in `.env.example` but are not used by the current source.

## Payments and Wallets

### Cashfree

The backend uses Cashfree's payment-gateway API for:

- customer booking orders
- payment verification
- garage-wallet recharge orders
- garage-wallet recharge verification

```env
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_ENV=sandbox
CASHFREE_NOTIFY_URL=
```

`CASHFREE_ENV=production` selects the live API; every other value selects sandbox.

### Wallets

Separate customer and garage wallet models are maintained. Transaction types include credits, debits, recharge, refunds, cashback, booking payment/refund, garage acceptance fees, and SOS deductions.

Wallet mutations should always go through the wallet service helpers so balance changes and transaction rows remain consistent.

## Media

Cloudinary is used for dynamic media:

- garage applications
- garage listing images/videos
- service category and service thumbnails
- service media
- vehicle-brand logos
- complaints
- booking pickup/delivery inspections

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Upload middleware uses Multer and validates limits at route/service level. Avoid persisting raw uploaded files on ephemeral hosting disks.

## Chatbot

The chatbot service:

- stores conversations and messages in PostgreSQL
- keeps one active conversation per customer
- loads Markdown knowledge from `src/customer/knowledge/`
- performs keyword-based retrieval over Markdown sections
- adds limited customer/booking context
- sends the resulting prompt to Groq
- retains a bounded recent history for context and display

```env
GROQ_API_KEY=
CHATBOT_GROQ_MODEL=llama-3.1-8b-instant
CHATBOT_GROQ_TIMEOUT_MS=12000
CHATBOT_RATE_LIMIT_PER_MINUTE=20
```

When the model is unavailable, the service can return a knowledge-based fallback answer.

## System-Issue Monitoring

The platform records frontend and backend issues in `SystemIssue`.

Features include:

- deterministic fingerprints
- occurrence counting and last-seen timestamps
- automatic reopening of resolved/ignored recurring issues
- sensitive metadata redaction
- customer, garage, admin, public, and system actor classification
- frontend, request, worker, startup, unhandled rejection, and uncaught exception reporting
- admin statistics, filtering, status updates, and deletion

Set `RENDER_GIT_COMMIT` or an equivalent release identifier to attach deployment metadata to backend reports.

## Redis

Redis is optional.

```env
REDIS_URL=
REDIS_CONNECT_TIMEOUT_MS=1500
REDIS_COMMAND_TIMEOUT_MS=1500
CACHE_TIMEOUT_MS=
DASHBOARD_CACHE_TTL=
PUBLIC_STATS_CACHE_TTL=
```

The client uses lazy connection, short timeouts, one retry, and fail-soft cache helpers. The application should continue using PostgreSQL when Redis is unavailable.

## Environment Variables

### Core

| Variable                  | Notes                             |
| ------------------------- | --------------------------------- |
| `NODE_ENV`              | `development` or `production` |
| `PORT`                  | Defaults to`5000`               |
| `DATABASE_URL`          | Required runtime database URL     |
| `DIRECT_URL`            | Required by Prisma CLI config     |
| `JWT_SECRET`            | Required; use a long random value |
| `JWT_EXPIRES_IN`        | Defaults to`7d`                 |
| `JWT_COOKIE_MAX_AGE_MS` | Defaults to seven days            |

### Origins

```text
CLIENT_URL
FRONTEND_URL
ALLOWED_ORIGINS
```

### Firebase and Google

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
GOOGLE_MAPS_API_KEY
GOOGLE_GEOCODING_TIMEOUT_MS
GOOGLE_GEOCODING_LANGUAGE
GOOGLE_GEOCODING_REGION
GOOGLE_GEOCODING_MAX_CANDIDATES
```

### Email and SMS

```text
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
```

### WhatsApp and Meta

```text
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
```

### Groq

```text
GROQ_API_KEY
GROQ_MODEL
GROQ_TIMEOUT_MS
CHATBOT_GROQ_MODEL
CHATBOT_GROQ_TIMEOUT_MS
CHATBOT_RATE_LIMIT_PER_MINUTE
```

### Booking, pricing, and cache tuning

```text
HANDOVER_OTP_TTL_MINUTES
SERVICE_PRICE_RANGE_DELTA
GARAGE_REQUEST_ACCEPT_PATH
GARAGE_SEARCH_BATCH_SIZE
GARAGE_SEARCH_TIMEOUT_SECONDS
GARAGE_SEARCH_WORKER_INTERVAL_MS
GARAGE_ETA_SPEED_KMPH
GARAGE_ETA_BUFFER_MINUTES
DASHBOARD_CACHE_TTL
PUBLIC_STATS_CACHE_TTL
CACHE_TIMEOUT_MS
REDIS_CONNECT_TIMEOUT_MS
REDIS_COMMAND_TIMEOUT_MS
```

### Platform metadata

```text
RENDER_GIT_COMMIT
```

## Scripts

### Development and Prisma

```bash
npm run dev
npm start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:status
npm run prisma:studio
npm run seed:admin
npm run seed:all
```

### Data and operations

```bash
npm run db:delete-user
npm run db:delete-active-bookings
npm run db:delete-payments
npm run db:delete-service-history
npm run db:delete-garages
npm run db:delete-price-ranges
npm run db:delete-bookings
npm run db:delete-notifications
npm run db:delete-support-data
npm run db:delete-auth-sessions
npm run db:delete-system-issues
npm run db:nuke-users
npm run db:approve-garage
npm run db:activate-garage
```

Several scripts are destructive or modify production-like records. Read the script source and use its dry-run/confirmation flags where provided before running it against a shared database. The cleanup scripts are aligned with the current Prisma schema, including support-ticket tables, support notifications, user sessions, customer/support push subscriptions, booking tracking points, admin booking events, and system issues.

## Docker

Build from `server/`:

```bash
docker build -t rovauto-server .
```

Run with an environment file:

```bash
docker run --env-file .env -p 5000:5000 rovauto-server
```

The image:

1. installs dependencies
2. copies the Prisma schema
3. runs `prisma generate`
4. copies the source
5. starts `npm start`

It does not run migrations automatically. Run this as a deployment/release step:

```bash
npm run prisma:deploy
```

The repository root `docker-compose.yml` builds the frontend and backend together but expects an external PostgreSQL database.

## Production Checklist

- Set `NODE_ENV=production`.
- Use HTTPS for both frontend and API.
- Configure exact production origins.
- Set a strong JWT secret.
- Use separate pooled and direct database URLs where the provider recommends it.
- Run `npm run prisma:deploy` before starting the new release.
- Configure Cashfree webhooks and validate provider signatures before real payment traffic.
- Set quotas for Google Maps, Groq, Cloudinary, SMS, WhatsApp, and email providers.
- Keep Redis optional.
- Use `/health` for the health check.
- Back up PostgreSQL before destructive admin scripts.
- Add automated tests for authentication, role separation, payments, wallets, garage request races, OTP handover, media, and deletion cascades.

## Current Validation Status

- Every server JavaScript file in this snapshot passes `node --check`.
- Dependency installation completes with Node 20-compatible packages.
- Prisma generation on a fresh machine requires outbound access to Prisma's engine-binary host.
- No automated tests, lint script, or CI workflow are currently included.

## License

The package metadata declares ISC. Add a repository-level `LICENSE` file before public distribution.
