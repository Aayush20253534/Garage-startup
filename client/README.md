# Rovauto Client

> Frontend reference verified against the repository on 23 July 2026.

The client is one React 18/Vite application serving public visitors, customers, garage owners, garage controllers, administrators, interns, and customer-support agents. Five HTML documents and role-specific manifests/service workers boot the same `src/main.jsx` and `src/App.jsx` route tree.

Use the root [`README.md`](../README.md) for full-stack setup and [`important/Architecture.md`](../important/Architecture.md) for the complete API and flow map.

## Entry documents

| Shell | Entry | Typical routes |
| --- | --- | --- |
| Public/customer | `index.html` | `/`, `/services`, `/login`, `/booking/*`, `/dashboard/*`, `/sos/*` |
| Garage | `garage.html` | `/garage/login`, `/garage/*` |
| Admin | `admin.html` | `/admin/login`, `/admin/*` |
| Intern | `intern.html` | `/intern/login`, `/intern/*` |
| Support | `support.html` | `/support/login`, `/support/*` |

Each deployment target must rewrite these paths to the correct HTML shell. Client-side route guards improve navigation but never replace backend authorization.

## Implemented UI areas

- Public marketing, service/category catalogue, how-it-works, partner application, contact, warranty, legal pages, and public stats.
- Customer registration/login with password, OTP, and Firebase Google sign-in.
- Customer onboarding, avatar/profile, saved locations, vehicle CRUD/default selection, and active-booking guard.
- City/category/service restrictions and approved city/service/vehicle price ranges.
- Checkout, wallet contribution, Cashfree SDK payment, payment recovery, and pending-payment continuation.
- Progressive 5/10/20 km garage search, assigned garage details, handover OTP, route/tracking views, inspection galleries, delivery acceptance, reviews, complaints, support, and notifications.
- Garage owner and controller/staff login from the same screen using an explicit role selector.
- Owner controller management and controller availability/assignment workspace.
- Admin, intern, and customer-support consoles with separate route guards and navigation.
- Role-specific installable PWAs and push-notification controls.

## Frontend architecture

```text
src/
|-- App.jsx                 Lazy route tree and role guards
|-- main.jsx                React bootstrap
|-- api/                    Shared Axios client and domain wrappers
|-- hooks/useApp.jsx        Application context and orchestration
|-- store/                  Redux state
|-- pages/                  Route-level screens by actor
|-- components/             Shared and domain UI
|-- utils/                  Auth, cart, payment, maps, activity, PWA, and recovery helpers
`-- data/                   Static presentation metadata/fallbacks
```

The shared Axios instance in `src/api/axios.js`:

- Sends cookies with `withCredentials`.
- Gets/reads the double-submit CSRF cookie and sends `X-CSRF-Token` for unsafe requests.
- Uses configured timeouts and safe GET retries.
- Carries/request-correlates `X-Request-ID`.
- Reports eligible failures to the system-issue endpoint when enabled.

Use that client for authenticated API calls; do not create unconfigured Axios instances.

## Authentication and routing

The browser does not store JWTs in local storage. The backend issues HttpOnly cookies:

- `accessToken` for customer, garage owner, garage controller, admin, and intern sessions.
- `supportAccessToken` for the customer-support portal.
- `rovautoDeviceId` for stable session/device identity.
- `rovautoCsrf` as the readable half of double-submit CSRF.

The garage login screen submits `GARAGE_OWNER` or `GARAGE_CONTROLLER`. Owner sessions route to the owner dashboard; controllers route to the controller workspace and see customer contact/location only for active assignments.

## Environment variables

All `VITE_*` values are included in browser bundles and must be treated as public configuration.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Primary API root, normally ending in `/api/v1` |
| `VITE_API_FALLBACK_URL` | Optional fallback API root |
| `VITE_USE_RELATIVE_API` | Prefer same-origin `/api/v1` |
| `VITE_API_TIMEOUT_MS` | Axios timeout |
| `VITE_API_NETWORK_RETRIES` | Safe network retry count |
| `VITE_API_RETRY_DELAY_MS` | Retry delay |
| `VITE_APP_VERSION` | Client version included with diagnostics |
| `VITE_ERROR_REPORTING_ENABLED` | Enable client issue reporting |
| `VITE_FIREBASE_API_KEY` | Firebase public browser key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project |
| `VITE_FIREBASE_APP_ID` | Firebase web app |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Maps JavaScript key; restrict by referrer/API |
| `VITE_GOOGLE_MAPS_MAP_ID` | Optional Google map style ID |

Never put Cashfree secret keys, JWT secrets, database URLs, Cloudinary secrets, Firebase private keys, provider tokens, or VAPID private keys in this file.

## Commands

```bash
npm ci
npm run dev
npm run build
npm run preview
```

Vite development and preview listen on `127.0.0.1:8080`.

## Booking-state rules

- Cart selections must be revalidated when city, location, or vehicle changes.
- The selected saved service location is the booking destination; garage live tracking must not overwrite it.
- `PENDING_PAYMENT` bookings can resume payment.
- Payment confirmation moves the booking to `SEARCHING_GARAGE`.
- Current search rounds are 5 km, 10 km, and 20 km.
- The current acceptance path writes `CONFIRMED`; `GARAGE_ASSIGNED` is compatibility state.
- Pickup OTP/evidence moves the booking to `IN_PROGRESS`.
- Garage delivery plus customer acceptance moves it to `COMPLETED`.
- Missing approved pricing must block checkout rather than inventing a price.

## UI and privacy rules

- Do not expose exact customer location/contact to unassigned garages or controllers.
- Never render provider secrets, session tokens, password hashes, OTP hashes, raw webhook data, or internal stack traces.
- Preserve loading, empty, retry, offline, and permission-denied states on mobile and desktop.
- Route-level lazy-loading failures use the chunk-recovery helper; avoid infinite refresh loops.
- Use `SafeImage` and media helpers for remote assets.
- Keep all five PWA manifests/service workers and deployment rewrites aligned after route changes.

## Validation

```bash
npm ci
npm run build
```

There is currently no client lint or standalone client test script. Relevant frontend regressions are covered by source-level Node tests in `server/test/security`; a production change still requires manual responsive and browser-flow testing.
