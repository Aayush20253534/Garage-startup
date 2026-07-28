# Garage Partner, Controller, Worker Task, and Booking Flow

> Operational flow verified against the repository on 28 July 2026.

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
- verify customer handover OTP;
- upload pickup evidence;
- return vehicle to garage;
- upload delivery evidence;
- complete assigned work.

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

- Customer takes the vehicle to the assigned garage.
- No pickup tracking is available.
- Controller/owner/worker verifies the handover OTP at the garage and uploads evidence.
- The booking moves to `IN_PROGRESS`.

For a self-drop `DELIVERY` task, the worker uploads ready-for-self-pickup evidence rather than travelling to the customer.

## 12. Service work and evidence

Required inspection media per pickup/delivery submission:

- 5-15 images, maximum 1 MB each
- exactly one video, maximum 50 MB

The manager should review evidence quality. Physical mechanics do not need an account; a floor supervisor or shared garage phone can handle evidence.

## 13. Delivery and completion

Pickup/delivery booking:

1. Delivery task starts at garage.
2. Worker/controller tracks to customer.
3. Delivery evidence is uploaded.
4. Garage marks delivered.
5. Customer accepts delivery.
6. Booking becomes `COMPLETED`.

Self drop:

1. Garage uploads ready-for-pickup evidence.
2. Customer collects and accepts.
3. Booking becomes `COMPLETED`.

## 14. Warranty and history

Completed booking appears in:

- customer service history;
- protected Warranty Center;
- garage/controller history according to role/privacy.

The warranty card remains active for 30 days from customer acceptance/delivery fallback and then shows expired.

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
