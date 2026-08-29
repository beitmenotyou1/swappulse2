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

The verified Milestone 1 toolchain is pinned to:

- Node.js: `22.x` for deployment / RPC tooling (`chain/.nvmrc`; `engine-strict=true` in the tooling package)
- Starknet.js: `10.0.2`
- Scarb / Cairo / Starknet package: `2.13.1`
- OpenZeppelin Contracts for Cairo: `3.0.0`
- OpenZeppelin interfaces: `2.1.0`
- Starknet Foundry / `snforge_std`: `0.51.2` (the version family OpenZeppelin 3.0 was tested against)
- Universal Sierra Compiler: `2.10.0`
- Starknet Devnet binary: `0.8.2` for local E2E only

Do not casually mix newer `snforge` binaries with the older `snforge_std` package. We reproduced an actual cheatcode protocol incompatibility with Foundry 0.63 + `snforge_std` 0.51.2. Pinning should be revisited deliberately before a public testnet or audit.

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

- `swappulse_network_IdentityRegistry.contract_class.json`
- `swappulse_network_IdentityRegistry.casm.json`
- `swappulse_network_SwapPulseAccount.contract_class.json`
- `swappulse_network_SwapPulseAccount.casm.json`

Persistent deployment requires these environment values to be injected by the operator or a secret manager, never committed to the repository:

- `SWAPPULSE_RPC_URL` — persistent HTTPS Starknet JSON-RPC endpoint
- `SWAPPULSE_DEPLOYER_ADDRESS` — funded deployment account address
- `SWAPPULSE_DEPLOYER_PRIVATE_KEY` — deployment signer secret, process-only

Optional values:

- `SWAPPULSE_RECOVERY_CONTROLLER`
- `SWAPPULSE_RECOVERY_DELAY_SECONDS` (default `172800`)
- `SWAPPULSE_DEPLOYMENT_MANIFEST` (default `chain/deployments/swappulse-testnet.json`)
- `SWAPPULSE_EXISTING_REGISTRY_ADDRESS` to verify/reuse an existing registry instead of deploying a new one

Run:

```bash
node deploy-network.mjs
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

`deploy-network.mjs` writes a **public-only** deployment manifest. It never serialises the deployment private key. A Node 22 smoke test on 29 August 2026 successfully declared both classes, deployed `IdentityRegistry`, verified the generated manifest against the node and confirmed that deployment output did not contain the private key.

For local E2E with a standalone devnet binary:

```bash
STARKNET_DEVNET_BIN=/path/to/starknet-devnet node devnet-e2e.mjs
STARKNET_DEVNET_BIN=/path/to/starknet-devnet node smoke-deploy-network.mjs
```

## Required tests before deployment

At minimum:

- account constructor rejects a zero public key
- standard account execution validates Stark signatures
- public-key rotation remains account-self-only
- recovery starts disabled and is impossible while controller is disabled
- recovery controller/delay configuration is account-self-only
- only recovery controller can propose / execute recovery
- recovery cannot execute before its delay
- current account holder can cancel a pending recovery through a self-call
- only the account itself can upgrade `SwapPulseAccount`
- only registry owner can register/change/merge/recovery-record/upgrade
- identity id `0` is rejected
- account addresses cannot be bound to two active identities
- identity ids cannot be registered twice
- merged identities remain queryable and resolve to the canonical target
- chained merges resolve transitively to the final active identity
- merged identity cannot be used again as an active source
- historical source account mapping survives a merge
- account replacement correctly clears the old reverse mapping

## Base44 provisioning flow

`chain-identity-admin` is intentionally admin-only for Milestone 1.

`prepare` accepts a **public Stark key only** and creates a `PENDING` private Base44 mirror. It never receives or stores a private key.

`record_deployment` records the deployed address and transaction hashes and advances the mirror only to `DEPLOYED`.

`REGISTERED` is reserved for a later reconciliation worker that reads `IdentityRegistry` from the testnet. Base44 must not promote itself to blockchain authority.

Required network configuration after the contracts are compiled and deployed is stored in the admin-only `ChainNetworkConfig` entity and managed through `chain-identity-admin`:

- `chain_id`
- `account_class_hash`
- `identity_registry_class_hash`
- `identity_registry_address`
- `identity_registry_owner`
- `recovery_controller` (optional during early testing; empty disables recovery)
- `recovery_delay_seconds` (defaults to 172800 / 48 hours)
- optional public `rpc_url` and `explorer_url`

The smart-account constructor accepts only `public_key`, matching OpenZeppelin's standard deploy-account validation ABI. Recovery starts disabled and is configured after deployment through signed account self-calls.

These values are public blockchain deployment metadata, not secrets. Private RPC credentials, private keys, seed phrases, and passkey secret material must never be stored in `ChainNetworkConfig`.

Saving these values creates or updates a **draft**, not a trusted network. `chain-network-verify` must independently query the HTTPS RPC, verify the chain ID, verify the `IdentityRegistry` class hash and owner at the configured address, and confirm that the configured `SwapPulseAccount` class is declared. Only that RPC verification can set `status = CONFIGURED`. Changing the RPC, chain ID, registry address/owner or either class hash invalidates the previous verification. Identity reconciliation re-checks the registry owner as well, so a later ownership change fails closed.

## Next milestone

The Base44 read-back reconciler is already implemented. It pins chain ID, IdentityRegistry address/class hash and SwapPulseAccount class hash, then verifies registry state and reverse identity mapping before promoting a mirror to `REGISTERED` / `RECOVERED` / `MERGED`.

Next:

1. declare the compiled classes and deploy `IdentityRegistry` on an isolated devnet, then on the persistent SwapPulse Testnet
2. configure the real chain ID, class hashes, registry address and public RPC URL
3. deploy the first test smart account, configure recovery through signed self-calls and register its opaque identity
4. prove Base44 reconciliation end-to-end
5. implement `AgeStatus` and enforce 18+ before ordinary-user chain provisioning
6. add client-side temporary Stark signer creation for the testnet
7. implement Handle Registry
8. implement admin-issued Card Possession Attestation
9. connect the real photo challenge
10. replace `STARK_V1` with audited P-256/WebAuthn validation before the identity layer carries real value
