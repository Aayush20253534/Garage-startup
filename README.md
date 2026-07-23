# Rovauto

> Implementation reference verified against the repository on 23 July 2026.

Rovauto is a full-stack vehicle-service marketplace for customers, garage owners, garage controllers/staff, customer-support agents, interns, and administrators. The platform combines service discovery, city/vehicle-aware estimates, online platform-fee collection, progressive nearby-garage dispatch, garage wallet fees, pickup and delivery evidence, live tracking, support, and operational administration.

## Current product surfaces

| Surface | Main capabilities |
| --- | --- |
| Public | Marketing pages, service catalogue, supported cities, public statistics, contact form, garage-partner application, legal pages, and maps-assisted address lookup |
| Customer | Password/OTP/Google authentication, onboarding, profile/avatar, vehicles, saved locations, service checkout, wallet/Cashfree payment, garage search, handover OTP, tracking, delivery acceptance, history, reviews, complaints, tickets, notifications, SOS, and chatbot |
| Garage owner | Owner login, profile/services, booking leads, accept/reject, wallet recharge, pickup/delivery evidence, tracking, account deletion, and garage-wise controller management |
| Garage controller/staff | Login from the garage login screen, availability, assigned work, limited customer-data access, booking acceptance/handling, and combined garage history with privacy filtering |
| Customer support | Separate session cookie and PWA, ticket claim/release/reply, notifications, push subscriptions, customer notifications, and outbound email history |
| Intern | Read-oriented operational views plus moderated price-range submission workflows |
| Admin | Catalogues, cities, price moderation, garages/applications, garage controllers and per-garage limits, customers, bookings, revenue/payments, support, staff accounts, system issues, and protected maintenance commands |

## Architecture at a glance

```mermaid
flowchart TD
    UI["React/Vite multi-surface client"] -->|"HTTPS + cookies + CSRF"| API["Express 5 API /api/v1"]
    API --> Domain["Controllers and domain services"]
    Domain --> Prisma["Prisma 7 / pg adapter"]
    Prisma --> DB[("PostgreSQL + PostGIS")]
    Domain --> Redis[("Redis cache and distributed limits")]
    Domain --> Providers["Cashfree, Google Maps, Cloudinary, Firebase, Resend, WhatsApp, SMS, Web Push, Groq"]
    Workers["In-process workers"] --> Domain
```

PostgreSQL is the source of truth. Redis accelerates reads and rate limits but is not a queue or system of record. The API process also runs the garage-search worker, garage-application email outbox worker, system-issue auto-resolver, and session-retention cleanup.

The detailed, code-verified design is in [`important/Architecture.md`](important/Architecture.md). Database ownership is in [`important/Database.md`](important/Database.md), security controls in [`important/security.md`](important/security.md), error policy in [`important/error handling.md`](important/error%20handling.md), and the delivery roadmap in [`important/Phases.md`](important/Phases.md).

## Technology

### Client

- React 18.3, React Router 6, Redux Toolkit, Axios, and Vite 5
- Tailwind CSS 4, Framer Motion, React Icons, and React Helmet Async
- Five HTML/PWA shells: customer/public, garage, admin, intern, and customer support
- Firebase client authentication for Google sign-in
- Vercel Analytics and Speed Insights

### Server

- Node.js 22+, Express 5, Prisma 7, and PostgreSQL/PostGIS
- HttpOnly JWT cookies backed by revocable database sessions
- Argon2 passwords, staff two-factor challenges, OTP hardening, CSRF, Helmet, strict CORS, rate and concurrency limits
- Cashfree, Cloudinary, Firebase Admin, Google Maps, Groq, Resend, WhatsApp, SMS, and Web Push
- Node's built-in test runner with 50 security/regression test files

## Repository layout

```text
/
|-- client/                         React/Vite application
|-- server/                         Express API, Prisma schema, migrations, tests, and scripts
|-- important/                      Canonical architecture and engineering guides
|-- garage-partner-flow.md          Current garage and booking lifecycle
|-- docker-compose.yml              Client/server containers; no database or Redis container
|-- firebase.json                   Firebase hosting rules
`-- README.md                       Full-stack entry point
```

`client/AGENTS.md` is an agent/tooling instruction file and is intentionally not product documentation.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL with PostGIS available
- Redis for production and production-equivalent testing
- Provider credentials for the integrations being exercised

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

Minimum development variables:

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

For `npm run seed:admin`, also set `ADMIN_LOGIN_ID`, `ADMIN_NAME`, and `ADMIN_PASSWORD`.

### Client

```bash
cd client
npm ci
cp .env.example .env
npm run dev
```

Typical client configuration:

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

## Health endpoints

| Endpoint | Meaning |
| --- | --- |
| `GET /health/live` | Process liveness only |
| `GET /health` | Readiness; checks PostgreSQL and Redis with two-second timeouts |
| `GET /health/ready` | Alias of readiness |
| `GET /api/v1/csrf-token` | Seeds/returns the browser double-submit CSRF token |

Readiness returns HTTP `503` when either PostgreSQL or Redis is unavailable.

## Commands

### Client

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Production multi-entry build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview `dist/` |

### Server

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm start` | Development/production start |
| `npm test` / `npm run test:security` | Run the security/regression suite |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:deploy` | Apply checked-in production migrations |
| `npm run prisma:status` | Inspect migration status |
| `npm run prisma:check-client` | Confirm generated client matches required models |
| `npm run db:backup` | Create a PostgreSQL custom-format backup |
| `npm run db:recovery-drill` | Restore and validate an isolated recovery database |
| `npm run deploy:smoke` | Check frontend, API readiness, and CSRF issuance |

The `db:delete-*`, `db:nuke-users`, and admin cleanup commands are destructive. Read [`server/docs/RECOVERY_RUNBOOK.md`](server/docs/RECOVERY_RUNBOOK.md), take a verified backup, and confirm the target database before use.

`seed:intern`, `seed:staff`, and `seed:all` currently reference the absent `src/seed/seedIntern.js`; use the admin UI for intern creation until that script is implemented.

## Validation before merging or deployment

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
```

Also run `git diff --check`. A production release must apply `npm run prisma:deploy` before starting application code that depends on a new schema.

## Deployment notes

- Production startup validates critical secrets and provider configuration before connecting.
- The backend container does not apply migrations automatically; the release workflow must do so.
- Docker Compose does not provision PostgreSQL or Redis.
- Vercel/Firebase/Nginx rewrites must preserve all five application shells.
- Never place secrets in `VITE_*`; Vite values are public build-time configuration.
- Keep Cashfree and WhatsApp webhook URLs outside browser authentication and CSRF, but always verify their provider signatures.

## Documentation ownership

When behavior changes, update the code and its owning document in the same patch:

| Change | Update |
| --- | --- |
| Route, auth, flow, worker, provider | `important/Architecture.md` |
| Prisma model, index, constraint, migration | `important/Database.md` |
| Auth, secrets, permissions, privacy | `important/security.md` |
| Error code, retry, logging, recovery | `important/error handling.md` |
| Product/scale milestone | `important/Phases.md` |
| Customer-facing chatbot behavior | `server/src/customer/knowledge/*.md` |
