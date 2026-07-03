# Rovauto Server

Express + Prisma backend for the Rovauto India vehicle service platform.

## Current Backend Capabilities

- REST API under `/api/v1`.
- Role-scoped customer, garage owner, and admin auth.
- Same email can be used separately for customer and garage owner accounts.
- Signup, OTP verification, login, Google auth, logout, forgot/reset password.
- Auth responses return a safe user bundle with `customerProfile`, `vehicles`, and `locations`.
- Customer profile, vehicles, locations, bookings, payments, wallet, notifications, dashboard, reviews, complaints, contact, SOS.
- Customer RAG chatbot with Markdown knowledge, Groq generation, local fallback, and user-specific conversation memory.
- Admin-managed cities for availability control and city dropdowns.
- Admin city/service/vehicle/fuel price ranges.
- Manual geocoding for India with Nominatim first and Groq correction/coordinate fallback.
- Backend rejects invalid coordinates, `0,0`, and non-India coordinates.
- Cashfree order creation and payment verification.
- Garage request broadcasting after payment verification.
- Garage application flow with minimum 10 photos.
- Garage request accept/reject, wallet deduction, handover OTP, pickup/delivery inspection images.
- Cloudinary uploads for garage media, service media, complaints, and booking inspection evidence.
- Redis cache utility with fail-fast fallback so cache outages do not block the API.
- Resend email and Fast2SMS-compatible SMS support.
- Admin/CLI cleanup scripts for users, garages, bookings, payments, notifications, price ranges.

## Source Layout

```text
src/
|-- app.js
|-- server.js
|-- admin/
|   |-- controllers/
|   |-- routes/
|   |-- services/
|-- config/
|-- constants/
|-- controllers/
|-- customer/
|   |-- controllers/
|   |-- knowledge/
|   |-- routes/
|   |-- services/
|   |-- validations/
|-- garage/
|   |-- controllers/
|   |-- routes/
|   |-- services/
|   |-- validations/
|-- middlewares/
|-- routes/
|-- scripts/
|-- seed/
|-- services/
|-- utils/
|-- validations/
```

`src/routes/index.routes.js` mounts the public API under `/api/v1`.

## Setup

```bash
npm install
```

Create `server/.env` from `.env.example`.

Important environment variables:

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
EMAIL_OTP_DELIVERY="log"
CONTACT_INBOX=""

SMS_PROVIDER="fast2sms_quick"
FAST2SMS_API_KEY=""
SMS_PROVIDER_URL=""
SMS_PROVIDER_TOKEN=""
SMS_SENDER_ID="ROVAUTO"

REDIS_URL=""
REDIS_CONNECT_TIMEOUT_MS=1500
REDIS_COMMAND_TIMEOUT_MS=1500
CACHE_TIMEOUT_MS=1500

GEOCODER_PROVIDER="nominatim"
GEOCODER_DEFAULT_COUNTRY="India"
GEOCODER_COUNTRYCODES="in"
GEOCODER_MAX_CANDIDATES=2
NOMINATIM_USER_AGENT="Rovauto/1.0 (your-email@example.com)"
NOMINATIM_TIMEOUT_MS=3000
GROQ_API_KEY=""
GROQ_MODEL="llama-3.1-8b-instant"
GROQ_TIMEOUT_MS=12000
CHATBOT_GROQ_MODEL="llama-3.1-8b-instant"
CHATBOT_GROQ_TIMEOUT_MS=12000
CHATBOT_RATE_LIMIT_PER_MINUTE=20

GARAGE_BROADCAST_RADIUS_KM=15
GARAGE_SEARCH_TIMEOUT_SECONDS=120
GARAGE_REQUEST_ACCEPT_PATH="/garage/requests"
HANDOVER_OTP_TTL_MINUTES=30
SERVICE_PRICE_RANGE_DELTA=500

WHATSAPP_PROVIDER_URL=""
WHATSAPP_PROVIDER_TOKEN=""
WHATSAPP_SENDER_ID=""
```

`REDIS_URL` is optional in development. Cache calls are skipped or fail fast when Redis is unavailable.

## Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

Production/staging releases:

```bash
npm run prisma:deploy
```

Optional seed data:

```bash
npm run seed:admin
npm run seed:services
npm run seed:garages
```

## Scripts

```bash
npm run dev                         # Start backend with nodemon
npm start                           # Start backend with node
npm run prisma:generate             # Generate Prisma client
npm run prisma:migrate              # Run development migrations
npm run prisma:deploy               # Deploy migrations
npm run prisma:studio               # Open Prisma Studio
npm run seed:admin                  # Seed admin user/data
npm run seed:services               # Seed service data
npm run seed:garages                # Seed garage data
npm run db:delete-user              # Dry-run/delete matched user data
npm run db:delete-active-bookings   # Dry-run/delete active bookings for one email
npm run db:delete-payments          # Dry-run/delete payment records for one email
npm run db:delete-service-history   # Dry-run/delete completed bookings for one email
npm run db:delete-garages           # Dry-run/delete garage data and applications
npm run db:delete-price-ranges      # Dry-run/delete admin price ranges
npm run db:delete-bookings          # Dry-run/delete booking data
npm run db:delete-notifications     # Dry-run/delete notification data
npm run db:nuke-users               # Dry-run/delete all users after backup and explicit flags
npm run db:approve-garage           # Approve a garage application from CLI
npm run db:activate-garage          # Activate a garage from CLI
```

Examples:

```bash
npm run db:delete-garages
npm run db:delete-garages -- --confirm
npm run db:delete-user -- --email=aayush@example.com
npm run db:delete-user -- --email=aayush@example.com --confirm
npm run db:nuke-users -- --confirm --i-understand-delete-all-users
```

Cleanup scripts are intentionally dry-run first. Destructive operations require `--confirm`; wider cleanup commands may require additional explicit flags.

## API Modules

Mounted under `/api/v1`:

```text
/auth
/public
/cities
/send-otp
/verify-otp
/customer
/vehicles
/locations
/contact
/services
/vehicle-meta
/garages
/garage/applications
/notifications
/bookings
/payments
/reviews
/complaints
/dashboard
/chatbot
/wallet
/garage/wallet
/garage/wallet-legacy
/garage/requests
/admin/garage-applications
/admin/city-service-price-ranges
/admin/garages
/admin
/sos
```

## Auth Notes

- Backend sets an `accessToken` cookie where appropriate.
- Backend also returns a bearer token for cross-domain frontend compatibility.
- Login, Google auth, OTP verification, and `/auth/me` return a safe user bundle.
- Sensitive fields such as password hashes, OTP hashes, and wallet internals are not returned.
- Customer and garage identities are role-scoped; same email is not globally merged across roles.

## Cities and Availability

Managed cities are stored in the `City` table.

Public:

```text
GET /api/v1/cities
```

Admin:

```text
GET   /api/v1/cities/admin
POST  /api/v1/cities/admin
PATCH /api/v1/cities/admin/:id
```

Location forms should reject unavailable cities before booking or onboarding continues.

## Geocoding API

Manual customer addresses are converted to coordinates through:

```text
GET /api/v1/locations/geocode?address=IIT%20Kanpur&area=Kalyanpur&city=Kanpur&pincode=208016&country=India&countrycodes=in
```

Flow:

```text
Nominatim search restricted to India
 -> reject non-India coordinates
 -> if provider fails or no place is found, use Groq address correction
 -> if correction still cannot resolve, use Groq coordinate fallback
 -> reject 0,0 and out-of-India coordinates
```

Location creation/update validation also rejects:

- missing/non-finite coordinates
- `0,0`
- coordinates outside India bounds

Current-location clients should save browser/device coordinates directly to `/locations`. Manual-location clients should call `/locations/geocode` only after the user clicks Save/Continue.

## Customer Location Endpoints

```text
GET    /api/v1/locations
POST   /api/v1/locations
GET    /api/v1/locations/:id
PATCH  /api/v1/locations/:id
DELETE /api/v1/locations/:id
PATCH  /api/v1/locations/:id/default
```

Creating a default location syncs the customer profile address internally.

## AI Chatbot and Memory

The customer chatbot is mounted at:

```text
GET    /api/v1/chatbot/history
POST   /api/v1/chatbot/ask
DELETE /api/v1/chatbot/history
```

It uses local Markdown knowledge files as the retrieval source:

```text
src/customer/knowledge/booking-flow.md
src/customer/knowledge/customer-account.md
src/customer/knowledge/services-and-support.md
```

Flow:

```text
customer question
 -> load recent user-specific chat memory
 -> retrieve relevant Markdown sections
 -> add safe minimal customer context
 -> ask Groq
 -> store user and assistant messages
 -> fall back to local RAG answer if Groq is unavailable
```

Conversation memory is stored in the same PostgreSQL database:

```text
chatbot_conversations
chatbot_messages
```

Privacy behavior:

- Every history read/write is scoped by `req.user.id`.
- Deleting a user cascades their chatbot conversations and messages.
- Exact customer name, saved address, booking code, and raw coordinates are not sent to Groq.
- The model receives only minimal state such as whether a location exists, default vehicle summary, active booking count, and latest booking status.

For now a separate Neon database is not required. Keep chatbot memory in the main DB unless future compliance, retention, or analytics requirements demand physical isolation.

## Garage Application and Activation

- Garage owner auth is separate from customer auth.
- Applications are independent; one pending/unapproved application does not block another.
- Minimum application photos: 10.
- Admin approval creates/updates the garage.
- Garage activation depends on approval/verification, wallet conditions, and required media.

Common routes:

```text
POST /api/v1/garage/applications
GET  /api/v1/admin/garage-applications
POST /api/v1/admin/garage-applications/:id/approve
```

## Booking Lifecycle

```text
Cashfree payment verified
 -> booking SEARCHING_GARAGE
 -> active verified garages inside GARAGE_BROADCAST_RADIUS_KM are notified/logged
 -> search expires after GARAGE_SEARCH_TIMEOUT_SECONDS if no garage accepts
 -> garage accepts and wallet/platform fee is deducted
 -> customer receives accepted notification and handover OTP
 -> garage verifies OTP and uploads pickup inspection images
 -> booking IN_PROGRESS
 -> garage uploads delivery inspection images and marks delivered
 -> customer accepts delivery
 -> booking COMPLETED and visible in service history
```

Garage request endpoints:

```text
GET  /api/v1/garage/requests
POST /api/v1/garage/requests/:requestId/accept
POST /api/v1/garage/requests/:requestId/reject
POST /api/v1/garage/requests/:requestId/verify-handover-otp
POST /api/v1/garage/requests/:requestId/mark-delivered
```

Customer completion:

```text
POST /api/v1/bookings/:id/accept-delivery
GET  /api/v1/bookings/service-history
```

## Booking Inspection Images

Garage handover and delivery endpoints require Cloudinary-backed evidence:

```text
POST /api/v1/garage/requests/:requestId/verify-handover-otp
multipart fields: otp, images[5]

POST /api/v1/garage/requests/:requestId/mark-delivered
multipart fields: images[5]
```

Each image stores:

```text
bookingId
garageId
phase
imageUrl
publicId
order
```

Booking responses include inspection images ordered by phase/order.

## Payments

Cashfree is used for payment order creation and verification. Current frontend flows verify payments through backend APIs before garage search begins.

Production note: add Cashfree webhooks before real production payment traffic.

## Media

- Cloudinary is used for dynamic uploads.
- Garage application photos require at least 10 images.
- Garage media/listing photos are validated server-side.
- Complaint, service, and inspection images should go through backend upload middleware.
- Static frontend assets can remain bundled in the client.

## Redis Cache

Redis is used for optional cache/rate-limit/session-like volatile data. It is not the source of truth.

The cache utility:

- skips cleanly if `REDIS_URL` is missing
- uses short connect/command timeouts
- fails closed and returns cache miss on Redis errors
- prevents dashboard/geocode/profile requests from freezing due to a slow Redis free tier

## Admin Operations

Admin routes support:

- customer list/filtering
- city add/toggle
- garage application review
- approved garage deletion
- price range CRUD
- booking/notification operations
- broad cleanup scripts via CLI

When deleting garages from admin or CLI cleanup, related garage records, applications, media, wallet/request data, and dependent garage-side records should be cleaned with the operation.

## Production Notes

- Prefer Google Maps API for production geocoding once paid services are enabled.
- Keep Nominatim/Groq fallback as backup, not the only production geocoder.
- Configure strict quotas for Google Maps, SMS, Groq, Cloudinary, and Cashfree.
- Keep all secrets in deployment environment variables.
- Use separate dev/staging/prod databases.
- Run `npm run prisma:deploy` on release.
- Configure production CORS with `CLIENT_URL` and `FRONTEND_URL`.
- Use Redis as an optimization only.
- Add tests around auth, role separation, location, booking, payments, garage requests, and admin cleanup.

## License

ISC, based on current package metadata.
