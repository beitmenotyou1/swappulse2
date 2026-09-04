---
description: The recorded SwapPulse security review, controls and remaining risks.
---

# Security Audit

**Audit completed:** 29 August 2026\
**Scope:** SwapPulse Base44 application, frontend, backend functions, entity/RLS configuration, authentication and account-security flows, payments, direct messages, AT Protocol/PDS integration, public-link handling, uploads, admin/moderation surfaces, blockchain configuration handoff, accessibility and production dependency/static checks.

This is an application-level engineering audit, not a substitute for an independent penetration test, infrastructure audit or formal smart-contract audit before real-value production use.

## Executive result

The audited application has **no unresolved high or critical findings identified in the code and schemas reviewed**.

Final automated release gate:

* Production Vite build: **PASS**
* ESLint: **PASS**
* Backend entrypoints parsed/bundled: **212 / 212 PASS**
* Ordinary entity schemas missing explicit RLS: **0**
* Open entity create rules (`create: {}`): **0**
* Literal Stripe/AWS/private-key signatures found in tracked source: **0**
* Tracked `.env` files: **0**
* npm production vulnerabilities: **0 critical, 0 high, 2 moderate**
* JSX icon/link/image accessibility scan: **0 findings**
* Form accessibility scan: only the two shared shadcn `Input`/`Textarea` primitives remain, which intentionally receive accessible names from callers.

The built-in Base44 `User` entity is the only schema without top-level entity RLS. It is a platform-managed authentication model, not an ordinary application entity. Sensitive custom `User` fields have explicit field-level restrictions and were verified against the live Base44 schema.

## Security fixes completed

### Authentication and account security

* WebAuthn credential create/update/delete operations are backend-only.
* WebAuthn credential ownership reads are bound to `user_id`.
* TOTP and WebAuthn enable/disable state is backend-controlled.
* TOTP secrets are backend/admin-readable only.
* Security-factor changes require fresh step-up verification.
* Step-up email codes are stored as salted SHA-256 digests rather than plaintext.
* Step-up capabilities are user-bound, signed and short-lived.
* A stolen authenticated browser session alone can no longer silently add/remove a passkey or disable TOTP.
* The old arbitrary-email TOTP-status enumeration endpoint was removed/disabled.
* Passwordless recovery/setup is bound to the verified account and cannot bypass configured second factors.
* `store-login-key` no longer trusts a caller-selected email before reset-token/account verification.
* `User.login_key` is backend/admin-only.
* `User.role` cannot be changed through ordinary user writes.

### User identity and sensitive profile fields

* `User.did` is backend-managed so a modified client cannot impersonate another DID.
* Legacy simulated-record `signing_key` is hidden and backend-managed.
* Web Push subscription endpoint/key material is backend-managed and not exposed as an ordinary profile field.
* Encrypted PDS app passwords are backend/admin-only.
* Stored PDS URLs are backend-managed and revalidated before authenticated use.
* Moderation strike/restriction state is backend-controlled.
* The old fallback that generated fake `did:plc` identities was removed.

### AT Protocol / PDS security

* Per-user PDS origins are treated as untrusted stored input and must be public HTTPS origins.
* Private/local/reserved addresses are rejected through SSRF validation.
* Authenticated PDS requests reject redirects.
* PDS sessions are bound to both DID and validated PDS origin.
* Handle updates, blob uploads, repo imports and outbound reconciliation now use the exact PDS that issued the bearer token.
* Bearer tokens are no longer sent to the shared/global PDS after authenticating against a user's own PDS.
* PDS image uploads enforce type/size restrictions server-side.

### Direct-message privacy and integrity

* New direct messages are local-only and never federated to public AT Protocol repositories.
* Plaintext fallback was removed. If E2EE cannot be established, the message is not persisted or sent.
* DM sender DID is bound to the authenticated user at creation.
* Message recipients cannot arbitrarily rewrite or delete sender content.
* Read receipts go through an authenticated backend operation.
* Legacy DM escrow/decryption behaviour is disabled for new messages.
* New DM reports use explicit report evidence rather than routine server-side plaintext escrow.
* Existing privacy-remediation tooling covers deletion of historical bridged DM/conversation copies from PDS repositories.

### Payments

* Stripe success pages no longer trust browser navigation alone.
* Fiat donation completion is verified server-side by retrieving the Checkout Session from Stripe.
* Currency, amount, session ID and payment state are checked against the pending local donation.
* Direct navigation to the success URL without a valid paid session reports an unconfirmed payment.
* Donation amount bounds are enforced.
* Legacy `FiatTopUp` and `BankAccount` custodial-wallet entities are quarantined admin-only and are not part of current V1.

### Notifications, moderation and reports

* Notification creation/mutation is backend-controlled; browser users can only read their own notifications.
* Read-state mutation is handled by an authenticated backend operation.
* Content-report moderation fields are staff-controlled.
* Moderator/admin role boundaries were reconciled with the live `User.role` enum.
* Legacy DM-decryption moderation functionality was tombstoned rather than retained as a hidden plaintext-access route.
* Dispute evidence URLs are HTTP(S)-only and rendered through safe external-link handling.

### URL, redirect and XSS hardening

* External navigation is restricted to `http:` and `https:` schemes.
* `javascript:`, `data:`, `file:` and similar schemes are rejected.
* Stored/deep-link internal routes reject protocol-relative paths, cross-origin URLs, backslashes and control characters before reaching React Router.
* Login `returnTo` validation blocks cross-origin and protocol-relative redirect tricks.
* Live-stream URLs are validated at both write and render boundaries.
* User-content rendering does not use raw unsanitised HTML.
* The only remaining `dangerouslySetInnerHTML` usage is the shared chart component generating CSS variables, not user content.
* `_blank` links use `noopener noreferrer`.

### File uploads and resource-abuse controls

* Profile/avatar/header images reject non-image files, SVG and images over 10 MB.
* Post images use the same image validation before preview and upload.
* Story images/videos have type and size limits.
* Story camera fallback uploads are image-only and size-limited.
* Trade-dispute evidence is capped at the schema's eight-photo maximum.
* Moderation report evidence is image-validated and capped.
* Podcast recordings have an explicit large-media size limit.
* Podcast covers are image/type/size validated.
* Collection imports are limited to CSV/JSON/XML, 10 MB and 5,000 rows per import.

### Blockchain/Web3 trust boundary

* Base44 stores only public blockchain coordinates, never signer/private keys.
* Network activation requires independent RPC verification.
* Chain ID, registry address/class, registry owner, account class and public RPC are pinned.
* Configuration-coordinate changes invalidate previous verification.
* Identity reconciliation fails closed when chain/contract/governance pins drift.
* Provisioning results are signer-bound and smart-account addresses are independently derived from the reserved public key.
* Persistent deployment uses separate private/write RPC and public/read-only RPC concepts.
* Raw Starknet Devnet administrative methods are not intended for public exposure.

## Usability and accessibility work completed

* Fixed 59 genuinely icon-only buttons that lacked accessible names.
* Normalised external-link accessibility/security attributes.
* Fixed shared image alt behaviour.
* Linked 57 visual labels programmatically to their controls.
* Added accessible names to 74 literal-placeholder controls.
* Added accessible names to 32 dynamically translated placeholder controls.
* Added explicit accessible names to specialised network, moderation, card-review, podcast-trim, date/time and live-duration controls.
* Final icon/link/image accessibility scan reports zero findings.
* Final form scan reports only the generic shared shadcn input/textarea primitives, which receive names from their callers.
* Upload failures now produce immediate user-facing validation instead of wasting bandwidth before failing.
* Trade evidence and collection-import limits now match their actual schema/processing constraints.

## Content Security Policy and browser headers

`index.html` currently provides a restrictive CSP through an HTML meta policy:

* default source restricted to self
* object embedding disabled
* script source restricted to self
* network connections restricted to self/HTTPS/WSS
* frame sources restricted to the explicitly supported media providers
* base URI and form actions restricted to self

The meta CSP is useful but **not equivalent to edge/server response headers**. The production hosting layer should additionally enforce:

* `Strict-Transport-Security`
* `Content-Security-Policy` as an HTTP response header
* `frame-ancestors` in the CSP header
* `Permissions-Policy`
* `X-Content-Type-Options: nosniff`
* appropriate cache controls for authenticated/sensitive responses

Those controls cannot be reliably supplied by Vite HTML markup alone and must be configured at the Base44/CDN/edge layer where supported.

## Known residual risks / architectural debt

### React Router

Production `npm audit` reports two moderate advisories in `react-router` / `react-router-dom` 6.x. The published npm remediation requires a major migration to React Router 7. Current attacker-controlled redirect/deep-link inputs are sanitised before reaching Router, and the SSR-specific advisory is not directly applicable to the current client-side Vite SPA architecture.

**Action:** plan and test a React Router 7 migration as normal maintenance rather than applying a forced major upgrade during a security-hardening release.

### Legacy simulated AT signing

The application still contains legacy client-facing social/federation architecture built around simulated record signing. Its signing key is now backend-protected, but the wider architecture should eventually be replaced by real AT Protocol/PDS-native signing and session semantics.

This legacy signing mechanism must never be reused for Starknet/SwapPulse Network keys.

### Base44 passwordless bridge

The current passwordless flow ultimately interoperates with Base44's email/password authentication bridge. `login_key` is now hidden and backend-managed, and recovery/setup has been strengthened, but a future native passwordless/session mechanism would remove this compatibility layer entirely.

### Platform/infrastructure verification

This audit cannot independently verify:

* Base44's internal storage encryption and platform IAM implementation
* CDN/edge TLS/HSTS configuration
* production WAF/rate-limit behaviour outside application code
* mail-provider account/security configuration
* Stripe dashboard/webhook configuration not represented in repository code
* browser/device matrix behaviour on every supported device

These should be checked operationally before a high-risk/public-value launch.

## Smart-contract audit boundary

The current Cairo identity/account contracts have been compiled, tested and exercised on Starknet Devnet, including persistent-state deployment/restart tests. This site-wide audit does **not** constitute a formal smart-contract security audit.

Before supporting real economic value, native passkey cryptography, production recovery governance or a sovereign/L3 deployment, obtain an independent Cairo/Starknet smart-contract review and add dedicated signature, upgrade-storage and migration tests.

## Release decision

Within the application/code/schema scope available to this audit, the site-wide security and usability audit is **complete** and the current state is suitable to proceed with the next private-testnet/Web3 development milestone.

This does not mean the application is "perfectly secure" or independently penetration-tested. It means the identified application-level high-impact findings have been remediated, no unresolved high/critical dependency findings remain, and the audited release gates are green.
