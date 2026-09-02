# SwapPulse V2 Live Architecture

Status: **Live on SWAPPULSE_TESTNET**

Last hardened: 2026-09-03 (Europe/London)

## 1. Architecture summary

SwapPulse uses a split-trust architecture:

- **Base44** is the application and orchestration layer. It owns private user mappings, private verifier state, UI state, transaction drafting, reconciliation and policy gating.
- **Cairo/Starknet** is the decentralised trust and smart-contract layer. It owns public identity references, verification commitments, replay protection, account binding, staking, token, card and bridge state.
- **The transaction relay** is a narrowly scoped server-side signer/provisioning boundary. Privileged keys never live in browser code.
- **The user smart account** is the user-controlled execution boundary for actions that require explicit wallet/device signing.

No plaintext personal identity information is written on-chain.

## 2. Public endpoints

- Public Starknet RPC: `https://rpc.swappulse.org/rpc`
- Privileged transaction relay: `https://relay.swappulse.org`

The relay requires a backend-only bearer token. Browser code does not contain the relay token, registry owner key or verifier key.

## 3. Live network

Chain ID:

`0x534e5f5345504f4c4941`

Identity verification mode:

`V2`

Permanent V2 requirement:

`verification_v2_required = true`

This is a one-way registry policy. V1 verification cannot be re-enabled. Individual V2 attestations can still expire or be revoked without changing the permanent global policy.

## 4. Live contracts

### IdentityRegistry

Address:

`0x3e884bce5b994cede34f6660db1c28bc37e3cbbffb539de6b5f8dd8f761ecbb`

Class hash:

`0x3179723520ee8e08450cf31e9c4c1e9b7c6491959f97bf5ce0fba020a84d1f1`

Owner:

`0x63365ad0c16e8e565b2555b2aa396f99ef7772fc389bddfb5c4d6c2dc44b3c0`

Authorised verifier:

`0x1fb17c0f4e8f198b799139ac370dc79a35019daa94e6415a54f3807b805042f`

### SwapPulseAccount class

Class hash:

`0x492c4b3e137468b6f6a805970d2c28b44f11bfd9f3cc6bd3187db5d83cb0a1c`

### NativeToken / SWPX

Address:

`0x5ef7e120c7bc5ba44fa5cfe11801db89a8648fccf03b16570d312b17afee30d`

Class hash:

`0x8e4030b0fa645e0ad92265a382901681d584cc50a35f07d5a27b170e7a444e`

### CardNft

Address:

`0xb34b3a03fd9addaedcd030b4d07d1684892b02461f23463c129bd264438ab9`

Class hash:

`0x1f921907ef4e4ef40aec02b3b0863bf789849ef1d3c5a6fab2ff675989efb87`

### ProofOfUsership

Address:

`0x4e07106ffe0aef5e26512cfc78dbfae834e61f6bfbc488b698efa5f121a8698`

Class hash:

`0x66cb61c761fdc756d0d8984c51c8d6e8389d7b58f7a11228cd7f7aeec81a256`

### StakingPool

Address:

`0x71374bd9e755408c590415c44201d53213fd2b422210c826f6c3d7f2c0e9ded`

Class hash:

`0x69d90f5e6997d905e6418622553aad7ec624f151b18d5efd4dbc999def2bbaf`

### BridgeAdapter

Address:

`0x18278c6a97de413b1ea4b63070c09e976e183bd4d69d1f697cefa4f48a9210`

Class hash:

`0x502a8c9953ed362307784df498bcfee81953337610e9560574915ecae9b53fc`

## 5. Identity privacy model

### Never stored on-chain

- name
- email address
- date of birth
- identity document data
- document images
- verifier raw evidence
- Base44 user ID
- private keys or seed phrases
- AT Protocol credentials

### Stored or referenced on-chain

- opaque `identity_id`
- smart-account address binding
- verification commitment/root
- generic verification schema hash
- verification status
- V2 verification type and level
- authorised verifier address
- verification timestamps and expiry
- revocation state
- opaque replay/attestation identifier
- recovery/account migration state
- events needed for off-chain reconciliation

## 6. V2 assurance and replay protection

A V2 verification carries generic public assurance metadata rather than private evidence.

Current value-feature policy requires:

- verification type `1`
- verification level `>= 2`
- non-zero opaque attestation/replay ID
- authorised configured verifier
- ACTIVE effective chain verification
- current private verifier assertion in Base44

`set_verification_v2` consumes the attestation ID. A consumed ID stays spent after expiry or revocation. Expiry changes effective validity, not historical audit state.

After permanent V2 cut-over, legacy V1 verification writes are rejected.

## 7. Base44 private mirror

`ChainIdentity` is a private Base44 mapping between the application user and the public chain identity.

It stores only the information needed to reconcile and operate the app, including:

- private Base44 `user_id`
- opaque public `chain_identity_id`
- smart-account address
- signer **public** key
- deployed class/registry references
- public transaction hashes
- mirrored verification state
- reconciliation timestamps and machine-readable failure codes

RLS permits a user to read only their own record. Mutations are backend/admin controlled.

`AgeStatus` and `AgeVerificationSession` keep private verifier state off-chain. They contain coarse age/policy state and opaque verifier references, never DOB or raw evidence.

## 8. Trusted verifier webhook

`age-verifier-webhook`:

- accepts POST only
- limits request body size
- authenticates the raw body using HMAC-SHA256
- uses a backend-only `SWAPPULSE_AGE_VERIFIER_WEBHOOK_SECRET`
- accepts only a fixed metadata allowlist
- rejects unknown evidence fields
- is idempotent by verifier event ID
- rejects conflicting reuse of an event ID
- ignores stale/superseded verifier subjects
- fails Base44 value eligibility closed before attempting chain synchronisation

## 9. Transaction trust boundary

### Browser/device

The browser may prepare user actions and obtains explicit user/device signatures where user approval is appropriate.

It never receives privileged registry/verifier keys or the relay bearer token.

### Base44 backend

For user-signed actions Base44:

1. authenticates the user
2. checks private eligibility
3. checks verified network pins
4. derives the authoritative smart account and identity
5. rebuilds expected calldata server-side
6. issues a short-lived signed draft token
7. validates transaction shape and resource bounds
8. verifies the user's Stark signature
9. recomputes calldata at submission time
10. rejects any signed transaction that differs from the server-side intent
11. forwards only the allowed canonical transaction to the relay

### Relay

The relay exposes only explicitly allowed Starknet methods and protected application operations. Arbitrary invoke/deploy methods and Devnet administration methods are rejected.

The production relay is currently in V2 mode and reports:

- `ok = true`
- `identity_verification_mode = v2`
- `verification_v2_required = true`
- `ecosystem_ready = true`

A repeat `/require-v2` call after permanent cut-over is read-first and idempotent. It returns no transaction hash and does not depend on the original proof identity remaining unexpired.

## 10. Staking behaviour

The current testnet describes validators in the Cairo ABI for compatibility, while the product UI calls them **community operators**. The current network is a single Starknet Devnet runtime, so operator stake currently bonds accountable service duties rather than representing a decentralised consensus validator set.

Registration requires:

- caller-owned active identity
- current verified identity
- minimum self-stake
- valid commission range
- no existing operator registration for the smart account

The UI reads operator state from `StakingPool.get_validator` through the verified public RPC. An existing ACTIVE operator is offered `increase_self_stake`, not a second `register_validator` action.

The Base44 draft backend independently rejects duplicate registration with `OPERATOR_ALREADY_REGISTERED`.

## 11. Expiry and revocation behaviour

Value-bearing actions require both sides of the trust boundary to be current:

1. private Base44 verifier assertion
2. public chain V2 attestation

If either expires or is revoked:

- the permanent identity remains
- historical verification/replay state remains auditable
- existing stake remains on-chain
- existing card/history records remain
- new staking actions are locked
- new bridge actions are locked
- permanent `verification_v2_required` stays true

When a new valid V2 assertion is issued and reconciled, value features unlock again without recreating the identity or operator.

This complete ACTIVE → EXPIRED → ACTIVE cycle has been exercised live.

## 12. Recovery

SwapPulseAccount recovery is configured with a public controller and a delay.

Current recovery delay:

`172800` seconds (48 hours)

Recovery actions remain subject to the on-chain delay. Recovery/controller keys are server-side and never placed in browser code.

## 13. Independent network verification

The canonical deployment manifest is:

`chain/deployments/swappulse-testnet.json`

The public verification flow checks, independently through the public RPC:

- chain ID
- deployed class hashes
- IdentityRegistry owner
- authorised verifier
- V2 mode
- permanent V2 flag
- NativeToken wiring
- CardNft wiring
- ProofOfUsership wiring
- StakingPool wiring
- BridgeAdapter wiring

The live manifest verification currently returns `ok = true` and `ecosystem_ready = true`.

## 14. Test evidence

Pinned toolchain:

- Scarb 2.13.1
- Starknet Foundry 0.51.2
- universal-sierra-compiler 2.8.0

Final Cairo/Foundry regression result:

- 64 tests collected
- 63 passed
- 0 failed
- 1 intentionally ignored by Foundry and separately verified
- zero-public-key constructor rejection separately passed

Coverage includes:

- unauthorised identity writes
- duplicate identity registration
- reverse mapping/account binding
- identity migration and merge invariants
- verifier authority separation and rotation
- replayed V2 attestation IDs
- V2 permanent cut-over
- expiry after permanent cut-over
- revocation
- token mint/burn/access control
- token accounting fuzz testing
- validator/operator ownership and verification
- duplicate/self-delegation controls
- unbonding and withdrawal timing
- slashing during exit
- account recovery and upgrades

Final relay policy smoke suite also passed, including:

- deployment allowlist
- invoke allowlist
- wrong-class rejection
- arbitrary invoke rejection
- Devnet administration rejection
- missing bearer-token rejection
- registration idempotency
- recovery-policy binding
- V2 assurance metadata enforcement
- V2 entrypoint enforcement
- faucet identity binding and cooldown
- irreversible cut-over confirmation enforcement
- cut-over proof enforcement
- idempotent cut-over retry after proof expiry
- readiness reflecting permanent V2

## 15. Operational invariants

Do not:

- put privileged keys in frontend code
- expose `.env.relay`
- commit private keys, bearer tokens or Cloudflare credentials
- expose raw Devnet port 5050 publicly
- manually insert user ChainIdentity rows as a normal provisioning workflow
- attempt to disable permanent V2
- treat Base44 mirrors as more authoritative than the chain

Do:

- use the public RPC for independent reads
- keep relay operations narrowly allowlisted
- use Base44 backend functions for trusted orchestration
- require explicit user signing for user-controlled transactions
- reconcile public chain state back into Base44
- fail closed on verifier expiry/revocation or pin mismatch
- keep PII and verifier evidence off-chain
- retain machine-readable audit/error codes that do not expose secrets

## 16. Current post-cutover state

The V2 identity architecture is live and hardened.

Verified live behaviour:

- permanent V2-only registry policy survives individual proof expiry
- expired private/chain verification locks staking and bridge actions
- permanent identity and existing 100 SWPX operator stake survive expiry
- fresh V2 attestation restores value actions
- existing operator is detected and offered self-stake increase rather than duplicate registration
- local and public relay `/readyz` agree with the canonical public RPC

No further irreversible chain action is required for this hardening phase.

## 17. Mini-server operational baseline

Final host-health inspection on the always-on mini-server showed:

- uptime approximately 14 days 21 hours
- load average around 1.48 / 1.13 / 1.27
- approximately 14 GiB RAM total with about 4.3 GiB `MemAvailable`
- 4 GiB swap fully occupied, but no sustained swap-in/swap-out activity during the live sample
- no kernel OOM-killer or memory-cgroup OOM events this boot
- root filesystem approximately 25% used and inode usage approximately 6%
- zero failed systemd units
- Devnet, RPC gateway and hardened transaction relay all running
- tx-relay memory approximately 61 MiB
- rpc-gateway memory approximately 24 MiB
- Devnet memory approximately 173 MiB

The full swap allocation is therefore treated as stale/cold-page occupancy rather than evidence of current memory thrashing. Do not force `swapoff` merely to make the usage counter fall, especially while available RAM is only marginally larger than the amount currently swapped.

One zombie process was observed: `auto-setup.sh`, parented by the long-running Temporal server process. A zombie consumes no meaningful CPU or RAM. Do not restart the Temporal service solely to remove this single zombie; handle it during a normal Temporal maintenance window if it persists or multiplies.

Host-health action threshold:

- investigate if `vmstat` shows sustained non-zero `si`/`so`
- investigate if `MemAvailable` remains low under ordinary load
- investigate any kernel OOM event
- investigate if zombie count grows rather than remaining isolated
- do not restart SwapPulse chain services for cosmetic swap or zombie cleanup
