# SwapPulse Security Audit Checklist

Complete this checklist before production deployment. Items are adapted to the Base44 platform architecture.

---

## Smart Contract Security

### ERC-20 Token ($PULSE)
- [ ] Total supply cap verified (1 billion tokens)
- [ ] Mining allocation correctly calculated (40% of supply)
- [ ] Signature verification uses ECDSA properly
- [ ] Nonce tracking prevents replay attacks
- [ ] Pause mechanism tested and documented
- [ ] Admin functions require explicit role checks
- [ ] Slashing logic is deterministic and transparent
- [ ] Emergency withdrawal procedures documented

### ERC-721 / ERC-1155 NFTs
- [ ] Token ID derivation is deterministic and collision-resistant
- [ ] Metadata URI is immutable or versioned
- [ ] Bridge role restricted to authorised contracts only
- [ ] Burn functions verify ownership before burning
- [ ] Approval workflows follow ERC standards
- [ ] `supportsInterface` correctly implemented
- [ ] Reentrancy guards on external calls
- [ ] Gas optimisations for batch operations

### Bridge Contracts
- [ ] Only authorised relayers can confirm mirrors
- [ ] Bridge event logs include all required metadata
- [ ] Timeout mechanism for abandoned bridges
- [ ] Reentrancy protection on release functions
- [ ] Circuit breaker for abnormal activity
- [ ] Cross-chain message verification validated

### Staking Contract
- [ ] Minimum stake enforced consistently
- [ ] Lock periods cannot be bypassed
- [ ] Slashing requires multi-sig or governance approval
- [ ] Reward calculations audited for precision errors
- [ ] Withdrawal queues handle concurrent requests

### Meta-Transaction Relay
- [ ] Domain separator includes chain ID
- [ ] Nonce management prevents replay attacks
- [ ] Gas limits enforced for executed calls
- [ ] Fee recipient rotation tested
- [ ] Signature verification handles edge cases

### Recommended Audit Firms
- [ ] OpenZeppelin Defender
- [ ] Trail of Bits
- [ ] ConsenSys Diligence
- [ ] Spearbit
- [ ] CertiK

---

## Base44 Platform Security

### Authentication
- [ ] Passwordless login (email OTP / magic link) enforced
- [ ] Google OAuth uses PKCE flow
- [ ] 2FA (TOTP) required for admin accounts
- [ ] Session tokens expire correctly
- [ ] `base44.auth.logout()` clears all client state
- [ ] Rate limiting on auth endpoints (login, register, OTP)
- [ ] Turnstile bot protection on registration

### Row-Level Security (RLS)
- [ ] Every entity has explicit RLS rules (not just defaults)
- [ ] User-scoped entities filter by `created_by_id` or `data.did`
- [ ] Admin-only write entities have `user_condition: { role: "admin" }`
- [ ] Public-read entities use `read: {}` intentionally
- [ ] No entity has open write (`create: {}`) without justification
- [ ] Cross-user data access tested with two different accounts

### Secrets Management
- [ ] All API keys stored as Base44 secrets (not in code)
- [ ] `POLYGON_PRIVATE_KEY` and `PULSE_PRIVATE_KEY` never logged
- [ ] `APP_PASSWORD_ENCRYPTION_KEY` never exposed to frontend
- [ ] `BACKEND_FUNCTION_SECRET` used to authenticate scheduled calls
- [ ] Secrets rotated every 90 days
- [ ] No secrets committed to git

### Backend Functions
- [ ] All user-facing functions call `base44.auth.me()` and check auth
- [ ] Admin-only functions verify `user.role === 'admin'`
- [ ] Webhook endpoints validate signatures (Stripe, NOWPayments)
- [ ] No sensitive data returned in error messages
- [ ] File uploads size-limited and type-checked
- [ ] SSRF guard on URL-fetching functions

### Wallet Security
- [ ] Custodial wallet private keys AES-256-GCM encrypted server-side
- [ ] Passkey (WebAuthn) unlock verified with challenge signing
- [ ] PIN unlock uses PBKDF2 with 100k iterations
- [ ] Seed phrase retrieval requires 2FA (email code + TOTP)
- [ ] Send codes bound to (to_address, amount, chain) tuple
- [ ] Token blocklist auto-hides malicious tokens

---

## Web Application Security

### Input Validation
- [ ] All user inputs sanitised (XSS prevention)
- [ ] No `dangerouslySetInnerHTML` without sanitisation
- [ ] File upload restrictions (size, type)
- [ ] Content-Security-Policy headers configured
- [ ] Input length limits enforced

### API Security
- [ ] All endpoints require authentication (except public routes)
- [ ] Rate limiting on sensitive operations
- [ ] Request size limits enforced
- [ ] Response body does not leak stack traces
- [ ] No PII in analytics events

### Data Protection
- [ ] PII encrypted at rest (AES-256-GCM)
- [ ] TLS 1.3 enforced for all connections
- [ ] Wallet private keys never sent to frontend
- [ ] Log sanitisation removes sensitive data
- [ ] Analytics events use minimal properties (no PII)

---

## Privacy Compliance

### GDPR
- [ ] User consent collected for cookies/tracking
- [ ] Data export available via `export-my-data` function
- [ ] Account deletion purges all user data via `delete-account`
- [ ] Right to rectification implemented
- [ ] Privacy policy publicly available at `/privacy`
- [ ] Data Subject Request workflow via `DataSubjectRequest` entity

### CCPA
- [ ] "Do Not Sell My Information" link provided
- [ ] Consumer verification process documented
- [ ] Opt-out mechanism functional

### COPPA
- [ ] Age gate prevents under-13 registration
- [ ] No targeted advertising to minors

### Data Retention
- [ ] Audit logs retained per policy
- [ ] Deleted data purged within 30 days
- [ ] Analytics anonymised after 90 days

---

## Monitoring & Incident Response

### Logging
- [ ] Structured JSON logging via `base44/shared/logger.ts`
- [ ] All auth events logged
- [ ] Payment transactions logged immutably
- [ ] Wallet operations logged with redacted keys
- [ ] Log retention configured

### Alerts
- [ ] Status page monitoring (`StatusService` entity)
- [ ] Failed transaction thresholds monitored
- [ ] Low wallet balance alerts (`check-low-balances` workflow)
- [ ] Bridge queue lag monitored

### Incident Response
- [ ] Severity classification documented
- [ ] Communication templates prepared
- [ ] Post-mortem process defined
- [ ] Customer notification procedures tested

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Developer | | | |
| Security Engineer | | | |
| Product Manager | | | |

Last Updated: 2026-08-26