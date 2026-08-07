# Pickup and Self Drop-off System

> Behaviour verified against the codebase on 8 August 2026.

## 1. Independent configuration layers

Rovauto separates three decisions:

1. **Service capability** — what vehicle movement a service allows.
2. **Booking choice** — what the customer selected for this booking.
3. **Garage capability** — what movement the garage can fulfil.

Enums:

```text
BOTH
PICKUP_DELIVERY
SELF_DROP_OFF
```

`Service.fulfillmentType` describes the service. `Booking.fulfillmentType` stores the booking snapshot. `Garage.fulfillmentMode` describes the garage.

### Preconditions shared with all fulfilment modes

Before pickup/self-drop logic begins, the customer must satisfy the normal account/vehicle rules. For customer accounts with `vehicleRegistrationRequired=true`, the selected vehicle must have a verified RC registration. Legacy accounts created before the RC feature remain optional. Eligible first bookings may also pause in `PENDING_VERIFICATION` for support approval before garage search; this does not change the later pickup/self-drop lifecycle.

## 2. Customer checkout

- If all selected services allow both, the customer can choose pickup/delivery or self drop-off.
- If any selected service is self-drop-only, the booking is forced to `SELF_DROP_OFF`.
- A pickup-only service requires pickup/delivery.
- Once the pending booking is created, the chosen fulfilment type is preserved as booking state.
- Payment can be started or resumed from 10:00 AM inclusive until 12:00 AM midnight exclusive in `Asia/Kolkata`; outside that window the pending booking remains recoverable.
- Missing price or service eligibility blocks checkout rather than silently changing service selection.

## 3. Garage eligibility

A garage receives a request only when every condition passes:

- Verified, active, operational, and within the search radius.
- `Garage.fulfillmentMode` supports `Booking.fulfillmentType`.
- `supportedBrands` contains the vehicle brand or `ALL`.
- The vehicle brand is not in `excludedServiceBrands`.
- Every selected service has an active `GarageService` scope matching the brand/model.
- No matching `GarageService` exclusion blocks the vehicle.
- Category/service restrictions and availability rules allow the request.

Examples:

| Garage scope | Customer vehicle | Eligible for that service? |
| --- | --- | --- |
| `BMW / ALL` | BMW X1 | Yes |
| `ALL / ALL` | BMW X1 | Yes unless excluded |
| `BMW / X3` | BMW X1 | No |
| Audi only | BMW X1 | No |

A self-drop-only garage never receives a pickup request. This is enforced in search, immediately before notification, and again during acceptance.

## 4. Controller mode interaction

Fulfilment and workforce access are separate settings.

### Controller accounts enabled

- Existing controller login/availability/notification/assignment flow runs.
- Worker task links cannot be created.

### Controller accounts disabled

- Active controller sessions are revoked.
- Controllers do not receive request notifications.
- The garage owner remains the central account.
- Owner/admin can create a secure WhatsApp worker task after the garage accepts.

Changing back to controller mode revokes active/in-progress worker tasks.

## 5. Pickup lifecycle

```text
Customer selects pickup
→ only pickup-capable garages are searched
→ compatible garage accepts
→ controller or worker receives assignment
→ live tracking to customer
→ customer handover OTP
→ 5-15 pickup photos + exactly one video
→ booking becomes IN_PROGRESS
→ live tracking back to garage
→ worker completes return journey
→ service work
→ post-service images/video uploaded
→ customer receives service-complete email
→ live delivery tracking to customer
→ worker confirms arrival near customer
→ customer submits Cash/UPI mode and amount
→ garage confirms payment received
→ booking becomes COMPLETED
```

Browser worker tracking requires HTTPS, location permission, and the task page remaining active.

## 6. Self-drop lifecycle

```text
Customer selects/is forced to self drop
→ only self-drop-capable garages are searched
→ garage accepts and acceptedAt starts the customer travel timer
→ customer opens the booking and starts one live route to the garage
→ customer location points use SELF_DROP_TO_GARAGE
→ customer reaches near the garage
→ garage/controller/authorised worker uploads 5-15 before-service photos and one video
→ garage confirms arrival without OTP
→ arrivedAtGarageAt stops the customer travel timer and service begins
→ service work
→ garage uploads 5-15 post-service photos and one video
→ customer receives service-complete notification and collects the vehicle
→ no second self-drop map or return-delivery route is opened
→ customer submits Cash/UPI mode and amount
→ garage confirms payment received
→ booking becomes COMPLETED
```

A no-account worker link can be used to confirm self-drop arrival and submit before/after evidence, but the customer—not the worker—shares the one-time journey location. No self-drop handover OTP is created.

## 7. Inspection evidence

For each pickup/delivery submission:

- 5-15 images
- each image at most 1 MB
- exactly one video
- video at most 50 MB

The upload control shows a local file as “Selected - ready to upload”. Only persisted booking evidence is labelled “Uploaded”. New Cloudinary videos request H.264 MP4 output; historical URLs are normalised for compatible playback with retry and direct-open fallbacks.

Evidence is linked to booking, garage, phase, media type, order, and upload timestamps.

## 8. Service history and customer warranty

After completion, both fulfilment methods appear in compact Service History cards. Detailed travel, service, delivery, and payment-confirmation timing remains expandable and is included in a black-and-white A4 PDF together with customer, vehicle, garage, service, payment, evidence, rating, and note details.


After garage payment confirmation completes the booking, the protected Warranty Center derives a 30-day warranty card showing services, vehicle, garage, activation, expiry, and remaining days. The public mock warranty page remains separate.

## 8A. Cross-cutting abuse protection

Vehicle creation and RC verification/change are server-limited to three attempts per customer per rolling 24 hours. These limits happen before fulfilment selection and must not be bypassed by switching between pickup and self drop-off.

## 9. Database deployment

Relevant migrations:

```text
20260725003000_add_service_fulfillment_type
20260725173000_add_customer_and_garage_fulfillment_modes
20260725190000_repair_fulfillment_enum_compatibility
20260726070000_add_booking_inspection_video
20260728090000_add_garage_worker_task_mode
20260728174500_add_pickup_delivery_payment_confirmation
20260728183000_add_self_drop_tracking_phase
```

Apply:

```bash
cd server
npm run prisma:deploy
npm run prisma:generate
npm run prisma:check-client
```

## 10. Verification checklist

- Normal service allows both choices.
- Self-drop service forces self drop.
- Pickup booking excludes self-drop-only garage.
- Self-drop booking excludes pickup-only garage.
- BMW/ALL matches BMW X1.
- A missing selected service scope prevents notification and acceptance.
- A matching exclusion prevents notification and acceptance.
- Controller-disabled garage sends no controller notification.
- Worker link cannot be created while controllers are enabled.
- Customer can start `SELF_DROP_TO_GARAGE`; garage/worker can view but cannot impersonate the customer location source.
- Pickup handover changes destination to garage for return tracking.
- Required image/video validation runs on client and server.
