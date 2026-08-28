# SwapPulse Network — Milestone 1

This directory contains the first portable Cairo implementation for the private SwapPulse Testnet.

## Scope

Milestone 1 intentionally contains only:

1. `SwapPulseAccount` — Starknet smart account using the standard Stark-curve signer for the private testnet.
2. Timelocked recovery hooks — recovery is disabled when the controller is the zero address.
3. `IdentityRegistry` — permanent opaque identity -> smart-account mapping.
4. Admin-gated identity merge — duplicate identities remain in history and resolve to one canonical identity.
5. Upgrade hooks — account upgrades are self-authorised; registry upgrades are owner-authorised for the testnet.

There is **no token, staking, bridge, marketplace settlement, Proof-of-Usership, custodial wallet, seed phrase, or user-paid gas design in this milestone**.

## Privacy boundary

The chain stores only public blockchain identifiers and state:

- opaque `identity_id`
- smart-account address
- identity status / canonical merge target
- creation timestamp
- recovery counter

The following must never be written on-chain:

- email address
- Base44 user id
- date of birth / age information
- AT Protocol credentials or app passwords
- private keys
- passkey secret material
- verification photos
- private collection/binder information

Base44 stores the private user -> chain identity mapping in the owner-readable `ChainIdentity` entity. The blockchain remains authoritative.

## Toolchain target

The manifest currently targets:

- Cairo / Starknet package: `2.13.1`
- OpenZeppelin Contracts for Cairo: `3.0.0`

These versions match the current stable OpenZeppelin 3.x documentation used for the initial implementation. Pinning should be revisited deliberately before any public testnet or audit.

## Build

From a machine with Scarb installed:

```bash
cd chain
scarb build
```

The Base44 shell currently exposes an empty `/workspace` rather than the repository checkout, so Cairo compilation cannot be executed from the connected Base44 sandbox. Do not treat the contracts as deployment-ready until `scarb build` and Starknet Foundry tests pass in a real Cairo workspace.

## Required tests before deployment

At minimum:

- account constructor rejects a zero public key
- standard account execution validates Stark signatures
- public-key rotation remains account-self-only
- recovery is impossible while controller is disabled
- only recovery controller can propose / execute recovery
- recovery cannot execute before its delay
- current account holder can cancel a pending recovery through a self-call
- only the account itself can upgrade `SwapPulseAccount`
- only registry owner can register/change/merge/recovery-record/upgrade
- identity id `0` is rejected
- account addresses cannot be bound to two active identities
- identity ids cannot be registered twice
- merged identities remain queryable and resolve to the canonical target
- merged identity cannot be merged again
- historical source account mapping survives a merge
- account replacement correctly clears the old reverse mapping

## Base44 provisioning flow

`chain-identity-admin` is intentionally admin-only for Milestone 1.

`prepare` accepts a **public Stark key only** and creates a `PENDING` private Base44 mirror. It never receives or stores a private key.

`record_deployment` records the deployed address and transaction hashes and advances the mirror only to `DEPLOYED`.

`REGISTERED` is reserved for a later reconciliation worker that reads `IdentityRegistry` from the testnet. Base44 must not promote itself to blockchain authority.

Required network configuration after the contracts are compiled and deployed is stored in the admin-only `ChainNetworkConfig` entity and managed through `chain-identity-admin`:

- `account_class_hash`
- `identity_registry_address`
- `recovery_controller` (optional during early testing; empty disables recovery)
- `recovery_delay_seconds` (defaults to 172800 / 48 hours)
- optional public `rpc_url` and `explorer_url`

These values are public blockchain deployment metadata, not secrets. Private RPC credentials, private keys, seed phrases, and passkey secret material must never be stored in `ChainNetworkConfig`.

## Next milestone

After compilation, tests and private-testnet deployment:

1. implement blockchain read-back / event reconciliation
2. promote verified mirrors from `DEPLOYED` to `REGISTERED`
3. implement `AgeStatus` and enforce 18+ before ordinary-user chain provisioning
4. add client-side temporary Stark signer creation for the testnet
5. implement Handle Registry
6. implement admin-issued Card Possession Attestation
7. connect the real photo challenge
8. replace `STARK_V1` with audited P-256/WebAuthn validation before the identity layer carries real value
