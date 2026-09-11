# SwapPulse Site-Wide Security & Usability Audit

**Audit completed:** 29 August 2026  
**Scope:** Base44 application, frontend, backend functions, entity/RLS configuration, authentication, payments, DMs, AT Protocol/PDS integration, uploads, moderation, Web3 handoff, accessibility and dependency/static checks.  
**Status:** Complete with residual maintenance actions.

This is an application-level engineering audit, not a substitute for an independent penetration test, infrastructure audit or formal smart-contract audit before real-value production use.

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | WebAuthn credential control | Strong-authentication credentials needed to be protected from ordinary browser mutation. | **Completed:** WebAuthn create/update/delete is backend-only, ownership is user-bound and security-factor changes require fresh step-up verification. |
| 🔴 P0 | TOTP / step-up security | TOTP state and verification secrets required stronger server authority and storage handling. | **Completed:** TOTP state is backend-controlled, secrets are backend/admin-readable only, email codes are stored as salted SHA-256 digests and step-up capabilities are signed, user-bound and short-lived. |
| 🔴 P0 | Passwordless recovery | Recovery/setup could become a compatibility bypass around account binding or configured second factors. | **Completed:** recovery/setup is tied to the verified account, respects second factors and `store-login-key` no longer trusts caller-selected email before verification. |
| 🔴 P0 | User identity integrity | Client-editable DID/signing/security fields could enable identity impersonation or unsafe reuse of sensitive values. | **Completed:** DID, legacy signing key, push subscription data, encrypted PDS credentials, PDS URLs and moderation account-state fields are backend-managed. |
| 🔴 P0 | PDS SSRF/session binding | Per-user PDS URLs are untrusted and bearer tokens must never be sent to an unverified origin. | **Completed:** PDS origins require public HTTPS, private/local/reserved targets and redirects are rejected, and sessions are bound to DID plus validated PDS origin. |
| 🔴 P0 | Direct-message confidentiality | New DMs could not safely tolerate plaintext fallback or public federation. | **Completed:** new DMs are local-only, E2EE is required, sender identity is auth-bound and plaintext fallback/public PDS bridging is disabled. |
| 🔴 P0 | Donation/payment confirmation | Browser navigation to a success route could otherwise be mistaken for confirmed payment. | **Completed:** Stripe Checkout Session is retrieved server-side and amount, currency, session ID and payment state are verified. |
| 🔴 P0 | Notifications / moderation state | Browser users must not be able to forge system notifications or staff moderation outcomes. | **Completed:** notification mutation and moderation fields are backend/staff controlled and read-state changes use authenticated endpoints. |
| 🔴 P0 | Redirect / XSS boundary | Untrusted URLs and deep links can permit unsafe schemes, cross-origin redirects or script-style navigation. | **Completed:** external navigation is HTTP(S)-only, dangerous/protocol-relative/cross-origin routes are rejected, raw user HTML is not rendered and `_blank` links use `noopener noreferrer`. |
| 🔴 P0 | Upload abuse | Multiple upload surfaces needed consistent type, size, quantity and import-row limits. | **Completed:** profile, post, story, evidence, podcast and collection-import paths enforce appropriate limits before expensive processing. |
| 🔴 P0 | Web3 secret boundary | Privileged Starknet/admin/verifier trust must never live in browser code or unverified chain configuration. | **Completed:** Base44 stores public chain coordinates only, activation verifies chain/registry/account-class pins, and private/write RPC is separated from public/read-only RPC. |
| 🟠 P1 | DM report privacy | Moderation tooling could recreate a hidden general-purpose plaintext-access path if report handling were not constrained. | **Completed:** routine plaintext escrow/decryption is disabled; reports use explicit evidence and legacy bridged copies have privacy-remediation tooling. |
| 🟠 P1 | Public URL safety | Stored media URLs and external links need validation at write and render boundaries. | **Completed:** supported URL schemes are validated on both sides. |
| 🟠 P1 | Accessibility | Icon-only buttons, visual labels and placeholder-only controls lacked complete accessible naming/relationships. | **Completed:** 59 icon-only buttons, 57 label/control relationships, 74 literal-placeholder controls and 32 translated-placeholder controls were corrected, plus specialised controls. |
| 🟠 P1 | Content Security Policy | HTML meta CSP cannot provide the complete protections of production HTTP response headers. | Configure edge/server `Strict-Transport-Security`, full `Content-Security-Policy`, `frame-ancestors`, `Permissions-Policy`, `X-Content-Type-Options: nosniff` and sensitive-response cache controls. |
| 🟠 P1 | React Router dependency | Production audit reported two moderate React Router 6.x advisories whose published remediation is a major v7 migration. | Plan and test React Router 7 migration; keep attacker-controlled redirect/deep-link inputs sanitised meanwhile. |
| 🟠 P1 | Legacy AT signing | Legacy simulated AT signing remains architectural debt even though its key is backend-protected. | Replace with proper PDS-native signing/session semantics; never reuse the compatibility mechanism for Starknet keys. |
| 🟠 P1 | Passwordless bridge | Passwordless login still interoperates with Base44's email/password compatibility layer. | Migrate to a native passwordless/session mechanism when supported without weakening current safeguards. |
| 🟠 P1 | Platform/infrastructure assurance | Repository review cannot independently prove Base44 storage/IAM, CDN TLS/HSTS/WAF/rate limits, mail-provider security or Stripe dashboard configuration. | Verify these operationally before high-risk/public-value launch and retain evidence outside the code audit. |
| 🟠 P1 | Smart-contract assurance | Application review and Devnet testing do not constitute a formal Cairo/Starknet smart-contract audit. | Obtain independent Cairo/Starknet review before real economic value, production recovery governance, native passkey cryptography or sovereign/L3 deployment. |
| 🟡 P2 | Build gate | Production Vite build needed to pass before audit closure. | **Completed:** production Vite build passed. |
| 🟡 P2 | Lint gate | ESLint needed to pass before audit closure. | **Completed:** ESLint passed. |
| 🟡 P2 | Backend entrypoints | Backend entrypoints needed parse/bundle validation. | **Completed:** 212 / 212 passed. |
| 🟡 P2 | Entity RLS | Ordinary entities without explicit RLS could create accidental data exposure. | **Completed:** zero ordinary entities were missing explicit RLS and zero had open `create: {}`; the Base44-managed `User` model remains the platform exception with sensitive custom fields restricted. |
| 🟡 P2 | Secret scanning | Tracked source needed checks for literal secret signatures and committed environment files. | **Completed:** no tracked Stripe/AWS/private-key signatures and no tracked `.env` files were found. |
| 🟡 P2 | Dependency audit | Production dependencies required vulnerability review. | **Completed with residual action:** zero critical/high vulnerabilities remained; two moderate React Router advisories are tracked for migration. |
| 🟡 P2 | Accessibility regression scan | Final JSX icon/link/image and form scans were required after remediation. | **Completed:** icon/link/image scan reported zero findings; only shared shadcn `Input`/`Textarea` primitives remain for callers to label. |
| 🟢 P3 | Audit consistency | The original report mixed findings and remediations across long narrative sections. | **Completed:** this document now follows the shared Priority / Area / Finding / Required action format. |

## Release decision

Within the application/code/schema scope of this audit, identified high-impact application findings were remediated and no unresolved critical/high dependency finding remained at audit close. This does **not** mean the application is perfectly secure or independently penetration-tested.

Future audits must use [AUDIT_STANDARD.md](AUDIT_STANDARD.md).
