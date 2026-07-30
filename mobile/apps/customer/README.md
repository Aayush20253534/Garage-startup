# Rovauto Customer Mobile App

> Mobile reference verified against the repository on 30 July 2026.

This is the early Expo SDK 57 customer application under the Rovauto monorepo. It uses Expo Router with routes in `src/app` and shares the existing backend rather than embedding server code.

## Current status

The application already contains the intended route structure, API client, React Query provider, SecureStore helpers, authentication screens, tabs, checkout routes, booking detail, payments, notifications, complaints, chatbot, profile, addresses, and vehicles. Most screens are still implementation placeholders and must not be treated as feature-equivalent to the web customer portal yet. Compatible inspection-video playback/upload state, compact service-history PDF export, and redesigned pending cards are current parity targets rather than completed native features.

## Stack

- Expo SDK 57 and Expo Router
- React 19.2 and React Native 0.86
- TanStack React Query
- Axios
- Expo SecureStore
- Zustand
- React Hook Form and Zod
- React Native Reanimated, Gesture Handler, Safe Area Context, and Screens

## Route structure

```text
src/app/
|-- index.tsx
|-- _layout.tsx
|-- (auth)/
|   |-- login.tsx
|   |-- register.tsx
|   |-- verify-otp.tsx
|   `-- forgot-password.tsx
|-- (tabs)/
|   |-- index.tsx
|   |-- services.tsx
|   |-- garages.tsx
|   |-- bookings.tsx
|   `-- profile.tsx
|-- services/[categoryId].tsx
|-- garages/[garageId].tsx
|-- bookings/[bookingId].tsx
|-- checkout/address.tsx
|-- checkout/cart.tsx
|-- checkout/summary.tsx
|-- payments/[bookingId].tsx
|-- payments/result.tsx
|-- notifications.tsx
|-- complaints.tsx
|-- chatbot.tsx
|-- profile/addresses.tsx
|-- profile/vehicles.tsx
|-- profile/edit.tsx
`-- settings.tsx
```

## API and authentication

`src/lib/api/client.ts` uses:

```text
EXPO_PUBLIC_API_URL
```

with this fallback:

```text
https://api.rovauto.com/api/v1
```

The client currently reads `accessToken` from SecureStore and sends it as a bearer token. The web application uses HttpOnly cookies instead. Before mobile production release, confirm that the backend explicitly supports the mobile bearer-token contract, refresh/revocation behaviour, CSRF exemption, and account logout semantics. Do not assume the existing browser session endpoint is sufficient.

Secure storage keys:

- `accessToken`
- `refreshToken`

A `401` response clears both keys. Refresh-token exchange is not yet implemented in the checked-in client.

## Setup

```bash
cd mobile/apps/customer
npm ci
```

Create a local environment file:

```env
# Physical Android/iOS device on the same network
EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:5000/api/v1

# Android Studio emulator on the same Windows host
# EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api/v1
```

Use a LAN-reachable address when testing on a physical phone. `localhost` on the phone refers to the phone itself.

Start Expo:

```bash
npm run start
```

Other commands:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

## Shared backend contracts to preserve

- Payment attempts are accepted from 10:00 AM inclusive until 12:00 AM midnight exclusive in `Asia/Kolkata`; surface server `SERVICE_HOURS_CLOSED` responses without relying only on device time.
- Pending bookings remain recoverable outside the payment window.
- Inspection evidence is 5-15 images plus exactly one video per phase; selected, uploading, uploaded, processing, and failed playback states must remain distinct.
- A future native service-history report should match the web PDF fields and black-and-white detail without exposing another customer's booking.

## Implementation priorities

1. Finalise the mobile authentication contract with the backend.
2. Replace placeholder tab screens with real React Query calls and robust loading/error states.
3. Implement vehicles, locations, service discovery, cart, and pricing parity.
4. Implement booking payment and result recovery.
5. Add tracking, inspection gallery, notifications, support, and real Warranty Center parity.
6. Add push notifications and deep-link validation.
7. Add offline-safe state only where product requirements justify it.
8. Run physical-device permission tests and store-release checks.

## Security rules

- Never place secrets in `EXPO_PUBLIC_*` variables.
- Do not log access/refresh tokens.
- Clear SecureStore on logout and revoked-session responses.
- Use certificate-backed HTTPS in production.
- Deep links must be validated before loading booking or payment state.
- The no-account garage worker flow remains a web task route for now; it is not part of this customer app.

## Release readiness

The mobile app is not ready for customer distribution solely because it builds. Release requires implemented screens, backend bearer-token support, Android/iOS device testing, privacy disclosures, crash reporting, push credentials, payment deep-link validation, and store review assets.
