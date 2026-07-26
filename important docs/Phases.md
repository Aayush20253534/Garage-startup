# Rovauto Delivery Phases

> Product and engineering plan aligned to the implementation on 23 July 2026. Advance by exit criteria, not calendar optimism.

## Design principles

1. Protect booking correctness, payments, wallets, location privacy, and garage assignment before adding breadth.
2. Launch one city with measurable operational quality before expanding.
3. Keep PostgreSQL/PostGIS as the source of truth until measured limits justify architectural change.
4. Automate repetitive operations only after the manual workflow and ownership are clear.
5. Every phase includes product, operations, reliability, security, data, and exit criteria.

## Phase 0 — Implemented platform baseline

### Scope present in the current codebase

- Multi-surface React client for public/customer, garage owner/controller, admin, intern, and support.
- Separate identities/sessions for customers, garage owners, garage controllers, staff, and support.
- City/category/service restrictions and moderated city/service/vehicle price ranges.
- Saved vehicles/locations, platform-fee checkout, customer wallet/Cashfree split.
- Progressive 5/10/20 km PostGIS garage search and first-winner acceptance.
- Garage wallet acceptance fees.
- Garage-wise controller limits, controller availability, dispatch, assignment, transfer, and privacy filtering.
- Handover OTP, pickup/delivery evidence, live tracking, customer completion.
- Reviews, complaints, tickets/disputes, notifications, messaging integrations, chatbot.
- Admin/intern/support operations, system issues, backup/recovery/smoke scripts.
- Focused 50-file security/regression suite and CI build checks.

### Baseline gaps that block confident scale

- No complete browser E2E suite.
- Background jobs remain inside the web process.
- Limited production observability/alerting is encoded in the repository.
- Full data-retention and privileged audit policy is not yet automated.
- `seed:intern` path is broken.
- Multi-replica worker safety is not an explicit platform contract.

## Phase 1 — Launch hardening

### Product

- Freeze critical booking/payment/status semantics.
- Verify customer mobile flow from signup through completed booking.
- Verify owner/controller login, lead visibility, acceptance-fee blocking, assignment, OTP, and delivery.
- Ensure unsupported/missing price combinations clearly block checkout.
- Verify all legal consent, privacy, cancellation, fee, and warranty text against policy.

### Engineering

- Add browser E2E for customer booking/payment recovery and garage owner/controller lifecycle.
- Add provider sandbox contract tests for Cashfree webhooks, WhatsApp, Maps, Cloudinary, and email.
- Fix broken seed scripts or remove misleading commands.
- Add structured production logs and stable application version/commit tagging.
- Add database migration check and deployment smoke to the release pipeline.

### Security

- Complete threat-model review of auth, IDOR, controller privacy, uploads, webhooks, and dangerous admin commands.
- Add step-up authentication/confirmation and immutable audit for destructive commands.
- Enable dependency, secret, and container scanning.
- Restrict Google/Firebase/Cashfree/Cloudinary/provider keys by environment and least privilege.

### Operations

- Document support escalation and garage onboarding SOPs.
- Establish on-call owner for booking, payment, and provider incidents.
- Run backup restore drill and record RPO/RTO.
- Prepare manual reconciliation queries for booking/payment/wallet/garage wallet.
- Confirm one active worker-bearing server process.

### Exit criteria

- Zero open P0/P1 defects in the critical lifecycle.
- Staging E2E passes repeatedly.
- Production configuration validation passes without debug bypasses.
- Backup restore and rollback rehearsal succeed.
- Readiness, logs, alerts, and provider dashboards are monitored.
- A real end-to-end pilot booking completes with reconciled ledgers and evidence.

## Phase 2 — Controlled single-city launch

### Rollout

- Launch to a limited customer cohort and verified garage cohort in the primary city.
- Use feature flags/operational controls for SOS, chatbot, wallet recharge, and new services.
- Expand daily only when service levels remain inside thresholds.

### Metrics

| Funnel | Metrics |
| --- | --- |
| Acquisition | Visitor → signup, signup → onboarding |
| Booking | Service view → checkout, checkout → paid |
| Dispatch | Eligible garages, notification delivery, acceptance rate by radius/round, median time to accept |
| Fulfilment | OTP success, in-progress → delivery, completion rate, cancellation rate |
| Quality | Rating, complaint/ticket rate, repeat booking, warranty claims |
| Financial | Platform fee, garage acceptance fee, Cashfree success, refund/reconciliation, ledger imbalance |
| Reliability | p50/p95/p99 latency, 4xx/5xx, readiness failures, worker lag, provider error rate |

### Operations

- Review unmatched searches and garage eligibility daily.
- Track insufficient garage-wallet acceptance attempts and recharge friction.
- Sample pickup/delivery evidence and controller access behavior.
- Reconcile Cashfree and both wallets daily.
- Maintain a launch issue board with severity, owner, and due date.

### Exit criteria

- Stable completion and acceptance performance over several operating weeks.
- No unexplained financial differences.
- Support response and garage SLA meet agreed targets.
- Unit economics and retention show the service is worth expanding.
- Incident rate is declining, not merely hidden by manual intervention.

## Phase 3 — Operational maturity

### Platform

- Move garage search, messaging, email outbox, issue probes, and cleanup to a durable job queue.
- Separate API and worker deployments.
- Add idempotent job keys, leases, bounded retries, dead-letter queue, and replay tooling.
- Add OpenTelemetry-style traces, metrics, dashboards, and SLO alerts.
- Add feature flags and safe maintenance mode for money/booking mutations.

### Data

- Create an analytics pipeline/read model rather than running heavy dashboards on transactional paths.
- Define data dictionary, event ownership, retention, and deletion schedules.
- Automate daily financial/booking reconciliation and anomaly detection.
- Add query performance review with real data and slow-query capture.

### Security and compliance

- Centralize secrets and rotation.
- Establish access reviews, audit retention, incident and privacy-response procedures.
- Add upload scanning/re-encoding for public evidence.
- Perform an independent penetration test before major expansion.

### Exit criteria

- API can scale horizontally without duplicate worker effects.
- Worker lag/retry/dead-letter state is observable.
- Privileged actions and financial state are auditable.
- SLOs and recovery objectives are measured and achieved.

## Phase 4 — Multi-zone city expansion

### Expansion design

- Treat each city as configuration and operational capacity, not a code fork.
- Require city registry, coordinates, price coverage, service/category restrictions, garage supply, support hours, and provider readiness.
- Add city launch checklist and rollback/disable control.
- Segment metrics and incidents by city.

### Product

- City-specific catalogue/availability and controlled pricing moderation.
- Garage density maps and supply onboarding.
- Clear outside-service-area behavior.
- Localized operations/support while preserving one product and data model.

### Data and infrastructure

- Keep one PostgreSQL/PostGIS cluster initially.
- Use connection pooling, query/index tuning, caching, and background queues.
- Consider read replicas for reporting only.
- Do not introduce geo-sharding solely because more cities are added.

### Exit criteria

- The first city operates without founder-only intervention.
- New-city setup is repeatable from documented configuration/SOPs.
- City-level supply, acceptance, completion, quality, and economics meet gates.
- Failure in one city can be contained without disabling every city.

## Phase 5 — National scale

### Platform evolution

- Capacity-test API, PostGIS queries, queue throughput, websocket/tracking behavior, and provider quotas.
- Partition high-volume tracking/activity/notification/audit tables when measurements justify it.
- Add regional caches/workers and traffic routing.
- Define provider failover and quota strategies.
- Build anti-fraud/risk systems for accounts, wallets, payments, garages, and reviews.

### Organization

- Dedicated owners for marketplace, payments, identity/security, garage operations, support, and data.
- Formal change management for migrations, pricing, dangerous operations, and incidents.
- Continuous security review, disaster recovery exercises, and vendor risk management.

### Sharding decision gate

Consider database sharding only if verified tuning, pooling, replicas, partitioning, and vertical scaling cannot meet SLO/cost requirements. Before sharding, answer:

- Is load geographically separable?
- Which data must remain global: identity, financial ledger, provider idempotency, fraud, support?
- How are cross-shard admin/reporting queries served?
- How are bookings moved or customers travelling between cities handled?
- What is the recovery and resharding plan?

Potential future split:

- Global control plane: identities, staff, provider idempotency, financial/audit references, city registry.
- Regional/city data plane: garage discovery, bookings, tracking, local catalogue projections.
- Analytics plane: append-only events and reporting warehouse.

### Exit criteria

- Regional failure isolation and tested disaster recovery.
- Financial reconciliation remains exact across scale.
- SLOs, fraud loss, support quality, and unit economics remain within target.

## Phase 6 — Platform ecosystem

Only after the marketplace core is reliable:

- Garage partner APIs and webhooks.
- Fleet/corporate accounts.
- Parts/inventory integration.
- Predictive maintenance and service reminders.
- Controlled external developer access with scoped OAuth/service accounts.
- Advanced routing/dispatch optimization.

Each new domain should have an owner, threat model, data model, API contract, audit trail, and sunset plan.

## Cross-phase release checklist

For every release:

1. Scope and rollback are documented.
2. Database migration is forward-compatible and reviewed.
3. Auth/ownership/idempotency/cache invalidation are tested.
4. `npm test`, Prisma checks, client build, and `git diff --check` pass.
5. Staging smoke and the affected critical flow pass.
6. Metrics/logs/alerts exist for the change.
7. Documentation and customer knowledge are updated.
8. Post-deploy verification and rollback owner are assigned.

## Architecture decision triggers

| Decision | Trigger |
| --- | --- |
| Durable queue | Before multi-replica workers or when retries/lag need guarantees |
| Read replica | Reporting/read load measurably harms transactional SLO |
| Table partitioning | High-volume table maintenance/query cost shows a measured threshold |
| Service split | Independent scaling/ownership/failure boundary outweighs distributed complexity |
| GraphQL | Multiple clients have measured aggregation/versioning pain not solved cleanly by REST |
| Geo-sharding | Tuned single-cluster design cannot meet SLO/cost and regional ownership is well defined |
