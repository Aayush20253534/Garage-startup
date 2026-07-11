# ROVAUTO recovery and rollback runbook

## Required environment variables

Production backup:

```bash
DATABASE_URL=postgresql://...
BACKUP_DIRECTORY=/secure/off-host/path
```

Restore drill:

```bash
DATABASE_URL=postgresql://production-read-source
RECOVERY_TEST_DATABASE_URL=postgresql://isolated-host/rovauto_recovery_test
```

The recovery database must be isolated from production. The drill refuses to run when both URLs identify the same database or when the recovery database name does not contain `test`, `recovery`, `restore`, `staging`, or `drill`.

## Create an encrypted/off-site backup

```bash
npm run db:backup
```

Copy the generated `.dump` file to protected off-site storage. Do not place database dumps in Git, the public web directory, or a generally accessible cloud bucket.

## Prove that the backup can be restored

```bash
npm run db:recovery-drill
```

The drill:

1. Creates a PostgreSQL custom-format dump.
2. Restores it into `RECOVERY_TEST_DATABASE_URL` using `--clean --if-exists`.
3. Confirms the User, Booking, Payment, and Prisma migration tables exist.
4. Reads restored row counts.
5. Deletes the temporary local dump.

Run this before launch, after major schema changes, and at least monthly. Save the successful JSON output in the private operations log.

## Deployment smoke test

```bash
SMOKE_API_URL=https://api.rovauto.com \
SMOKE_FRONTEND_URL=https://www.rovauto.com \
npm run deploy:smoke
```

Run once immediately after deployment. It checks API health, CSRF-token issuance, and frontend availability.

## Roll back a bad Render deployment

1. Open the backend service in Render.
2. Open **Deploys** and select the last known-good deploy.
3. Choose **Rollback** or redeploy that exact commit.
4. Do not reverse a database migration until compatibility has been reviewed. Prefer rolling back application code to a version that can read the current schema.
5. Run `npm run deploy:smoke`.
6. Verify a staff 2FA login, one customer login, booking creation, and a low-value payment in the appropriate environment.

## Roll back a bad frontend deployment

1. Open the Vercel project deployment history.
2. Promote the last known-good deployment to production.
3. Confirm the Cashfree SDK is allowed by CSP in browser developer tools.
4. Run `npm run deploy:smoke` from the server project.

## Emergency database restoration

1. Put booking/payment mutations into maintenance mode at the edge.
2. Take a final incident snapshot of the current database before overwriting anything.
3. Restore the verified dump into a new database, not directly over the only production database.
4. Point a staging backend at the restored database and run smoke/integrity checks.
5. Switch production only after payment and booking counts are reconciled.
6. Keep the previous database read-only until reconciliation is complete.
