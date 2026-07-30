# Rovauto Recovery, Rollback, and Incident Runbook

> Runbook synchronized with the repository on 30 July 2026.

## 1. Objectives and ownership

This runbook covers database backup/restore, deployment rollback, provider incidents, booking recovery, controller/worker-task access incidents, and post-incident closure.

Named owners should exist for:

- incident command;
- backend/infrastructure;
- database;
- payments/finance;
- garage operations;
- customer communication/support.

Do not run destructive database scripts during diagnosis unless the incident commander and database owner have approved a verified recovery plan.

## 2. Required configuration

Operational scripts use environment such as:

```env
DATABASE_URL=
DIRECT_URL=
BACKUP_DIRECTORY=
RECOVERY_TEST_DATABASE_URL=
SMOKE_FRONTEND_URL=
SMOKE_API_URL=
```

Keep credentials outside the repository. Recovery databases must be isolated from production and must never reuse production webhook URLs.

## 3. Pre-deployment checklist

### Docker/Compose first response

```powershell
# Repository root
docker compose config
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=100 postgres redis frontend
```

The database service must use a PostGIS image compatible with PostgreSQL 16. If migration logs report that the `postgis` extension is unavailable, fix the image first; repeated application restarts cannot solve a missing database extension package.

Safe restart/rebuild:

```powershell
docker compose up -d --build
docker compose restart backend frontend
```

Normal shutdown preserves named volumes:

```powershell
docker compose down
```

`docker compose down -v` permanently deletes the local PostGIS and Redis volumes and is allowed only after an intentional reset decision or verified external backup.

1. Record current frontend/backend releases and commit IDs.
2. Review migration list and backward compatibility.
3. Run server tests and Prisma validation.
4. Build the client.
5. Take/verify a database backup before consequential migrations.
6. Confirm System Health baseline.
7. Confirm rollback artefacts and environment values.
8. Confirm provider callback URLs and DNS.

For the current schema, production must include migration:

```text
20260728090000_add_garage_worker_task_mode
```

## 4. Backup procedure

```bash
cd server
npm run db:backup
```

Verify:

- command exit success;
- output file exists and is non-zero;
- file timestamp and target database are correct;
- backup is encrypted/protected according to operational policy;
- retention location is not the same failure domain as the database.

Record backup identifier in the deployment/incident log.

## 5. Restore drill

```bash
cd server
npm run db:recovery-drill
```

The drill must use an isolated database. Validate:

- restore completes;
- Prisma migration status is understandable;
- critical tables exist;
- representative customer, booking, payment, garage, session, task, issue, and audit rows are readable;
- API can start against the restored copy without calling production providers.

Run restore drills regularly, not only during an incident.

## 6. Deployment smoke test

```bash
cd server
npm run deploy:smoke
```

Manual checks should include:

- frontend loads and direct portal routes refresh;
- `/health/live` and `/health`;
- CSRF issuance;
- customer/admin/garage/intern login as applicable;
- System Health access;
- one provider-safe integration check;
- no obvious stale-chunk loop.

After schema/feature releases, add targeted smoke flows.

## 7. Current feature smoke flows

### Garage eligibility

- Pickup request does not notify a self-drop-only garage.
- BMW/ALL service scope matches BMW X1.
- Missing selected service scope excludes garage.

### Controller/worker mode

- Disabling controllers revokes controller sessions.
- Worker task can be created only while controllers are disabled.
- Worker link opens, tracks, uploads media, and verifies handover.
- Re-enabling controllers invalidates the worker link.

### Payment hours, media, history, and warranty

- Verify 09:59 IST is blocked, 10:00 and 23:59 are accepted, and 00:00 is blocked with `SERVICE_HOURS_CLOSED`.
- Upload a phone-recorded inspection video, confirm the persisted Uploaded state, and test inline playback, Retry, and Open video.
- Complete a booking, expand detailed timings, and download the black-and-white service-history PDF.
- Confirm pending count/payment state cards remain compact on a narrow mobile viewport.

### Warranty

- Completed customer booking appears at `/dashboard/warranty`.
- Public `/warranty` remains mock and unauthenticated.
- Active/expired calculation matches activation + 30 days.

## 8. Backend rollback

Preferred sequence:

1. Stop or drain the bad release.
2. Deploy the last known-good backend image/commit.
3. Keep the current database schema unless the old code is incompatible.
4. Restart and check liveness/readiness.
5. Run CSRF/login and one read-only domain smoke test.
6. Review System Issues for new errors.

Do not down-migrate production casually. Forward-compatible rollback code or a repair migration is safer.

## 9. Frontend rollback

1. Promote/redeploy the last known-good static build.
2. Purge/invalidate CDN cache where required.
3. Verify all five shell rewrites.
4. Open direct routes:
   - `/dashboard/warranty`
   - `/worker-task/<test-token only in staging>`
   - `/admin/system-health`
   - `/intern/system-health`
5. Confirm service-worker/stale-chunk recovery does not loop.

## 10. Emergency database restoration

Use only when repair/rollback against the current database is impossible.

1. Declare the write freeze/maintenance window.
2. Confirm exact recovery point and expected data loss.
3. Preserve the damaged/current database for forensics.
4. Restore to a new database first where possible.
5. Validate schema, data, constraints, and critical flows.
6. Point application to restored database through controlled configuration.
7. Reconcile provider events after the restored point, especially Cashfree.
8. Reconcile booking/task/notification events that occurred after the backup.
9. Document all manually repaired records.

## 11. Payment incident playbook

- Disable or limit new checkout only if necessary.
- Do not mark bookings paid from browser screenshots/redirects.
- Collect Cashfree order/payment IDs and request IDs.
- Verify webhook signature and provider order status.
- Reconcile payment, customer wallet, garage wallet, and booking state.
- Make repair scripts idempotent and review before execution.
- Communicate delayed confirmation rather than asking customers to pay twice.

## 12. WhatsApp/worker-task incident

### Template or provider outage

- Task creation can continue.
- Use manager copy-link/manual WhatsApp sharing.
- Avoid repeatedly creating duplicate tasks.
- Use resend only when token rotation is intended.

### Token exposure

1. Revoke the task immediately.
2. Stop active tracking where possible.
3. Review access/open/location/media timestamps.
4. Create a new task/token for the correct worker if still needed.
5. Check logs/System Issues for raw URL leakage.
6. Escalate privacy impact if customer location/media was exposed.

### Wrong workforce mode

- If controllers must be disabled, update garage setting and confirm sessions revoked.
- If controllers must be restored, enable setting and confirm worker tasks revoked.
- Notify garage manager of the new workflow.

## 13. Tracking/media incident

- Browser tracking failure: confirm permission, HTTPS, page active state, and token status.
- Do not overwrite customer saved location with worker position.
- For failed uploads, preserve booking state and temporary-file cleanup evidence.
- Confirm Cloudinary availability and size/MIME requirements.
- Use manager/manual operational fallback only with audit notes.

## 14. Resend/email OTP incident

- Check Integration Health and Resend provider response.
- Confirm sender/domain/environment values.
- A working domains-list probe does not prove a particular email send succeeded.
- Do not bypass staff 2FA by sharing sessions/passwords.
- Restore provider/configuration or use an approved operational recovery path.

## 15. Database/PostGIS/Redis outage

- Readiness should return `503`.
- Stop unsafe traffic or fail over according to hosting plan.
- Confirm network/DNS/TLS/connection limits before restarting repeatedly.
- Redis loss can affect cache/limits; current production readiness treats it as unavailable.
- PostgreSQL/PostGIS recovery takes priority because it is authoritative. Verify `SELECT PostGIS_Version()` and Prisma migration status before reopening traffic.

## 16. Destructive scripts

Commands such as `db:delete-*` and `db:nuke-users` require:

- verified backup;
- explicit production/staging target confirmation;
- peer review;
- written scope and expected row counts;
- maintenance window where needed;
- post-operation reconciliation.

Never use them as a shortcut for fixing one malformed record.

## 17. Incident closure

Closure report should include:

- timeline and detection source;
- customer/garage/financial impact;
- request/provider/audit IDs;
- root cause and contributing factors;
- mitigation and permanent fix;
- data repair/reconciliation;
- tests and monitoring added;
- documentation/runbook updates;
- owner and due date for remaining actions.
