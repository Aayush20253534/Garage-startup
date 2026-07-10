# Rovauto

![Frontend](https://img.shields.io/badge/Frontend-React%2018-61DAFB)
![Backend](https://img.shields.io/badge/Backend-Express%205-339933)
![Database](https://img.shields.io/badge/Database-PostgreSQL-4169E1)
![ORM](https://img.shields.io/badge/ORM-Prisma%207-2D3748)
![Payments](https://img.shields.io/badge/Payments-Cashfree-6C47FF)
![Runtime](https://img.shields.io/badge/Node.js-%3E%3D20-339933)

Rovauto is a full-stack vehicle-service platform that connects customers, garage partners, customer-support agents, and administrators. The repository contains one React application with role-specific portals and one Express API backed by PostgreSQL and Prisma.

The current implementation covers customer onboarding, vehicle and location management, service discovery, checkout and payments, nearby-garage broadcasting, garage booking workflows, wallet operations, SOS requests, media uploads, push notifications, support tickets and disputes, support-agent operations, complaints, reviews, an AI support assistant, and an admin operations console.

## Product Surfaces

| Surface | Main capabilities |
| --- | --- |
| Customer | Signup/login, OTP and Google authentication, location onboarding, vehicle management, service booking, Cashfree payment, booking tracking, service history, wallet, notifications, complaints, reviews, SOS, profile, and chatbot history |
| Garage partner | Partner application, email/password and OTP login, garage profile, service management, incoming booking requests, accept/reject flow, pickup and delivery verification, inspection media, wallet, and settings |
| Customer support | Dedicated login/PWA shell, support dashboard, ticket queue, ticket claiming, dispute replies, support notifications, customer notifications, and support email history |
| Admin | Operational dashboard, customers, garages, garage applications, services, vehicle catalog, cities, city-specific price ranges, bookings, support tickets, support accounts, intern accounts, notifications, bulk email, dangerous operations, and system-issue monitoring |
| Public | Landing pages, service catalog, category pages, contact form, warranty information, partner application, public statistics, and service availability checks |

## Current Architecture

```mermaid
flowchart LR
    B[Browser] --> C[React + Vite client]
    C -->|HTTPS + HttpOnly cookie| A[Express API /api/v1]
    A --> S[Controllers and services]
    S --> P[Prisma 7 + PostgreSQL adapter]
    P --> D[(PostgreSQL)]

    S --> CF[Cashfree]
    S --> CL[Cloudinary]
    S --> FB[Firebase Admin]
    S --> RS[Resend]
    S --> SMS[SMS provider]
    S --> WA[WhatsApp provider / Meta webhook]
    S --> GM[Google Geocoding]
    S --> GQ[Groq]
    S --> R[(Optional Redis)]
```

### Important implementation details

- The browser authenticates with a single `accessToken` HttpOnly cookie. The frontend sends requests with `withCredentials: true`; it does not attach bearer tokens.
- The runtime database connection uses `DATABASE_URL`. Prisma CLI commands use `DIRECT_URL` through `server/prisma.config.ts`.
- Redis is optional and treated as a cache. PostgreSQL remains the source of truth.
- Google Geocoding is the active address provider. Groq can normalize a failed manual address before another Google lookup.
- A recurring backend worker advances garage-search rounds for paid bookings that remain in `SEARCHING_GARAGE`.
- Customer and garage-owner identities are role-scoped through compound unique constraints on email/role and phone/role. Admin and intern staff accounts live in `staff_accounts`; customer-support agents live in `customer_support_accounts`.

## Technology Stack

### Frontend

- React 18.3
- Vite 5
- React Router 6
- Redux Toolkit 2 and React Redux 9
- Axios
- Tailwind CSS 4 through `@tailwindcss/vite`
- Framer Motion
- Firebase client authentication
- Vercel Analytics and Speed Insights
- Nginx for the Docker production image

### Backend

- Node.js 20+
- Express 5
- Prisma 7 with `@prisma/adapter-pg`
- PostgreSQL
- JWT, HttpOnly cookies, and Argon2
- Zod and Express Validator
- Cloudinary and Multer
- Cashfree Payments
- Firebase Admin
- Redis through ioredis, optional
- Resend email
- Configurable SMS and WhatsApp providers
- Groq SDK
- Helmet, CORS, compression, Morgan, and cookie-parser

## Repository Layout

```text
Codebase/
├── client/
│   ├── public/
│   │   └── sw.js
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── config/
│   │   ├── data/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── booking/
│   │   │   ├── customer/
│   │   │   ├── garage/
│   │   │   └── sos/
│   │   ├── store/
│   │   └── utils/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vercel.json
│   └── README.md
├── server/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── scripts/
│   ├── src/
│   │   ├── admin/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── customer/
│   │   ├── garage/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── seed/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validations/
│   ├── Dockerfile
│   ├── .env.example
│   └── README.md
├── docker-compose.yml
├── garage-partner-flow.md
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL database
- Git
- Docker and Docker Compose, optional

Third-party credentials are only required for the integrations you intend to exercise. A database and JWT secret are required for the backend to start.

## Local Development

### 1. Clone and install the backend

```bash
git clone <repository-url>
cd Codebase/server
npm ci
```

Create the backend environment file:

```bash
cp .env.example .env
```

Minimum practical configuration:

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

Generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Seed an admin account when needed:

```bash
npm run seed:admin
```

Start the API:

```bash
npm run dev
```

Available locally at:

```text
API:    http://localhost:5000/api/v1
Root:   http://localhost:5000/
Health: http://localhost:5000/health
```

### 2. Install and start the frontend

Open another terminal:

```bash
cd Codebase/client
npm ci
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

VITE_ERROR_REPORTING_ENABLED=true
VITE_APP_VERSION=local
```

Start Vite:

```bash
npm run dev
```

The configured development URL is:

```text
http://127.0.0.1:8080
```

## Environment Groups

The server README documents every actively referenced variable. At a high level:

| Group | Variables |
| --- | --- |
| Core | `NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_COOKIE_MAX_AGE_MS` |
| Browser/CORS | `CLIENT_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS` |
| Payments | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `CASHFREE_NOTIFY_URL` |
| Media | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Google/Firebase | `GOOGLE_MAPS_API_KEY`, Google geocoding tuning variables, and Firebase service-account variables |
| Communication | Resend, SMS provider, and WhatsApp/Meta variables |
| AI | `GROQ_API_KEY`, model and timeout variables, chatbot limits |
| Caching/workers | Redis timeouts, cache TTLs, and garage-search worker settings |

Legacy Nominatim variables remain in `server/.env.example`, but the current geocoding service uses Google Geocoding rather than Nominatim.

## Main Application Routes

### Frontend

| Area | Representative routes |
| --- | --- |
| Public | `/`, `/services`, `/services/:categoryId`, `/how-it-works`, `/about`, `/partner`, `/contact`, `/warranty` |
| Customer auth | `/login`, `/register`, `/otp`, `/forgot` |
| Customer booking | `/booking/address`, `/booking/vehicle`, `/booking/services`, `/booking/garage`, `/checkout`, `/tracking` |
| Customer portal | `/dashboard`, `/dashboard/vehicles`, `/dashboard/bookings`, `/dashboard/history`, `/dashboard/payments`, `/dashboard/notifications`, `/dashboard/profile` |
| Garage | `/garage/login`, `/garage/otp-login`, `/garage/onboarding`, `/garage`, `/garage/bookings`, `/garage/services`, `/garage/wallet`, `/garage/profile`, `/garage/settings` |
| Admin | `/admin/login`, `/admin`, `/admin/customers`, `/admin/cars`, `/admin/services`, `/admin/garages`, `/admin/bookings`, `/admin/pending-bookings`, `/admin/revenue`, `/admin/payments`, `/admin/system-issues`, `/admin/support-tickets`, `/admin/customer-support-accounts`, `/admin/intern-accounts`, `/admin/dangerous` |
| Customer support | `/support/login`, `/support`, `/support/tickets`, `/support/notify`, `/support/notifications`, `/support/email` |
| SOS | `/sos`, `/sos/location`, `/sos/checkout`, `/sos/success` |

### API groups

All API routes are mounted under `/api/v1`.

```text
/auth                     Customer authentication and sessions
/customer                 Customer profile and account operations
/vehicles                 Customer vehicles
/locations                Geocoding and saved-location operations
/services                 Public services and media
/vehicle-meta             Public vehicle brands and models
/garages                  Garage search, profile, services, and media
/garage/applications      Partner applications and geocoding
/garage/requests          Garage booking-request lifecycle
/garage/wallet            Garage wallet and Cashfree recharge
/bookings                 Checkout, booking history, tracking, cancellation
/payments                 Customer payment order and verification
/wallet                   Customer wallet
/sos                      Emergency request creation and lookup
/reviews                   Customer reviews
/complaints               Customer complaints
/support-tickets           Customer support tickets and disputes
/notifications            Customer notifications
/chatbot                  Assistant history, ask, and clear
/activities               Customer activity feed
/cities                   Public and admin-managed cities
/system-issues            Frontend issue reporting
/customer-support          Support-agent dashboard, tickets, alerts, push, and email
/admin/*                   Admin operations and catalogs
/whatsapp                 WhatsApp health and webhook endpoints
/public/stats              Public platform statistics
```

## Customer Booking Lifecycle

```text
PENDING_PAYMENT
  -> SEARCHING_GARAGE
  -> GARAGE_ASSIGNED
  -> CONFIRMED
  -> IN_PROGRESS
  -> COMPLETED
```

Alternative terminal states are `CANCELLED` and `EXPIRED`.

The implemented flow is:

1. The customer must have a valid India location and at least one vehicle.
2. The customer selects one or more available services.
3. The backend creates a booking and Cashfree payment order.
4. Successful verification moves the booking into garage search.
5. Eligible nearby garages receive broadcast requests in batches.
6. The first valid acceptance wins; other requests expire.
7. Pickup uses a handover OTP and mandatory inspection images.
8. Delivery records another inspection phase.
9. The customer accepts delivery and may submit a review or complaint.

## Garage Partner Lifecycle

```text
PENDING
  -> CHANGES_REQUESTED
  -> PENDING
  -> APPROVED
```

An application may also end as `DENIED`.

Garage onboarding currently enforces 10 to 15 images, with a maximum size of 1 MB per onboarding image in the client flow. Admin approval creates or activates the garage-owner identity and garage record. Approved garages can configure services, receive nearby requests, and use wallet and booking workflows.

## Docker

The Compose file builds both services but does not create a PostgreSQL container. Point `DATABASE_URL` and `DIRECT_URL` to an accessible database.

Create a root `.env` for frontend build arguments:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Keep backend runtime variables in `server/.env`, then run:

```bash
docker compose up --build
```

Services:

```text
Frontend: http://localhost:8080
Backend:  http://localhost:5000
```

Useful commands:

```bash
docker compose up -d --build
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
docker compose down
```

The backend image generates Prisma Client but does not automatically run database migrations. Run `npm run prisma:deploy` as an explicit release step.

## Production Deployment

### Frontend

The client can be deployed in either form:

- Vercel using `client/vercel.json` for SPA rewrites and cache headers.
- The multi-stage Docker image, which serves `dist/` through Nginx.

Required production variable:

```env
VITE_API_URL=https://your-api-domain.example/api/v1
```

Vite variables are compiled into the frontend bundle. Changing them requires another build.

### Backend

Deploy the server as a Node.js service or from `server/Dockerfile`.

Recommended release sequence:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm start
```

Use `/health` as the platform health-check path. Add every production frontend origin to `ALLOWED_ORIGINS`, `CLIENT_URL`, or `FRONTEND_URL`. Cookie authentication also requires HTTPS in production because the cookie is marked `secure` when `NODE_ENV=production`.

## Available Scripts

### Client

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
```

### Server

```bash
npm run dev
npm start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:status
npm run prisma:studio
npm run seed:admin
```

The server also includes targeted data-cleanup and garage-administration scripts. Review their implementation and arguments before running them against any shared database. Current destructive cleanup scripts cover users, customer bookings/payments/history, garages, price ranges, bookings, customer/support notifications, support desk data, auth sessions and push endpoints, system issues, and full user nukes.

## Validation Performed on This Snapshot

- The frontend production build completes successfully.
- All backend JavaScript files pass `node --check` syntax validation.
- The repository currently has no automated test suite, no lint script, and no CI workflow.
- Prisma generation requires downloading Prisma engine binaries and therefore needs outbound network access on a fresh machine or build worker.

## Operational Notes

- `client/src/assets/Rovauto_home.png` is larger than 2 MB; compressing or converting large static images to WebP/AVIF would improve first-load performance.
- Keep Cashfree, Firebase, Cloudinary, Google Maps, Groq, SMS, and WhatsApp credentials out of Git.
- Use separate development, staging, and production databases.
- Set quotas and alerts on every paid external provider.
- Treat Redis as disposable acceleration, never as durable state.
- Add integration tests before allowing real payment, wallet, destructive admin, or booking-lifecycle traffic.

## Additional Documentation

- [`client/README.md`](client/README.md): frontend architecture, routes, state, environment, and deployment
- [`server/README.md`](server/README.md): API architecture, database, environment variables, endpoints, and scripts
- [`garage-partner-flow.md`](garage-partner-flow.md): product-level garage and booking flow diagrams

## License

The package metadata declares ISC. Add a root `LICENSE` file before distributing the repository publicly.
