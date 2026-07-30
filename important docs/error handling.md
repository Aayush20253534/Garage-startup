# Rovauto Error Handling and Resilience

> Error policy synchronized with the codebase on 30 July 2026.

## 1. Goals

- Return useful, stable client errors without leaking internals.
- Correlate every unexpected failure with a request/reference ID.
- Preserve idempotency for payments, wallet entries, garage acceptance, OTPs, and task lifecycle changes.
- Degrade optional providers without corrupting booking state.
- Capture recurring frontend/backend failures in System Issues.
- Make operational recovery possible without direct production database edits.

## 2. Standard response shape

Successful responses generally use `ApiResponse`:

```json
{
  "statusCode": 200,
  "message": "...",
  "data": {},
  "success": true
}
```

Operational errors use `ApiError` and centralized error middleware. Unexpected 5xx responses should expose a generic message and a reference ID rather than stack, SQL, provider secret, or raw payload.

## 3. Request correlation

Every request receives `X-Request-ID`.

- A valid incoming ID may be preserved.
- Otherwise the API creates a UUID.
- The response exposes the same ID.
- Browser issue reports and support escalation should include it.
- Do not include worker tokens, OTPs, cookies, or provider secrets in correlated metadata.

## 4. Status-code policy

| Code | Use |
| --- | --- |
| `400` | Invalid input, malformed state-independent request |
| `401` | Missing/invalid/expired authentication |
| `403` | Authenticated but not authorised |
| `404` | Resource/token intentionally not found |
| `409` | State conflict or invariant violation |
| `410` | Expired or revoked worker-task link |
| `413` | Body/upload too large where surfaced by middleware |
| `422` | Provider/domain validation where explicitly used |
| `429` | Rate limit or OTP/task attempt limit |
| `500` | Unexpected application failure |
| `502` | Upstream provider/proxy failure |
| `503` | Readiness dependency unavailable |
| `504` | Explicit upstream timeout where translated |

A 502 is not automatically a frontend problem. Trace proxy, API, database, and provider logs using the request ID.

## 5. Validation pattern

Routes should validate before controllers. Services must still enforce:

- ownership
- actor role
- booking/garage state
- capability and scope
- idempotency/concurrency
- provider response validity

Client validation improves UX but never replaces server enforcement.

## 6. Client behaviour

The shared Axios client:

- sends cookies and CSRF for unsafe browser requests;
- uses a configurable timeout;
- retries only safe eligible requests;
- records `ERR_BAD_RESPONSE`, timeout, status, and retry metadata;
- reports eligible failures to System Issues;
- avoids automatic POST retries that could duplicate OTPs, payments, or task mutations.

Every page should implement loading, empty, retry, permission-denied, and offline/network states.

## 7. Domain error matrix

| Domain | Examples | Expected handling |
| --- | --- | --- |
| Authentication | wrong password, expired session, 2FA email failure | `401` for credentials/session; provider failure translated without exposing provider secret |
| Pricing | no approved range | `409`/domain error; block checkout |
| Payment | order mismatch, failed verification, provider timeout, or `SERVICE_HOURS_CLOSED` | preserve pending state, allow safe recovery, never mark paid from redirect alone; outside 10:00 AM-12:00 AM IST return the shared payment-hours message |
| Dispatch | no eligible garage, stale capability | continue/expire search; reject stale acceptance |
| Handover | wrong/expired OTP, missing media | bounded attempts; no state transition |
| Worker task | invalid token, expired, revoked, wrong stage, controllers enabled | `404`, `410`, or `409` as appropriate |
| Tracking | permission denied, stale token, invalid coordinates | clear worker message; preserve booking destination |
| Warranty | no completed bookings | successful empty list, not an error |
| Provider health | not configured/degraded/outage | report status without secrets; do not mutate provider state |

## 8. Payment resilience

- Cashfree order creation and finalization must be idempotent.
- Webhook signatures and order/amount ownership must be verified.
- Duplicate webhooks must not duplicate wallet or booking mutations.
- Redirect success is not payment truth.
- Provider timeouts should leave recoverable state and a request ID.
- Refunds must reconcile provider and both relevant ledgers.

## 9. Booking and concurrency

Critical transitions must be transactional or compare-and-set guarded:

- first garage acceptance wins;
- garage eligibility is recalculated in acceptance;
- wallet acceptance fee is charged once;
- pickup handover OTP is consumed atomically; self-drop arrival uses proximity plus evidence and no OTP;
- inspection evidence is complete before transition;
- final-payment confirmation does not complete the booking twice;
- task creation revokes prior active same-type task.

## 10. Worker-task failures

### Link errors

- malformed or unknown token: `404` with generic invalid-link message;
- expired token: `410`;
- revoked token: `410`;
- controller mode re-enabled: `410`;
- stage already completed or booking moved: `409`.

### WhatsApp delivery

Task creation and link delivery are separate outcomes. If WhatsApp fails:

- keep the task record and generated URL;
- show manager/admin the copy/manual-share option;
- record provider failure without exposing access token;
- do not create duplicate tasks merely to retry delivery;
- use resend to rotate the token when a new link is required.

### Tracking

- Location permission denial is a recoverable worker UX error.
- Browser background suspension is an operational limitation, not a server crash.
- Reject invalid coordinates and unauthorised task state.
- Stop tracking on completion/revoke where possible.

### Media

- A file selected in the browser is not yet uploaded; show “ready to upload” until persistence succeeds.
- New videos request eager H.264 MP4 transformation. Playback tries the compatible URL first and preserves the original source as fallback.
- When inline playback fails, expose Retry and Open video actions instead of leaving an inert black player.
- Cloudinary processing can be eventually consistent; a first playback failure is recoverable and must not delete the database record.
- The 55 MB Nginx body limit stays above the 50 MB application video limit so the application can return its own validation response.


- Enforce 5-15 images, one video, MIME/type/size limits.
- Clean temporary files after success or failure.
- Preserve task/booking state when provider upload fails part-way.

## 11. Service-history PDF and warranty behaviour

PDF export is generated in the authenticated browser from the currently loaded booking. A generation failure should show a local retryable error and must not mutate booking state. The report intentionally uses built-in PDF generation, ASCII-safe text, black/white output, pagination, and no remote font or rendering dependency.


Warranty calculation is a read projection. Errors reading completed bookings return a normal server error with request ID. An empty list is valid. The frontend recalculates remaining days from `expiresAt`; it must not write daily countdown values back to the database.

## 12. Provider failure policy

| Provider | Failure behaviour |
| --- | --- |
| PostgreSQL | readiness `503`; core API unavailable |
| Redis | readiness `503` in current production contract; bounded local rate fallback where implemented |
| Cashfree | payment remains recoverable/pending |
| Resend | authentication/OTP operation fails clearly; do not pretend email was sent |
| WhatsApp | retain task/notification fallback where possible |
| Cloudinary | reject media transition and clean temp files |
| Maps | preserve saved coordinates; show route/geocode fallback |
| Firebase | reject Google sign-in verification |
| Web Push | notification may continue through other channels |
| Groq | chatbot uses local retrieval/fallback response path |

## 13. Container startup and background errors

- Compose waits for PostGIS and Redis health before starting the backend.
- `docker-entrypoint.sh` retries `prisma migrate deploy` for configured attempts and exits non-zero instead of starting against an unknown schema.
- The database image must provide PostGIS; a plain PostgreSQL image causes the geospatial extension migration to fail and is a configuration error, not a retryable application incident.
- Frontend starts only after backend readiness. Use `docker compose logs -f backend` to distinguish migration, schema-client, provider-configuration, and runtime failures.


Background jobs must:

- claim work safely;
- be idempotent;
- use bounded retries/backoff;
- record final failure or issue;
- avoid crashing the entire API for one item;
- expose overdue/pending counts in operational views where supported.

The current in-process design needs stronger distributed claiming before multi-replica scale.

## 14. Logging

Log structured fields such as request ID, route, actor type, resource ID, provider, status, duration, and safe error code.

Never log:

- passwords or hashes
- OTPs or OTP hashes
- raw worker-task tokens or full URLs
- cookies/JWTs/session tokens
- Cashfree/WhatsApp/Resend/Cloudinary secrets
- raw signed webhook bodies
- complete customer contact/location unless strictly required and protected

## 15. System Issues

Frontend/backend reporters fingerprint recurring issues into `SystemIssue`. Staff can view, investigate, resolve, ignore, or delete through System Health.

Actor and route metadata must be privacy-minimised. Auto-resolution probes are restricted by policy to prevent SSRF or arbitrary network access.

## 16. Integration Health

Integration Health is read-only and available to `ADMIN`, `SUB_ADMIN`, and `INTERN`. Checks return operational/degraded/outage/not-configured states. Secrets and tokens are redacted; phone numbers and optional metadata are masked.

Health probes must not send customer messages, create payments, mutate provider resources, or expose configuration values.

## 17. Testing checklist

- Expected 4xx message/code is stable.
- Unexpected error returns reference ID and no stack.
- Duplicate payment/webhook/acceptance is safe.
- Stale garage capability prevents acceptance.
- Worker invalid/expired/revoked/mode-changed links fail correctly.
- Worker resend invalidates previous token.
- Upload failures clean temporary files and preserve state.
- Warranty empty/active/expired calculations pass.
- System Health redacts secrets and permits all intended staff roles.
- Client does not retry unsafe mutations automatically.

## 18. Escalation

1. Capture time, actor, route, request ID, release, and visible message.
2. Check System Issues and server/proxy logs.
3. Check Integration Health and provider dashboard.
4. Determine whether data state changed.
5. Apply reversible mitigation first.
6. Roll back code only if it remains compatible with the deployed schema.
7. Record root cause, customer impact, repair, and prevention.
