# Pickup and Self Drop-off System

> Behaviour verified against the codebase on 28 July 2026.

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

## 2. Customer checkout

- If all selected services allow both, the customer can choose pickup/delivery or self drop-off.
- If any selected service is self-drop-only, the booking is forced to `SELF_DROP_OFF`.
- A pickup-only service requires pickup/delivery.
- Once the pending booking is created, the chosen fulfilment type is preserved as booking state.
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
→ delivery task/evidence
→ customer accepts
→ booking becomes COMPLETED
```

Browser worker tracking requires HTTPS, location permission, and the task page remaining active.

## 6. Self-drop lifecycle

```text
Customer selects/is forced to self drop
→ only self-drop-capable garages are searched
→ garage accepts
→ customer receives garage location/instructions
→ customer takes vehicle to garage
→ garage/controller/worker verifies handover OTP and media at garage
→ no pickup tracking is created
→ service work
→ delivery task means ready-for-self-pickup evidence
→ customer collects/accepts
→ booking becomes COMPLETED
```

A no-account worker link can still be used for handover and ready-for-pickup media, but `canTrack` is false for self-drop bookings.

## 7. Inspection evidence

For each pickup/delivery submission:

- 5-15 images
- each image at most 1 MB
- exactly one video
- video at most 50 MB

Evidence is linked to booking, garage, phase, media type, order, and upload timestamps.

## 8. Customer warranty

After customer acceptance completes the booking, the protected Warranty Center derives a 30-day warranty card showing services, vehicle, garage, activation, expiry, and remaining days. The public mock warranty page remains separate.

## 9. Database deployment

Relevant migrations:

```text
20260725003000_add_service_fulfillment_type
20260725173000_add_customer_and_garage_fulfillment_modes
20260725190000_repair_fulfillment_enum_compatibility
20260726070000_add_booking_inspection_video
20260728090000_add_garage_worker_task_mode
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
- Self-drop worker page shows no live tracking.
- Pickup handover changes destination to garage for return tracking.
- Required image/video validation runs on client and server.
