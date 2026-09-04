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

The node-lab must use the same audited source contracts, but a completely new deployment manifest and fresh node-lab account:

1. SwapPulseAccount class;
2. IdentityRegistry;
3. SWPX NativeToken;
4. CardNft;
5. ProofOfUsership;
6. StakingPool;
7. BridgeAdapter.

After deployment, generate a dedicated manifest such as:

```text
chain/deployments/swappulse-nodelab-1.json
```

Then independently query both sequencer and observer for every deployed address/class hash. Do not import node-lab addresses into live `ChainNetworkConfig`.

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
