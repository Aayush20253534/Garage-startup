# Rovauto Security Design

> Security reference verified against the source and security tests on 23 July 2026.

## 1. Security objectives

1. Prevent cross-account and cross-garage data access.
2. Prevent session theft/reuse and login abuse.
3. Prevent forged browser mutations and forged provider callbacks.
4. Preserve exactly-once financial and booking assignment outcomes.
5. Minimize exposure of location, contact, vehicle, credential, and payment data.
6. Make destructive/admin behavior authenticated, authorized, limited, and auditable.
7. Return safe errors while preserving enough server-side evidence to investigate.

Security is defense in depth: route middleware, service ownership checks, database constraints/transactions, provider verification, and regression tests all participate.

## 2. Threat model

| Threat | Primary controls |
| --- | --- |
| Credential stuffing/brute force | Argon2, IP+identity limits, concurrency limits, OTP limits, staff 2FA |
| Session replay | HttpOnly secure cookies, DB sessions, expiry/revocation, device ID, password-change invalidation |
| CSRF/login CSRF | SameSite cookies plus double-submit token; session-establishing routes protected for browser requests |
| XSS token theft | JWT inaccessible to JavaScript; Helmet/CSP defaults; React escaping; output/privacy sanitization |
| Broken access control/IDOR | Account-type/role middleware, ownership queries, garage/controller scoping, dedicated tests |
| Payment forgery/replay | Cashfree signatures/freshness, server verification, amount/order matching, unique provider IDs, idempotency |
| Double garage acceptance | Conditional transaction, one booking assignment, idempotent garage-wallet fee |
| Malicious upload | Count/size/MIME allow-list, file signature validation, random temp names, private temp directory |
| SSRF through issue probes | Fixed base origin/path policy, stripped query/fragment, public actor restrictions |
| Secret leakage | Production environment validation, no secrets in `VITE_*`, sanitized errors/log controls |
| Destructive admin misuse | Admin-only routes, validation, stricter rate limits, backup download/run separation |

## 3. Authentication

### Passwords and identity

- Passwords use Argon2 hashes.
- Customer, garage owner, garage controller, staff, and support accounts are separate persistent identities.
- Login requests specify/resolve an expected role; generic error text avoids easy account enumeration.
- Controller email/phone is unique and the controller is permanently tied to one garage.
- Google login verifies Firebase identity server-side and records consent/auth-provider state.

### Cookies

| Cookie | Properties |
| --- | --- |
| `accessToken` | HttpOnly, Secure in production, SameSite `None` in production/`Lax` locally, path `/`, bounded age |
| `supportAccessToken` | Same protections; separate support trust boundary |
| `rovautoDeviceId` | HttpOnly stable device/session identifier |
| `rovautoCsrf` | Secure in production, readable by JavaScript for double-submit CSRF |

Production cross-site frontend/API deployment requires `SameSite=None; Secure`; HTTPS is mandatory.

### Database sessions

Every accepted JWT is resolved to a current account and session record. Requests fail when:

- Token is missing, malformed, or expired.
- Account type/role is invalid.
- Account is disabled/deleted.
- Session is expired or revoked.
- Token predates `passwordChangedAt`.

Password changes, admin reset, controller deactivation, logout, explicit revocation, and retention processes update/revoke the relevant session rows.

### Staff two-factor

Admin/intern/support login can require a short-lived email challenge. Challenge verification and resend are separately rate-limited. Production requires `ADMIN_2FA_EMAIL` and email OTP delivery.

## 4. Authorization matrix

| Resource | Customer | Owner | Controller | Support | Intern | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Own profile/vehicles/locations | Own | No | No | Limited support view | Read ops | Operational |
| Own booking/payment/wallet | Own | Assigned garage view | Own assignment | Ticket context | Read ops | Operational mutation |
| Garage profile/services | No | Own garage | Read own garage | No | Read ops | Manage |
| Garage controllers | No | Own garage | Self only | No | Read where exposed | All garages + limits |
| Customer details on lead | Own | After assignment | Active own assignment | Ticket need | Minimal/read ops | Operational |
| Price ranges | View approved | View | View | No | Submit/edit per route | Approve/manage |
| Dangerous commands | No | No | No | No | No | Admin only |

Rules:

- Never authorize only from an ID supplied by the browser.
- Queries must bind IDs to the current actor (`userId`, `ownerId`, `garageId`, `garageControllerId`, or support assignment).
- A controller cannot manage controllers, change the garage account, or cross garages.
- Frontend hiding is not authorization.

## 5. CSRF and CORS

The API seeds `rovautoCsrf`. Unsafe requests carrying an authentication cookie must send the same value in `X-CSRF-Token`; comparison is timing safe.

Browser session-establishing endpoints are protected even before a login cookie exists:

- `/api/v1/auth/login`
- `/api/v1/auth/support/login`
- `/api/v1/auth/google`
- `/api/v1/auth/verify-otp`
- `/api/v1/auth/staff/verify-otp`

Webhook paths are excluded from CSRF because providers cannot supply the browser token. Their security comes from provider signatures.

CORS:

- Uses an explicit normalized allow-list and credentials.
- Removes bearer `Authorization` from allowed browser headers because cookies are the intended auth mechanism.
- Allows no-Origin requests for legitimate server-to-server/health clients; those requests still face authentication/signature requirements at the route.
- Production filters local origins.

## 6. Input and upload controls

- Express JSON and URL-encoded bodies have configured size limits.
- Express Validator is the active request validation framework.
- Route-specific rate/concurrency limits protect expensive/auth/provider operations.
- Multer uses bounded file counts/sizes/fields.
- Allowed image/video MIME types are explicit.
- Magic-byte/file-signature checks reject MIME spoofing.
- Disk upload names are random UUIDs and the temp directory uses mode `0700`.
- Temporary files are cleaned on response finish/close when disk upload flow is used.

Remaining hardening for high-risk public uploads should include malware scanning/image re-encoding and Cloudinary transformation restrictions.

## 7. Payment and financial security

### Cashfree

- Production refuses to start without app credentials, strong webhook secret, HTTPS notify URL, production environment, and signature enforcement.
- Raw body is retained for signature verification.
- Webhook freshness/age and signature are checked.
- Server verification compares booking/order/amount/currency/provider state.
- Cashfree order and payment IDs are unique.
- Financial idempotency keys prevent repeat wallet effects.

### Customer and garage wallets

- Whole-rupee integer arithmetic.
- Conditional balance updates prevent overdraft.
- Balance and ledger entry change in one transaction.
- Booking payment/refund and garage acceptance fee use stable idempotency identities.
- Late provider success and cancellation races reconcile visibly rather than disappearing.

Never trust a client-supplied “payment successful” flag.

## 8. Booking, OTP, and controller security

- Active-booking database guard prevents concurrent active bookings for one vehicle.
- First-winner garage acceptance is transactional.
- Controllers can accept/handle only requests for their garage and see sensitive customer data only for active assignment.
- Handover OTP is six digits, hashed, expires after two hours, has bounded attempts, and uses a concurrency claim.
- OTP is sent/viewed through secure account flows and must not enter chatbot/support free text.
- Pickup and delivery evidence is required at the relevant state transition.

## 9. Webhooks and messaging

| Endpoint | Required protection |
| --- | --- |
| Cashfree webhook | Signature, timestamp/freshness, raw-body verification, order/amount reconciliation, idempotency |
| WhatsApp webhook | Meta app signature using raw body, verify token for challenge, payload validation |

Notification delivery is not authorization and is not proof a booking changed. Every deep link must reauthenticate and reauthorize against current database state.

## 10. Privacy and data minimization

Sensitive data includes exact location, phone/email, registration number, OTP, password/token, payment identifiers, provider payloads, images, support messages, and internal IDs.

Controls:

- Chatbot context is minimized and text is redacted for credentials, tokens, phone/email, and payment-number patterns.
- Assistant output removes internal source paths and privileged route details.
- Customer location/contact is withheld from unassigned garages/controllers.
- Error responses hide internal server details in production.
- Notification ownership uses explicit foreign keys.
- Support/admin access should be limited to job need and audited.

The chatbot can explain navigation/state but cannot approve refunds, mutate bookings, reveal OTPs, or impersonate support.

## 11. Operational and infrastructure security

- Production environment validation is fail-closed for critical secrets/providers.
- Helmet sets baseline browser security headers and disables `X-Powered-By`.
- Reverse-proxy trust is fixed to one hop; deployment topology must match.
- Readiness verifies PostgreSQL and Redis.
- GitHub Actions uses read-only repository permissions and runs Node 22 Prisma validation, security tests, and client production build.
- Backups must be encrypted, off-site, access-controlled, and restore-tested.
- Database URLs and credentials must never be printed in support artifacts.

Recommended additions:

1. Central secret manager with rotation ownership.
2. Dependency/SCA and secret scanning in CI.
3. Structured audit events for every privileged mutation.
4. WAF/bot controls at the edge.
5. Cloud/provider IAM least privilege and key restrictions.
6. Central logs/metrics/traces with alerting.
7. Regular restore drills and access reviews.

## 12. Known residual risks

| Risk | Current status | Required action |
| --- | --- | --- |
| In-process workers under horizontal scaling | Possible duplicate execution unless claims are universally safe | Move to durable queue or enforce leader/lease |
| Process-local rate-limit fallback | Not global across replicas | Keep Redis healthy; edge-limit auth/webhooks |
| Dangerous admin commands | Admin-only and limited, still high impact | Require re-auth/step-up confirmation and immutable audit |
| JSON capability/exclusion fields | Application validated, weak DB shape constraints | Normalize into relational tables if complexity grows |
| Upload malware/polyglots | Signature check only | Scan/re-encode high-risk uploads |
| No full browser E2E suite | Source/security regression coverage only | Add staging E2E for money and booking lifecycle |
| Personal-data retention | Session cleanup exists; full table policy not encoded | Define and automate retention/deletion policy |

## 13. Security testing and release gate

Run:

```bash
cd server
npm ci
npm run prisma:validate
npm run prisma:generate
npm run prisma:check-client
npm run test:security

cd ../client
npm ci
npm run build
```

For every auth, ownership, payment, booking, upload, or admin change, add positive, unauthenticated, wrong-role, wrong-owner/cross-garage, replay/concurrency, and sanitized-error tests as applicable.

## 14. Incident response

1. Preserve request/reference IDs, actor, time, commit, provider IDs, and affected records.
2. Revoke sessions/keys or disable the affected route/provider when containment requires it.
3. Do not destroy evidence or overwrite the only database.
4. Reconcile booking and financial ledgers after containment.
5. Notify affected users/regulators according to the applicable privacy policy/law.
6. Add a regression test and control owner before closure.

Recovery details: [`../server/docs/RECOVERY_RUNBOOK.md`](../server/docs/RECOVERY_RUNBOOK.md).
