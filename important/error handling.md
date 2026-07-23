# Rovauto Error Handling And Resilience

> Canonical error policy, verified against the source on 23 July 2026.

## 1. Goals

- Give users a clear next action without exposing internals.
- Preserve a correlation/reference ID for every failed request.
- Distinguish validation/auth/conflict/provider/server failures.
- Retry only safe or idempotent work.
- Keep booking and financial state consistent through partial failures.
- Persist actionable server/background issues without creating recursive failure loops.

## 2. Standard HTTP response

Operational failures use `ApiError(statusCode, message, code?)`. The central middleware returns:

```json
{
  "success": false,
  "statusCode": 409,
  "message": "The booking changed. Refresh and try again.",
  "code": "OPTIONAL_SAFE_CODE",
  "referenceId": "request-correlation-id"
}
```

In development only, `stack` may be included. For unexpected or `5xx` failures, the public message becomes:

```text
Request could not be completed. Please try again. Reference: <referenceId>
```

Only operational non-5xx codes matching `^[A-Z][A-Z0-9_]{2,63}$` are exposed.

Success responses commonly use:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable result",
  "data": {}
}
```

## 3. Request correlation

- Accept `X-Request-ID` only when it is 8–64 characters of letters, numbers, `_`, or `-`.
- Otherwise generate a UUID.
- Return it in the `X-Request-ID` response header.
- Attach the same value to system-issue evidence and relevant structured logs.
- Client/support should show or capture the reference ID, not the stack trace.

## 4. Status-code policy

| Status | Use |
| ---: | --- |
| `400` | Invalid syntax/validation/domain input that can be corrected |
| `401` | Missing/invalid/expired/revoked authentication |
| `403` | Authenticated but forbidden role/ownership, invalid CSRF, blocked origin |
| `404` | Resource not found within the actor's allowed scope |
| `409` | Concurrency/state/idempotency conflict; refresh/retry may be appropriate |
| `413` | Request/upload exceeds configured limit when emitted by parser/upload stack |
| `429` | Rate/attempt limit; return `Retry-After` where available |
| `500` | Unexpected internal failure |
| `502` | Upstream provider failed or returned unusable response |
| `503` | Dependency/readiness unavailable or temporary service incapacity |
| `504` | Upstream timeout when explicitly mapped |

Avoid revealing whether a cross-owner resource exists; an ownership-bound `404` is often safer than `403`.

## 5. Validation and controller pattern

1. Route applies authentication/roles/limits.
2. Express Validator checks params/query/body.
3. Upload middleware checks count, size, MIME, and signatures.
4. Controller delegates through `asyncHandler`.
5. Service enforces ownership, state, and transaction rules.
6. Service throws `ApiError` for expected failures.
7. Central middleware sanitizes and responds.

Do not catch an error only to return an ad-hoc JSON shape. Catch only when translating provider errors, compensating partial work, or adding safe context, then rethrow/forward.

## 6. Client behavior

The shared Axios layer should:

- Send cookies and CSRF automatically.
- Use configured timeouts.
- Retry safe GET/network failures only, with a small bounded count/delay.
- Never automatically replay an unsafe mutation unless it has a stable idempotency key and the domain explicitly supports replay.
- Preserve server `message`, `code`, and `referenceId`.
- Treat `401` as session loss and refresh/redirect appropriately.
- Treat `403` as permission/CSRF failure, not generic login failure.
- Respect `Retry-After` on `429`.
- Show retry UI for recoverable network/provider failures.
- Avoid duplicate toasts and infinite refresh/chunk-recovery loops.

## 7. Domain error matrix

| Domain | Recoverable user action | Server requirement |
| --- | --- | --- |
| Authentication | Re-login, verify OTP, wait for retry window | Revoke invalid cookie/session; generic credential errors |
| CSRF | Refresh CSRF token/page and retry once | Never bypass for browser mutation |
| Pricing | Select supported vehicle/service/city or wait for approval | Never invent/fallback to stale arbitrary price |
| Payment pending/timeout | Check current order state, then retry | Verify provider; preserve idempotency |
| Wallet changed | Retry checkout after reconciliation | Credit late provider success exactly once |
| Garage not found yet | Continue automatic search | Advance 5/10/20 km rounds safely |
| Garage wallet insufficient | Recharge then accept | Do not debit or assign partially |
| Acceptance conflict | Refresh request | One atomic winner |
| OTP invalid/expired | Retry within limits or regenerate | Hash, attempts, expiry, claim, no partial `IN_PROGRESS` |
| Media upload failed | Retry upload | Clean temporary/provider partials; do not advance evidence-dependent state |
| Delivery conflict | Refresh current booking | Require delivered checkpoint and correct owner |

## 8. Payment resilience

Payment is the highest-risk failure domain.

### Rules

- Creating an order is not payment success.
- Browser callback is not payment success.
- Verify Cashfree server-side or through the signed webhook.
- Compare order, amount, currency, booking ownership, and expected state.
- Use unique provider IDs and financial idempotency keys.
- Place balance, ledger, payment, and booking transition in a transaction.
- If response delivery fails after commit, a retry must return/reconstruct the committed result.
- If cancellation races with late provider success, credit wallet once and tell the customer what happened.

### Timeout policy

Timeout means “unknown”, not “failed”. Query provider/order state before creating a replacement order or refund. Never double charge because the first response was lost.

## 9. Booking and concurrency resilience

Use conditional updates/transactions for:

- One active booking per vehicle.
- One accepted garage per booking.
- One acceptance-fee debit.
- One OTP verifier claim/use.
- One customer delivery acceptance/completion.
- One live price row per normalized scope.

Return `409` when another actor won the race. Clients should refresh rather than blindly retry the same mutation.

## 10. Provider failure policy

| Provider | Timeout/retry | Fallback |
| --- | --- | --- |
| Cashfree | Bounded timeout; reconcile before retry | Keep pending; never synthesize paid |
| Google Maps | Bounded calls; safe lookup retry | Preserve confirmed stored destination; omit route enhancement |
| Cloudinary | Retry only before state transition; clean partial objects | Block required-evidence transition |
| Resend/WhatsApp/SMS/Push | Best-effort or outbox where implemented | In-app/database state remains authoritative |
| Redis | Bounded commands | Database reads and bounded stricter in-memory rate limit; production readiness fails |
| Groq | Bounded timeout/rate | Friendly chatbot unavailable message; core product unaffected |

Use exponential backoff with jitter for background retries. Cap attempts and preserve final failure reason; introduce dead-letter handling when jobs move to a durable queue.

## 11. Background errors

`server.js` handles startup failure, unhandled rejection, uncaught exception, HTTP server error, and shutdown signals.

- Background failures are reported through `systemIssueReporter`.
- Failure reporting itself has a timeout and must not prevent shutdown.
- Workers stop before HTTP/database/Redis close.
- Shutdown has a forced timeout.
- A failing issue-report route must not recursively report itself.

Each worker iteration should isolate one job failure, preserve retryable state, and continue with later jobs where safe.

## 12. Logging

Log structured fields where possible:

- Timestamp, level, component, action.
- Request/reference ID.
- Actor type and opaque actor ID.
- Booking/payment/provider IDs where needed.
- Error class/code and sanitized message.
- Duration, retry attempt, dependency.

Never log:

- Password/OTP/token/cookie/authorization values.
- Full provider secrets or signed URLs.
- Full card/payment credentials.
- Raw personal address/contact unless strictly required and protected.
- Firebase private keys, database URLs, Cloudinary/Cashfree/WhatsApp tokens.

Development Morgan logs are enabled only in development. Production needs centralized structured logs and retention/access controls.

## 13. System-issue reporting

- Eligible frontend/backend failures can create `SystemIssue`.
- Actor attribution is resolved by server rules, not blindly trusted from public input.
- Metadata must be sanitized.
- Auto-resolve probes are restricted to the configured base origin/path, remove query/fragment, and reject credentials or unsupported protocols.
- Quiet-window and protected-status policies prevent unsafe automatic closure.

System issues support diagnosis; they do not replace metrics, logs, traces, or provider dashboards.

## 14. Health and degradation

| Endpoint | Expected behavior |
| --- | --- |
| `/health/live` | `200` when Node process can answer |
| `/health` | `200` only when PostgreSQL and Redis checks succeed; otherwise `503` |
| `/health/ready` | Same readiness behavior |

Load balancers should use readiness to stop routing to a dependency-isolated instance and liveness to decide process restart.

## 15. Error testing checklist

For every changed mutation, test:

1. Valid success.
2. Validation failure.
3. Unauthenticated and wrong role.
4. Wrong owner/cross-garage ID.
5. Duplicate/replayed request.
6. Concurrent request.
7. Provider timeout and provider failure.
8. Database failure before and after critical write.
9. Client response loss followed by retry.
10. Production response contains no stack/secret.
11. Reference ID is present.
12. Compensation/cleanup preserves state.

Run `npm test`, Prisma validation/client checks, client build, staging smoke tests, and the critical manual lifecycle before release.

## 16. Operational escalation

- P0: financial corruption, cross-account exposure, auth bypass, destructive data loss.
- P1: booking/garage assignment unavailable, provider-wide payment failure, database/Redis readiness failure.
- P2: degraded maps/messaging/chatbot/support with core booking intact.
- P3: isolated UI/content defect.

For P0/P1, freeze risky mutations, preserve evidence, assign incident command, reconcile database/provider state, and follow [`../server/docs/RECOVERY_RUNBOOK.md`](../server/docs/RECOVERY_RUNBOOK.md).
