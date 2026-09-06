---
description: >-
  The current SwapPulse Cairo/Starknet architecture, live V2 contract suite,
  trust boundaries, toolchain and deployment discipline.
---

# Cairo and Starknet Chain Overview

SwapPulse uses Cairo and Starknet for its public trust layer. The current V2 contract suite is live on `SWAPPULSE_TESTNET`; Base44 remains the private application/orchestration layer around it.

{% hint style="warning" %}
The network is still testnet infrastructure. Community staking currently represents application/operator accountability, not permissionless blockchain consensus.
{% endhint %}

## Architecture split

### Cairo/Starknet owns

* public smart-account state;
* opaque identity registration and account binding;
* V2 verification commitments and assurance metadata;
* verifier authorisation and revocation state;
* replay protection;
* permanent V2-only policy;
* SWPX token state;
* community staking state;
* public card anchors;
* usership commitments/scores;
* bridge state;
* events needed for reconciliation.

### Base44 owns

* authentication and application sessions;
* private user-to-chain mappings;
* private verifier state;
* private eligibility policy;
* transaction drafting/orchestration;
* UI state;
* chain reconciliation and notifications.

### The relay owns

* the protected server-side write boundary;
* narrow privileged signer use;
* contract/entrypoint allowlisting;
* chain and class-hash pin checks;
* request-shape and policy enforcement.

### The user smart account owns

* user-authorised chain execution;
* explicit signatures for user-controlled transactions;
* account-level signer/recovery state.

## Live V2 contract suite

The live suite is:

1. `IdentityRegistry`
2. `SwapPulseAccount`
3. `NativeToken` / SWPX
4. `CardNft`
5. `ProofOfUsership`
6. `StakingPool`
7. `BridgeAdapter`

For addresses, class hashes and contract-by-contract responsibilities, read Cairo Contracts Reference.

## Privacy boundary

Personal identity evidence stays off-chain.

Never write any of the following to Cairo storage or events:

* names;
* email addresses;
* phone numbers;
* dates of birth;
* addresses;
* document scans/images/numbers;
* raw verifier responses;
* Base44 user IDs;
* AT Protocol credentials;
* private keys, seed phrases or passkey secrets;
* private collection notes.

The chain may contain opaque references, commitments, public addresses, generic assurance metadata, timestamps, expiry, revocation state and replay identifiers.

A commitment is not automatically private. Low-entropy personal data must not simply be hashed and published. Approved commitment construction should use explicit domain separation and appropriate blinding/salting.

## Permanent V2 policy

The live registry has:

```
identity_verification_mode = V2
verification_v2_required = true
```

This flag is permanent. V1 verification cannot be re-enabled.

Individual V2 attestations can still expire, be revoked and later be replaced by a fresh V2 attestation. That does not change the global policy.

Read Permanent V2 Verification Policy for the exact semantics and operational rules.

## Verifier model

The registry owner and authorised verifier are separate authorities.

The authorised verifier can issue/revoke approved V2 assertions but does not gain unrestricted registry administration simply because it can attest verification.

The Base44 verifier webhook authenticates third-party verification results off-chain and keeps raw evidence private. The chain receives only generic assurance metadata and replay-protected identifiers.

Read Verifier Logic and Assurance.

## Chain authority and reconciliation

The blockchain is authoritative for Web3 state. Base44 mirrors are caches and private mappings, not a replacement ledger.

For identity, staking and other value-bearing state:

1. read the verified public RPC;
2. compare with the canonical deployment pins;
3. reconcile the private mirror;
4. fail closed if the layers disagree.

Read Chain State and Reconciliation.

## Current toolchain

The live V2 baseline was built/tested with:

```
Node.js 22.x
Scarb / Cairo / Starknet package 2.13.1
Starknet Foundry 0.51.2
Universal Sierra Compiler 2.8.0
OpenZeppelin Contracts for Cairo 3.x family
```

The repository deliberately pins tooling because Cairo/Starknet build artefacts and compiled-class hashes can change across incompatible compiler/tooling combinations.

Do not casually mix Foundry, `snforge_std`, Scarb, Cairo and USC versions across an existing deployment workflow.

## Build and test

From the repository:

```bash
cd chain
SCARB_BIN=scarb SNFORGE_BIN=snforge bash scripts/test-chain.sh
```

The final V2 hardening baseline collected 64 tests:

```
63 passed
0 failed
1 runner-limited test ignored and separately verified
```

The zero-public-key constructor rejection was separately verified.

Coverage includes identity registration, verifier permissions, replay protection, V2 cut-over, expiry, revocation, recovery, token accounting, fuzz testing, staking lifecycle rules and malicious/unauthorised callers.

## Deployment manifest

The canonical live public manifest is:

```
chain/deployments/swappulse-testnet.json
```

It contains public deployment metadata only.

It must not contain:

* deployment private keys;
* verifier private keys;
* registry-owner private keys;
* relay bearer tokens;
* private RPC credentials;
* Cloudflare credentials;
* user secrets.

The manifest is independently verified through the public RPC before Base44 treats the network as configured.

## Deployment order for a new network

For a fresh environment, use this sequence:

1. build and test the Cairo packages;
2. declare/deploy the complete intended V2 suite;
3. generate the canonical public manifest;
4. verify every address/class hash and authority pin through the public RPC;
5. import the public manifest into `ChainNetworkConfig`;
6. run Base44 independent Verify & Activate checks;
7. configure the relay from the verified pins;
8. verify authenticated relay `/readyz`;
9. provision a real identity through the normal wallet flow;
10. issue and reconcile a genuine V2 assurance;
11. exercise token/staking/value paths;
12. only then perform any one-way V2 activation on a network where it is not already enabled.

On the live SwapPulse testnet, that permanent V2 activation is already complete and must not be repeated as a new write.

## OpenZeppelin usage

Standard security-sensitive primitives should use established OpenZeppelin Cairo components wherever appropriate rather than custom implementations.

Examples include:

* ERC-20 behaviour;
* access-control/ownership patterns;
* upgrade patterns;
* common account/security interfaces.

Custom logic should focus on SwapPulse-specific state transitions, not reimplement standard token or access-control machinery unnecessarily.

## Testing principles

Every contract change should include negative-path tests, not only successful flows.

Required themes include:

* unauthorised writes;
* duplicate registration;
* invalid state changes;
* replay attempts;
* expired/revoked verification;
* zero/invalid addresses and keys;
* ownership/admin changes;
* verifier permission boundaries;
* malicious/unexpected callers;
* lifecycle timing errors;
* fuzz/property testing where state/accounting logic benefits from it.

## Upgrade discipline

Do not modify the live deployment merely because source code changed.

For a contract upgrade or replacement:

1. identify whether an upgrade is actually necessary;
2. review storage/interface compatibility;
3. run the full test suite;
4. deploy or declare the candidate in a controlled environment;
5. independently verify the class hash;
6. exercise migration/upgrade paths;
7. update public manifests only after verification;
8. re-run Base44 network verification;
9. re-run relay readiness and policy tests;
10. publish migration notes and security implications.

## Related pages

* Cairo Contracts Reference
* Identity Registry
* Permanent V2 Verification Policy
* Verifier Logic and Assurance
* Chain State and Reconciliation
* Transaction Relay API and Policy
* Community Staking
* SwapPulse V2 Live Architecture
