# Rovauto Web Client

> Frontend reference verified against the repository on 28 July 2026.

The web client is one React/Vite application serving public visitors, customers, garage owners, garage controllers, no-account workers, administrators, interns, and customer-support agents. Role-specific HTML/PWA shells boot the same route tree from `src/main.jsx` and `src/App.jsx`.

## Entry documents and routes

| Shell | Entry document | Main routes |
| --- | --- | --- |
| Public/customer | `index.html` | `/`, `/services`, `/login`, `/booking/*`, `/dashboard/*`, `/warranty`, `/worker-task/:token` |
| Garage | `garage.html` | `/garage/login`, `/garage/*` |
| Admin | `admin.html` | `/admin/login`, `/admin/*` |
| Intern | `intern.html` | `/intern/login`, `/intern/*` |
| Customer support | `support.html` | `/support/login`, `/support/*` |

Deployment rewrites must send each path family to its matching HTML document. Route guards improve navigation but do not replace server-side authorization.

## Implemented UI areas

### Public and customer

- Marketing, service/category catalogue, garage discovery, contact, partner application, legal pages, and the unchanged public mock warranty page.
- Customer password, OTP, and Firebase Google authentication.
- Profile, avatar, saved locations, vehicle management, default vehicle, and vehicle model photos.
- City/category/service restrictions and approved vehicle-aware price ranges.
- Checkout with pickup/self-drop selection, wallet contribution, Cashfree, pending-payment recovery, and progressive garage search.
- Pickup handover OTP, pickup/return/delivery tracking, one-time customer-to-garage self-drop tracking, 5-15 image plus one-video inspection evidence, final-payment confirmation, detailed service timings, reviews, complaints, tickets, and notifications.
- Protected customer Warranty Center at `/dashboard/warranty`, derived from completed bookings with a live 30-day countdown.
- Customer chatbot backed by repository Markdown knowledge.

### Garage and workers

- Shared owner/controller login with an explicit account type.
- Controller management, availability, assignment, privacy-limited controller workspace, and controller history.
- Controller navigation is hidden when the assigned garage has controller accounts disabled.
- Owner/admin Worker Task Manager for garages in no-account mode.
- Public `/worker-task/:token` page with Hindi/English copy, browser speech synthesis, pickup tracking/OTP, self-drop no-OTP arrival evidence, and structured media upload.

### Staff and support

- Admin and intern consoles with role-specific navigation.
- Combined System Health page containing System Issues and Integration Health for `ADMIN`, `SUB_ADMIN`, and `INTERN`.
- Customer-support console with a separate session and shell.

## Source structure

```text
src/
|-- App.jsx                         Lazy route tree, shell routing, and guards
|-- main.jsx                        React bootstrap
|-- api/                            Axios client and domain wrappers
|-- hooks/useApp.jsx                Shared application orchestration
|-- store/                          Redux state
|-- pages/                          Route-level pages by actor
|-- components/                     Shared and domain components
|-- utils/                          Auth, payment, maps, media, PWA, activity, recovery
`-- data/                           Presentation metadata and safe fallbacks
```

Relevant recent pages/components:

- `pages/customer/WarrantyCenter.jsx`
- `pages/worker/WorkerTask.jsx`
- `pages/admin/SystemHealth.jsx`
- `pages/admin/IntegrationHealth.jsx`
- `pages/admin/SystemIssues.jsx`
- `components/garage/WorkerTaskManager.jsx`
- `components/booking/InspectionGallery.jsx`

## API client rules

`src/api/axios.js` is the default browser transport. It:

- Sends cookies with `withCredentials`.
- Seeds/reads the double-submit CSRF token and sends `X-CSRF-Token` on unsafe requests.
- Applies configured timeouts and bounded retries only where safe.
- Sends and exposes `X-Request-ID` for incident correlation.
- Reports eligible frontend failures to the System Issues endpoint.

The public worker-task wrapper in `src/api/workerTasks.js` sends the secure token in the URL. The token must never be written to logs, analytics metadata, or issue reports.

## Authentication and privacy

- Browser JWTs are HttpOnly cookies; they are not stored in local storage.
- `accessToken` is used for customer, garage owner/controller, admin, sub-admin, and intern browser sessions.
- `supportAccessToken` is isolated to the support portal.
- `rovautoDeviceId` identifies browser sessions/devices.
- `rovautoCsrf` is the readable CSRF half and is not an authentication credential.
- The worker-task page has no general account session. Its authority is limited to the hashed, expiring booking task token.

## Booking and warranty states

- Missing approved pricing blocks checkout.
- `PENDING_PAYMENT` can resume payment.
- Successful payment moves a normal booking into garage search.
- Garage acceptance normally writes `CONFIRMED`; `GARAGE_ASSIGNED` is compatibility state.
- Verified handover with required media moves the booking to `IN_PROGRESS`.
- Customer Cash/UPI submission remains pending until the garage confirms receipt; that confirmation moves the booking to `COMPLETED`.
- The Warranty Center reads completed bookings from `/api/v1/warranties`.
- Warranty activation uses `customerAcceptedAt`, then `deliveredAt`, then `updatedAt` as a fallback.
- A warranty is active for exactly 30 days and remains visible as expired afterwards.

## Fulfilment and task-link UI rules

- A cart containing a self-drop-only service must use self drop-off.
- A garage receives only requests compatible with its `fulfillmentMode` and vehicle/service coverage.
- Worker-task links are available only when `controllerAccountsEnabled` is false.
- Pickup tasks can track from the garage/worker to the customer and then back to the garage after handover.
- Self-drop customers share one live route to the garage; garage/worker task pages observe that route and confirm arrival with before-service evidence, without OTP. No return or delivery route is opened for self-drop.
- Evidence requires 5-15 images, each at most 1 MB, plus exactly one video at most 50 MB.
- Hindi voice is implemented with browser `speechSynthesis`; unsupported browsers show a clear error rather than silently failing.

## Environment

All `VITE_*` values are public build-time configuration.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API root ending in `/api/v1` |
| `VITE_API_FALLBACK_URL` | Optional fallback API root |
| `VITE_USE_RELATIVE_API` | Prefer same-origin `/api/v1` |
| `VITE_API_TIMEOUT_MS` | Axios timeout |
| `VITE_API_NETWORK_RETRIES` | Safe network retry count |
| `VITE_API_RETRY_DELAY_MS` | Retry delay |
| `VITE_APP_VERSION` | Client release identifier |
| `VITE_ERROR_REPORTING_ENABLED` | Frontend issue reporting toggle |
| `VITE_FIREBASE_*` | Public Firebase web settings |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Browser Maps key, restricted by referrer/API |
| `VITE_GOOGLE_MAPS_MAP_ID` | Optional map style ID |

Never expose provider secret keys, database URLs, JWT secrets, private Firebase credentials, WhatsApp tokens, or VAPID private keys.

## Commands and validation

```bash
npm ci
npm run dev
npm run build
npm run preview
```

Vite development and preview bind to `127.0.0.1:8080`.

There is no standalone frontend test command. A production change should include:

1. `npm run build`.
2. Relevant Node source-regression tests in `server/test/security`.
3. Manual mobile and desktop checks for all affected roles.
4. Route refresh checks against the deployment rewrites.
5. Browser permission checks for camera, location, notifications, and voice where relevant.
