# Self Drop-off Service Setup

## Behaviour

Rovauto now supports two service-level vehicle movement modes:

- `PICKUP_DELIVERY`: the existing garage pickup and return process. This remains the default for every existing and newly created service unless an admin changes it.
- `SELF_DROP_OFF`: the customer takes the vehicle to the assigned garage and returns to collect it after service.

An admin selects the mode independently for each service from **Admin → Services → Customer vehicle movement**.

## Mixed cart protection

Pickup-and-delivery services and self drop-off services cannot be placed in the same booking.

Protection exists in both places:

1. The customer UI refuses the second incompatible service and displays a disclaimer.
2. The booking API validates the selected services again and returns HTTP `409` if a mixed request is submitted manually or by an outdated client.

## Self drop-off lifecycle

1. Customer selects only self drop-off services and pays the normal platform fee.
2. The existing nearby-garage matching process runs without changes.
3. The accepted garage address, map, phone and handover OTP are shown to the customer.
4. The garage is told not to travel to the customer. Customer address and coordinates are not exposed as a pickup destination.
5. The customer reaches the garage and shares the OTP.
6. Garage captures five drop-off inspection photos and starts service.
7. Garage captures five post-service photos and marks the vehicle ready for customer pickup.
8. Customer visits the garage, enters the final amount paid and confirms vehicle collection.
9. The booking completes and warranty/service history activate through the existing completion process.

Live pickup-route tracking and customer-proximity unlocking are disabled only for self drop-off bookings. Standard bookings continue using the existing tracking and proximity rules.

## Database deployment

Run the migration before starting the updated server:

```bash
cd server
npm run prisma:deploy
npm run prisma:generate
```

Migration:

`server/prisma/migrations/20260725003000_add_service_fulfillment_type/migration.sql`

The migration adds:

- `Service.fulfillmentType`
- `Booking.fulfillmentType`
- PostgreSQL enum `ServiceFulfillmentType`

Both columns default to `PICKUP_DELIVERY`, so existing services and bookings preserve their current behaviour.

## Verification checklist

- Edit one service in admin and choose **Self drop-off & pickup**.
- Confirm the service badge is visible on customer service cards.
- Add that service to cart, then attempt to add a standard service; confirm the disclaimer appears and the second item is not added.
- Repeat in reverse order.
- Submit a mixed service-ID request directly to the API; confirm it returns `409`.
- Complete a self drop-off booking and confirm no live pickup route is created.
- Confirm garage sees the OTP and photo controls without customer-distance unlocking.
- Confirm the garage cannot see or navigate to the customer address for the self drop-off booking.
- Mark the vehicle ready and confirm the customer sees **Confirm Vehicle Collection**.
- Confirm a normal pickup-and-delivery booking works exactly as before.
