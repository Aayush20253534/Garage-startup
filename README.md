# Rovauto

> Repository documentation verified against the codebase on 28 July 2026.

Rovauto is a multi-surface vehicle-service marketplace for customers, garage owners, garage controllers, no-account garage workers, customer-support agents, interns, sub-admins, and main administrators. The system combines city- and vehicle-aware service discovery, Cashfree payments, progressive garage dispatch, garage wallet fees, pickup/self-drop fulfilment, live tracking, inspection evidence, operational health monitoring, and customer support.

## Product surfaces

| Surface | Current capabilities |
| --- | --- |
| Public | Marketing pages, service catalogue, supported cities, garage discovery, public warranty mock page, contact, legal pages, garage-partner application, and the public worker-task route |
| Customer | Authentication, onboarding, saved locations, vehicles with model photos, service selection, pickup/self-drop choice, wallet/Cashfree platform-fee payment, garage search, pickup handover OTP, pickup/return/delivery tracking, one-time self-drop customer-to-garage tracking, inspection media, Cash/UPI final-payment submission, real 30-day warranty cards, detailed service timings, history, reviews, complaints, tickets, notifications, SOS, and chatbot |
| Garage owner | Garage profile and media, services and vehicle scopes, booking requests, wallet, controller management when enabled, no-account worker task assignment when controllers are disabled, pickup/return/delivery tracking, inspection media, and final-payment confirmation |
| Garage controller | Garage-scoped login, availability, assigned bookings, limited customer data, booking handling, tracking, evidence, and history |
| No-account worker | Secure booking-specific WhatsApp task link, Hindi/English instructions, browser voice guidance, pickup/return/delivery tracking, pickup handover OTP, self-drop arrival evidence without OTP, required photo/video evidence, customer-arrival confirmation, and payment-receipt confirmation without a Rovauto account |
| Customer support | Separate authentication/session, ticket claim/release/reply, outbound notifications and email history, and push subscriptions |
| Intern | Price-range operations, staff-authorised operational pages, and the same System Health centre used by admins |
| Admin/Sub-admin | Customers, bookings, garages, fulfilment and controller settings, services, cities, price operations, support, worker-task intervention, System Health, and permitted staff administration |
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
    Services --> Providers["Cashfree, Cloudinary, Google Maps, Firebase, Resend, WhatsApp, Web Push, Groq"]
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
- Inspection evidence requires 5-15 images and exactly one video for each pickup/delivery phase.
- Vehicle model photos are managed in Admin Cars and shown on customer vehicle cards when a brand/model match exists.
- A shared elapsed timer starts at garage acceptance; final Cash/UPI details remain pending until garage confirmation completes the booking.
- Customer warranty cards appear for completed bookings for 30 days, then remain visible as expired.
- System Health combines System Issues and Integration Health for main admin, sub-admin, and intern roles.

## Technology

### Web client

- React 18.3, React Router 6, Redux Toolkit, Axios, and Vite 5
- Tailwind CSS 4, Framer Motion, React Icons, and React Helmet Async
- Five role-aware HTML/PWA shells: public/customer, garage, admin, intern, and customer support
- Firebase browser authentication for Google sign-in
- Vercel Analytics and Speed Insights

### Server

- Node.js 22+, Express 5, Prisma 7, PostgreSQL/PostGIS, and Redis
- HttpOnly browser sessions backed by revocable database session records
- Argon2 passwords, staff two-factor challenges, OTP attempt controls, CSRF, CORS, Helmet, rate limits, and request correlation IDs
- Cashfree, Cloudinary, Firebase Admin, Google Maps, Groq, Resend, WhatsApp Cloud API, web push, and optional SMS providers
- 70 Node security/regression tests under `server/test/security`

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
|-- docker-compose.yml              Optional container composition
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

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL with PostGIS
- Redis for production-equivalent operation
- Provider credentials only for integrations being exercised

## Local development

### Server

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
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_MAPS_BROWSER_KEY=
VITE_GOOGLE_MAPS_MAP_ID=
```

Open `http://127.0.0.1:8080`.

### Mobile customer app

```bash
cd mobile/apps/customer
npm ci
# Create .env manually with EXPO_PUBLIC_API_URL when needed
npm run start
```

The current API fallback is `https://api.rovauto.com/api/v1`. Set `EXPO_PUBLIC_API_URL` for local or staging work.

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

When a migration exists, apply `npm run prisma:deploy` before starting application code that depends on it. The current latest migration is `20260728090000_add_garage_worker_task_mode`.

## Deployment notes

- The frontend currently uses path-based portals such as `/admin`, `/intern`, `/garage`, `/support`, and `/dashboard`; they are not separate subdomains.
- `rovauto.com` and `www.rovauto.com` belong to the frontend deployment. `api.rovauto.com` belongs to the backend/reverse proxy.
- Preserve all five HTML/PWA shell rewrites when changing hosting providers.
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
