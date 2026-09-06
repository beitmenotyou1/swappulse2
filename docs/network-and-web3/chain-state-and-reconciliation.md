---
description: >-
  How SwapPulse decides which chain state is authoritative, mirrors it into
  Base44 and keeps the UI fail-closed during expiry, revocation and network
  faults.
---

# Chain State and Reconciliation

SwapPulse treats Starknet as the authority for public Web3 state and Base44 as a private application/orchestration layer. Reconciliation connects those two systems without allowing a private database record to override the chain.

## Source-of-truth hierarchy

For Web3 state, use this order:

1. **Verified public chain state** - authoritative for deployed classes, identity registration, verification, token balances, staking, cards, bridge state and transaction results.
2. **Base44 private mirrors** - cached application records used for ownership mapping, UX, policy and reconciliation status.
3. **Browser/UI state** - presentation only. Never authoritative for a value-bearing decision.

If the layers disagree, the application must fail closed and reconcile from the chain.

## Verified network configuration

`ChainNetworkConfig` contains public network metadata such as:

* chain ID;
* public RPC URL;
* account class hash;
* IdentityRegistry address and class hash;
* V2 contract addresses and class hashes;
* recovery delay;
* verification mode and related public pins.

It is admin-only and becomes trusted only after independent verification through the public RPC.

Changing a critical pin invalidates the previous verification until the network is checked again.

`ChainNetworkConfig` must never contain private keys, relay bearer tokens, private RPC credentials or user secrets.

## Canonical deployment manifest

The canonical public manifest is:

```
chain/deployments/swappulse-testnet.json
```

Verification checks include:

* chain ID;
* each deployed class hash;
* IdentityRegistry owner;
* authorised verifier;
* permanent V2 flag;
* token/staking/card/usership/bridge wiring;
* ecosystem readiness.

The manifest is public deployment metadata. It is not a secret store.

## ChainIdentity mirror

`ChainIdentity` maps an authenticated Base44 user to the public Starknet identity/account state.

It may store:

* Base44 `user_id` privately;
* opaque `chain_identity_id`;
* smart-account address;
* signer **public** key;
* registry and class references;
* public transaction hashes;
* mirrored V2 verification metadata;
* reconciliation timestamps;
* machine-readable reconciliation/failure codes.

Normal provisioning creates this record automatically. Operators should not manually insert user `ChainIdentity` rows as a routine workflow.

## Identity reconciliation

`chain-identity-reconcile` reads the public registry and updates the private mirror.

For effective verification it considers both stored audit state and current time. A historical status value of verified does not remain effective after its expiry.

Typical effective outcomes include:

* `ACTIVE` - current valid V2 assurance;
* `EXPIRED` - expiry has passed;
* `REVOKED` - current assurance was revoked;
* registration/recovery states that describe the identity anchor independently from assurance.

The reconciler also mirrors V2 type, level, attestation ID, attester and expiry where needed for application policy.

## Private verifier reconciliation

The Base44 `AgeStatus` mirror is private and separately time-bound.

If a public-chain assertion expires, the application does not continue value access merely because the old private record still says VERIFIED. Likewise, a current chain assertion is not sufficient if the private verifier assertion has expired.

The value gate requires both sides to be current.

## Browser fail-closed timer

The Wallet performs explicit time checks for private and public expiry. It refreshes its current-time reference regularly rather than waiting indefinitely for a background reconciliation job.

This avoids a window where an already-rendered page could continue to show a value action as available after its attestation expiry.

The browser check is an additional UX safety control. The Base44 backend still performs the authoritative policy check before a transaction draft is issued.

## Transaction lifecycle

A normal user-controlled chain write follows this sequence:

1. the authenticated user chooses an action in the UI;
2. Base44 reads current private policy and verified network configuration;
3. Base44 reads or validates the relevant current chain state;
4. Base44 builds the canonical transaction intent server-side;
5. the user explicitly signs the approved action;
6. Base44 verifies that the signature and transaction match the server intent;
7. the protected relay checks its allowlist and chain pins;
8. the relay submits the transaction;
9. Base44 does **not** treat the relay response alone as final truth;
10. the public RPC is used to confirm and reconcile the resulting chain state;
11. Base44 mirrors and UI are updated from that confirmed result.

## Why relay success is not final chain truth

The relay is a write boundary. It may return a transaction hash before every application mirror has caught up.

Therefore:

* transaction submission state is distinct from confirmed chain state;
* duplicate actions must be guarded during the propagation window;
* retries use idempotency and read-before-write checks where possible;
* the UI may show a pending state until public-chain confirmation succeeds.

## Staking state

Staking uses the chain-authoritative `StakingPool` read model.

`chain-staking-status` reads `get_validator(accountAddress)` through the verified public RPC and reports operator state such as:

* `NONE`;
* `ACTIVE`;
* `EXITING`;
* `SLASHED`.

A Base44 row cannot turn a chain `NONE` state into an active operator. Conversely, an old/stale Base44 mirror must not trigger a duplicate registration if the chain already says ACTIVE.

The UI therefore offers `increase_self_stake` to an existing active operator instead of a second `register_validator` action.

## Staking mirrors and propagation guards

`StakePosition` records are useful for user history, pending transaction state and propagation guards. They are not the authoritative balance ledger.

The draft backend re-reads the chain before creating an action and independently rejects invalid lifecycle transitions such as:

* duplicate operator registration;
* undelegating more than the active delegation;
* withdrawing before the unbonding delay;
* invalid operator state transitions.

A periodic chain-event reconciliation job advances submitted mirrors and records lifecycle timestamps without redefining the underlying chain state.

## Expiry and existing positions

When verification expires or is revoked:

* the identity anchor remains;
* existing stake remains on-chain;
* existing card and transaction history remains;
* read-only display may continue;
* new staking writes are blocked;
* new bridge writes are blocked;
* the permanent V2 requirement remains true.

A later fresh V2 attestation can restore value features without recreating the identity or stake position.

## Event-driven synchronisation

Cairo events are designed to support off-chain synchronisation of material state changes such as:

* identity registration/binding;
* verification/revocation;
* recovery and account updates;
* staking lifecycle changes;
* card and bridge operations.

Consumers must treat events as evidence to reconcile against the canonical chain, not as an excuse to trust unverified client-supplied state.

## Failure modes

The application should fail closed when:

* public RPC cannot prove the expected chain ID or class pins;
* relay `/readyz` is not healthy;
* an identity/account mapping differs from the registry;
* an attester differs from the configured verifier;
* a V2 attestation is expired or revoked;
* private verifier state is expired or unavailable;
* a staking status read fails during a sensitive transition;
* a submitted transaction cannot be reconciled to the expected state.

Read-only UI can degrade gracefully where safe. New value-bearing writes should not.

## Operator incident workflow

When a mirror looks wrong:

1. read the public chain first;
2. verify the canonical deployment manifest and network pins;
3. check authenticated relay readiness if the issue concerns writes;
4. rerun the relevant reconciler;
5. compare the mirrored account/identity/attestation fields with the public result;
6. fix the mirror or code path, not the chain, when the chain is already correct;
7. avoid manual database edits that bypass the normal ownership and reconciliation flow.

When a chain write is uncertain:

1. do not resubmit blindly;
2. query the transaction/account/contract state through the public RPC;
3. use the idempotent retry path if one exists;
4. only submit a new transaction when the current state proves the intended transition did not already happen.

## Security invariants

* Public chain state outranks Base44 mirrors for Web3 truth.
* Private Base44 records outrank browser claims for application policy.
* The browser never receives privileged signing keys.
* The relay is not a general-purpose RPC.
* Reconciliation must be repeatable and idempotent where practical.
* Expiry is evaluated using current time, not only a stored status label.
* Stale mirrors must never create duplicate or invalid chain actions.
* Machine-readable errors should be preserved without logging secrets or PII.

## Related pages

* SwapPulse V2 Live Architecture
* Permanent V2 Verification Policy
* Verifier Logic and Assurance
* Community Staking
* Transaction Relay API and Policy
