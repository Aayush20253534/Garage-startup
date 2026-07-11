# Rovauto

Rovauto is a full-stack vehicle-service marketplace for customers, garage partners, customer-support agents, interns, and administrators. The repository contains a React/Vite frontend and an Express API backed by PostgreSQL, PostGIS, and Prisma.

The current application supports customer accounts, saved locations and vehicles, city- and vehicle-specific service pricing, platform-fee checkout through Cashfree, automatic nearby-garage broadcasting, garage acceptance and wallet fees, pickup/delivery evidence, live tracking, support tickets and disputes, complaints, reviews, notifications, garage onboarding, and administrative operations.

## Application surfaces

| Surface | Confirmed capabilities |
| --- | --- |
| Public | Marketing pages, service catalog, public statistics, contact form, garage-partner application, and service-availability checks |
| Customer | Password/OTP/Google login, profile, location and vehicle management, service booking, wallet-assisted payment, garage-search tracking, handover OTP, history, support, complaints, reviews, notifications, SOS, and chatbot |
| Garage partner | Application and approval flow, password/OTP login, first-login password change, profile/services, booking requests, wallet recharge, acceptance fee, pickup/delivery inspection photos, and booking tracking |
| Customer support | Separate login and PWA shell, dashboard, ticket queue, claim/release/reply actions, customer notifications, push subscriptions, and outbound email history |
| Intern | Read-oriented operational console for services, garages, pricing, customers, bookings, and system issues |
| Admin | Catalogs, cities, contextual price ranges, garages/applications, customers, bookings, payments, support, staff accounts, system issues, and protected destructive operations |

## System architecture

```mermaid
flowchart LR
    Browser["Browser: React/Vite"] -->|HTTPS, cookies, CSRF header| API["Express API /api/v1"]
    API --> Controllers[Controllers]
    Controllers --> Services[Domain services]
    Services --> Prisma["Prisma 7 + PostgreSQL adapter"]
    Prisma --> DB[("PostgreSQL + PostGIS")]
    Services --> Redis[("Redis cache/rate limits")]
    Services --> Cashfree[Cashfree]
    Services --> Cloudinary[Cloudinary]
    Services --> Google[Google Maps Platform]
    Services --> Firebase[Firebase]
    Services --> Messaging["Resend, SMS, WhatsApp, Web Push"]
    Services --> Groq[Groq]
```

Important implementation facts:

- The frontend has five HTML/PWA shells (`main`, `support`, `admin`, `intern`, and `garage`) but they all boot the same `src/main.jsx` and `src/App.jsx` route tree.
- Authentication is cookie based. User/staff sessions use `accessToken`; customer support uses `supportAccessToken`. Session rows are revocable in PostgreSQL.
- Unsafe authenticated requests use a double-submit CSRF token (`rovautoCsrf` cookie plus `X-CSRF-Token` header). `client/src/api/axios.js` handles this automatically.
- Customers preview ranked nearby garages, but do not reserve the highlighted garage. Payment starts an automatic broadcast, and the first eligible garage to accept wins.
- PostgreSQL is the source of truth. Redis accelerates caches and distributed rate limits; development can run without it, while the production environment validator currently requires `REDIS_URL`.
- Two in-process workers run with the API: the garage-search worker and the system-issue auto-resolver. There is no external queue system.

## Technology stack

### Frontend

- React 18.3, React Router 6, and Vite 5
- Redux Toolkit, React Redux, and an application context provider
- Axios with credentials, CSRF handling, safe GET retries, and issue reporting
- Tailwind CSS 4 through `@tailwindcss/vite`
- Framer Motion, React Icons, React Helmet Async
- Firebase client authentication for Google sign-in
- Vercel Analytics and Speed Insights
- Multiple web manifests and service workers for role-specific PWAs

### Backend

- Node.js 20+ and Express 5
- Prisma 7 with `@prisma/adapter-pg`
- PostgreSQL with PostGIS distance queries and indexes
- JWT, HttpOnly cookies, Argon2, database-backed sessions, and CSRF protection
- Express Validator (the `zod` dependency is installed but is not imported by current source code)
- Cashfree, Cloudinary/Multer, Firebase Admin, Google Maps Platform, Groq, Resend, Web Push, SMS, and WhatsApp integrations
- Redis through ioredis, Helmet, CORS, compression, Morgan, and cookie-parser

## Repository layout

```text
Codebase/
|-- client/                    React/Vite application and frontend deployment files
|-- server/                    Express API, Prisma schema, migrations, and operations scripts
|-- .gitignore                 Root-only ignore rules
|-- 1.ps1                      PowerShell tree generator for project-architecture.txt
|-- docker-compose.yml         Builds frontend and backend; does not create PostgreSQL or Redis
|-- firebase.json              Root Firebase Hosting configuration for client/dist
|-- garage-partner-flow.md     Product-level garage and booking workflow notes
|-- project-architecture.txt   Generated tree snapshot; currently older than the source tree
|-- README.md                  Repository overview and quick start
`-- Detailed Schema.md         Local comprehensive guide; intentionally ignored by Git
```

Local-only ignored files can include root/client/server `.env` files, `notes.md`, and the notification PDF. `.agents/`, `.codex/`, and `.git/` are tooling/version-control metadata rather than runtime application code.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL with permission to enable/use PostGIS
- Git
- Optional for local development: Redis, Docker, and Docker Compose
- Provider credentials only for the integrations you plan to exercise

The repository uses npm in its Dockerfiles and documented workflows. A Bun lockfile and Bun supply-chain configuration also exist in `client/`; avoid switching package managers inside one change unless both lockfiles are intentionally reconciled.

## Local setup

### 1. Backend

```bash
cd server
npm ci
```

Copy `server/.env.example` to `server/.env` (`Copy-Item .env.example .env` in PowerShell, or `cp .env.example .env` in Bash). The minimum useful development configuration is:

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

Do not copy real credentials into documentation or Git. Then prepare the database and start the API:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed:admin
npm run dev
```

Endpoints:

```text
API base: http://localhost:5000/api/v1
Root:     http://localhost:5000/
Health:   http://localhost:5000/health
```

`GET /health` returns `{ "status": "ok" }`; it does not run a new database query.

### 2. Frontend

In another terminal:

```bash
cd client
npm ci
```

Copy `client/.env.example` to `client/.env`. A minimal local file is:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_MAPS_BROWSER_KEY=
VITE_GOOGLE_MAPS_MAP_ID=
```

Firebase values are needed for Google sign-in. The Maps browser key can instead be returned by the backend `/maps/config` endpoint when the server is configured. Start Vite:

```bash
npm run dev
```

Open `http://127.0.0.1:8080`.

## Environment configuration

The complete, source-verified variable catalogs are in [`client/README.md`](client/README.md) and [`server/README.md`](server/README.md). At a high level:

| Area | Main variables |
| --- | --- |
| Client API | `VITE_API_URL`, `VITE_API_FALLBACK_URL`, `VITE_USE_RELATIVE_API`, timeout/retry variables |
| Client Firebase/Maps | `VITE_FIREBASE_*`, `VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_GOOGLE_MAPS_MAP_ID` |
| Server core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, cookie lifetime |
| Origins | `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS` |
| Payments/media | `CASHFREE_*`, `CLOUDINARY_*` |
| Maps/AI | `GOOGLE_*`, `GROQ_*`, `CHATBOT_*` |
| Messaging | Firebase Admin, Resend/email, SMS, WhatsApp, and VAPID variables |
| Runtime tuning | Redis/cache, garage search, tracking, system-issue resolver, pricing, and OTP variables |

Vite variables are public build-time configuration. Never put server secrets in a `VITE_*` variable. The checked-in example files are helpful starting points but are not complete inventories; the READMEs document active variables that are currently missing from those examples.

## Available commands

There is no root `package.json`; run commands in `client/` or `server/`.

### Client

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on `127.0.0.1:8080` |
| `npm run build` | Production multi-entry bundle in `client/dist/` |
| `npm run build:dev` | Development-mode bundle |
| `npm run preview` | Preview the built bundle on `127.0.0.1:8080` |

### Server

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon |
| `npm start` | Start with Node |
| `npm run prisma:generate` | Generate Prisma Client only |
| `npm run prisma:migrate` | Create/apply development migrations |
| `npm run prisma:deploy` | Apply checked-in migrations in release environments |
| `npm run prisma:validate` | Validate schema/configuration |
| `npm run prisma:status` | Show migration status |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed:admin` | Create/update the configured admin account |
| `npm run push:generate-vapid-keys` | Generate Web Push VAPID keys |

The server also exposes destructive `db:*` maintenance commands. Read the target script and back up the database before using one. `seed:intern`, `seed:staff`, and `seed:all` are currently broken because `src/seed/seedIntern.js` is absent.

## Development workflow

1. Start PostgreSQL (and Redis if the feature/environment requires it).
2. Apply migrations before running code that depends on new tables or indexes.
3. Run the server, then the client.
4. Keep frontend route guards and backend role middleware aligned; backend authorization is authoritative.
5. Use the shared Axios instance for API calls so cookies, CSRF, retry, and issue-reporting behavior remain consistent.
6. Add database logic in services. This codebase does not have a repository abstraction; services call Prisma directly.
7. After changes, run the relevant build/syntax/schema checks and `git diff --check`.

Current validation commands:

```powershell
# client/
npm.cmd run build

# server/
npm.cmd run prisma:validate
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

The repository currently has no automated test suite, lint script, or CI workflow.

## Build and deployment

### Docker Compose

Create a root `.env` containing frontend build arguments and keep backend runtime values in `server/.env`, then run:

```bash
docker compose up --build
```

The frontend is served at `http://localhost:8080`; the backend is exposed at `http://localhost:5000`. Compose does not create PostgreSQL or Redis and the backend image does not run migrations. Apply `npm run prisma:deploy` separately. The current `server/.dockerignore` does not exclude `server/.env`, while the Dockerfile later runs `COPY . .`; fix that ignore rule before building or distributing any image from a context containing secrets.

### Frontend

- Vercel: use `client/` as the project root, `npm run build`, and `dist` as output. `client/vercel.json` contains the five shell rewrites, security headers, and an API proxy currently hard-coded to `https://rovauto.onrender.com`.
- Firebase Hosting: build first, then deploy with the intended Firebase config. `client/firebase.json` contains all five shell rewrites; the root `firebase.json` currently lags behind it for support/admin/intern shells.
- Docker/Nginx: `client/Dockerfile` builds the Vite bundle and `client/nginx.conf` provides SPA/PWA rewrites.

Changing a `VITE_*` value requires a new frontend build.

### Backend

No Render blueprint or other platform manifest is checked in, so configure the Node service manually or use `server/Dockerfile`. A normal release sequence is:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm start
```

Use `/health` for the platform health check. The PostGIS migration creates the extension and spatial indexes, so the deployment database user must have the required permission. In production, `src/config/env.js` requires HTTPS URLs, a strong JWT secret, Redis, Cashfree, Cloudinary, Firebase Admin, Resend, Web Push, and other core payment settings before the server will listen.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| CORS or missing-cookie errors | Confirm the exact frontend origin is in `ALLOWED_ORIGINS`; use `withCredentials`; use HTTPS in production; production cookies are `Secure` and `SameSite=None` |
| `Invalid CSRF token` | Use `src/api/axios.js`; confirm `GET /api/v1/csrf-token` succeeds and cookies are not blocked |
| Prisma cannot connect | Check `DATABASE_URL`; use `DIRECT_URL` for CLI migrations; verify SSL/provider requirements and PostGIS support |
| Server exits immediately in production | Read the startup error from `src/config/env.js`; production requires all validated provider variables, including `REDIS_URL` |
| Maps autocomplete or map fails | Check backend Google web-service key, browser key/referrer restrictions, enabled APIs, CSP, and `/api/v1/maps/config` |
| Payment remains pending | Confirm Cashfree mode/credentials, the HTTPS notify URL, webhook signature secret, and backend verification response |
| Upload reaches the API with no files | Send `FormData` without forcing JSON `Content-Type`; check route-specific count/size/type limits and Cloudinary variables |
| A static-host route opens the wrong PWA | Verify host rewrites for `support.html`, `admin.html`, `intern.html`, and `garage.html`; clear stale service-worker data after deployment changes |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` (and the local `.cmd` Prisma binary when necessary) |

## Confirmed gaps and leftovers

- No automated tests, linter, CI workflow, load-test baseline, or root `LICENSE` file is present.
- The production client build succeeds but warns that the main JavaScript chunk is about 550 kB minified; `src/assets/Rovauto_home.png` produces an approximately 2.21 MB asset.
- `server/package.json` references a missing `src/seed/seedIntern.js`; the derived staff seed commands fail.
- `db:activate-garage` uses `activateGarage.js`, while the tracked filename is `activategarage.js`; this is unsafe on case-sensitive deployment filesystems.
- Both `.env.example` files omit some active variables, and the server example contains duplicate/legacy entries.
- `server/.dockerignore` does not exclude `.env`, so a local secret file can be copied into the backend image by `COPY . .`.
- Root and client Firebase configs have drifted; the client-scoped file has the complete multi-shell routing.
- `project-architecture.txt` is a stale generated snapshot. Run `1.ps1` when a fresh tree is needed.
- Several files are not wired into active routes/imports, including the standalone reset-password page, garage Jobs/Leads/Earnings pages, a duplicate SOS guard, two garage mock-data files, and an empty legacy support router.
- `client/.rovauto/project.json` identifies an older TanStack Start TypeScript template even though the runtime is React/Vite JavaScript.

See `Detailed Schema.md` for the standalone beginner guide and the scoped READMEs for implementation details.

## Documentation

- [`client/README.md`](client/README.md) - frontend architecture, route tree, state, environment, build, and troubleshooting
- [`server/README.md`](server/README.md) - backend layers, endpoint catalog, database, environment, operations, and deployment
- [`garage-partner-flow.md`](garage-partner-flow.md) - product-level garage workflow notes
- `Detailed Schema.md` - comprehensive local guide; ignored by Git by request

## License

`server/package.json` declares ISC, but the repository does not contain a root `LICENSE` file. Add one before relying on that metadata for distribution.
