# Rovauto Engineering Prompts

> Prompt library synchronized with the codebase on 8 August 2026.

These prompts are templates for code assistants. Always attach the latest complete codebase or state the exact base commit/patch. Require evidence for every claim.

## 1. Universal context block

```text
You are modifying Rovauto, a React/Vite + Express/Prisma/PostgreSQL vehicle-service marketplace.

Current staff roles:
- ADMIN = Main Admin
- SUB_ADMIN = Admin
- INTERN = Intern

Important current behaviour:
- Garage fulfilment: BOTH, PICKUP_DELIVERY, SELF_DROP_OFF.
- Garage service scopes use vehicleBrand/vehicleModel with ALL support and explicit exclusions.
- controllerAccountsEnabled=true uses permanent controllers.
- controllerAccountsEnabled=false uses secure WhatsApp worker-task links.
- Worker tasks are HANDOVER or DELIVERY, token-scoped, expiring, and require 5-15 images plus exactly one video. New uploads must remain browser-compatible H.264 MP4, distinguish selected from uploaded state, and retain playback retry/direct-open fallbacks.
- Customer payment actions are allowed only from 10:00 AM inclusive until 12:00 AM midnight exclusive in Asia/Kolkata; keep frontend and backend checks aligned.
- Service History is compact and exports a detailed black-and-white A4 PDF locally. Pending status UI uses rectangular corner cards, not oversized capsules.
- Local Docker uses PostGIS 16, Redis 7, the backend migration entrypoint, and Nginx same-origin API proxying.
- Public /warranty is a mock design page; customer /dashboard/warranty is real and protected.
- Customer warranties are derived from completed bookings for 30 days; there is no Warranty table.
- System Health combines System Issues and Integration Health for ADMIN, SUB_ADMIN, and INTERN.
- VehicleModel supports imageUrl/imagePublicId and customer vehicle cards show matching model images.
- Web frontend state ownership: TanStack Query for backend/API server state, Redux Toolkit for shared client-owned selection/cart/session UI, component/URL state for local UI. Do not duplicate the same server resource into new ad-hoc localStorage caches.
- Way2API RC verification is server-only. Existing customers remain optional through `vehicleRegistrationRequired=false`; new customer accounts are required. Vehicle create and RC verify/change are each limited to 3 attempts per 24 hours.
- Admin Vehicles distinguishes RC registered owner from Rovauto account name; Way2API does not provide an RC-registered phone, so do not substitute the account phone.
- Eligible first bookings can enter `PENDING_VERIFICATION` and require support approval before garage search.
- Admin customer Login History projects retained `UserSession` data; logout-all is ADMIN/SUB_ADMIN only.

Do not weaken authorization, CSRF, provider signature checks, wallet/payment idempotency, or privacy.
Return an incremental patch and a complete ZIP. State migrations and tests truthfully.
```

## 2. Implement a feature

```text
Inspect the attached latest codebase before editing.

Implement: <feature>
Actors: <roles>
Routes/screens: <paths>
Required state transitions: <states>
Security/privacy constraints: <constraints>
UI constraints: rectangular operational controls, responsive states, no unnecessary pills.

Tasks:
1. Identify the current implementation and owning models/routes.
2. Implement backend validation, authorization, service invariants, API, and tests.
3. Implement frontend loading, empty, success, error, permission, and responsive states.
4. Add a Prisma migration only when persistence changes.
5. Update all owning Markdown documentation and customer knowledge.
6. Run syntax/Prisma/tests/build checks that are available.
7. Generate and verify an incremental git patch against the supplied base.
8. Generate a complete ZIP excluding node_modules, build output, logs, and .git.

Do not fabricate build/test results.
```

## 3. Diagnose without changing code

```text
Analyse the provided code and logs without modifying files.

Issue: <symptom>
Reference/request ID: <id>
Actor and route: <actor/route>
Deployment: <frontend/backend/database/provider>

Trace the request from UI to API route, middleware, controller, service, database, and provider.
Distinguish configuration, provider, application, data, timeout, and proxy failures.
Give the most likely cause, competing causes, exact evidence to collect, and safe remediation order.
Do not assume a 502 always means the same provider failure.
```

## 4. Production-readiness review

```text
Review the attached Rovauto codebase for launch readiness.

Prioritise:
- auth/session/CSRF/CORS
- payment and wallet idempotency
- garage eligibility and stale acceptance
- controller and worker-task access
- worker-token leakage and expiry
- tracking and inspection evidence
- upload limits and cleanup
- support/privacy
- background-worker duplication
- migrations/backups/rollback
- provider timeouts and webhooks
- observability/System Health

For every finding provide severity, exploit/failure path, exact file/function, launch impact, and minimal fix.
Separate blockers from post-launch debt.
```

## 5. Security review

```text
Perform a source-based security review of Rovauto.

Explicitly test:
- IDOR and cross-role access
- main-admin/sub-admin/intern boundaries
- controller disabled-state bypass
- worker-task token guessing, logging, forwarding, expiry, resend, and revocation
- customer-data exposure in worker public responses
- CSRF and webhook exceptions
- OTP attempts and atomic consumption
- Cashfree webhook/order verification
- upload MIME/count/size and temp-file cleanup
- SSRF and auto-resolver probe restrictions
- secrets in client/mobile environment variables
- system issue and integration-health redaction

Do not recommend hiding UI as an authorization control.
```

## 6. Prisma/database change

```text
Implement this database change: <change>

Requirements:
- Update schema and add a new forward migration.
- Do not edit applied migrations.
- Preserve existing production data and enum compatibility.
- Add indexes/unique constraints that match real queries.
- Update services and tests for transactional invariants.
- Update important docs/Database.md and relevant architecture/security docs.
- State exact prisma deploy/generate commands.
```

## 7. API change

```text
Design and implement: <API>

Specify method, path, authentication, roles, validation, rate limits, idempotency, ownership, response shape, status codes, audit logging, cache invalidation, and tests.
Use the shared ApiError/ApiResponse/error middleware conventions.
Never return secrets, hashes, raw provider payloads, or unrelated customer data.
```

## 8. Frontend UI improvement

```text
Improve: <page/component>

Preserve behaviour and API contracts unless explicitly changed.
Use the shared Axios client.
Cover loading, empty, error, retry, disabled, permission, and mobile states.
Retain public/private route separation.
Use model/service images through existing safe image helpers and fallbacks.
Validate JSX and run the production build when dependencies are available.
```

## 8A. Frontend state-management change

```text
Before editing state management, classify every value:
- backend-owned/server state -> TanStack Query
- shared frontend interaction/selection state -> Redux Toolkit
- page-local form/modal/filter -> component state or URL params

Reuse queryKeys/queryClient, invalidate affected queries after mutations, clear query data on account logout, and do not persist sensitive server responses. Preserve booking cart context rules and test with browser HTTP cache disabled.
```

## 8B. Vehicle registration / RC verification change

```text
Preserve legacy compatibility through User.vehicleRegistrationRequired.
Never expose WAY2API_API_KEY to the browser.
Enforce provider calls, maker/model/fuel match, 3-per-24-hour limits, and booking guard on the server.
Keep RC registered owner distinct from Rovauto account identity. Do not claim RC phone verification because Way2API does not return a registered phone field.
Test valid, not-found, mismatch, provider error, legacy optional, new-account required, rate-limit, and admin live lookup paths.
```

## 9. Payment or wallet change

```text
Modify the Cashfree/wallet flow: <change>

Treat the backend/provider as authoritative.
Preserve amount validation, order ownership, webhook signature verification, idempotency, duplicate callback handling, wallet ledger consistency, refund reconciliation, and reference IDs.
Add regression tests for repeats, timeouts, mismatches, and partial failure.
```

## 10. Garage eligibility change

```text
Modify garage matching/notifications: <change>

Eligibility must be identical in candidate search, pre-notification validation, and acceptance transaction.
Check operational status, verification, distance, fulfilment mode, supported brands, garage-wide exclusions, every selected service, brand/model scopes, service exclusions, and availability.
Include tests such as BMW/ALL matching BMW X1 and self-drop-only excluding pickup.
```

## 11. Controller or worker-task change

```text
Modify garage workforce handling: <change>

Permanent controllers:
- only when controllerAccountsEnabled=true
- garage-scoped sessions and assignment privacy

No-account worker tasks:
- only when controllerAccountsEnabled=false
- manager is assigned owner or staff
- token hash only, bounded TTL, rotate on resend, revoke on mode switch
- one accepted booking/request and one task stage
- no wallet/payment/customer phone exposure
- tracking and media lifecycle tested

Update the WhatsApp template documentation when parameters change.
```

## 12. Warranty change

```text
Modify customer warranty behaviour: <change>

Current design is derived from completed bookings, not a Warranty table.
Public /warranty must remain the mock design page unless explicitly requested.
Protected /dashboard/warranty uses /api/v1/warranties.
Activation preference is customerAcceptedAt, deliveredAt, updatedAt; duration is 30 days.
Explain whether the requested change now requires a persistent claim/warranty model.
```

## 13. Incident/log analysis

```text
Analyse this incident: <logs/error/reference ID>

Correlate X-Request-ID through proxy, API logs, provider response, database, and System Issues.
State what is proven, what is inferred, and what evidence is missing.
Give immediate mitigation, root fix, verification, and rollback.
Redact tokens, phone numbers, emails, signed payloads, and database credentials.
```

## 14. Documentation synchronization

```text
Update every Markdown file in the attached latest Rovauto codebase.

Requirements:
- Verify claims against source, schema, migrations, routes, package manifests, and tests.
- Update dates, paths, role names, current feature status, environment variables, and limitations.
- Keep chatbot knowledge customer-safe and free of internal/security details.
- Do not claim placeholder mobile screens are complete.
- Check internal Markdown links and report every changed file.
- Return an incremental patch and complete ZIP.
```

## 15. Patch review

```text
Review this patch against the supplied base.

Check whether it applies cleanly, touches unintended files, weakens authorization, misses migration/data handling, changes public/private routes, leaks tokens, breaks state transitions, omits tests/docs, or conflicts with recent patches.
Provide blocking findings first and include exact hunks/files.
```

## 16. Docker/Compose change

```text
Inspect the Prisma migrations before selecting a database image. Rovauto requires PostgreSQL with PostGIS.

For every Docker change:
1. Keep secrets out of image layers and client build arguments.
2. Preserve named database/Redis volumes.
3. Keep backend migration retries and Prisma client verification.
4. Preserve the Nginx /api/ proxy, five SPA shell fallbacks, upload limit, and health checks.
5. Validate `docker compose config` and document first-run, logs, rebuild, stop, and destructive reset commands.
6. Update README.md, client/README.md, server/README.md, Architecture.md, security.md, error handling.md, and RECOVERY_RUNBOOK.md.
```

## 17. Commit and pull-request convention

```text
Choose exactly one prefix:
- feat: a new or materially expanded user-facing capability
- fix: correction of broken or incorrect behaviour
- update: configuration, documentation, dependency, or existing implementation revision
- temp: temporary diagnostic/testing change that must be removed or explicitly justified

Write the remainder in imperative, specific language. Mention the affected flow and the important invariant, not only the filename.
Example:
feat: add compatible inspection video playback, compact service history PDF exports, and structured pending-payment status cards
```

## 18. Required handoff format

Every code handoff should include:

1. What changed.
2. Actor-visible behaviour.
3. Security/privacy behaviour.
4. Migration and environment requirements.
5. Exact commands to apply/deploy.
6. Tests/checks actually run and results.
7. Checks not run and why.
8. Incremental patch link.
9. Complete updated codebase link when requested.
