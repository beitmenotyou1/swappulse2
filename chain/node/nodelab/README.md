# SWAPPULSE_NODELAB_1

`SWAPPULSE_NODELAB_1` is the first isolated Madara-based development network for the SwapPulse full/lite-node architecture.

It is deliberately separate from the live `SWAPPULSE_TESTNET` Devnet runtime. Starting or stopping this node-lab must not restart, mutate or replace the live Devnet, RPC gateway, transaction relay or lite node.

## Purpose

Stage A proved that the N95 reference host can run a post-hardening Madara full client in a guarded short-run qualification. Stage B/C now move from Sepolia hardware testing to a real SwapPulse-specific development topology:

1. local testing sequencer with a unique SwapPulse chain ID;
2. independent Madara full observer with no sequencer/deployer key;
3. matching chain ID and confirmed block hashes at a common height;
4. deploy the existing SwapPulse Cairo V2 contract suite using a fresh node-lab deployer account;
5. compare class hashes/state from both nodes;
6. point the SwapPulse lite node at both RPCs and prove multi-peer agreement.

This is **not** permissionless consensus yet. The initial node-lab has one block-producing testing sequencer and one independent observer. Existing `StakingPool` stakes are application staking, not consensus voting power.

## Chain identity

Human-readable ID:

```text
SWAPPULSE_NODELAB_1
```

Expected Starknet felt returned by `starknet_chainId`:

```text
0x5357415050554c53455f4e4f44454c41425f31
```

This intentionally differs from the live legacy SwapPulse Devnet chain ID / `SN_SEPOLIA` value.

## Madara mode choice

The node-lab sequencer initially uses Madara `--devnet` mode plus `--chain-config-override` rather than pretending the lab is already a production validator network.

This choice gives us Madara's deterministic local genesis fixture while overriding the chain ID, chain name, gateway URLs and block time for SwapPulse. Current Madara applies chain-config overrides after selecting the devnet preset. The observer uses `--full --preset devnet` with the same public chain overrides and synchronises through the sequencer's feeder gateway.

The deterministic Madara devnet bootstrap accounts are public test fixtures only. They must never be reused outside the node-lab. `prepare-nodelab.sh` separately generates fresh local sequencer and SwapPulse deployer keys; their values are never committed or printed.

## Security boundaries

- no production/live relay key;
- no live IdentityRegistry owner key;
- no verifier signing key;
- no Base44 secret;
- no user private key;
- no PII;
- no live deployment manifest reused as a node-lab manifest;
- sequencer and observer have separate databases;
- observer receives no sequencer/deployer private key;
- node-lab uses a dedicated bridge so host loopback RPC publication works;
- host RPC ports bind explicitly to `127.0.0.1` only;
- sequencer feeder/gateway port `8080` is never host-published;
- named volumes are preserved on normal stop for recovery tests;
- resource caps protect the live SwapPulse services.

## Reviewed Madara image

The initial node-lab harness defaults to the post-hardening image already qualified in Stage A:

```text
ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6
```

Do not silently substitute `:latest`. A different image requires a new immutable digest and a new qualification record.

## Ports

```text
sequencer RPC: 127.0.0.1:19950
observer RPC:  127.0.0.1:19951
```

The sequencer feeder gateway stays inside the dedicated Compose bridge on port `8080`; it is not published to the host or Internet. The bridge itself is not `internal: true`, because Docker internal networks isolate host-interface publication. Only the RPC ports are published, and both are explicitly bound to host loopback.

## Prepare

```bash
bash prepare-nodelab.sh
```

This creates:

- `.env.image` with the reviewed immutable Madara digest;
- `.env.local` mode `0600` containing fresh node-lab-only keys and public configuration.

Neither file should be committed.

Run the read-only host/image/configuration preflight before starting either node:

```bash
bash preflight-nodelab.sh
```

It verifies the immutable image, required Madara CLI flags, local secret-file permissions, ports, host headroom, explicit persistent `--base-path /var/lib/madara` wiring for both nodes, loopback port mappings, Compose parsing and live SwapPulse health without printing secret values.

## Start sequencer first

```bash
bash start-sequencer.sh
```

Before starting the observer, verify the sequencer-only state:

```bash
bash verify-sequencer.sh
```

It requires the exact node-lab chain ID, at least one confirmed block and healthy live SwapPulse services.

## Start independent observer

```bash
bash start-observer.sh
```

The observer runs `--full`, has its own data volume, and is not passed `--private-key` or `--devnet`.

## Verify

```bash
bash verify-nodelab.sh
```

The verifier requires:

- both RPCs return the exact `SWAPPULSE_NODELAB_1` felt;
- the observer reaches confirmed state;
- sequencer and observer return the same block hash at their common confirmed height;
- observer mode/key separation passes;
- live SwapPulse RPC/relay/lite services remain healthy.

Only after this passes should we deploy the Cairo V2 contracts.

## Cairo V2 deployment order

The node-lab must use the same audited source contracts, but a completely new deployment manifest and fresh node-lab authority accounts.

Madara's deterministic devnet bootstrap accounts are deliberately public fixtures. They may be used only as a one-time funding/declaration bootstrap. They must not become the IdentityRegistry owner or long-lived verifier. `bootstrap-authorities.sh` uses the first fixture without displaying its private key to declare `SwapPulseAccount`, fund two future addresses, then deploys fresh SwapPulse accounts derived from `.env.local` for the node-lab deployer/owner and verifier.

Use a clean exported `chain/` workspace from `origin/main`, install the chain tooling there and run the full pinned Cairo security suite before bootstrap/deployment. Then:

```bash
bash bootstrap-authorities.sh /path/to/clean/chain
bash deploy-v2.sh /path/to/clean/chain
```

Deployment order:

1. declare `SwapPulseAccount` through the public one-time bootstrap;
2. deploy fresh node-lab owner/deployer `SwapPulseAccount`;
3. deploy fresh node-lab verifier `SwapPulseAccount`;
4. declare the remaining audited V2 classes using the fresh deployer;
5. deploy IdentityRegistry;
6. deploy SWPX NativeToken;
7. deploy CardNft;
8. deploy ProofOfUsership;
9. deploy StakingPool;
10. deploy BridgeAdapter;
11. authorise the fresh verifier and bridge relationships;
12. generate `chain/deployments/swappulse-nodelab-1.json`;
13. verify the complete manifest first through the sequencer and then independently through the observer.

`deploy-v2.sh` deliberately does **not** invoke the irreversible `require_verification_v2()` switch. The node-lab first has to exercise a genuine V2 identity/assurance transaction through the freshly deployed contracts, then the one-way cut-over can be tested separately.

After a successful deployment, run the bounded pre-cutover exercise from the same clean, tested `chain/` workspace:

```bash
bash exercise-v2.sh /path/to/clean/chain
```

`exercise-v2.sh` keeps all generated test keys in local mode-0600 `.env.local` and verifies, before any permanent cut-over:

- a fresh SwapPulseAccount test user is deployed and bound to a random opaque identity id;
- the separately authorised verifier records a real V2 commitment/assurance;
- reusing the same attestation id fails with `ATTESTATION_REPLAY`;
- the verified user can register application stake and then use `increase_self_stake`;
- a short-lived V2 assurance expires while its audit record and locked stake remain intact;
- explicit revocation makes verification ineffective;
- a final fresh V2 assurance reactivates the identity for the later cut-over test;
- the independent observer reproduces the final identity, assurance and staking state;
- `verification_v2_required` remains false throughout this exercise.

Only after this exercise passes should the separate one-way cut-over harness invoke `require_verification_v2()`:

```bash
NODELAB_CONFIRM_V2_CUTOVER=YES bash cutover-v2.sh /path/to/clean/chain
```

The explicit confirmation environment variable exists because this transaction is deliberately irreversible for the deployed IdentityRegistry. The cut-over harness reads local authority/test secrets directly from the mode-0600 `.env.local` file rather than exporting or displaying them. It requires the successful `v2-exercise.json` evidence and a fresh two-node consistency pass immediately before the cut-over.

The cut-over is not considered complete merely because the boolean flips. The harness must also prove:

- `verification_v2_required` becomes true on the sequencer and independent observer;
- legacy `set_verification()` fails with `VERIFY_V2_REQUIRED` immediately after cut-over and again after a V2 assurance expires;
- fresh `set_verification_v2()` remains functional;
- replaying a post-cutover attestation id fails with `ATTESTATION_REPLAY`;
- the already-registered operator uses `increase_self_stake` after cut-over rather than duplicate registration, increasing the exercise stake from 110 to 115 SWPX;
- post-cutover verification expiry leaves the immutable assurance record, replay id and application stake intact;
- a final non-expiring V2 assurance restores active verification;
- calling `require_verification_v2()` again cannot disable the permanent state;
- the independent observer reproduces the final V2 flag, assurance and staking state.

If the cut-over harness exits non-zero after starting, do **not** automatically rerun it. Inspect on-chain state first because the one-way flag may already have committed.

Do not import node-lab addresses into live `ChainNetworkConfig`.

## Lite-node integration

Once the independent observer reproduces the sequencer state and V2 class-hash pins, create a node-lab lite manifest with both RPC peers:

```text
http://127.0.0.1:19950
http://127.0.0.1:19951
```

The expected trust transition is:

```text
single-peer-degraded -> multi-peer-agreement
```

This is still multi-source fault detection, not a cryptographic Starknet light-client proof system.

## Stop

```bash
bash stop-nodelab.sh
```

Normal stop preserves both node-lab volumes for restart/catch-up tests. Do not use `docker compose down -v` unless the node-lab state is intentionally being destroyed and its evidence has already been recorded.

### First-start configuration discovery, 2026-09-04

The first scaffold start exposed two harness defects before any Cairo V2 deployment: the bridge was incorrectly marked `internal: true`, preventing the expected host loopback RPC publication, and `--base-path /var/lib/madara` was missing even though the named volumes were mounted there. Current Madara defaults its database to `/tmp/madara`, so that first ephemeral run is not valid persistence/genesis evidence. The corrected harness uses a normal dedicated bridge with loopback-only host RPC mappings, explicitly sets the persistent base path for both nodes, and waits for each RPC to become ready before returning success.
