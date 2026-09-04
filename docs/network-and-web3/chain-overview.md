---
description: The SwapPulse Cairo contracts, trust boundaries and development toolchain.
---

# Cairo and Starknet Chain Overview

This directory contains the Cairo/Starknet implementation for the private SwapPulse Testnet. Milestone 1 identity infrastructure is deployed; Phase 2 token, staking/operator and additional Web3 components are being hardened and remain undeployed until their build, Foundry tests and deployment checks pass.

## Scope

Milestone 1 intentionally contains only:

1. `SwapPulseAccount` : Starknet smart account using the standard Stark-curve signer for the private testnet.
2. Timelocked recovery hooks : recovery is disabled when the controller is the zero address.
3. `IdentityRegistry` : permanent opaque identity -> smart-account mapping, with a privacy-preserving verification commitment scaffold.
4. Admin-gated identity merge : duplicate identities remain in history and resolve to one canonical identity.
5. Upgrade hooks : account upgrades are self-authorised; registry upgrades are owner-authorised for the testnet.

Milestone 1 deliberately excludes token, staking, bridge, marketplace settlement, Proof-of-Usership, custodial wallet, seed phrase and user-paid gas behaviour from the deployed identity architecture. Phase 2 source code for several of those features now exists in this repository, but it is **not part of the live Milestone 1 deployment** until explicitly compiled, tested, deployed and added to the verified public manifest.

## Privacy boundary

The chain stores only public blockchain identifiers and state:

* opaque `identity_id`
* smart-account address
* identity status / canonical merge target
* creation timestamp
* recovery counter
* verification commitment root (for example a Poseidon/Merkle commitment to off-chain verified claims)
* verification schema hash, attester address, validity timestamps, revocation timestamp and version

`IdentityRecord` formalises the public identity shape without changing the legacy `get_identity()` tuple used by the existing relay/reconciler. `IdentityVerification` is deliberately separate from it. `get_verification()` exposes the direct historical verification record, while `get_effective_verification()` follows identity merges to the canonical identity.

The commitment is proof metadata, not the identity evidence itself. A future verifier can prove that a claim set matched an approved schema without publishing the underlying claim values. Commitment construction must use explicit domain separation plus a secret salt/blinding value. A plain hash of low-entropy personal data such as DOB, postcode or nationality is not private because it can be dictionary-attacked. The current testnet uses the registry owner as the bootstrap attester; this authority boundary is expected to move to an explicit attester/governance policy before production.

The following must never be written on-chain:

* email address
* Base44 user id
* date of birth / age information
* AT Protocol credentials or app passwords
* private keys
* passkey secret material
* verification photos, document scans, document numbers or raw verifier responses
* plaintext or reversibly encoded verified claims (for example legal name, DOB, address or nationality)
* private collection/binder information

Base44 stores the private user -> chain identity mapping in the owner-readable `ChainIdentity` entity. The blockchain remains authoritative.

## Toolchain target

The verified Milestone 1 toolchain is pinned to:

* Node.js: `22.x` for deployment / RPC tooling (`chain/.nvmrc`; `engine-strict=true` in the tooling package)
* Starknet.js: `10.0.2`
* Scarb / Cairo / Starknet package: `2.13.1`
* OpenZeppelin Contracts for Cairo: `3.0.0`
* OpenZeppelin interfaces: `2.1.0`
* Starknet Foundry / `snforge_std`: `0.51.2` (the version family OpenZeppelin 3.0 was tested against)
* Universal Sierra Compiler: `2.8.0` for Devnet 0.8.2 declaration compatibility
* Starknet Devnet binary: `0.8.2` for local E2E only

Do not casually mix newer `snforge` binaries with the older `snforge_std` package. We reproduced an actual cheatcode protocol incompatibility with Foundry 0.63 + `snforge_std` 0.51.2. Devnet 0.8.2 is internally locked to Universal Sierra Compiler 2.8.0 with Cairo 2.17.0; generating deployment CASM with another USC release can produce a different compiled-class hash and make `DECLARE` fail. Pinning should be revisited deliberately before a public testnet or audit.

## Build

The Base44 sandbox repository is mounted at `/app`. From the project root, run:

```bash
cd chain
SCARB_BIN=scarb SNFORGE_BIN=snforge bash scripts/test-chain.sh
```

`test-chain.sh` runs `scarb build`, the full Foundry suite, and the isolated zero-public-key constructor negative check. On 29 August 2026 the pinned toolchain completed with 26 normal tests passing, 0 failing, 1 runner-limited test ignored by the normal suite, and the ignored constructor case separately verified to revert with `INVALID_PUBLIC_KEY`.

## Deployment tooling

Deployment/RPC tooling is isolated under `chain/scripts/tooling`. Use Node 22. The npm `starknet-devnet` wrapper is intentionally **not** a dependency: its transitive `decompress` package had a critical archive-extraction advisory during this audit. Local E2E instead uses a separately installed `starknet-devnet` binary through `STARKNET_DEVNET_BIN`.

Install and audit the tooling:

```bash
cd chain
nvm use
cd scripts/tooling
npm ci
npm audit
```

The audited tooling dependency tree contains Starknet.js only and returned zero known npm vulnerabilities on 29 August 2026.

Before persistent deployment, build the Cairo contracts and compile their Sierra artifacts to CASM. The deployment script expects these four files in `chain/target/dev`:

* `swappulse_network_IdentityRegistry.contract_class.json`
* `swappulse_network_IdentityRegistry.casm.json`
* `swappulse_network_SwapPulseAccount.contract_class.json`
* `swappulse_network_SwapPulseAccount.casm.json`

Persistent deployment requires these environment values to be injected by the operator or a secret manager, never committed to the repository:

* `SWAPPULSE_RPC_URL` : private/write-capable RPC used by the deployment process (localhost HTTP is allowed for Devnet)
* `SWAPPULSE_PUBLIC_RPC_URL` : public read-only HTTPS gateway written into the Base44-facing manifest
* `SWAPPULSE_DEPLOYER_ADDRESS` : funded deployment account address
* `SWAPPULSE_DEPLOYER_PRIVATE_KEY` : deployment signer secret, process-only

Optional values:

* `SWAPPULSE_RECOVERY_CONTROLLER`
* `SWAPPULSE_RECOVERY_DELAY_SECONDS` (default `172800`)
* `SWAPPULSE_DEPLOYMENT_MANIFEST` (default `chain/deployments/swappulse-testnet.json`)
* `SWAPPULSE_EXISTING_REGISTRY_ADDRESS` to verify/reuse an existing registry instead of deploying a new one

Run:

```bash
node deploy-network.mjs
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

`deploy-network.mjs` writes a **public-only** deployment manifest. It never serialises the deployment private key, and the manifest's `rpc_url` comes from `SWAPPULSE_PUBLIC_RPC_URL` rather than the private deployment RPC when that value is supplied. A Node 22 smoke test on 29 August 2026 successfully declared both classes, deployed `IdentityRegistry`, verified the generated manifest against the node and confirmed that deployment output did not contain the private key.

For local E2E with a standalone devnet binary:

```bash
STARKNET_DEVNET_BIN=/path/to/starknet-devnet node devnet-e2e.mjs
STARKNET_DEVNET_BIN=/path/to/starknet-devnet node smoke-deploy-network.mjs
```

## Required tests before deployment

At minimum:

* account constructor rejects a zero public key
* standard account execution validates Stark signatures
* public-key rotation remains account-self-only
* recovery starts disabled and is impossible while controller is disabled
* recovery controller/delay configuration is account-self-only
* only recovery controller can propose / execute recovery
* recovery cannot execute before its delay
* current account holder can cancel a pending recovery through a self-call
* only the account itself can upgrade `SwapPulseAccount`
* only registry owner can register/change/merge/recovery-record/upgrade
* identity id `0` is rejected
* account addresses cannot be bound to two active identities
* identity ids cannot be registered twice
* merged identities remain queryable and resolve to the canonical target
* chained merges resolve transitively to the final active identity
* merged identity cannot be used again as an active source
* historical source account mapping survives a merge
* account replacement correctly clears the old reverse mapping

## Base44 provisioning flow

`chain-identity-admin` is intentionally admin-only for Milestone 1.

`prepare` accepts a **public Stark key only** and creates a `PENDING` private Base44 mirror. It never receives or stores a private key.

`record_deployment` records the deployed address and transaction hashes and advances the mirror only to `DEPLOYED`.

`REGISTERED` is reserved for a later reconciliation worker that reads `IdentityRegistry` from the testnet. Base44 must not promote itself to blockchain authority.

Required network configuration after the contracts are compiled and deployed is stored in the admin-only `ChainNetworkConfig` entity and managed through `chain-identity-admin`:

* `chain_id`
* `account_class_hash`
* `identity_registry_class_hash`
* `identity_registry_address`
* `identity_registry_owner`
* `recovery_controller` (optional during early testing; empty disables recovery)
* `recovery_delay_seconds` (defaults to 172800 / 48 hours)
* optional public `rpc_url` and `explorer_url`

The smart-account constructor accepts only `public_key`, matching OpenZeppelin's standard deploy-account validation ABI. Recovery starts disabled and is configured after deployment through signed account self-calls.

These values are public blockchain deployment metadata, not secrets. Private RPC credentials, private keys, seed phrases, and passkey secret material must never be stored in `ChainNetworkConfig`.

Saving these values creates or updates a **draft**, not a trusted network. The admin UI can import the public `schema_version: 1` deployment manifest directly; the importer rejects secret-looking fields, wrong network/schema and non-HTTPS public RPC URLs, then still saves the result only as `UNCONFIGURED`. `chain-network-verify` must independently query the HTTPS RPC, verify the chain ID, verify the `IdentityRegistry` class hash and owner at the configured address, and confirm that the configured `SwapPulseAccount` class is declared. Only that RPC verification can set `status = CONFIGURED`. Changing the RPC, chain ID, registry address/owner or either class hash invalidates the previous verification. Identity reconciliation re-checks the registry owner as well, so a later ownership change fails closed.

For the first admin-only test identity, `create-test-signer.mjs` can generate a temporary Stark signer into a local mode-`0600` file while printing only its public key. After that public key is used with Base44 **Prepare Test Identity**, `provision-test-identity.mjs` (or the host wrapper in `chain/infra`) deploys the smart account, applies recovery configuration and registers the returned opaque identity ID. The provisioning flow is idempotent: a second run submits no transactions when the chain already matches, and its smoke test verifies that neither registry-admin nor user private keys appear in output.

## Phase 2 status

Milestone 1 identity deployment and relay policy are now the frozen foundation for Phase 2. Do not redeploy or mutate the live `IdentityRegistry` merely to add token/staking features.

Phase 2 work currently includes:

* `NativeToken`, refactored onto OpenZeppelin Cairo `ERC20Component` for standard transfer, allowance, balance and metadata behaviour;
* a capped supply plus explicit owner/allowlisted mint authority;
* `StakingPool`, with verified-identity-bound operator registration, delegation, unbonding, active-vs-locked stake accounting and slashable exiting self-stake;
* Foundry tests for token supply/accounting and staking security invariants;
* Base44 wallet, draft/sign/submit and staking mirror plumbing;
* the community operator model documented in [operator guide](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/operator-guide).

The product calls staking participants **community operators**. Some Cairo and Base44 fields retain historical `validator` names for ABI compatibility. The current SwapPulse Testnet still runs on one Starknet Devnet runtime, so Phase 2 staking currently represents economic accountability for operator/service duties, **not decentralised consensus validation**.

Production token rewards are not live yet. Before any promise of token earnings, SwapPulse still needs a deterministic reward distributor, published reward/emission parameters, governance/provable-fault slashing, a multi-operator production architecture and an external security review.

Read [operator guide](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/operator-guide) for the open operator model, security requirements, staking semantics and the roadmap to permissionless network maintenance.

## Next milestone

1. compile `NativeToken` and `StakingPool` with the pinned Scarb/Cairo toolchain;
2. run the complete Starknet Foundry suite, including fuzz and negative-path tests;
3. fix every compile/test finding before class declaration;
4. add deterministic reward accounting and replay/duplicate protection;
5. extend deployment tooling and the public manifest with Phase 2 class hashes/addresses;
6. verify Phase 2 contracts independently through the public read-only RPC;
7. connect the existing Base44 wallet UI to only verified Phase 2 addresses;
8. keep all user signing self-custodial and all privileged signing server-side;
9. add operator discovery, health/service proofs and governance rules;
10. migrate from the single Devnet runtime to a genuinely decentralised appchain/rollup operator set before describing staking as consensus security;
11. replace `STARK_V1` with audited P-256/WebAuthn validation before the identity/value layer carries real economic value.
