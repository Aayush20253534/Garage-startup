# Rovauto

![Frontend](https://img.shields.io/badge/Frontend-React-blue)
![State](https://img.shields.io/badge/State-Redux%20Toolkit-764ABC)
![Backend](https://img.shields.io/badge/Backend-Express-green)
![Database](https://img.shields.io/badge/Database-PostgreSQL-lightgrey)
![ORM](https://img.shields.io/badge/ORM-Prisma-2D3748)
![Payments](https://img.shields.io/badge/Payments-Cashfree-purple)

Rovauto is a full-stack vehicle service, garage partner, and roadside assistance platform for India. It connects customers with verified garages, supports service booking, vehicle management, location-aware garage matching, online payments, wallet flows, SOS requests, notifications, inspections, and admin operations.

The app currently has three main portals:

- Customer: auth, profile, city/location onboarding, vehicles, service selection, checkout, payments, dashboard, bookings, history, profile, SOS.
- Garage owner: garage login, onboarding/application, services, bookings, wallet, profile/settings, handover and delivery workflows.
- Admin: dashboard, customers, garage applications, approved garages, managed cities, price ranges, bookings, and notifications.

## Current Highlights

- India-first city and location flow with admin-managed service cities.
- Customer and garage identities are role-scoped, so the same email can be used separately as customer and garage owner.
- Manual address geocoding uses backend Nominatim first, then Groq address/coordinate fallback when provider lookup fails.
- Current-location flow stores browser/device coordinates directly and reverse-geocodes only for display fields.
- Invalid coordinates such as `0,0` and non-India coordinates are rejected by both frontend and backend.
- Customer location is compulsory before vehicle selection and dashboard access.
- Vehicle selection is compulsory before service booking dashboard flows.
- Garage applications require at least 10 photos.
- Garage approval is independent; one pending/unapproved garage no longer blocks another application.
- Cashfree payment order and verification flow.
- Garage request broadcast after successful payment, with accept/reject and timeout behavior.
- Handover OTP plus mandatory inspection photos at pickup and delivery.
- Admin can delete garages with related garage data cleaned up.
- CLI cleanup scripts are dry-run by default and include explicit destructive flags.
- Redis caching is optional and now fails fast so cache outages do not freeze dashboard or geocoding.
- Cloudinary media upload support for garage, service, complaint, and inspection images.
- Resend email, Fast2SMS-compatible SMS, Firebase Google auth, and Groq fallback support.

## Tech Stack

Frontend:

- React 18
- Vite
- Redux Toolkit and React Redux
- React Router DOM
- Axios
- Tailwind CSS
- Framer Motion
- React Icons
- Firebase client auth

Backend:

- Node.js
- Express 5
- Prisma 7
- PostgreSQL
- JWT and httpOnly cookie support
- Argon2
- Firebase Admin
- Express Validator
- Multer
- Cloudinary
- Cashfree
- Redis/ioredis
- Resend
- Fast2SMS-compatible SMS
- Groq SDK

## Architecture

```text
React/Vite client
  -> Axios API client
  -> Express API under /api/v1
  -> Service layer
  -> Prisma
  -> PostgreSQL

External services:
  Cashfree, Cloudinary, Firebase, Resend, Fast2SMS, Redis, Nominatim, Groq
```

## Project Structure

```text
Codebase/
|-- client/
|   |-- src/
|   |   |-- api/
|   |   |-- assets/
|   |   |-- components/
|   |   |-- hooks/
|   |   |-- layouts/
|   |   |-- pages/
|   |   |   |-- admin/
|   |   |   |-- auth/
|   |   |   |-- booking/
|   |   |   |-- customer/
|   |   |   |-- garage/
|   |   |   |-- sos/
|   |   |-- store/
|   |   |-- utils/
|   |-- README.md
|   |-- package.json
|
|-- server/
|   |-- prisma/
|   |   |-- migrations/
|   |   |-- schema.prisma
|   |-- src/
|   |   |-- admin/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- customer/
|   |   |   |-- knowledge/
|   |   |-- garage/
|   |   |-- middlewares/
|   |   |-- routes/
|   |   |-- scripts/
|   |   |-- seed/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- validations/
|   |-- README.md
|   |-- package.json
|
|-- docker-compose.yml
|-- README.md
```

## Local Setup

### Backend

```bash
cd server
npm install
```

Create `server/.env` from `server/.env.example` and fill required values.

Common required values:

```env
DATABASE_URL=""
PORT=5000
NODE_ENV=development

JWT_SECRET=""
JWT_EXPIRES_IN="7d"

FRONTEND_URL="http://localhost:8080"
CLIENT_URL="http://localhost:8080"

FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""

CASHFREE_APP_ID=""
CASHFREE_SECRET_KEY=""
CASHFREE_ENV="sandbox"
CASHFREE_NOTIFY_URL=""

CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

RESEND_API_KEY=""
EMAIL_FROM=""

SMS_PROVIDER="fast2sms_quick"
FAST2SMS_API_KEY=""

REDIS_URL=""

GEOCODER_PROVIDER="nominatim"
GEOCODER_DEFAULT_COUNTRY="India"
GEOCODER_COUNTRYCODES="in"
NOMINATIM_USER_AGENT="Rovauto/1.0 (your-email@example.com)"
NOMINATIM_TIMEOUT_MS=3000
GROQ_API_KEY=""
GROQ_MODEL="llama-3.1-8b-instant"
CHATBOT_GROQ_MODEL="llama-3.1-8b-instant"
CHATBOT_GROQ_TIMEOUT_MS=12000
CHATBOT_RATE_LIMIT_PER_MINUTE=20
```

Run Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Optional seed data:

```bash
npm run seed:admin
npm run seed:services
npm run seed:garages
```

Start the backend:

```bash
npm run dev
```

Default API base:

```text
http://localhost:5000/api/v1
```

### Frontend

```bash
cd client
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

Start the frontend:

```bash
npm run dev
```

Default frontend:

```text
http://localhost:8080
```

## Scripts

Backend:

```bash
npm run dev
npm start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
npm run seed:admin
npm run seed:services
npm run seed:garages
npm run db:delete-user
npm run db:delete-active-bookings
npm run db:delete-payments
npm run db:delete-service-history
npm run db:delete-garages
npm run db:delete-price-ranges
npm run db:delete-bookings
npm run db:delete-notifications
npm run db:nuke-users
npm run db:approve-garage
npm run db:activate-garage
```

Frontend:

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
```

## API Modules

Mounted under `/api/v1`:

- `/auth`
- `/public`
- `/cities`
- `/send-otp`
- `/verify-otp`
- `/customer`
- `/vehicles`
- `/locations`
- `/contact`
- `/services`
- `/vehicle-meta`
- `/garages`
- `/garage/applications`
- `/notifications`
- `/bookings`
- `/payments`
- `/reviews`
- `/complaints`
- `/dashboard`
- `/chatbot`
- `/wallet`
- `/garage/wallet`
- `/garage/wallet-legacy`
- `/garage/requests`
- `/admin/garage-applications`
- `/admin/city-service-price-ranges`
- `/admin/garages`
- `/admin`
- `/sos`

## Location Behavior

Rovauto is configured for India.

Current location:

```text
Browser/device geolocation -> save latitude/longitude directly -> reverse geocode for display fields.
```

Manual location:

```text
User enters address, area, city, pincode
 -> frontend checks admin-managed city availability
 -> backend geocodes with Nominatim, restricted to India
 -> if provider fails, Groq can correct/estimate Indian coordinates
 -> backend rejects 0,0 and non-India coordinates
 -> valid coordinates are saved to CustomerLocation
```

The app should not call geocoding again for an unchanged saved location. Coordinates are stored in the database and reused.

## AI Chatbot

Rovauto has a customer-side RAG chatbot connected to the floating chat UI.

```text
Markdown knowledge files
 -> lightweight section retrieval
 -> safe customer account context
 -> Groq answer generation
 -> local RAG fallback if Groq is unavailable
```

Knowledge files live in:

```text
server/src/customer/knowledge/
```

The chatbot can answer customer-side questions about booking, vehicles, location, city availability, payments, SOS, complaints, reviews, profile settings, tracking, and service history. It is intentionally scoped away from random general-purpose chat and should not invent policies, prices, garage availability, refunds, or emergency dispatch.

Chat memory is stored in the main PostgreSQL database, not a separate Neon database:

```text
chatbot_conversations
chatbot_messages
```

Messages are always scoped by the logged-in `userId`, so one customer cannot read another customer's chat. The backend trims sensitive account context before sending prompts to Groq; exact saved addresses, customer names, and booking codes are not included in the model context.

Chatbot endpoints:

```text
GET    /api/v1/chatbot/history
POST   /api/v1/chatbot/ask
DELETE /api/v1/chatbot/history
```

## Booking Lifecycle

```text
Customer selects location
 -> selects/adds vehicle
 -> selects services
 -> selects garage or auto assignment
 -> pays Rovauto handling/platform fee through Cashfree
 -> backend verifies payment
 -> nearby active verified garages are notified
 -> garage accepts before timeout
 -> customer receives accepted notification and handover OTP
 -> garage verifies handover OTP and uploads pickup inspection photos
 -> booking moves to IN_PROGRESS
 -> garage uploads delivery inspection photos and marks delivered
 -> customer accepts delivery
 -> booking moves to COMPLETED and service history
```

Important controls:

```env
GARAGE_BROADCAST_RADIUS_KM=15
GARAGE_SEARCH_TIMEOUT_SECONDS=120
HANDOVER_OTP_TTL_MINUTES=30
SERVICE_PRICE_RANGE_DELTA=500
```

## Garage Applications

- Garage owner accounts are separate from customer accounts even with the same email.
- Each application is independent.
- Minimum photos for garage application submission: 10.
- Admin approval creates/updates garage records.
- Admin city availability controls whether customer/garage location cities are serviceable.

## Docker

From the root:

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up -d
```

Stop:

```bash
docker compose down
```

Logs:

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
```

## Production Notes

- Use Google Maps API for production geocoding when funding/paid tier is available.
- Set strict daily/monthly quotas on Google Maps, SMS, Groq, and Cloudinary.
- Store chatbot conversations in the main database unless strict isolation or analytics scale later requires a separate database.
- Keep all secrets in hosting environment variables.
- Use separate development, staging, and production databases.
- Run `npm run prisma:deploy` during production releases.
- Configure production CORS with `CLIENT_URL` and `FRONTEND_URL`.
- Add Cashfree webhooks before real production payment traffic.
- Keep Redis optional and non-blocking; it is a cache, not the source of truth.
- Optimize large frontend images before production traffic.

## License

ISC, based on current package metadata.
