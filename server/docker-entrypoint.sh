#!/bin/sh
set -eu

run_migrations="${RUN_DATABASE_MIGRATIONS:-true}"
max_attempts="${DATABASE_STARTUP_MAX_ATTEMPTS:-30}"
retry_seconds="${DATABASE_STARTUP_RETRY_SECONDS:-2}"

case "$run_migrations" in
  true|TRUE|1|yes|YES)
    attempt=1
    while ! npm run prisma:deploy; do
      if [ "$attempt" -ge "$max_attempts" ]; then
        echo "Database migration failed after ${max_attempts} attempts." >&2
        exit 1
      fi

      echo "Database is not ready or migration is locked; retrying in ${retry_seconds}s (${attempt}/${max_attempts})..." >&2
      attempt=$((attempt + 1))
      sleep "$retry_seconds"
    done
    ;;
  *)
    echo "Skipping Prisma migrations because RUN_DATABASE_MIGRATIONS=${run_migrations}."
    ;;
esac

npm run prisma:check-client
exec node src/server.js
