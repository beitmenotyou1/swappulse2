---
description: >-
  How SwapPulse turns private off-chain verification into minimal V2 on-chain
  assurance without publishing personal identity evidence.
---

# Verifier Logic and Assurance

SwapPulse deliberately separates **identity evidence** from **public assurance**. Private evidence is evaluated off-chain. The chain receives only the minimum generic metadata needed to prove that an authorised verifier issued a current V2 assertion.

{% hint style="danger" %}
Never put names, email addresses, dates of birth, document data, document images, raw verifier responses or other sensitive evidence on-chain.
{% endhint %}

## Trust path

The verifier flow has four distinct boundaries:

1. **External verifier** evaluates the private evidence and produces a signed or authenticated result.
2. **Base44 backend** validates the verifier callback, stores the private policy state and decides whether the application-side assertion is current.
3. **Transaction relay** uses the separately authorised on-chain verifier signer for the narrow V2 attestation or revocation operation.
4. **IdentityRegistry** stores generic V2 assurance metadata, replay protection and effective verification state.

No browser receives the verifier private key, registry-owner key, relay bearer token or raw private evidence.

## Base44 verifier webhook

The `age-verifier-webhook` backend function is the protected ingress for third-party verification events.

It:

* accepts `POST` only;
* limits the request body to 16 KiB;
* verifies an HMAC-SHA256 signature over the raw request body;
* compares authentication data using timing-safe logic;
* requires the backend-only `SWAPPULSE_AGE_VERIFIER_WEBHOOK_SECRET`;
* uses an exact metadata allowlist;
* rejects unknown evidence fields rather than silently storing them;
* validates opaque subject references;
* rejects conflicting event-ID reuse;
* handles stale/superseded verifier events safely;
* fails application value eligibility closed before attempting chain synchronisation.

The accepted event metadata is intentionally narrow and may include fields such as:

```
event_id
subject_ref
status
age_band
verified_at
expires_at
occurred_at
```

This data is enough to drive policy without copying raw identity evidence into Base44 or Starknet.

## Private Base44 assertion

`AgeStatus` and `AgeVerificationSession` hold the private application-side verification state.

The value-feature decision requires the private assertion to be current. At minimum, the application checks:

* verifier status is `VERIFIED`;
* the private verifier expiry has not passed;
* the private policy says the user is eligible for value-bearing features;
* the record belongs to the authenticated user through owner-scoped RLS.

These records are not blockchain authority. They are one side of a two-sided eligibility check.

## On-chain verifier role

The live `IdentityRegistry` separates the registry owner from the authorised verifier.

Live authorised verifier:

```
0x1fb17c0f4e8f198b799139ac370dc79a35019daa94e6415a54f3807b805042f
```

The verifier can issue or revoke approved verification assertions. It does not receive unrestricted registry administration authority merely because it can attest verification.

The owner and verifier are intentionally different accounts. The relay readiness check fails if that separation or the configured authority pins cannot be proven.

## V2 public assurance shape

A V2 verification contains generic public metadata rather than private claims.

The live policy uses fields including:

* verification commitment/root;
* schema hash or schema commitment;
* verification status;
* verification type;
* verification level;
* verifier/attester address;
* verification timestamp;
* optional expiry timestamp;
* revocation state;
* non-zero opaque attestation/replay identifier;
* version/audit metadata where exposed by the registry ABI.

The commitment is not a licence to hash plaintext PII directly. Low-entropy data such as DOB or postcode can be dictionary-attacked. Commitment construction must use an approved scheme with domain separation and appropriate blinding/salting.

## Current assurance policy

For the current value-bearing feature gate, SwapPulse requires:

```
verification_type = 1
verification_level >= 2
verification_attestation_id != 0
verification_status = ACTIVE
attested_by = configured authorised verifier
```

The public expiry must also be current, and the matching Base44 private assertion must still be current.

This means neither side alone is sufficient:

| Base44 private assertion | Chain V2 assertion | Result                                              |
| ------------------------ | ------------------ | --------------------------------------------------- |
| Current                  | Current            | Value features may proceed if all other checks pass |
| Current                  | Expired/revoked    | Fail closed                                         |
| Expired/revoked          | Current            | Fail closed                                         |
| Missing/unreadable       | Current            | Fail closed                                         |

## Replay protection

Every V2 assertion uses a non-zero opaque attestation/replay identifier.

Once consumed, that identifier remains spent even if the assertion later expires or is revoked. A replacement attestation must use a new identifier.

This prevents an old signed verification object or old relay request from being reused to recreate a previously consumed state transition.

## Expiry

Expiry does not delete historical verification metadata.

When the current time passes `expires_at`:

* effective verification becomes false;
* the historical status record remains auditable;
* the attestation ID remains spent;
* the permanent V2-only registry policy remains true;
* Base44 reconciliation maps the user to an expired effective state;
* new staking and bridge writes are blocked until a fresh V2 assertion is issued.

## Revocation

Revocation is an explicit verifier-controlled invalidation of the current assertion.

A revoked assertion:

* is not effective for value features;
* remains part of the audit history;
* does not unregister the user's identity;
* does not free the replay identifier;
* does not disable permanent V2 mode.

## Re-attestation

A user does not need a new identity after expiry or revocation.

The normal recovery path is:

1. obtain a new successful private verification result;
2. Base44 validates the new verifier event;
3. the protected backend prepares a fresh V2 assertion;
4. the relay submits it using the authorised verifier signer;
5. the public RPC confirms the chain state;
6. `chain-identity-reconcile` updates the private mirror;
7. value-bearing UI becomes available again when both private and public assertions are current.

The live ACTIVE -> EXPIRED -> ACTIVE cycle has been exercised successfully without recreating the identity or operator stake.

## Verifier rotation

Verifier rotation is a security-sensitive administrative operation.

A safe rotation procedure must:

1. identify the intended new verifier account;
2. verify it is non-zero and distinct from the registry owner;
3. change authorisation only through the approved owner/admin path;
4. update host configuration without exposing the private key;
5. recreate or reload the relay as required;
6. verify authenticated `/readyz` proves the new authorised verifier;
7. issue and reconcile a controlled V2 assertion;
8. preserve old public verification history for audit purposes.

Do not accept both old and new authorities indefinitely unless a deliberate multi-verifier policy has been designed and tested.

## Browser and backend rules

The browser may show coarse status such as ACTIVE, EXPIRED or REVOKED. It may show public assurance type/level and expiry.

The browser must never receive:

* raw age or identity evidence;
* verifier secrets;
* registry-owner secrets;
* relay bearer token;
* trusted server signing logic.

The Base44 backend must rebuild and validate any trusted assertion server-side rather than accepting arbitrary verifier metadata from the browser.

## Failure handling

Fail closed when:

* the webhook signature is missing or invalid;
* the verifier event is stale, malformed or conflicts with an existing event ID;
* the private assertion is expired;
* the public assertion is expired or revoked;
* the chain attester does not match the configured verifier;
* assurance type or level is below policy;
* the attestation/replay identifier is missing or zero;
* registry/verifier pins cannot be independently verified;
* reconciliation cannot determine current effective state.

## Test coverage

Current tests cover:

* unauthorised verification writes;
* authorised verifier permissions;
* verifier/owner separation;
* V2 type and level enforcement;
* zero or replayed attestation IDs;
* expiry;
* revocation;
* re-attestation;
* permanent V2 behaviour after expiry;
* malicious/unexpected callers;
* relay policy enforcement and readiness pins.

## Related pages

* Identity Registry
* Permanent V2 Verification Policy
* Chain State and Reconciliation
* Transaction Relay API and Policy
* Community Staking
