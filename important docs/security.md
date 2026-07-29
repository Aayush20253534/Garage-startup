# Rovauto Security Design

> Security reference synchronized with the codebase on 28 July 2026.

## 1. Objectives

- Prevent cross-customer, cross-garage, and cross-role access.
- Keep provider credentials, sessions, OTPs, and worker tokens secret.
- Make payment, wallet, acceptance, handover, and completion mutations idempotent and auditable.
- Minimise customer data exposed to garages, controllers, workers, and support.
- Detect/report failures without turning diagnostics into a data leak or SSRF channel.

## 2. Threat model

Key threats:

- credential stuffing and session theft;
- CSRF against cookie-authenticated mutations;
- IDOR across booking, garage, ticket, and media IDs;
- stale or forged garage acceptance;
- payment/webhook spoofing and duplicate financial writes;
- OTP guessing/replay;
- worker-task link guessing, forwarding, logging, or reuse;
- malicious uploads;
- provider/webhook signature bypass;
- sensitive error/system-health disclosure;
- insider misuse of admin/intern tools;
- browser tracking/privacy overcollection.

## 3. Authentication

### Passwords and sessions

- Passwords use Argon2.
- Browser tokens are HttpOnly cookies backed by revocable session rows.
- Session/device identity is tracked and retention cleanup runs periodically.
- Customer support uses a separate session family/cookie.

### Staff two-factor

Admin/sub-admin/intern login uses staff login challenges and email OTP according to configuration. OTP hashes, expiry, resend cooldown, attempts, and consumption must remain bounded and atomic.

### Garage controllers

Controllers have garage-scoped accounts/sessions. They must never gain owner wallet, withdrawal, settings, or unrelated booking access.

Disabling controller accounts revokes active controller sessions and blocks login.

### Worker task links

No-account workers do not authenticate as garage owners/controllers.

Security properties:

- 32 random bytes encoded as base64url;
- SHA-256 hash stored in `GarageWorkerTask.tokenHash`;
- raw token only exists in the generated URL/delivery response;
- 1-48 hour expiry;
- stage- and booking-scoped;
- resend rotates token;
- revoke/mode switch invalidates access;
- rate limits on public read/mutation/evidence endpoints;
- public projection hides customer phone and financial data.

Current implementation does not bind the task to one device. Forwarded-link risk remains a residual risk and should be reduced later with optional device binding/PIN or a native worker app.

## 4. Authorization matrix

| Capability | Customer | Garage owner | Controller | Worker link | Intern | Sub-admin | Main admin | Support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Own customer booking | Yes | Assigned only | Assigned only | One task only | Operational scope | Operational scope | Yes | Ticket scope |
| Garage wallet/settings | No | Own garage | No | No | No | Permitted admin views | Yes | No |
| Controller management | No | Own garage if enabled | No | No | No | Admin scope | Yes | No |
| Worker task manage | No | Assigned garage | No | No | No | Yes | Yes | No |
| Worker task execute | No | Through normal account | Through normal account | Token stage only | No | No | No | No |
| System Health | No | No | No | No | Yes | Yes | Yes | No |
| Dangerous operations | No | No | No | No | No | No | Main-admin only | No |
| Customer support tickets | Own | Limited booking context | Limited | No | Permitted views | Yes | Yes | Assigned support scope |

Backend service ownership is authoritative; UI visibility is not security.

## 5. CSRF and CORS

- Cookie-authenticated unsafe browser requests require double-submit CSRF.
- Allowed origins are explicit and production local origins are rejected.
- Server-to-server/no-Origin requests are allowed where route security permits.
- Cashfree/WhatsApp webhook routes bypass CSRF only with provider verification.
- Public worker-task routes bypass account CSRF because they use token capability; they require strict token validation and rate limits.

## 6. Input and upload controls

- Express Validator checks request shapes.
- Services normalise phone, scopes, enums, TTL, and state.
- JSON/urlencoded body limits are configured.
- Upload middleware enforces MIME, file count, and size.
- Worker evidence allows 5-15 images and one video, with server lifecycle checks.
- Temporary files are registered for cleanup.
- Cloudinary public IDs are stored for controlled deletion.

Client `accept` attributes are not security controls.

## 7. Payment and wallet security

### Cashfree

- Verify webhook signature and provider order.
- Verify amount, currency, booking ownership, and expected state.
- Treat redirects as untrusted presentation.
- Deduplicate callbacks and finalisation.

### Wallets

- Ledger writes are transactional.
- Garage acceptance fee must post once.
- Refund/recharge operations need idempotency and audit metadata.
- Controllers/workers never receive withdrawal access.

## 8. Garage eligibility and acceptance

Security and correctness depend on capability revalidation:

- fulfilment mode;
- brand/model/service scopes;
- exclusions;
- operational status;
- distance/availability;
- request validity;
- booking unassigned state.

Notification-time filtering alone is insufficient because configuration may change before acceptance.

## 9. Handover, tracking, and evidence

- Pickup handover OTP is sent to/confirmed by the customer, not used as worker login. Self-drop creates no handover OTP.
- Pickup OTP attempt count, expiry, and atomic claim prevent replay/races.
- Tracking updates require the correct actor for the current phase.
- `SELF_DROP_TO_GARAGE` updates are accepted only from the authenticated customer who owns the confirmed booking; garage/controller/worker may view the route but cannot submit customer points.
- Customer saved destination must not be overwritten by live garage/worker position.
- Evidence is tied to booking, garage, phase, media type, and order.
- Mandatory evidence should be immutable after completion except through explicit audited admin workflow.

## 10. WhatsApp and webhooks

- Verify Meta webhook signatures using the app secret/raw body.
- Store tokens only in server environment.
- Templates must not include secrets or unnecessary customer data.
- Worker task button receives token suffix; raw token must not be logged.
- When automatic delivery fails, manual sharing is allowed but the manager must protect the link.

## 11. System Issues and Integration Health

- Staff roles `ADMIN`, `SUB_ADMIN`, and `INTERN` can access System Health.
- Diagnostics must redact tokens, credentials, signed payloads, and private URLs.
- WhatsApp numbers/provider metadata are masked where exposed.
- Integration checks are read-only.
- System issue reporter metadata is minimised and fingerprints recurring failures.
- Auto-resolver probe targets are restricted to avoid SSRF.

## 12. Warranty privacy

The warranty endpoint is customer-authenticated and queries only `req.user.id`. It returns vehicle, selected services, assigned garage, and dates for the customer's own completed bookings. It does not expose internal garage financials or provider data.

The public `/warranty` route contains only mock/design data and must never load a customer's warranty list.

## 13. Client and mobile secrets

- `VITE_*` and `EXPO_PUBLIC_*` are public.
- Web JWTs remain HttpOnly; do not copy them into local storage.
- Mobile SecureStore is better than plain storage but still requires backend revocation/refresh design.
- Google Maps browser keys must be API/referrer restricted.
- Firebase public configuration is not a server credential.

## 14. Operational security

- Apply security updates and pin/review dependencies.
- Run behind HTTPS and a reverse proxy/CDN/WAF.
- Restrict database/Redis network access.
- Back up and test restore.
- Rotate provider secrets and revoke old credentials.
- Use least-privilege cloud/provider accounts.
- Protect production environment files and CI secrets.
- Review admin audit logs for consequential changes such as controller-mode switches.

## 15. Residual risks

- Browser worker tracking may stop in background.
- Worker links are bearer capabilities and are not device-bound.
- In-process workers need stronger multi-replica coordination.
- Full E2E security coverage is incomplete.
- Mobile bearer-token backend contract is not yet production-final.
- Warranty claims currently route through support rather than a dedicated adjudication model.

## 16. Release security gate

- Prisma validation/generation and all migrations pass.
- 70 regression tests pass.
- Client build passes.
- Role/IDOR checks for changed routes pass.
- Provider webhook signatures are enabled.
- Worker token never appears in logs/issue reports.
- Controller mode switch revokes correct sessions/tasks.
- Upload limits and cleanup tested.
- System Health shows no unexplained outage and no secret disclosure.
- Backup and rollback are ready.

## 17. Incident response

1. Preserve request IDs, timestamps, audit logs, and relevant provider event IDs.
2. Revoke sessions/task links/credentials where exposure is possible.
3. Contain affected route/provider without destructive cleanup.
4. Assess customer/garage/payment impact.
5. Repair and test the root cause.
6. Notify affected parties according to legal/business requirements.
7. Record preventive tests, monitoring, and documentation changes.
