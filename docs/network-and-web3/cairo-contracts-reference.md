---
description: >-
  Detailed reference for the live SwapPulse Cairo contracts, responsibilities,
  trust boundaries and security invariants.
---

# Cairo Contracts Reference

SwapPulse uses Cairo contracts on Starknet for the public trust and value layer. Base44 remains the application/orchestration layer; Cairo owns the public rules that must not depend on private browser or database state.

{% hint style="info" %}
The contracts below are live on `SWAPPULSE_TESTNET`. Testnet SWPX and staking positions are test assets and do not represent production financial value.
{% endhint %}

## Contract suite

The current live V2 suite contains:

| Contract             | Responsibility                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `IdentityRegistry`   | Opaque identity registration, account binding, V2 assurance, verifier authority, revocation, replay protection and permanent V2 policy |
| `SwapPulseAccount`   | User-controlled Starknet smart account, execution, signer management and delayed recovery                                              |
| `NativeToken` / SWPX | ERC-20 compatible testnet token used by staking and bridge flows                                                                       |
| `CardNft`            | On-chain representation of approved card anchors and ownership transfers                                                               |
| `ProofOfUsership`    | Epoch-bound usership score/commitment submission                                                                                       |
| `StakingPool`        | Community-operator self-stake, delegation, unbonding, withdrawal, exit and slashing state                                              |
| `BridgeAdapter`      | Controlled bridge-out flows for approved token and card operations                                                                     |

## Live deployment pins

### IdentityRegistry

```
Address
0x3e884bce5b994cede34f6660db1c28bc37e3cbbffb539de6b5f8dd8f761ecbb

Class hash
0x3179723520ee8e08450cf31e9c4c1e9b7c6491959f97bf5ce0fba020a84d1f1
```

### SwapPulseAccount

```
Class hash
0x492c4b3e137468b6f6a805970d2c28b44f11bfd9f3cc6bd3187db5d83cb0a1c
```

### NativeToken / SWPX

```
Address
0x5ef7e120c7bc5ba44fa5cfe11801db89a8648fccf03b16570d312b17afee30d

Class hash
0x8e4030b0fa645e0ad92265a382901681d584cc50a35f07d5a27b170e7a444e
```

### CardNft

```
Address
0xb34b3a03fd9addaedcd030b4d07d1684892b02461f23463c129bd264438ab9

Class hash
0x1f921907ef4e4ef40aec02b3b0863bf789849ef1d3c5a6fab2ff675989efb87
```

### ProofOfUsership

```
Address
0x4e07106ffe0aef5e26512cfc78dbfae834e61f6bfbc488b698efa5f121a8698

Class hash
0x66cb61c761fdc756d0d8984c51c8d6e8389d7b58f7a11228cd7f7aeec81a256
```

### StakingPool

```
Address
0x71374bd9e755408c590415c44201d53213fd2b422210c826f6c3d7f2c0e9ded

Class hash
0x69d90f5e6997d905e6418622553aad7ec624f151b18d5efd4dbc999def2bbaf
```

### BridgeAdapter

```
Address
0x18278c6a97de413b1ea4b63070c09e976e183bd4d69d1f697cefa4f48a9210

Class hash
0x502a8c9953ed362307784df498bcfee81953337610e9560574915ecae9b53fc
```

## IdentityRegistry

`IdentityRegistry` is the public identity and verification authority.

It is responsible for:

* registering a non-zero opaque identity ID;
* binding the identity to an approved smart-account address;
* maintaining reverse account-to-identity mapping;
* resolving canonical identities after merge/migration;
* storing generic verification commitments and V2 assurance metadata;
* enforcing authorised verifier writes;
* consuming replay/attestation identifiers;
* recording expiry and revocation state;
* enforcing permanent V2-only verification once activated;
* emitting events for Base44/backend reconciliation.

The registry must never contain plaintext names, emails, DOBs, identity documents or raw verifier evidence.

## SwapPulseAccount

`SwapPulseAccount` is the user's execution boundary.

The account is designed so that user-controlled actions can require explicit user/device signatures while privileged application authorities stay outside the browser.

Core responsibilities include:

* Stark-compatible account execution;
* non-zero signer/public-key validation;
* account-self-authorised signer changes;
* delayed recovery controlled through the configured recovery authority;
* cancellation of pending recovery by the current account where permitted;
* account upgrade paths subject to account-level authorisation.

Current recovery delay:

```
172800 seconds
48 hours
```

The account is not a custodial wallet. Base44 does not receive the user's private key merely because it orchestrates the transaction workflow.

## NativeToken / SWPX

`NativeToken` uses OpenZeppelin Cairo ERC-20 components rather than rebuilding standard token accounting.

Its security model includes:

* standard balance and allowance behaviour;
* owner/authorised mint controls;
* capped supply rules where configured;
* explicit burn/transfer accounting;
* compatibility with staking approvals and transfer flows.

The token is currently a testnet utility asset. Production economics, rewards and emissions must not be inferred from testnet balances.

## CardNft

`CardNft` represents approved on-chain card anchors.

The application decides whether an off-chain card record is eligible for minting before the protected backend invokes the mint path. The contract itself then owns public NFT state such as token ownership and transfer/burn behaviour.

The relay allowlist permits user-signed `transfer` and `burn` calls. Privileged minting remains a protected backend/relay action.

The NFT should not contain private collection notes, purchase records, identity documents or hidden verifier evidence.

## ProofOfUsership

`ProofOfUsership` provides the public anchor for an epoch-bound usership result.

Base44 may aggregate eligible platform activity off-chain, but the chain receives only the approved public score/commitment material for the epoch.

The contract is designed to prevent arbitrary or duplicate submission of the same logical usership result and to make the public result auditable without publishing a user's private activity history.

## StakingPool

`StakingPool` implements community-operator accountability.

Although some ABI fields retain the historical word `validator`, the product calls these actors **community operators**. The current network is not a permissionless consensus validator set.

The pool supports:

* operator registration with minimum self-stake;
* commission bounds;
* self-stake increases;
* delegation;
* request/undelegation state;
* timed withdrawal;
* operator exit;
* slashable states and exit protections;
* verified-identity requirements for value-bearing actions.

Duplicate operator registration is invalid. An already-active operator must use `increase_self_stake` rather than register again.

## BridgeAdapter

`BridgeAdapter` is the controlled outbound bridge surface for approved token and card operations.

User-signed relay calls are narrowly allowlisted to:

```
bridge_out_token
bridge_out_card
```

The bridge must not become an arbitrary-call escape hatch. Contract addresses, class hashes and expected wiring are verified as part of relay readiness and network-manifest validation.

Bridge writes also fail closed when the user's V2 assurance is not current.

## Access-control model

Security-sensitive roles are intentionally separated.

Typical authority classes include:

* registry owner/admin;
* authorised identity verifier;
* user smart account;
* protected relay operations;
* contract-specific owner/minter/bridge authorities.

Do not collapse these into one browser key or one unrestricted server signer.

OpenZeppelin Cairo components are preferred for standard access control, token and security primitives wherever they fit the design.

## Public events

Events are required for application synchronisation and auditability.

Material state transitions should produce events for:

* identity registration and account binding;
* identity update/merge/recovery;
* verification and revocation;
* operator registration and staking lifecycle changes;
* token/card operations;
* usership submissions;
* bridge actions.

Base44 uses events and direct RPC reads to reconcile mirrors, but event payloads must not contain PII.

## Replay and duplicate protection

The suite uses multiple protections depending on the operation:

* identity IDs and account mappings cannot be registered twice in conflicting ways;
* V2 attestation IDs are non-zero and single-use;
* stale verification assertions remain historically auditable but cannot be replayed;
* operator registration cannot be duplicated for an already registered account;
* server-side transaction drafts are short-lived and bound to exact calldata/action intent;
* relay policy rejects transaction shapes outside the approved contract and entrypoint allowlist.

## Zero-address and invalid-state handling

Security tests cover invalid or zero values where they would create unsafe authority or identity state.

Examples include:

* zero smart-account public key rejected;
* zero identity ID rejected;
* invalid account/identity binding rejected;
* unauthorised verifier/admin calls rejected;
* invalid staking transitions rejected;
* premature withdrawals rejected;
* unexpected caller paths rejected.

## Upgrade boundaries

Upgrades are security-sensitive and should be treated as governance events, not routine UI operations.

Before any upgrade:

1. compile with the pinned toolchain;
2. run the full Foundry suite;
3. run fuzz/negative-path tests where applicable;
4. compare storage layout and interface compatibility;
5. deploy/declare the candidate class separately;
6. verify its class hash independently;
7. exercise the upgrade on a controlled environment;
8. update the canonical manifest only after verification;
9. re-run Base44 network verification and relay readiness;
10. document the change and migration path.

## Current toolchain

The live V2 baseline was tested with:

```
Scarb 2.13.1
Starknet Foundry 0.51.2
Universal Sierra Compiler 2.8.0
OpenZeppelin Contracts for Cairo 3.x family
```

Final regression result:

```
64 tests collected
63 passed
0 failed
1 runner-limited test ignored and separately verified
```

The zero-public-key constructor rejection was verified separately.

## Security test themes

Coverage includes:

* unauthorised writes;
* duplicate registration;
* invalid state changes;
* replay attempts;
* revoked identities;
* expired verification;
* invalid/zero addresses and keys;
* ownership/admin changes;
* verifier permissions;
* malicious/unexpected callers;
* token accounting/fuzz behaviour;
* staking lifecycle edge cases;
* recovery timing and permissions;
* permanent V2 expiry behaviour.

## Related pages

* Cairo and Starknet Chain Overview
* Identity Registry
* Permanent V2 Verification Policy
* Verifier Logic and Assurance
* Chain State and Reconciliation
* Community Staking
* Transaction Relay API and Policy
