# Rovauto Delivery Phases

> Roadmap synchronized with the repository on 30 July 2026. The planned launch date referenced by the team is 1 August 2026.

## Guiding principles

- Protect booking, payment, handover, and customer data before adding breadth.
- Prefer a small operationally reliable launch over a large feature-complete launch.
- Keep physical garage workflows realistic: permanent controller accounts are optional, not mandatory.
- Every production feature requires permissions, failure states, auditability, documentation, and rollback.
- Do not introduce Kubernetes, microservices, or a vector database until measured constraints justify them.

## Phase 0 — Implemented baseline

Status verified on 30 July 2026.

Current code includes:

- Public/customer, garage, controller, admin, intern, and support web portals.
- Customer authentication, onboarding, vehicles, locations, service selection, checkout, wallet, Cashfree, garage search, tracking, support, and chatbot.
- Garage applications, profiles, service/vehicle scopes, media, wallet, dispatch, controllers, and operational controls.
- Pickup and self-drop fulfilment with garage eligibility enforcement.
- Controller enable/disable setting and no-account WhatsApp worker tasks.
- Pickup/return/delivery worker tracking, one-time customer-originated self-drop tracking, Hindi/English worker instructions, browser voice, pickup handover OTP, and structured inspection evidence with one browser-compatible H.264 MP4 video per phase, selected/uploaded state, and playback fallbacks.
- Compact service history, expandable detailed timings, and black-and-white A4 PDF export.
- Rectangular pending-booking and payment-state cards.
- Full local Docker Compose stack with PostGIS, Redis, backend migration retries, and Nginx frontend proxying.
- Vehicle model catalogue photos shown in customer My Vehicles.
- Combined System Health for admin, sub-admin, and intern.
- Customer real Warranty Center derived from completed bookings with a 30-day countdown.
- Prisma migrations, security/regression tests, backup/recovery scripts, and deployment smoke checks.

## Phase 1 — Launch gate

### Product

- Confirm every launch garage has the correct fulfilment mode.
- Confirm supported brands and `GarageService` scopes match real capability.
- Confirm controller mode per garage:
  - organised garage: controller accounts enabled;
  - low-digital-literacy garage: controller accounts disabled and worker-task mode tested.
- Confirm each launch service has approved price ranges for supported vehicles.
- Confirm public mock warranty and customer real warranty routes are intentionally separate.

### Engineering

- Run `docker compose config` and a clean `docker compose up -d --build` smoke test on a machine with Docker Desktop.
- Confirm the PostGIS migration succeeds against an empty Compose volume and against the retained local PostgreSQL 16 volume after switching from the plain Postgres image.
- Verify the backend becomes healthy before Nginx starts, `/api/v1` works through port 8080, and all five route shells survive a hard refresh.
- Test payment boundaries at 09:59, 10:00, 23:59, and 00:00 IST.
- Upload a real phone video, wait for Cloudinary processing, confirm inline playback/retry/open behaviour, and verify “Uploaded” appears only after persistence.
- Download a service-history PDF and review every section in black and white on mobile and desktop.

- Apply all production migrations through `20260729103000_add_pseudo_average_rating`.
- Build all frontend shells and test direct URL refresh.
- Run all 74 security/regression test files (275 current `test(...)` cases).
- Validate Cashfree, Resend, Cloudinary, WhatsApp, Maps, Firebase, Web Push, Redis, and PostgreSQL in System Health.
- Test one end-to-end pickup booking and one end-to-end self-drop booking.
- Test both controller-enabled and controller-disabled garages.
- Verify 5-15 photos plus one video on pickup and delivery.
- Verify customer Warranty Center after booking completion.

### Operations

- Train managers on accepting requests, wallet fees, worker-link creation, resend, revoke, and evidence review.
- Train workers with a one-page Hindi flow and a shared Android phone where needed.
- Prepare manual fallbacks for WhatsApp template approval or delivery failure.
- Define launch-day owners for payment, garage dispatch, support, infrastructure, and customer communication.
- Keep a verified database backup before launch-day migration/deployment.

### Exit criteria

- No unresolved critical security or payment blocker.
- Readiness is green and System Health has no unexplained outage.
- Successful staging smoke flow for Docker/PostGIS startup → valid-hours platform-fee payment → dispatch → pickup → return-to-garage tracking → compatible video evidence → delivery tracking → Cash/UPI submission → garage confirmation → compact history/PDF → warranty.
- Every launch garage has verified operational configuration and contact details.
- Rollback and incident contacts are written and available.

## Phase 2 — Controlled single-city launch

### Rollout

- Begin with a limited service area and a verified garage cohort.
- Use gradual customer acquisition rather than opening all campaigns simultaneously.
- Review failed searches, rejected requests, response time, price gaps, and worker evidence daily.

### Metrics

Track at minimum:

- Registration-to-first-booking conversion
- Payment creation/paid/failure rates
- Garage search success and time to acceptance
- Garage notification delivery and response
- Controller versus worker-task usage
- Tracking freshness and permission failure
- Handover OTP failure/attempt rate
- Evidence upload failure and median size
- Final-payment submission and garage-confirmation rate
- Warranty cards created and support claims
- Support tickets, complaints, cancellations, and refunds
- System issues by severity and route

### Exit criteria

- Stable payment and dispatch success over a sustained period.
- Operational staff can resolve routine failures without direct database edits.
- Garage capability data accurately predicts acceptance.
- No repeated high-severity privacy or worker-token incident.

## Phase 3 — Operational maturity

- Move important background work to durable jobs with retries and dead-letter handling.
- Add structured logs, metrics, tracing, and alert routing.
- Add explicit worker-task retention and audit reports.
- Add warranty claim workflow if business policy requires claim decisions rather than support tickets.
- Add a garage worker directory without passwords for reusable names/phones.
- Improve task-device binding and media retry/offline behaviour.
- Add automated staging E2E tests for core booking variants.
- Formalise SLOs for API, payment, dispatch, and notifications.

## Phase 4 — Multi-zone city expansion

- Model service zones and operating hours explicitly.
- Use city/zone launch configuration and capacity limits.
- Add garage performance, acceptance reliability, and service quality scoring.
- Add marketing attribution, coupon, referral, and lead-management modules.
- Introduce a city launch command centre and repeatable onboarding checklist.
- Separate heavy reporting from transactional API queries.

Exit only after the first city has reproducible unit economics and an operational playbook.

## Phase 5 — Native worker and customer maturity

### Worker

Build a lightweight Android worker mode when browser tracking limitations become material:

- Task-link deep linking without account creation
- Reliable background location
- Camera-only mandatory evidence
- Offline upload queue
- Hindi voice and icon-led flow
- Device registration/revocation

### Customer mobile

Complete the Expo customer application only after the backend bearer-token contract is defined and tested. Reach web parity in phases rather than copying all screens at once.

## Phase 6 — National scale

Potential evolution:

- Multi-region CDN/WAF and load-balanced API
- Managed container platform and autoscaling
- Durable event/queue infrastructure
- Read replicas and analytics warehouse
- Managed PostgreSQL/Redis capacity planning
- Provider failover for critical communication
- Formal privacy, retention, audit, and incident programmes

Sharding is a measured decision, not a default. Consider it only after vertical scaling, indexes, query design, caching, partitioning, and read replicas are insufficient.

## Cross-phase release checklist

1. Product requirements and role permissions approved.
2. Schema migration reviewed and backup taken.
3. Server validation/tests pass.
4. Client production build passes.
5. Staging smoke and provider callbacks pass.
6. Mobile/desktop permission and responsive states checked.
7. System Health reviewed.
8. Documentation and customer knowledge updated.
9. Rollback version and owner identified.
10. Post-deploy booking/payment smoke completed.

## Architecture decision triggers

| Trigger | Likely decision |
| --- | --- |
| Browser worker tracking repeatedly stops | Native worker app |
| In-process jobs duplicate or are lost | Durable queue and worker service |
| API CPU/memory saturates | Container autoscaling and workload separation |
| Reporting affects bookings | Analytics warehouse/read replica |
| Keyword chatbot retrieval misses many questions | Hybrid full-text + embeddings, potentially pgvector |
| Multiple city rules become unmanageable | Explicit zone/capacity/configuration domain |
| Warranty support becomes high volume | Warranty claim models and workflow |
