# Rovauto Engineering Prompts

> Prompt library synchronized with the codebase on 28 July 2026.

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
- Worker tasks are HANDOVER or DELIVERY, token-scoped, expiring, and require 5-15 images plus exactly one video.
- Public /warranty is a mock design page; customer /dashboard/warranty is real and protected.
- Customer warranties are derived from completed bookings for 30 days; there is no Warranty table.
- System Health combines System Issues and Integration Health for ADMIN, SUB_ADMIN, and INTERN.
- VehicleModel supports imageUrl/imagePublicId and customer vehicle cards show matching model images.

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

## 16. Required handoff format

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
