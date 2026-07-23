# Rovauto Recovery, Rollback, And Incident Runbook

> Verified against the operational scripts on 23 July 2026.

## Objectives and ownership

Use this runbook for failed deployments, data corruption, provider incidents, and database recovery. Assign one incident commander and one operator. Record timestamps, deployment commit, database target, request/reference IDs, Cashfree order IDs, and every mutation made during the incident.

Never run a destructive cleanup or restore command against an unverified target.

## Required configuration

Backup:

```bash
DATABASE_URL=postgresql://...
BACKUP_DIRECTORY=/secure/off-host/path
```

Restore drill:

```bash
DATABASE_URL=postgresql://production-read-source
RECOVERY_TEST_DATABASE_URL=postgresql://isolated-host/rovauto_recovery_test
```

Smoke test:

```bash
SMOKE_API_URL=https://api.rovauto.com
SMOKE_FRONTEND_URL=https://www.rovauto.com
SMOKE_TIMEOUT_MS=10000
```

The recovery script refuses an identical source/target database and requires the recovery database name to contain `test`, `recovery`, `restore`, `staging`, or `drill`.

## Backup procedure

```bash
cd server
npm run db:backup
```

The script produces a PostgreSQL custom-format `.dump`. After creation:

1. Verify the command completed successfully.
2. Move/copy the dump to encrypted, access-controlled off-site storage.
3. Record its timestamp, size, checksum, source database, and application commit.
4. Keep it out of Git, public web roots, shared chat, and public buckets.
5. Apply retention appropriate to the production data policy.

An untested backup is not a recovery plan.

## Restore drill

```bash
cd server
npm run db:recovery-drill
```

The drill creates a custom-format dump, restores it into `RECOVERY_TEST_DATABASE_URL` with `--clean --if-exists`, verifies core and Prisma migration tables, reads row counts, and deletes the temporary local dump.

Run it:

- Before production launch.
- After material schema or backup-script changes.
- At least monthly.
- Before relying on a new backup provider/location.

Keep the successful JSON output in a private operations log. The target must be isolated and expendable.

## Deployment smoke test

```bash
cd server
npm run deploy:smoke
```

The script checks frontend availability, API readiness, and CSRF-token issuance. It does not prove authenticated booking/payment correctness. After every production release also check:

1. `GET /health/live` returns `200`.
2. `GET /health/ready` returns `200` with database and Redis `ok`.
3. Admin/intern two-factor login as applicable.
4. Customer login and profile retrieval.
5. Garage owner and garage controller login.
6. Low-value sandbox/staging booking, payment, dispatch, acceptance, OTP handover, delivery, and completion.
7. Cashfree/WhatsApp webhook delivery dashboards.

## Backend rollback

1. Freeze nonessential deployments and record the bad commit/migration.
2. Select the last known-good backend build in the hosting platform.
3. Check whether it can read the **current** database schema.
4. Redeploy/rollback that exact build.
5. Do not reverse a migration until data compatibility and restore steps are reviewed.
6. Run the smoke test and the manual critical flow.
7. Reconcile bookings, payments, customer wallets, garage wallets, and webhook events created during the incident window.

Prefer a forward-compatible application rollback over destructive schema rollback.

## Frontend rollback

1. Promote the last known-good Vercel/Firebase deployment.
2. Confirm all five HTML/PWA route rewrites.
3. Confirm the client points at the intended API.
4. Check browser CSP/network behavior for Cashfree, Firebase, Maps, and API requests.
5. Run server smoke checks and manually exercise affected routes.

## Emergency database restoration

1. Put booking/payment/admin mutations into maintenance mode at the edge.
2. Preserve logs and take a final incident snapshot of the current database.
3. Restore the verified dump into a **new** database, never directly over the only production database.
4. Point an isolated backend at the restored database.
5. Run `prisma migrate status`, Prisma client checks, security tests, smoke tests, and integrity queries.
6. Reconcile at minimum:
   - `Booking` against `Payment`.
   - Customer `WalletTransaction` totals/balances.
   - `GarageWalletTransaction` acceptance fees/recharges.
   - Cashfree order/payment IDs and webhook outcomes.
   - Active booking uniqueness per vehicle.
   - Accepted broadcast winner versus assigned garage/controller.
7. Switch production only after sign-off.
8. Keep the former database read-only until reconciliation and rollback windows close.

## Provider outage playbooks

| Provider | Safe degradation |
| --- | --- |
| Redis | Readiness fails in production; rate limits may use stricter process-local fallback, but do not treat that as full multi-instance protection |
| Cashfree | Stop new external payment attempts; preserve pending bookings; reconcile provider state before retry/refund |
| Google Maps | Preserve saved coordinates/address; disable paid lookup/routing enhancements rather than inventing location |
| Cloudinary | Block evidence-dependent state transitions if required images cannot be durably stored |
| Resend/SMS/WhatsApp/Push | Keep authoritative in-app/database state; retry outbox-capable messages; do not roll back successful bookings |
| Groq | Disable/degrade chatbot only; core booking/support must remain available |

## Destructive scripts

Commands beginning `db:delete-*`, `db:nuke-users`, and cleanup/approval scripts can materially change production data. Before execution:

1. Resolve the exact database host/name without printing credentials.
2. Take and verify a backup.
3. Read the target script and scope.
4. Use a staging rehearsal.
5. Require a second-person check for production.
6. Record command, actor, time, reason, and result.

## Incident closure

Do not close the incident until:

- Service and readiness are stable.
- Financial and booking reconciliation is complete.
- Background workers are running exactly once as intended.
- Customer/support communications are issued where necessary.
- Root cause, timeline, affected records, recovery steps, and follow-up owners are documented.
- A regression test or monitoring control is added for the failure mode.
