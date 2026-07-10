# Rovauto Client

The Rovauto client is a React 18 single-page application for public visitors, customers, garage partners, customer-support agents, interns, and administrators. It uses one route tree with role-aware layouts and guards, communicates with the backend through Axios, and relies on an HttpOnly authentication cookie rather than storing JWTs in JavaScript.

## Stack

- React 18.3 and React DOM
- Vite 5
- React Router DOM 6
- Redux Toolkit 2 and React Redux 9
- Axios
- Tailwind CSS 4 through `@tailwindcss/vite`
- Framer Motion
- React Icons
- Firebase client authentication
- Vercel Analytics and Speed Insights
- Nginx in the Docker production image

## Implemented Areas

### Public experience

- Home, services, category details, how it works, about, partner, contact, and warranty pages
- Admin-managed service categories and thumbnails
- Public statistics
- Garage-partner application and onboarding entry points
- Responsive navigation, footer, chatbot launcher, and fallback pages

### Customer experience

- Email/password signup and login
- Email or phone OTP flows
- Google authentication through Firebase
- Forgot/reset-password flow
- Required location onboarding
- Required first-vehicle onboarding
- Service and garage selection
- Cashfree checkout and verification
- Booking tracking, active bookings, service history, and payments
- Vehicle, profile, notification, wallet, complaint, review, and SOS-related interfaces
- Support tickets, disputes, ticket messages, attachments, and chatbot history
- Persisted assistant conversation history

### Garage experience

- Garage login, OTP login, forgot-password, onboarding, and magic-link pages
- Dashboard, bookings, booking details, services, wallet, profile, and settings
- Request acceptance/rejection
- Handover OTP and pickup/delivery inspection workflows

### Admin experience

- Dashboard
- Customers
- Vehicle brands and models
- Service categories and services
- Garages and garage applications
- Bookings
- City/service price ranges
- System issues
- Support tickets and disputes
- Customer-support account management
- Intern account management
- Notifications, support alerts, dangerous operations, and bulk email

### Customer support experience

- Dedicated support login and installable support PWA shell
- Support dashboard and ticket queue
- Ticket claiming/releasing, public replies, internal notes, and status updates
- Received support alerts, customer notifications, and recorded support email

## Application Structure

```text
client/
├── public/
│   └── sw.js                    Cloudinary image service worker
├── src/
│   ├── api/                     Axios instance and API helpers
│   ├── assets/                  Bundled Rovauto brand/site images
│   ├── components/              Shared interface components
│   ├── config/                  Firebase client configuration
│   ├── data/                    UI metadata and fallback display data
│   ├── hooks/                   App provider and reusable hooks
│   ├── layouts/                 Public and dashboard layouts
│   ├── pages/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── booking/
│   │   ├── customer/
│   │   ├── garage/
│   │   └── sos/
│   ├── store/                   Redux store and slices
│   ├── utils/                   Auth, location, payment, cache, and error helpers
│   ├── App.jsx                  Route tree and route guards
│   ├── index.css
│   └── main.jsx
├── Dockerfile
├── nginx.conf
├── vercel.json
├── vite.config.js
└── package.json
```

## Setup

Requirements:

- Node.js 20+
- npm 10+
- A running Rovauto API

Install dependencies:

```bash
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

Start development mode:

```bash
npm run dev
```

Vite is configured for:

```text
http://127.0.0.1:8080
```

## Environment Variables

| Variable                         | Required        | Purpose                                                                                                      |
| -------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `VITE_API_URL`                 | Production: yes | Base API URL. Production builds throw when it is missing. Local fallback is`http://localhost:5000/api/v1`. |
| `VITE_FIREBASE_API_KEY`        | For Google auth | Firebase web API key                                                                                         |
| `VITE_FIREBASE_AUTH_DOMAIN`    | For Google auth | Firebase auth domain                                                                                         |
| `VITE_FIREBASE_PROJECT_ID`     | For Google auth | Firebase project ID                                                                                          |
| `VITE_FIREBASE_APP_ID`         | For Google auth | Firebase application ID                                                                                      |
| `VITE_ERROR_REPORTING_ENABLED` | No              | Set to`false` to disable browser issue reports                                                             |
| `VITE_APP_VERSION`             | No              | Release label attached to system-issue reports                                                               |

Vite injects these values at build time. They are public configuration values and must never contain private server credentials.

## Scripts

```bash
npm run dev        # Vite dev server on 127.0.0.1:8080
npm run build      # Production bundle in dist/
npm run build:dev  # Development-mode bundle
npm run preview    # Preview dist/ on 127.0.0.1:8080
```

The current repository has no lint, unit-test, or end-to-end-test script.

## API Client and Authentication

The shared client is defined in `src/api/axios.js`.

```js
axios.create({
  baseURL: VITE_API_URL,
  withCredentials: true,
  timeout: 20000,
});
```

Key behavior:

- Authentication uses the backend `accessToken` HttpOnly cookie.
- No bearer token is read from local storage or attached to requests.
- Multipart requests remove the default JSON content type so the browser can generate the boundary.
- Recognized expired-session responses clear the local role hint and dispatch `rovauto:session-expired`.
- Network failures and selected critical API failures are sent to `/system-issues/report` unless disabled.

The local-storage key `rov_session_role` is only a UI/session hint. Backend authorization remains authoritative.

## Route Guards

`src/App.jsx` defines three important guards:

| Guard              | Behavior                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| `ProtectedRoute` | Requires a customer, garage, or admin session according to the URL prefix        |
| `AddressCheck`   | Redirects customers without a usable saved India location to`/booking/address` |
| `VehicleCheck`   | Redirects customers without a vehicle to`/booking/vehicle`                     |

The SOS routes use `SOSAvailabilityGuard`, which reads the service catalog and blocks the flow when roadside assistance is marked as coming soon.

## Route Map

### Public and authentication

```text
/
/services
/services/:categoryId
/how-it-works
/about
/partner
/contact
/warranty
/login
/register
/otp
/forgot
/admin/login
/garage/login
/garage/otp-login
/garage/forgot-password
/garage/onboarding
/garage/magic/:id
/garage/requests/:id
```

`/reset-password` currently redirects to `/forgot`.

### Customer booking

```text
/booking/address
/booking/vehicle
/booking/services
/booking/garage
/checkout
/tracking
```

### Customer portal

```text
/dashboard
/dashboard/vehicles
/dashboard/bookings
/dashboard/history
/dashboard/payments
/dashboard/notifications
/dashboard/profile
```

### Garage portal

```text
/garage
/garage/bookings
/garage/bookings/:id
/garage/services
/garage/wallet
/garage/profile
/garage/settings
```

### Admin portal

```text
/admin
/admin/customers
/admin/cars
/admin/services
/admin/garages
/admin/bookings
/admin/pending-bookings
/admin/revenue
/admin/payments
/admin/system-issues
/admin/support-tickets
/admin/customer-support-accounts
/admin/intern-accounts
/admin/dangerous
```

### Customer support portal

```text
/support/login
/support
/support/tickets
/support/notify
/support/notifications
/support/email
```

### SOS

```text
/sos
/sos/location
/sos/checkout
/sos/success
```

## State Management

The application combines:

- Redux Toolkit for customer-facing cached state
- `AppProvider` in `src/hooks/useApp.jsx` for session, garage, location, booking, and compatibility state
- Local storage for selected persistence and lightweight activity records
- Server state fetched through Axios helpers

The Redux store currently contains `customerSlice` and `garageSlice`. Keep cache invalidation synchronized with write operations, especially profile, location, vehicle, booking, and notification updates.

## Location Behavior

The client accepts:

- Manual address entry, geocoded by the backend
- Browser/device coordinates, reverse-geocoded by the backend for display

Shared utilities reject missing, `0,0`, and out-of-India coordinates. The customer route flow requires a valid location before vehicle/service/dashboard actions.

Current backend geocoding behavior is Google Geocoding first. Groq may correct a failed manual address before the backend retries Google.

## Service and Vehicle Catalogs

Catalog content is admin-managed:

- Vehicle brands and models come from `/vehicle-meta` and admin car endpoints.
- Service categories and services come from `/services` and admin service endpoints.
- Brand logos, category thumbnails, and service thumbnails are delivered from Cloudinary.
- Local files in `src/data/` mainly provide interface metadata and fallback presentation behavior, not the authoritative production catalog.

## Payments

Checkout creates and verifies Cashfree payment orders through the backend. Browser code never receives Cashfree secret credentials.

Payment flow helpers live in:

```text
src/utils/bookingPayment.js
src/pages/booking/Checkout.jsx
```

The frontend should treat the backend verification response as the source of truth rather than trusting only a client-side redirect.

## Chatbot

The floating assistant is implemented in:

```text
src/components/FAB.jsx
src/components/ChatbotPopup.jsx
```

It uses:

```text
GET    /api/v1/chatbot/history
POST   /api/v1/chatbot/ask
DELETE /api/v1/chatbot/history
```

Conversation history is stored in PostgreSQL. The backend combines the latest conversation messages, customer context, Markdown knowledge files, and Groq responses.

## Error Reporting

`src/utils/errorReporter.js` installs handlers for browser errors and unhandled promise rejections. It also receives selected Axios failures.

Reports are:

- throttled by fingerprint for one minute
- sent with `credentials: include`
- tagged with portal, route, component, environment, and optional release
- ignored when `VITE_ERROR_REPORTING_ENABLED=false`

The reporting path is designed not to break the original customer or garage action when issue submission fails.

## Image Caching

`public/sw.js` caches Cloudinary images with a stale-while-revalidate-style strategy and supports explicit cache warming.

The service worker:

- is registered only by the application helper
- handles Cloudinary image GET requests
- removes older Rovauto image-cache versions on activation
- does not cache API responses or application HTML

Vercel and Nginx configurations give hashed assets long-lived immutable caching while keeping `index.html` uncached.

## Production Build

```bash
npm run build
```

Output is written to `dist/`. Do not edit generated files directly.

The production build for this snapshot completes successfully. The largest bundled static image is `src/assets/Rovauto_home.png`, which is over 2 MB before build processing; converting large PNG assets to optimized WebP or AVIF is recommended.

## Docker

The Dockerfile uses a Node 20 build stage and an Nginx runtime stage.

From the repository root, provide frontend build arguments through a root `.env` and run:

```bash
docker compose up --build frontend
```

Direct build example:

```bash
docker build \
  --build-arg VITE_API_URL=https://api.example.com/api/v1 \
  --build-arg VITE_FIREBASE_API_KEY=... \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
  --build-arg VITE_FIREBASE_PROJECT_ID=... \
  --build-arg VITE_FIREBASE_APP_ID=... \
  -t rovauto-client .
```

The container serves the SPA on port 80 and handles client-side route fallback through `nginx.conf`.

## Vercel

Use `client` as the project root.

Recommended settings:

```text
Framework preset: Vite
Build command:    npm run build
Output directory: dist
Install command:  npm ci
```

`vercel.json` includes SPA rewrites and cache headers for assets, the service worker, HTML, booking routes, services, and dashboard routes.

## Development Notes

- `@/` resolves to `src/` through Vite and `jsconfig.json`.
- Route pages are loaded with `React.lazy()` and `Suspense`.
- `main.jsx` performs a one-time reload when a stale deployed chunk cannot be imported.
- Keep frontend role checks aligned with backend middleware; UI guards are not security boundaries.
- Dynamic user/catalog media should use backend Cloudinary endpoints rather than being added to the bundle.
