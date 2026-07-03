# Rovauto Client

React + Vite frontend for the Rovauto customer, garage owner, admin, and SOS experiences.

## Current Frontend Capabilities

- Public pages: home, services, category details, how it works, about, contact, warranty, partner.
- Customer auth: register, login, OTP, Google auth, forgot password.
- Customer onboarding: compulsory location first, then compulsory vehicle selection.
- Customer booking: service selection, garage selection, checkout, Cashfree payment, tracking.
- Customer portal: dashboard, quick actions, recent activity, vehicles, bookings, service history, payments, notifications, profile.
- Floating Rovauto Assistant chatbot connected to backend RAG, Groq, and user-specific chat history.
- Profile location editor: opens a location card, supports manual geocoding and current-location update.
- Garage owner portal: login, OTP login, onboarding/application, dashboard, services, bookings, wallet, profile, settings, magic links.
- Admin portal: dashboard, customers, garages, garage applications, bookings, price ranges, notifications, managed cities.
- SOS flow: panic, location, checkout, success screens.
- City dropdowns use admin-managed city data.
- If selected/detected city is unavailable, the UI shows: `Rovauto isn't available in your area yet.`
- Route-level code splitting with `React.lazy()` and `Suspense`.
- Redux Toolkit customer state with local cache for dashboard/profile/vehicles/bookings/service data.
- Axios API client with bearer token and cookie-compatible requests.

## Tech Stack

- React 18
- Vite
- Redux Toolkit
- React Redux
- React Router DOM
- Axios
- Tailwind CSS
- Framer Motion
- React Icons
- Firebase client auth

## Setup

```bash
npm install
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_APP_ID=""
```

If `VITE_API_URL` is missing, the app falls back to the API URL configured in `src/api/axios.js`.

## Scripts

```bash
npm run dev        # Start Vite dev server on port 8080
npm run build      # Build production files into dist/
npm run build:dev  # Build in development mode
npm run preview    # Preview production build on port 8080
```

## Important Folders

```text
src/
|-- api/          # Axios wrappers and API helpers
|-- assets/       # Bundled static images/assets
|-- components/   # Shared UI components
|-- data/         # Local display data
|-- hooks/        # useApp compatibility layer and shared hooks
|-- layouts/      # Main and dashboard layouts
|-- pages/
|   |-- admin/
|   |-- auth/
|   |-- booking/
|   |-- customer/
|   |-- garage/
|   |-- sos/
|-- store/        # Redux store and customer slice
|-- utils/        # Auth, payment, address, geocode, cities, activity helpers
```

## Rovauto Assistant

The floating chatbot lives in:

```text
src/components/ChatbotPopup.jsx
src/components/FAB.jsx
```

Behavior:

- Loads the logged-in customer's previous chatbot messages on open.
- Sends new questions to `POST /api/v1/chatbot/ask`.
- Shows the assistant reply from backend RAG/Groq.
- Lets the user clear their own chatbot history through `DELETE /api/v1/chatbot/history`.
- Does not store another user's messages in local UI state; server history is scoped by the logged-in token.

The frontend keeps only the visible widget state. Durable memory lives in backend database tables.

## State Management

The app uses Redux Toolkit for the central customer bundle:

```text
user
token
vehicles
selected vehicle
location
```

`useApp()` exposes the existing app API to pages while reading/writing Redux state underneath.

Do not store passwords, OTPs, raw payment secrets, wallet transaction details, or other sensitive data in Redux/localStorage.

## Auth Flow

- Backend sets an httpOnly cookie and also returns a token.
- Frontend stores the token in localStorage for cross-domain deployment compatibility.
- Login and Google signup/login update app state directly, then navigate with React Router.
- New customers without a valid saved location are sent to `/booking/address`.
- Customers with location but no vehicle are sent to `/booking/vehicle`.

## Location Flow

The app is India-first and city availability is controlled by the admin city list.

Current location:

```text
Browser/device geolocation
 -> reverse geocode for address fields
 -> save coordinates directly to /locations
 -> do not geocode again on Save & Continue
```

Manual location:

```text
User enters address, area, city, pincode
 -> city must be available in admin city list
 -> Save & Continue calls /locations/geocode
 -> backend returns Indian coordinates
 -> frontend posts the location to /locations
```

Frontend coordinate checks reject:

- missing coordinates
- `0,0`
- coordinates outside India bounds

Manual geocode requests are queued and cached in `src/utils/geocodeService.js`. The cache ignores invalid/non-India results.

## City Selection

`CitySelect` loads active cities through:

```text
GET /api/v1/cities
```

Admin city management uses admin endpoints under:

```text
/api/v1/cities/admin
```

Any city dropdown value not in the active city list is treated as unavailable.

## Main Customer Routes

```text
/booking/address
/booking/vehicle
/booking/services
/booking/garage
/checkout
/tracking
/dashboard
/dashboard/vehicles
/dashboard/bookings
/dashboard/history
/dashboard/payments
/dashboard/notifications
/dashboard/profile
```

`AddressCheck` and `VehicleCheck` in `App.jsx` protect routes so the user cannot skip compulsory onboarding.

## Main Backend APIs Used

Customer:

```text
POST /api/v1/auth/login
POST /api/v1/auth/google
POST /api/v1/auth/signup
POST /api/v1/auth/verify-otp
GET  /api/v1/auth/me
GET  /api/v1/cities
GET  /api/v1/locations/geocode
POST /api/v1/locations
GET  /api/v1/vehicles
POST /api/v1/vehicles
GET  /api/v1/services/categories
POST /api/v1/bookings/checkout
POST /api/v1/payments/verify
POST /api/v1/bookings/:id/accept-delivery
GET  /api/v1/bookings/service-history
GET  /api/v1/chatbot/history
POST /api/v1/chatbot/ask
DELETE /api/v1/chatbot/history
```

Garage:

```text
POST /api/v1/garage/applications
GET  /api/v1/garage/requests
POST /api/v1/garage/requests/:requestId/accept
POST /api/v1/garage/requests/:requestId/verify-handover-otp
POST /api/v1/garage/requests/:requestId/mark-delivered
POST /api/v1/garage/wallet/recharge/order
POST /api/v1/garage/wallet/recharge/verify
```

Admin:

```text
GET/POST/PATCH /api/v1/cities/admin
GET/POST/PATCH/DELETE /api/v1/admin/city-service-price-ranges
GET/POST/PATCH /api/v1/admin/garage-applications
GET/DELETE /api/v1/admin/garages
POST /api/v1/admin/cleanup/*
```

## Recent Activity

Customer dashboard quick actions can show the last three local user actions, including:

- booking/payment activity
- location changes
- profile changes
- SOS activity

The helper lives in:

```text
src/utils/activityLog.js
```

## Media Notes

- Static site images live in the client bundle.
- Dynamic garage/customer/admin media should go through Cloudinary-backed backend endpoints.
- Garage application uploads require at least 10 photos.
- Booking pickup/delivery inspection images are uploaded through garage request endpoints.

## Build Output

`dist/` is generated by Vite. Do not edit it directly.

```bash
npm run build
```

## Notes

- `jsconfig.json` provides the `@/` import alias.
- The project currently uses `package-lock.json`.
- Keep UI route guards in sync with backend validation, especially location and role behavior.
