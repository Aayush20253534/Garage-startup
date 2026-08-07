# Rovauto Database Design

> Schema reference verified against `server/prisma/schema.prisma` on 8 August 2026.

## 1. Platform and conventions

- PostgreSQL 16 with PostGIS is the system of record. The local Compose stack uses `postgis/postgis:16-3.5-alpine`; plain `postgres:16` cannot execute the checked-in `CREATE EXTENSION postgis` migration by itself.
- PostGIS supports geospatial queries and garage-distance matching.
- Prisma 7 is the application data layer.
- IDs are UUID strings unless a provider or domain code requires another identifier.
- Monetary values are stored as integer INR units in current models.
- Timestamps are stored in UTC and formatted at the client boundary.
- Redis is not the durable source for bookings, sessions, tasks, or payments.

The repository currently contains 57 checked-in migration directories. The latest is:

```text
20260807174500_add_full_rc_owner_name
```

## 2. Domain map

```text
Identity
  User / GarageOwner / GarageController / StaffAccount / CustomerSupportAccount
  session and OTP/challenge tables

Catalogue and pricing
  ServiceCategory / Service / ServiceMedia
  VehicleBrand / VehicleModel
  City / restrictions / CityServicePriceRange / submissions / schedules

Garage capability
  Garage / GarageService / GarageImage / GarageVideo
  controllers / applications / availability rules

Booking and fulfilment
  Booking / BookingService / broadcasts / controller dispatch
  inspection media / tracking / worker tasks / events / reassignments

Finance
  Payment / customer wallet ledger / garage wallet ledger

Support and operations
  tickets / complaints / reviews / notifications
  SystemIssue / AdminAuditLog / escalations
```

## 3. Identity and session models

| Model | Purpose |
| --- | --- |
| `User` | Customer identity |
| `CustomerProfile` | Customer profile extension |
| `GarageOwner` | Central garage account |
| `GarageController` | Permanent garage staff account |
| `StaffAccount` | `ADMIN`, `SUB_ADMIN`, `INTERN` |
| `CustomerSupportAccount` | Isolated support agent identity |
| `UserSession` | Customer browser session |
| `GarageOwnerSession` | Owner session |
| `GarageControllerSession` | Controller session |
| `StaffSession` | Staff session |
| `CustomerSupportSession` | Support session |
| `StaffLoginChallenge` | Staff 2FA login challenge |
| `StaffPasswordResetChallenge` | Staff password reset |

Session rows support revocation and retention cleanup. Disabling controller accounts revokes active controller sessions for that garage.

### UserSession and admin login history

`UserSession` retains `userAgent`, `deviceId`, `lastSeenAt`, `expiresAt`, `revokedAt`, and timestamps. Admin Login History is a projection over these rows; no separate login-history table is required. Active device count is computed by grouping non-revoked, non-expired sessions by device identity. Logout-all writes `revokedAt` to active customer sessions rather than deleting history immediately; normal retention cleanup eventually removes sufficiently old revoked/expired sessions.

## 4. Customer and vehicle models

### Vehicle

A customer `Vehicle` stores brand, model, year, fuel type, registration, and default ownership state.

### Vehicle metadata

`VehicleBrand`:

- unique `name`
- optional `logoUrl`
- optional `logoPublicId`
- active state

`VehicleModel`:

- belongs to one brand
- unique `(brandId, name)`
- optional `imageUrl`
- optional `imagePublicId`
- active state

Model images are catalogue assets. A saved customer vehicle references brand/model text rather than a foreign key, so UI matching is case-insensitive and must retain a fallback when metadata changes.

### Customer registration-compatibility flag

`User.vehicleRegistrationRequired` is the migration-safe account-level switch:

- migration default `false` protects every pre-existing customer;
- new customer creation paths explicitly set `true`;
- booking/vehicle services enforce RC verification only when this flag is true.

`User.firstBookingOfferConsumedAt` records one-time first-booking offer consumption so the verification/waiver path cannot be replayed by simply abandoning a lead.

### Vehicle RC verification fields

`Vehicle` stores the minimum RC verification projection needed by Rovauto:

- `registrationNumber`
- `registrationVerified`
- `registrationVerifiedAt`
- `registrationVerificationProvider`
- `rcOwnerName` (full, admin-authorised use)
- `rcOwnerNameMasked` (customer-safe presentation)
- `rcMaker`, `rcModel`, `rcFuelType`, `rcVehicleClass`, `rcStatus`

Registration number and verification state are indexed. Rovauto intentionally does not persist provider-returned chassis/engine/address fields when they are not required for product behaviour.

## 5. Garage and capability models

### Garage

Important operational fields:

| Field | Meaning |
| --- | --- |
| `workingRadiusKm` | Garage service radius setting |
| `fulfillmentMode` | `BOTH`, `PICKUP_DELIVERY`, or `SELF_DROP_OFF` |
| `supportedBrands` | JSON brand list; `ALL` may be used by product rules |
| `excludedServiceBrands` | Garage-wide brand exclusions |
| `controllerLimit` | Maximum permanent controllers |
| `controllerAccountsEnabled` | Switch between controller workflow and worker-task mode |
| `operationalStatus` | Active/suspended/blocked/review/document state |

When `controllerAccountsEnabled=false`, controller sessions are revoked. When switched back to true, active/in-progress worker tasks are revoked.

### GarageService

A garage-service assignment is unique by:

```text
garageId + serviceId + vehicleBrand + vehicleModel
```

Scope rules:

- `ALL / ALL`: all vehicles
- `BMW / ALL`: every BMW model, including X1
- `BMW / X1`: only BMW X1
- `isExcluded=true`: explicit negative scope

Garage-wide and service-level exclusions must be evaluated before positive inclusion.

## 6. Booking model and states

`Booking` owns the marketplace lifecycle, selected vehicle, assigned garage/controller, financial snapshot, fulfilment type, location, route, handover OTP state, garage arrival, service completion, delivery arrival, final-payment declaration/confirmation, and tracking summary.

Current `BookingStatus` values:

```text
PENDING_PAYMENT
PENDING_VERIFICATION
SEARCHING_GARAGE
CONFIRMED
GARAGE_ASSIGNED     compatibility
IN_PROGRESS
COMPLETED
CANCELLED
EXPIRED
```

Important timestamps:

- `acceptedAt` — starts the acceptance counter; for self-drop it is also the customer-to-garage journey start
- `handoverOtpVerifiedAt`
- `arrivedAtGarageAt` — stops the self-drop travel timer or records pickup return arrival
- `serviceCompletedAt`
- `deliveryStartedAt`
- `deliveredAt` — garage/worker reached the customer, or self-drop vehicle became ready
- `finalPaymentSubmittedAt`
- `finalPaymentConfirmedAt`
- `customerAcceptedAt` — compatibility/completion timestamp set with payment confirmation
- tracking start/end and latest location timestamps

`BookingTrackingPhase` includes `SELF_DROP_TO_GARAGE`, `PICKUP_TO_CUSTOMER`, `RETURN_TO_GARAGE`, and `DELIVERY_TO_CUSTOMER`. Self-drop points use `TrackingSource.CUSTOMER`; garage actors may observe the route but cannot write customer-originated points.

`BookingFinalPaymentMethod` is `CASH` or `UPI`. `finalPaymentAmount` is the amount declared by the customer after physical payment; this record is not itself a payment-rail transaction. The garage confirmation transaction changes the booking to `COMPLETED`.

`BookingService` snapshots estimated/final prices for each selected service.

### BookingVerificationLead

The one-to-one `BookingVerificationLead` record coordinates eligible first-booking approval before garage search. It stores lead status, claim/call/decision timestamps, support ownership/notes and escalation metadata required by the support workflow. `BookingStatus.PENDING_VERIFICATION` is the corresponding booking lifecycle state.

The lead and `User.firstBookingOfferConsumedAt` are separate concerns: the lead represents operational review; the user timestamp prevents reuse of the one-time acquisition offer.

## 7. Fulfilment enums

`ServiceFulfillmentType` is used by services and bookings:

```text
BOTH
PICKUP_DELIVERY
SELF_DROP_OFF
```

`GarageFulfillmentMode` uses the same values but is an independent garage capability. Matching must compare the booking snapshot against the garage mode.

## 8. Dispatch models

### GarageBroadcastRequest

Records the offer sent to one garage for one booking, including round/cycle/radius and acceptance/rejection/expiry state.

### GarageControllerDispatch

Records controller-specific notification/acceptance delivery for a garage request.

### GarageWorkerTask

No-account worker capability record:

| Field | Purpose |
| --- | --- |
| `garageId`, `bookingId`, `requestId` | Scope to accepted booking and garage |
| `taskType` | `HANDOVER` or `DELIVERY` |
| `status` | `ACTIVE`, `IN_PROGRESS`, `COMPLETED`, `REVOKED`, `EXPIRED` |
| `workerName`, `workerPhone` | Assignment/contact metadata |
| `tokenHash` | Unique SHA-256 hash; raw token is never stored |
| `expiresAt` | Hard expiry |
| open/start/complete/revoke timestamps | Audit/lifecycle |
| `lastLocationAt` | Tracking recency |
| creator fields | Admin/owner accountability |

Indexes support garage/status/expiry and booking/type/status lookups.

There is intentionally no permanent `GarageWorker` account model in the current implementation.

## 9. Inspection media and tracking

### BookingInspectionImage

Despite the historical name, the model stores both images and videos:

- `phase`: `PICKUP` or `DELIVERY`
- `mediaType`: `IMAGE` or `VIDEO`
- URL/public ID/order
- unique `(bookingId, phase, mediaType, order)`

The service layer enforces 5-15 images and exactly one video per submission. Cloudinary delivery/transcoding changes do not require a schema change: the same URL/public-ID fields store the uploaded resource, while clients derive a compatible H.264 MP4 URL when needed.

### BookingTrackingPoint

Tracking points can belong to:

- customer
- garage owner
- garage controller
- worker task

`workerTaskId` links no-account worker location to the temporary assignment. `journeyPhase` partitions trails into `SELF_DROP_TO_GARAGE`, `PICKUP_TO_CUSTOMER`, `RETURN_TO_GARAGE`, and `DELIVERY_TO_CUSTOMER`. Source remains `GARAGE`, `CUSTOMER`, or `ADMIN`; worker origin is distinguished by the relation.

## 10. Warranty design

There is no `Warranty` table in the current schema. There is also no PDF/report table: the service-history PDF is generated in the authenticated browser from booking data and is not persisted.

Warranty data is a read model derived from `Booking` where:

```text
userId = authenticated customer
status = COMPLETED
garageId is not null
```

Activation uses:

```text
customerAcceptedAt ?? deliveredAt ?? updatedAt
```

Expiry is 30 days later. This avoids a daily decrement job and automatically includes historical completed bookings. A dedicated warranty table becomes appropriate only when adding claims, per-service durations, exclusions, extensions, transfer, or administrator overrides.

## 11. Financial models

- `Payment` is one-to-one with booking and records provider/order/status information.
- `Wallet` and `WalletTransaction` record customer funds.
- `GarageWallet` and `GarageWalletTransaction` record garage funds, recharge, and acceptance fees.
- Financial mutations require idempotency keys/provider IDs and transactional reconciliation.

Never infer payment truth solely from a frontend redirect.

## 12. Support and operational models

| Model | Use |
| --- | --- |
| `SupportTicket` and related message/attachment models | Customer support and disputes |
| `Complaint` / `ComplaintImage` | Booking/customer complaints |
| `Review` | Garage/service review data |
| `Notification` and push subscription models | In-app/browser communication |
| `SystemIssue` | Deduplicated frontend/backend failures |
| `AdminAuditLog` | Staff mutations and actor identity |
| `AdminEscalationRule` / `BookingEscalation` | Operational escalations |
| `PriceRangeSchedule` | Future/temporary pricing changes |
| `ServiceAvailabilityRule` | Deny/allow service scopes by dimensions |

## 13. Critical invariants

### Payment finalisation

- Provider order/amount/signature are verified.
- Repeated callbacks are idempotent.
- Wallet and payment state reconcile transactionally.

### Garage acceptance

- Booking must still be assignable.
- Request must still be valid.
- Garage capability is recalculated.
- First valid acceptance wins.
- Garage wallet fee is charged once.

### Handover

- OTP hash, expiry, attempts, and claim state are checked atomically.
- Required media is validated before lifecycle completion.
- Worker task must match booking, garage, accepted request, and task stage.

### Worker task

- Raw token is never persisted.
- Expired/revoked token cannot mutate state.
- Controller mode change invalidates the incompatible access method.
- Creating/resending rotates token authority.

### Price moderation

- Scope key uniqueness prevents duplicate approved ranges.
- Submission/review actor identity is retained.
- Scheduling preserves previous values for restoration/audit.

## 14. Deletion and retention

- Session cleanup revokes/deletes expired historical sessions according to configuration.
- Booking/financial deletion scripts are operationally dangerous and must follow the recovery runbook.
- Worker tasks should be retained long enough for incident/audit investigation; a formal retention period is not yet encoded.
- System issues can be resolved/ignored/deleted through authorised operations.
- Media deletion must coordinate Cloudinary cleanup with database state.

### Latest registration migrations

```text
20260806090000_add_pending_verification_status
20260806090100_add_first_booking_verification_leads
20260807160000_add_vehicle_registration_verification
20260807174500_add_full_rc_owner_name
```

As of this snapshot there are **57** checked-in migration directories. Do not collapse or rewrite historical migrations that have been applied to shared environments.

## 15. Migration workflow

Development:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:migrate
npm run prisma:generate
```

Production:

```bash
npm run prisma:deploy
npm run prisma:generate
npm run prisma:check-client
```

Never edit an already-applied migration. Add a repair migration when production history and schema diverge.

The repository currently contains 57 migration directories. Recent migrations:

```text
20260725003000_add_service_fulfillment_type
20260725173000_add_customer_and_garage_fulfillment_modes
20260725190000_repair_fulfillment_enum_compatibility
20260726070000_add_booking_inspection_video
20260726193000_add_vehicle_model_photos
20260728090000_add_garage_worker_task_mode
20260728174500_add_pickup_delivery_payment_confirmation
20260728183000_add_self_drop_tracking_phase
20260729100000_add_platform_pseudo_data
20260729103000_add_pseudo_average_rating
20260731153000_make_garage_controller_email_optional
20260806090000_add_pending_verification_status
20260806090100_add_first_booking_verification_leads
20260807160000_add_vehicle_registration_verification
20260807174500_add_full_rc_owner_name
```

## 16. Backup and recovery

Use PostgreSQL custom-format backups and isolated restore drills. For Docker, run backup/restore commands inside the backend or PostGIS container and copy artefacts outside the named volume before destructive maintenance. Verify migrations, critical tables, row counts, and application smoke tests before declaring recovery successful. See `server/docs/RECOVERY_RUNBOOK.md`.

## 17. Future evolution

Potential future models:

- Durable outbox/queue jobs
- Permanent lightweight garage worker directory without login
- Warranty claim/decision/history models
- Marketing campaign, attribution, coupon, referral, and lead models
- Analytics event/warehouse pipeline
- Device binding and offline upload queue for a native worker app
