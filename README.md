# Rovauto

> Repository documentation verified against the codebase on 8 August 2026.

Rovauto is a multi-surface vehicle-service marketplace for customers, garage owners, garage controllers, no-account garage workers, customer-support agents, interns, sub-admins, and main administrators. The system combines city- and vehicle-aware service discovery, Cashfree payments, progressive garage dispatch, garage wallet fees, pickup/self-drop fulfilment, live tracking, inspection evidence, operational health monitoring, and customer support.

## Product surfaces

| Surface | Current capabilities |
| --- | --- |
| Public | Marketing pages, service catalogue, supported cities, garage discovery, public warranty mock page, contact, legal pages, garage-partner application, and the public worker-task route |
| Customer | Authentication, onboarding, saved locations, vehicles with model photos, service selection, pickup/self-drop choice, wallet/Cashfree platform-fee payment, garage search, pickup handover OTP, pickup/return/delivery tracking, one-time self-drop customer-to-garage tracking, inspection media with browser-compatible video playback, Cash/UPI final-payment submission, real 30-day warranty cards, compact service history with detailed black-and-white PDF export, reviews, complaints, tickets, notifications, SOS, and chatbot |
| Garage owner | Garage profile and media, services and vehicle scopes, booking requests, wallet, controller management when enabled, no-account worker task assignment when controllers are disabled, pickup/return/delivery tracking, inspection media, and final-payment confirmation |
| Garage controller | Garage-scoped login, availability, assigned bookings, limited customer data, booking handling, tracking, evidence, and history |
| No-account worker | Secure booking-specific WhatsApp task link, Hindi/English instructions, browser voice guidance, pickup/return/delivery tracking, pickup handover OTP, self-drop arrival evidence without OTP, required photo/video evidence, customer-arrival confirmation, and payment-receipt confirmation without a Rovauto account |
| Customer support | Separate authentication/session, ticket claim/release/reply, first-booking verification lead queue with claim/call/approve/reject, outbound notifications and email history, and push subscriptions |
| Intern | Price-range operations, read-only customer session-history/vehicle registry access where permitted, staff-authorised operational pages, and the same System Health centre used by admins |
| Admin/Sub-admin | Customers, customer login-history/session revocation, bookings, garages, vehicle registry/live RC lookup, fulfilment and controller settings, services, cities, price operations, support, worker-task intervention, System Health, and permitted staff administration |
| Main admin | All admin capabilities plus main-admin-only account and dangerous-operation controls |

## Architecture

```mermaid
flowchart TD
    Browser["React/Vite web client"] -->|HTTPS, cookies, CSRF| API["Express API /api/v1"]
    Mobile["Expo customer app - early implementation"] -->|Bearer token target| API
    Worker["Temporary worker task page"] -->|Secure task token| API
    API --> Services["Domain services and controllers"]
    Services --> Prisma["Prisma 7"]
    Prisma --> DB[(PostgreSQL/PostGIS)]
    Services --> Redis[(Redis)]
    Services --> Providers["Cashfree, Cloudinary, Google Maps, Firebase, Resend, WhatsApp, Web Push, Groq, Way2API"]
    Jobs["In-process workers"] --> Services
```

PostgreSQL is the source of truth. Redis is used for cache, rate limits, and operational coordination, but not as the durable record for bookings, payments, tasks, or warranties. Customer warranties are derived from completed bookings rather than stored in a separate warranty table.

## Current operational rules

- Garage matching validates fulfilment mode, brand coverage, model/service scopes, exclusions, active status, distance, and availability.
- A self-drop-only garage does not receive pickup requests.
- A garage that supports `BMW` with an active `BMW / ALL` or `ALL / ALL` service scope can receive a BMW X1 request unless an exclusion blocks it.
- `controllerAccountsEnabled=true` keeps the existing controller workflow.
- `controllerAccountsEnabled=false` revokes controller sessions and enables secure WhatsApp worker-task links.
- Worker links are booking- and stage-specific, expire automatically, and never expose wallet, payment, or unrelated customer data.
- Inspection evidence requires 5-15 images and exactly one video for each pickup/delivery phase. New videos are uploaded as browser-compatible H.264 MP4 assets; the UI distinguishes selected files from successfully uploaded evidence and provides retry/direct-open playback fallbacks.
- Customer payment actions are accepted daily from 10:00 AM inclusive until 12:00 AM midnight exclusive in `Asia/Kolkata`; both client and server enforce the same rule, and the server remains authoritative.
- Pending-booking counts and payment state use compact corner cards rather than oversized capsules. Completed bookings use a minimal history layout with expandable timings and a detailed black-and-white A4 PDF generated in the browser.
- Vehicle model photos are managed in Admin Cars and shown on customer vehicle cards when a brand/model match exists.
- A shared elapsed timer starts at garage acceptance; final Cash/UPI details remain pending until garage confirmation completes the booking.
- Customer warranty cards appear for completed bookings for 30 days, then remain visible as expired.
- System Health combines System Issues and Integration Health for main admin, sub-admin, and intern roles.
- New customer accounts require a Way2API-backed RC registration check before saving/using a vehicle; customers that existed when the migration was introduced remain optional for backward compatibility. Customer vehicle creation and RC verification/change are each limited to 3 attempts per rolling 24 hours.
- Admin Vehicles separates the Way2API RC registered owner from the Rovauto account name, supports explicit live RC lookup for authorised staff, and never substitutes the Rovauto account phone as an RC-registered phone because Way2API does not return that field.
- Admin customer profiles expose retained login/session history, currently logged devices, and an ADMIN/SUB_ADMIN logout-from-all-devices action.
- Eligible first bookings with estimated service total up to the configured limit enter `PENDING_VERIFICATION`; support claims/calls/approves the lead before garage search and the one-time platform-fee offer is consumed when the lead is created.

## Technology

### Vehicle registration verification (Way2API)

Production configuration requires registration verification to remain enabled and requires a real Way2API key. Development can omit exercising the provider only when the relevant flow is not being tested:

```env
VEHICLE_REGISTRATION_VERIFICATION_ENABLED=true
WAY2API_API_KEY=<server-only-api-key>
WAY2API_RC_URL=https://app.way2api.com/api/v1/rc/verify
WAY2API_RC_TIMEOUT_MS=12000
```

Do not put the API key in `client/.env` or any `VITE_*` value. Production environment validation rejects `VEHICLE_REGISTRATION_VERIFICATION_ENABLED=false` and rejects a missing `WAY2API_API_KEY`. Existing customer accounts created before the registration migration keep `vehicleRegistrationRequired=false`; new customer signup paths set it to `true`.

The first-booking verification worker also uses the documented `FIRST_BOOKING_*` server variables.

### Web client

- React 18.3, React Router 6, Redux Toolkit/React Redux for client-owned state, TanStack Query 5 for server-state caching, Axios, and Vite 5
- Tailwind CSS 4, Framer Motion, React Icons, and React Helmet Async
- Five role-aware HTML/PWA shells: public/customer, garage, admin, intern, and customer support
- Firebase browser authentication for Google sign-in
- Vercel Analytics and Speed Insights

### Server

- Node.js 22+, Express 5, Prisma 7, PostgreSQL/PostGIS, and Redis
- HttpOnly browser sessions backed by revocable database session records
- Argon2 passwords, staff two-factor challenges, OTP attempt controls, CSRF, CORS, Helmet, rate limits, and request correlation IDs
- Cashfree, Cloudinary, Firebase Admin, Google Maps, Groq, Resend, WhatsApp Cloud API, web push, Way2API RC verification, and optional SMS providers
- 80 Node security/regression test files under `server/test/security` (301 current `test(...)` cases)

### Mobile

- Expo SDK 57, Expo Router, React Native 0.86, React Query, Axios, SecureStore, Zustand, React Hook Form, and Zod
- The mobile customer application is an early implementation: the route structure and API/storage foundations exist, while many screens remain placeholders

## Repository layout

```text
/
|-- client/                         React/Vite web application
|-- server/                         Express API, Prisma schema, migrations, tests, scripts
|-- mobile/apps/customer/           Expo customer application
|-- important docs/                 Canonical architecture and operational documentation
|-- docker-compose.yml              Recommended local full-stack composition
|-- firebase.json                   Firebase hosting configuration
`-- README.md                       Full-stack entry point
```

Canonical documentation:

- [Architecture](important%20docs/Architecture.md)
- [Database](important%20docs/Database.md)
- [Security](important%20docs/security.md)
- [Error handling](important%20docs/error%20handling.md)
- [Delivery phases](important%20docs/Phases.md)
- [Garage partner flow](important%20docs/garage-partner-flow.md)
- [Pickup and self-drop rules](important%20docs/Self%20drop%20off%20system.md)
- [WhatsApp worker template](important%20docs/WHATSAPP_WORKER_TASK_TEMPLATE.md)
- [Recovery runbook](server/docs/RECOVERY_RUNBOOK.md)

## Prerequisites

Choose either Docker Desktop/Compose or the manual Node setup.

- Docker Desktop with Docker Compose v2 for the recommended local stack
- Node.js 22 or newer and npm 10 or newer for manual development
- PostgreSQL 16 with PostGIS when the database is not run through Compose
- Redis for production-equivalent manual operation
- Provider credentials only for integrations being exercised

## Local development

### Docker Compose — recommended

From the repository root:

```powershell
Copy-Item .\server\.env.example .\server\.env   # first run only
# Edit server/.env when testing optional integrations or seed credentials.

docker compose config
docker compose up -d --build
docker compose ps
```

Open `http://localhost:8080`. The API is also published at `http://localhost:5000`, while browser requests normally use the same-origin Nginx proxy at `/api/v1`.

```powershell
# Follow startup, migration, and application logs
docker compose logs -f backend

# Seed the optional local admin after the stack is healthy
docker compose exec backend npm run seed:admin

# Stop without deleting PostgreSQL/Redis data
docker compose down
```

Compose runs `postgis/postgis:16-3.5-alpine`, Redis 7, the Node backend, and the Nginx-served production client. The backend entrypoint retries `prisma migrate deploy`, verifies the generated Prisma client, and then starts the API. Do not run `docker compose down -v` unless you intentionally want to erase the local database and Redis volumes.

### Manual server

```bash
cd server
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run seed:admin
npm run dev
```

Minimum local variables:

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
```

For the worker-task flow, configure the WhatsApp template variables in `server/.env.example`. The secure task is still created when automatic WhatsApp delivery fails, allowing the manager to copy the URL manually.

### Web client

```bash
cd client
npm ci
cp .env.example .env
npm run dev
```

Typical local configuration:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_ERROR_REPORTING_ENABLED=false
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Google Maps browser configuration is fetched from `GET /api/v1/maps/config`; keep `GOOGLE_MAPS_BROWSER_KEY` and `GOOGLE_MAPS_MAP_ID` in `server/.env`, not in the client file. Open `http://127.0.0.1:8080`.

### Mobile customer app

```bash
cd mobile/apps/customer
npm ci
# Create .env manually with EXPO_PUBLIC_API_URL when needed
npm run start
```

The current API fallback is `https://api.rovauto.com/api/v1`. Set `EXPO_PUBLIC_API_URL` for local or staging work.

## Frontend state ownership

The web client now uses three different state layers deliberately:

| State | Owner | Examples |
| --- | --- | --- |
| Server/API data | TanStack Query | dashboard, profile, vehicles fetch lifecycle, active/history bookings, service categories, vehicle catalogue, admin vehicles, customer login history |
| Shared client-owned interaction state | Redux Toolkit | authenticated customer/garage UI state, selected vehicle/location, booking cart and cart pricing context |
| Page-local UI | React component state / URL params | forms, modals, dropdowns, transient filters |

TanStack Query is an application-memory cache and does not depend on the browser HTTP cache. PostgreSQL remains authoritative; Redis remains the shared backend cache/rate-limit layer. Some legacy Redux fields mirror server data for compatibility, but new server-state fetch/cache logic should use query keys and invalidation instead of creating another localStorage cache.

Logout clears the QueryClient so cached data cannot cross accounts. Authentication itself remains server/session-cookie authoritative.

## Health endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | Process liveness |
| `GET /health` | PostgreSQL and Redis readiness |
| `GET /health/ready` | Readiness alias |
| `GET /api/v1/csrf-token` | Issue/read the browser CSRF token |
| `GET /api/v1/admin/integration-health` | Staff-authenticated provider/infrastructure checks |
| `GET /api/v1/admin/system-issues` | Staff-authenticated issue queue |

Readiness returns HTTP `503` if PostgreSQL or Redis is unavailable. Integration Health can return `OPERATIONAL`, `DEGRADED`, `OUTAGE`, or `NOT_CONFIGURED` per provider without changing the public readiness response.

## Important commands

### Client

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
```

### Server

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status
npm run prisma:check-client
npm test
npm run db:backup
npm run db:recovery-drill
npm run deploy:smoke
```

Destructive `db:delete-*` and `db:nuke-users` commands require a verified backup and explicit target confirmation. Follow the recovery runbook before running them.

## Release validation

```bash
cd server
npm ci
npm run prisma:validate
npm run prisma:generate
npm run prisma:check-client
npm test

cd ../client
npm ci
npm run build

git diff --check
```

When a migration exists, apply `npm run prisma:deploy` before starting application code that depends on it. The current latest migration is `20260807174500_add_full_rc_owner_name`; 57 migration directories are checked in.

## Deployment notes

- The frontend currently uses path-based portals such as `/admin`, `/intern`, `/garage`, `/support`, and `/dashboard`; they are not separate subdomains.
- `rovauto.com` and `www.rovauto.com` belong to the frontend deployment. `api.rovauto.com` belongs to the backend/reverse proxy.
- Preserve all five HTML/PWA shell rewrites when changing hosting providers. The included Nginx configuration already routes `/admin`, `/intern`, `/garage`, `/support`, and public/customer paths to the correct documents.
- The local Compose database must be PostGIS-enabled because checked-in migrations create the `postgis` extension and geospatial indexes.
- Never place secrets in `VITE_*` or `EXPO_PUBLIC_*` variables.
- Cashfree and WhatsApp webhooks bypass browser CSRF but require provider signature verification.
- Browser live tracking depends on HTTPS, location permission, and the worker keeping the task page active. A future native worker app is the stronger background-tracking option.

## Documentation ownership

Update documentation in the same patch as behaviour changes:

| Change | Owning document |
| --- | --- |
| Routes, flows, workers, providers | `important docs/Architecture.md` |
| Models, constraints, migrations | `important docs/Database.md` |
| Authentication, permissions, secrets, privacy | `important docs/security.md` |
| Error codes, retries, logging, recovery | `important docs/error handling.md` |
| Product delivery and scale milestones | `important docs/Phases.md` |
| Garage operations and dispatch | `important docs/garage-partner-flow.md` |
| Customer chatbot answers | `server/src/customer/knowledge/*.md` |
| Docker images, Compose, proxying, and local startup | root `README.md`, `client/README.md`, and `server/README.md` |

## Commit message convention

Use one descriptive commit per coherent change:

```text
feat: add or materially extend a user-facing capability
fix: correct broken or incorrect behaviour
update: revise configuration, documentation, dependencies, or an existing implementation
temp: temporary diagnostic or test-only change
```

Do not keep `temp:` changes in a production pull request unless the temporary nature is intentional and documented.
