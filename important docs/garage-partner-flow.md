# Garage Partner, Controller, Worker Task, and Booking Flow

> Operational flow verified against the repository on 30 July 2026.

## 1. Partner application and approval

1. Garage submits partner application and media.
2. Admin reviews identity, address, location, services, and documents.
3. Approved application creates/links the garage and owner account.
4. Admin configures operational status, fulfilment, brands, service scopes, exclusions, and controller mode.
5. Garage must be active and verified before normal marketplace participation.

## 2. Garage configuration

Admin Garage Details owns:

- contact/address/location/radius
- `fulfillmentMode`
- garage type
- supported brands
- garage-wide brand exclusions
- service/brand/model scopes
- service exclusions
- controller limit
- `controllerAccountsEnabled`
- verification and operational status

Incorrect capability configuration directly affects which booking notifications the garage receives.

## 3. Fulfilment choices

Garage modes:

```text
BOTH
PICKUP_DELIVERY
SELF_DROP_OFF
```

- Self-drop-only garages never receive pickup requests.
- Pickup-only garages never receive self-drop requests.
- Both-mode garages can receive either when all other capability checks pass.

## 4. Brand/model/service eligibility

A garage must support the vehicle brand and every selected service.

Common configuration:

```text
Supported brand: BMW
Service scope: BMW / ALL
```

This matches BMW X1, X3, and other BMW models. Garages do not need to list every model when they serve all models of a brand.

Specific positive or excluded scopes override broad assumptions. Eligibility is rechecked before notification and acceptance.

## 5. Workforce access modes

### Controller accounts enabled

Use for organised garages with digitally capable supervisors/staff.

- Owner creates/manages controllers within the garage limit.
- Controllers log in from the garage login screen.
- Controller sessions, availability, dispatch, assignment, and history are active.
- Controller/customer data remains assignment-scoped.
- Worker task links cannot be created.

### Controller accounts disabled

Use for garages where workers should not maintain accounts.

- Active controller sessions are revoked.
- Controller login/notifications are blocked.
- The central owner account accepts and manages the booking.
- Owner/admin assigns a no-account worker through a secure task link.
- Garage controller navigation is hidden.

Re-enabling controllers revokes active/in-progress worker links.

## 6. Customer checkout and payment

Payment creation and recovery are allowed daily from 10:00 AM inclusive until 12:00 AM midnight exclusive in `Asia/Kolkata`. The client blocks obvious out-of-window attempts, but the backend remains the authority and preserves the pending booking for the next valid window.

1. Customer selects city, vehicle, and services.
2. Server validates restrictions and approved price ranges.
3. Customer selects pickup/self-drop when allowed.
4. Pending booking stores prices, fulfilment, and location snapshot.
5. Customer wallet contribution and Cashfree payment are reconciled.
6. Paid booking enters garage search.

## 7. Progressive garage search

Search expands through configured rounds/radii. For each candidate:

- operational/verification/active checks
- fulfilment compatibility
- brand and exclusion checks
- every selected service scope
- service/category availability/restriction
- distance/working radius

A `GarageBroadcastRequest` is created only for an eligible garage.

## 8. Acceptance and wallet fee

- First valid acceptance wins.
- Booking and request are revalidated transactionally.
- Garage capability is recalculated.
- Garage wallet fee is charged once.
- Booking is assigned and normally becomes `CONFIRMED`.
- Controller or owner notification path follows the garage workforce setting.

## 9. Controller-enabled handover

The existing controller/owner flow can:

- start tracking;
- reach the customer;
- verify customer handover OTP for pickup bookings;
- upload pickup evidence;
- return vehicle to garage;
- confirm arrival back at the garage;
- upload post-service evidence;
- track the vehicle back to the customer;
- confirm customer arrival and final payment receipt.

Controller availability moves between available and busy according to booking state.

## 10. No-account worker handover

Owner/admin creates a `HANDOVER` task with worker name, WhatsApp number, and TTL.

```text
WhatsApp template/manual link
→ /worker-task/:token
→ Hindi/English instructions
→ optional voice playback
→ live tracking for pickup
→ 5-15 images + one video
→ customer handover OTP
→ return tracking to garage
→ complete return journey
```

The worker sees only task-relevant vehicle, services, destination, garage, and masked customer information. Wallet, payments, other bookings, and customer history are absent.

## 11. Self-drop handover

- Garage acceptance starts the customer travel timer at `acceptedAt`.
- The customer opens the booking and shares the single `SELF_DROP_TO_GARAGE` route to the assigned garage.
- Controller/owner/worker watches the route but cannot publish customer-originated location points.
- When the customer is near the garage, garage staff uploads 5-15 before-service photos and one video and confirms arrival without OTP.
- `arrivedAtGarageAt` stops the travel timer and the booking moves to `IN_PROGRESS`.
- Post-service evidence marks the vehicle ready for self pickup. No second self-drop map opens.

## 12. Service work and evidence

Required inspection media per pickup/delivery submission:

- 5-15 images, maximum 1 MB each
- exactly one video, maximum 50 MB
- The video picker labels local selection as ready to upload; the booking gallery labels only persisted media as uploaded.
- New Cloudinary videos use H.264 MP4 delivery, and the gallery provides retry/direct-open recovery for processing or browser playback failures.

The manager should review evidence quality. Physical mechanics do not need an account; a floor supervisor or shared garage phone can handle evidence.

## 13. Service completion, delivery, and payment confirmation

Pickup/delivery booking:

1. Garage/controller/worker confirms that the pickup return journey reached the garage.
2. Service work is completed and 5-15 post-service images plus one video are uploaded.
3. Rovauto sends the customer a service-completed email/notification and starts the delivery journey.
4. Worker/controller shares live location from garage to customer and confirms arrival near the saved address.
5. Customer inspects the vehicle, chooses Cash or UPI, enters the amount actually paid, and sends the payment details.
6. The booking remains pending until garage/controller/authorised task worker confirms receipt.
7. Confirmation atomically sets `COMPLETED`, stops the elapsed timer, releases the controller, and activates warranty/history.

Self drop:

1. Garage uploads ready-for-pickup evidence and the customer is notified to collect the vehicle.
2. Customer inspects at the garage, chooses Cash or UPI, and submits the amount paid.
3. Garage/controller/authorised worker confirms receipt and completes the booking.

The Cash/UPI choice is an auditable payment declaration and confirmation flow, not a replacement for the actual cash handover or UPI transfer.

## 14. Warranty and history

Completed booking appears in:

- customer service history with a minimal summary, expandable phase timings, and a detailed black-and-white A4 PDF containing the booking, service, payment, evidence, rating, and timing record;
- protected Warranty Center;
- garage/controller history according to role/privacy.

The warranty card remains active for 30 days from final payment confirmation/completion and then shows expired.

## 15. Intervention controls

Owner/admin can:

- create task;
- list task history;
- resend/rotate link;
- revoke link;
- review open/start/location/completion timestamps;
- switch workforce mode through garage settings.

Changing mode is consequential because it revokes the incompatible session/link family.

## 16. Operational ownership

| Issue | Primary owner |
| --- | --- |
| Garage configuration/capability | Admin operations |
| Request acceptance/wallet | Garage manager + operations |
| Controller account/session | Garage owner + admin |
| Worker link delivery/expiry | Garage owner + operations |
| Worker location/media permission | Garage manager training/support |
| Payment/refund | Finance/tech operations |
| Booking state incident | Tech operations using System Health/request ID |
| Customer complaint/warranty claim | Customer support |
