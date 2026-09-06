---
description: >-
  The one-way V2 verification policy, activation rules, expiry semantics and
  operational invariants for SwapPulse.
---

# Permanent V2 Verification Policy

SwapPulse uses a permanent V2-only identity verification policy on `SWAPPULSE_TESTNET`. This page documents what the policy means, how it was activated, what it does not mean, and the rules operators and application code must preserve.

{% hint style="danger" %}
`verification_v2_required = true` is a one-way registry state. Do not attempt to disable it, downgrade the registry to V1, or redeploy around it as an operational shortcut.
{% endhint %}

## Current live state

The live registry reports:

```
identity_verification_mode = V2
verification_v2_required = true
ecosystem_ready = true
```

IdentityRegistry:

```
0x3e884bce5b994cede34f6660db1c28bc37e3cbbffb539de6b5f8dd8f761ecbb
```

The permanent policy applies globally to verification writes. It is separate from the validity of any individual user's current V2 attestation.

## Global policy versus individual verification

There are two different state machines and they must not be confused.

| State                      | Scope           | Can it change?              | Effect                                                                         |
| -------------------------- | --------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `verification_v2_required` | Registry-wide   | One-way from false to true  | Rejects legacy V1 verification writes permanently                              |
| V2 verification status     | One identity    | Yes                         | Can become ACTIVE, EXPIRED or REVOKED                                          |
| V2 expiry                  | One attestation | Yes, by time or replacement | Stops the attestation from being effective after its expiry                    |
| V2 revocation              | One attestation | Yes, by authorised verifier | Invalidates the current attestation without changing the global V2 requirement |

An expired or revoked V2 assertion does **not** switch the registry back to V1. A later valid V2 attestation can restore the user's eligibility without recreating the identity.

## Why the policy is permanent

The cut-over prevents downgrade paths after the application and relay have committed to the stronger assurance model. Without a permanent flag, an old V1 path could remain a weaker alternative after V2 has been adopted.

The permanent rule therefore gives the rest of the stack a stable invariant:

* Base44 can assume that all new verification writes must use V2 semantics.
* The relay can reject V1 entrypoints and malformed assurance payloads.
* The UI can explain expiry or revocation without implying that the network itself has downgraded.
* Auditors can distinguish historical V1-compatible code from the live verification policy.

## Activation requirements

The one-way switch was gated by several checks. A legitimate first activation must only be attempted when all of these are true:

1. the intended V2 `IdentityRegistry` class and address have been independently verified through the public RPC;
2. the authorised verifier is configured and distinct from the registry owner;
3. the V2 account, token, staking, card, usership and bridge contract pins match the canonical deployment manifest;
4. the relay is running in V2 mode and its authenticated `/readyz` check passes;
5. a real V2 assurance attestation has succeeded end to end;
6. the cut-over caller provides the exact irreversible confirmation required by the protected backend/relay path;
7. the current on-chain flag is read before any write is attempted.

The activation path is intentionally more restrictive than an ordinary contract write because the result cannot be undone.

## Read-first and idempotent behaviour

The Base44 admin path and relay both read the permanent flag first.

If the flag is already true, a repeated cut-over request is treated as a successful idempotent confirmation:

```json
{
  "ok": true,
  "transaction_hash": "",
  "idempotent": true,
  "verification_v2_required": true
}
```

No second chain transaction is submitted. The retry does not depend on the original proof identity still being current.

This matters during incident recovery. A lost HTTP response or expired original proof must not tempt an operator to submit a second irreversible action blindly.

## Legacy writes after cut-over

After the permanent flag is true:

* legacy V1 verification writes are rejected;
* V2 attestation writes must use the approved V2 entrypoint and data shape;
* replay identifiers remain protected;
* the verifier role remains separate from registry ownership;
* expiry and revocation continue to work normally;
* ordinary identity registration and account recovery continue according to their own rules.

The policy changes which verification format is accepted. It does not erase identity history or make every identity permanently verified.

## Expiry after permanent cut-over

Expiry is an effective-state calculation, not a rollback of the registry policy.

For an attestation with a non-zero expiry:

1. it is valid before the expiry timestamp if all other checks pass;
2. it becomes ineffective after expiry;
3. its historical record remains auditable;
4. its consumed replay/attestation identifier stays consumed;
5. `verification_v2_required` remains true;
6. a fresh valid V2 attestation may later restore effective verification.

The Cairo regression suite explicitly tests this sequence after the permanent switch.

## Revocation after permanent cut-over

Revocation follows the same separation of concerns:

* the authorised verifier can revoke the current verification according to contract policy;
* revocation stops effective verification;
* the identity anchor remains registered;
* existing on-chain history remains visible;
* the global V2-only flag remains unchanged;
* a later valid V2 attestation must use a new replay identifier.

## Effect on value-bearing features

The application requires current private and public assurance before allowing new value-bearing actions such as staking or bridge writes.

When verification expires or is revoked:

* the smart account and identity remain;
* existing stake remains on-chain;
* existing card and transaction history remains;
* new staking writes are blocked;
* new bridge writes are blocked;
* the UI may remain read-only for existing positions;
* reconciliation marks the effective verification state accordingly.

A fresh V2 attestation can re-enable those actions after public-chain reconciliation succeeds.

## Operator rules

Never:

* attempt to turn the permanent flag off;
* substitute a V1 write because V2 verification is temporarily unavailable;
* treat an expired user attestation as evidence that the registry is no longer V2-only;
* retry an uncertain cut-over write without first reading the chain;
* bypass `/readyz` or contract-pin verification during recovery;
* expose privileged keys or relay credentials while diagnosing the cut-over path.

Always:

* read the registry state before deciding whether a write is needed;
* use the verified public RPC for confirmation;
* preserve the canonical deployment manifest;
* fail closed when V2 assurance cannot be proven;
* treat already-true cut-over requests as idempotent confirmations;
* keep user verification state separate from the global registry policy in UI copy and backend logic.

## Test evidence

Current regression coverage includes:

* exact irreversible confirmation required;
* proof requirement on first activation;
* V1 rejection after activation;
* idempotent retry after activation;
* idempotent retry after the original proof later expires;
* V2 expiry after permanent cut-over;
* replay identifier remains spent after expiry;
* revocation without policy downgrade;
* authenticated relay readiness reflects the permanent flag.

## Related pages

* SwapPulse V2 Live Architecture
* Identity Registry
* Verifier Logic and Assurance
* Transaction Relay API and Policy
* Chain State and Reconciliation
