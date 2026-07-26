# Pickup and Self Drop-off Setup

## Behaviour

Rovauto separates the service rule from the booking choice:

- A normal service is stored as `BOTH`. At checkout, the customer can choose either `PICKUP_DELIVERY` or `SELF_DROP_OFF` for the complete booking.
- A service explicitly stored as `SELF_DROP_OFF` is self-drop-off-only. If the cart contains one or more of these services, checkout automatically selects self drop-off and disables pickup.
- A garage is independently stored as `BOTH`, `PICKUP_DELIVERY`, or `SELF_DROP_OFF` according to the handover modes that it can fulfil.

An admin configures service behaviour from **Admin → Services → Customer vehicle movement** and garage behaviour from **Admin → Garages → Garage Details → Edit all details → Booking handover**.

## Customer checkout

1. The customer can combine normal services and self-drop-off-only services in one cart.
2. If every selected service is normal, checkout presents both handover options.
3. If any selected service is self-drop-off-only, the booking must use self drop-off.
4. The selected booking mode is saved on `Booking.fulfillmentType` and remains fixed once the pending booking has been created.
5. Older clients that omit the booking mode remain compatible: normal carts default to pickup, while carts containing a self-drop-off-only service are inferred as self drop-off.

## Garage matching and notifications

A garage is eligible only when all of the following are true:

- Its `Garage.fulfillmentMode` supports the customer-selected booking mode.
- Its `supportedBrands` list contains the booking vehicle's brand, or contains `ALL`.
- The vehicle brand is not in the garage-wide excluded-brand list.
- Every selected service is actively assigned to that garage for the vehicle's brand/model scope.
- No matching service exclusion blocks that brand/model.
- The service and its category are active and the existing operational, distance and availability checks pass.

The same capability check runs during nearby matching, immediately before notifications are dispatched, and again inside the acceptance transaction. A garage therefore cannot accept a stale request after its mode, brand coverage or service allocation changes.

## Self drop-off lifecycle

1. Customer chooses self drop-off, or checkout forces it because a selected service requires it.
2. Matching alerts only garages that support self drop-off and the selected vehicle/services.
3. After acceptance, the customer receives the garage address, map, phone and handover OTP.
4. The customer takes the vehicle to the garage and later collects it there.
5. Pickup-route tracking and customer-proximity unlocking remain disabled for self-drop-off bookings.
6. Inspection photos, final amount confirmation, completion, warranty and service history continue through the existing booking lifecycle.

For pickup bookings, notifications only go to pickup-capable garages, and the existing collection/return tracking flow remains active.

## Database deployment

Deploy and regenerate Prisma before starting the updated server:

```bash
cd server
npm run prisma:deploy
npm run prisma:generate
```

New migration:

`server/prisma/migrations/20260725173000_add_customer_and_garage_fulfillment_modes/migration.sql`

It:

- Converts existing normal services from `PICKUP_DELIVERY` to service mode `BOTH`.
- Preserves explicitly configured self-drop-off-only services.
- Keeps existing booking snapshots unchanged.
- Adds `Garage.fulfillmentMode` with a safe default of `BOTH`.

## Verification checklist

- For a normal service, confirm checkout allows both pickup and self drop-off.
- For a self-drop-off-only service, confirm pickup is disabled.
- Mix a normal service with a self-drop-off-only service and confirm checkout forces self drop-off instead of rejecting the cart.
- Set one garage to pickup-only, one to self-drop-off-only and one to both.
- Confirm a pickup booking alerts only pickup-only/both garages.
- Confirm a self-drop-off booking alerts only self-drop-off-only/both garages.
- Remove the vehicle brand from a garage's supported-brand list and confirm it receives no request.
- Confirm every selected service must be assigned for the vehicle brand/model.
- Change a garage capability after a request is created and confirm acceptance is rejected by the final transactional check.
