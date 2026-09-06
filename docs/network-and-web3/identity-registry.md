---
description: >-
  Live V2 IdentityRegistry architecture, privacy model, account binding,
  verifier permissions, replay protection, expiry, revocation and permanent V2
  rules.
---

# Identity Registry

`IdentityRegistry` is the permanent public identity anchor for SwapPulse. It binds an opaque identity reference to an approved Starknet smart account and stores only the public verification metadata required by the V2 trust model.

{% hint style="danger" %}
Do not store plaintext personal information in the registry or its events. Names, emails, DOBs, identity documents and raw verifier evidence stay off-chain.
{% endhint %}

## Live registry

```
Address
0x3e884bce5b994cede34f6660db1c28bc37e3cbbffb539de6b5f8dd8f761ecbb

Class hash
0x3179723520ee8e08450cf31e9c4c1e9b7c6491959f97bf5ce0fba020a84d1f1

Owner
0x63365ad0c16e8e565b2555b2aa396f99ef7772fc389bddfb5c4d6c2dc44b3c0

Authorised verifier
0x1fb17c0f4e8f198b799139ac370dc79a35019daa94e6415a54f3807b805042f
```

The owner and verifier are distinct authorities.

## Identity anchor

The identity layer tracks public state such as:

* opaque non-zero `identity_id`;
* bound smart-account address;
* identity status;
* canonical identity after merge/migration;
* creation/recovery metadata;
* reverse mapping from account to identity.

The Base44 user ID is not part of the public identity record.

## Registration rules

Registration is deliberately constrained.

A valid registration requires:

* a non-zero opaque identity ID;
* an approved deterministic smart-account address;
* the expected account class;
* a valid forward identity-to-account binding;
* a valid reverse account-to-identity binding;
* no conflicting existing registration;
* the authorised registry operation path.

Duplicate identity IDs and conflicting account reuse are rejected.

The normal product flow creates the private `ChainIdentity` mirror automatically. Administrators should not manually insert user identity rows as a normal provisioning shortcut.

## Canonical identities and merge history

Historical identities remain queryable when identities are merged or migrated.

Canonical resolution follows the surviving identity rather than deleting the old public history. This preserves auditability while giving the application one current identity target.

Effective verification follows the canonical identity where the contract interface specifies canonical resolution.

## V2 verification data

The current V2 verification model stores generic public assurance metadata, including concepts such as:

* `verification_root` or equivalent commitment;
* `schema_hash` or schema commitment;
* status/audit state;
* `attested_by`;
* `verified_at`;
* `expires_at`;
* V2 verification type;
* V2 verification level;
* non-zero replay/attestation ID;
* revocation state;
* version/audit counters where exposed by the ABI.

The commitment is a public cryptographic commitment to approved off-chain claim material. The underlying claims remain private.

## Privacy-safe commitments

Do not publish a plain hash of low-entropy personal information and call it private.

Values such as DOB, postcode or nationality can often be guessed and dictionary-attacked. Commitment construction should use an approved Starknet-friendly design with explicit domain separation and suitable secret blinding/salting.

The registry should never require a verifier to publish the raw evidence that produced the commitment.

## Verifier permissions

Verification authority is separate from registry ownership.

The authorised verifier may submit/revoke verification through the approved V2 path. It does not inherit arbitrary owner/admin rights.

The relay and public verification tooling independently check that:

* the configured verifier is authorised;
* the verifier is non-zero;
* the verifier is distinct from the registry owner;
* the registry class/address/owner pins match the canonical deployment.

Read Verifier Logic and Assurance for the complete off-chain-to-on-chain trust path.

## Replay protection

Every V2 assertion uses a non-zero opaque attestation/replay identifier.

A consumed identifier remains spent after:

* normal expiry;
* revocation;
* replacement by a later assertion.

A fresh assertion must use a fresh identifier. This prevents old signed assertion material from being reused to recreate a previous state transition.

## Expiry

Expiry is evaluated against the current block/application time as appropriate to the read path.

When an assertion expires:

* effective verification becomes false;
* the historical verification record remains auditable;
* the replay identifier remains spent;
* the identity itself remains registered;
* permanent V2-only mode remains enabled;
* new value-bearing actions fail closed until a fresh V2 assertion is issued.

## Revocation

Revocation invalidates the current verification without deleting the identity anchor.

A revoked identity can retain historical audit state, account history and existing on-chain positions while new eligibility-dependent writes are blocked.

Revocation does not switch the registry back to V1.

## Permanent V2 requirement

The live registry has:

```
verification_v2_required = true
```

This is a one-way global policy.

After activation:

* V1 verification writes are rejected;
* V2 assurance format is required;
* expiry/revocation remain per-identity behaviours;
* repeated cut-over requests are handled as read-first/idempotent confirmations by the protected application/relay path.

Read Permanent V2 Verification Policy.

## Account recovery and identity continuity

`SwapPulseAccount` recovery can rotate control of the smart account after the configured delay while preserving the public identity relationship according to the approved recovery flow.

Recovery state is public protocol state; recovery secrets remain server-side/user-side as appropriate and are never published in the registry.

Current configured recovery delay is 48 hours (`172800` seconds).

## Events and Base44 synchronisation

Registry events support application reconciliation for material transitions such as:

* registration;
* account/identity updates;
* merge/canonical changes;
* verification;
* revocation;
* recovery-related identity state.

Events must remain free of PII.

Base44 reconciles event-driven state with direct public RPC reads rather than treating a private mirror as more authoritative than the chain.

Read Chain State and Reconciliation.

## Security invariants

The registry must preserve these invariants:

* identity ID `0` is invalid;
* conflicting duplicate registration is invalid;
* an account cannot be silently rebound to a conflicting active identity;
* unauthorised callers cannot register, attest, revoke, merge or administer state;
* verifier and owner authority remain distinct;
* replay identifiers cannot be reused;
* expired/revoked assertions are ineffective;
* permanent V2 cannot be downgraded;
* no plaintext PII enters storage or events.

## Test coverage

Current tests cover:

* zero/invalid identity values;
* duplicate registration;
* reverse mapping consistency;
* canonical identity resolution;
* unauthorised writes;
* verifier permission boundaries;
* verifier rotation/authority checks;
* replayed V2 IDs;
* expiry;
* revocation;
* permanent V2 cut-over;
* expiry after permanent cut-over;
* recovery and migration-related invariants;
* malicious/unexpected callers.

## Related pages

* Cairo Contracts Reference
* Permanent V2 Verification Policy
* Verifier Logic and Assurance
* Chain State and Reconciliation
* SwapPulse V2 Live Architecture
