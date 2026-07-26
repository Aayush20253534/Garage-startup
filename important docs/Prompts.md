# Rovauto Engineering Prompts

> Reusable prompts for code changes, reviews, testing, incidents, and documentation. Replace bracketed fields and attach the latest source archive or repository.

## 1. Universal context block

Paste this before a task-specific prompt:

```text
You are working on Rovauto, a React/Vite + Express/Prisma/PostgreSQL/PostGIS vehicle-service marketplace.

Actors: customer, garage owner, garage controller/staff, admin, intern, customer support.
Authentication: HttpOnly cookie JWT plus database-backed sessions; unsafe browser mutations use double-submit CSRF.
Money: whole INR rupees. Payment uses customer wallet + Cashfree; garage acceptance uses garage wallet.
Booking: PENDING_PAYMENT -> SEARCHING_GARAGE -> CONFIRMED -> IN_PROGRESS -> COMPLETED, with cancellation/expiry paths.
Dispatch: progressive 5 km, 10 km, 20 km rounds; first eligible garage wins atomically.
Garage controllers are scoped to one garage and controlled by a per-garage admin limit.
PostgreSQL is authoritative; Redis is cache/rate-limit infrastructure.

Read the relevant routes, middleware, services, Prisma schema/migrations, tests, and current Markdown before proposing changes. Do not infer behavior from filenames alone.
Preserve unrelated user changes. Never include secrets. Backend authorization is authoritative.
```

## 2. Implement a feature and return a patch

```text
[UNIVERSAL CONTEXT]

Implement: [FEATURE].

Required behavior:
- [RULE 1]
- [RULE 2]
- [MOBILE/DESKTOP OR ACTOR-SPECIFIC REQUIREMENT]

Before editing:
1. Trace the current frontend route/component/API call and backend route/controller/service/schema path.
2. Identify authorization, ownership, state, financial, cache, provider, and migration impacts.
3. Ask only questions whose answers materially change the implementation.

Implementation requirements:
- Keep domain logic in services and use transactions/conditional writes for concurrency.
- Add or update validation and role/ownership checks.
- Add cache invalidation and idempotency where needed.
- Add a forward Prisma migration for persistence changes; do not edit applied migrations.
- Add regression tests for success, unauthenticated, wrong-role, wrong-owner/cross-garage, replay/concurrency, and sanitized errors as relevant.
- Update the owning Markdown documents.

Validate with Prisma checks, server tests, client build, and git diff --check.
Return one Git-applicable patch rooted at the repository. Summarize changed files, behavior, migration/deployment steps, tests, and remaining risks.
```

## 3. Diagnose without changing code

```text
[UNIVERSAL CONTEXT]

Diagnose this issue without implementing a fix:
[ERROR, LOG, SCREENSHOT, OR BEHAVIOR]

Trace the exact execution path and give:
1. Root cause with file/function evidence.
2. Why it occurs only under the observed conditions.
3. Data/security/payment impact.
4. Safe reproduction steps.
5. The smallest correct fix and its risks.
6. Tests that would prevent regression.

Clearly distinguish confirmed facts from hypotheses. Do not mutate files or external systems.
```

## 4. Production-readiness review

```text
[UNIVERSAL CONTEXT]

Review the attached latest codebase for production readiness. Do not implement fixes.

Prioritize:
- Authentication, session revocation, CSRF, CORS, IDOR, role and controller privacy.
- Cashfree verification/webhooks, idempotency, customer/garage wallet ledger correctness.
- Concurrent garage acceptance and booking state transitions.
- Upload validation and media cleanup.
- Redis/database/provider failure behavior.
- Background worker multi-replica safety.
- Migrations, backups, recovery, deployment, health/readiness, observability.
- Mobile critical flows and PWA route/deployment consistency.

Report only evidence-backed findings. For each finding include severity, exploit/failure scenario, exact code location, affected actors/data, and remediation. End with launch blockers, acceptable risks, and a prioritized verification checklist.
```

## 5. Security review

```text
[UNIVERSAL CONTEXT]

Perform a threat-model-driven security review for [FEATURE/SURFACE].

Check:
- Authentication and account-type confusion.
- Role, ownership, cross-user/cross-garage IDOR.
- CSRF/login CSRF, CORS, cookie flags, session fixation/replay/revocation.
- Validation, injection, SSRF, XSS, upload/polyglot risks.
- Secrets and sensitive logging/error leakage.
- Rate, concurrency, OTP, webhook replay and freshness.
- Payment/wallet/booking idempotency and race conditions.
- Controller access to customer contact/location.
- Destructive/admin action audit and step-up authorization.

Give attack paths and concrete mitigations. Add test cases for every high/critical risk. Do not claim a control exists without locating it in code.
```

## 6. Prisma/database change

```text
[UNIVERSAL CONTEXT]

Design and implement this database change:
[CHANGE]

Provide:
1. Current model/query/invariant analysis.
2. Updated Prisma schema.
3. A forward-only migration with backfill, constraints, indexes, and rollback-compatible deployment sequencing.
4. Transaction and concurrency changes.
5. Query/cache invalidation changes.
6. Tests using realistic duplicate/race/legacy data.
7. Backup, migration-deploy, and post-deploy verification steps.

Preserve financial/provider idempotency and audit history. Use Int for INR. Do not use prisma db push for production delivery.
```

## 7. API design or change

```text
[UNIVERSAL CONTEXT]

Design/implement API behavior for [USE CASE].

Specify:
- Method/path and actor.
- Authentication, role, ownership, CSRF, rate and concurrency limits.
- Params/query/body validation.
- Success and error response contracts.
- Domain state transition and transaction boundary.
- Idempotency/retry semantics.
- Cache and provider interactions.
- Audit/privacy requirements.
- Backward compatibility and client rollout.
- Tests and documentation updates.

Prefer the existing REST conventions. Do not introduce GraphQL or a new service without a measured requirement.
```

## 8. Frontend UI improvement

```text
[UNIVERSAL CONTEXT]

Improve [SCREEN/COMPONENT] for desktop and mobile.

User goal: [GOAL].
Problems: [SCREENSHOT/DETAILS].

Requirements:
- Reuse the established design tokens/components and avoid generic AI-looking decoration.
- Preserve accessibility, keyboard use, focus, touch targets, loading/empty/error/offline states.
- Preserve role guards, privacy, booking/payment recovery, and current API contracts.
- Check narrow mobile widths, long text, safe areas, keyboard overlap, and PWA mode.
- Avoid new dependencies unless necessary.

Trace why the current UI behaves this way, implement the smallest coherent change, build the client, and return a Git patch plus visual/manual verification checklist.
```

## 9. Payment or wallet change

```text
[UNIVERSAL CONTEXT]

Implement/review this payment change:
[CHANGE]

Treat timeouts as unknown state. Require server-side Cashfree verification, exact amount/order/currency/booking matching, signature/freshness checks, unique provider IDs, and stable idempotency keys.

Model and test:
- Wallet-only, Cashfree-only, and split payment.
- Duplicate create/verify/webhook calls.
- Response loss after database commit.
- Wallet balance changing during provider payment.
- Cancellation racing with late payment success.
- Refund/reconciliation replay.
- Concurrent requests and database rollback.

No client signal may directly mark a booking paid. Return ledger reconciliation steps and deploy/rollback notes.
```

## 10. Garage controller feature

```text
[UNIVERSAL CONTEXT]

Implement/review this garage-controller feature:
[CHANGE]

Enforce:
- Controller belongs to exactly one garage.
- Admin limit is per garage and transactionally enforced.
- Owner manages only own garage; admin resolves explicit garage.
- Controller cannot access owner-only management.
- Customer phone/address is visible only for active controller assignment.
- Deactivation/password reset revokes sessions.
- Assignment/transfer cannot cross garages and is concurrency safe.
- Actions and dispatch outcomes are auditable.

Test owner, controller, admin, wrong garage, deleted/disabled controller, limit race, session revocation, assignment transfer, and privacy-filtered history.
```

## 11. Incident/log analysis

```text
[UNIVERSAL CONTEXT]

Analyze this production incident:
[TIMELINE, LOGS, REFERENCE IDS, PROVIDER IDS]

Do not expose or request secrets. Build a timeline and distinguish:
- User-visible symptom.
- First failing component.
- Root cause vs cascading failures.
- Committed database/provider state.
- Potential financial/privacy impact.
- Safe containment.
- Reconciliation queries/checks.
- Recovery/rollback decision.
- Permanent code, test, alert, and runbook changes.

Assume a provider timeout is unknown until verified. Never recommend overwriting the only production database.
```

## 12. Documentation synchronization

```text
[UNIVERSAL CONTEXT]

Update all product/runtime Markdown to match the attached codebase.

Verify facts from routes, services, schema, migrations, tests, environment validation, deployment files, and workers. Update:
- Root/client/server READMEs.
- Garage/customer flow and chatbot knowledge.
- important/Architecture.md, Phases.md, Database.md, Prompts.md, security.md, and error handling.md.
- Recovery runbook.

Do not modify AGENTS.md/tooling instructions as product documentation.
Remove stale claims rather than preserving contradictions. Run a link check, search for old statuses/versions/commands, and return a clean Git patch.
```

## 13. Patch review

```text
[UNIVERSAL CONTEXT]

Review this patch against the current repository:
[PATCH]

Look for correctness regressions, missing files/migrations, wrong paths, role/ownership leaks, concurrency/idempotency bugs, stale generated client assumptions, cache invalidation gaps, provider reconciliation errors, mobile regressions, and missing tests/docs.

List findings by severity with exact patch/file evidence. If clean, state what was verified and the remaining test/deployment risk. Do not rewrite the patch unless asked.
```

## 14. Required handoff format

For implementation work, ask the agent to finish with:

```text
Outcome:
Changed files:
Database migration:
API/behavior changes:
Security and privacy:
Validation performed:
Deployment order:
Rollback considerations:
Known limitations:
Patch:
```
