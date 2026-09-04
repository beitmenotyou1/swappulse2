# SwapPulse Full Node / Madara Lab

This directory is the full-node engineering track for the next SwapPulse network generation.

It does **not** replace or modify the frozen live `SWAPPULSE_TESTNET` Shardlabs Devnet.

## Selected prototype client: Madara

Madara is the initial client selected for the custom SwapPulse appchain/full-node laboratory because its current public implementation supports:

- `--full`, `--sequencer` and `--devnet` modes;
- custom Devnet chain IDs;
- modern versioned Starknet JSON-RPC routes;
- full-node state synchronisation;
- feeder-gateway state synchronisation between Madara nodes;
- application-chain tooling;
- Starknet settlement/L3-oriented operation;
- automatic database migrations.

Upstream references:

- https://github.com/madara-alliance/madara
- https://github.com/madara-alliance/madara-cli

Madara is an initial architecture choice, not an irreversible dependency. We should continue compatibility testing against independent Starknet implementations such as Pathfinder and Juno where useful.

## Why the existing live chain cannot have a real follower yet

The live chain is produced by `shardlabs/starknet-devnet-rs:0.8.2` and persisted through a Devnet dump.

That runtime is appropriate for the current application testnet but it is not exposing a network protocol through which a second machine can independently synchronise and re-execute the same chain from genesis.

A second Devnet started with the same seed/dump is a copied local state, not a continuously synchronising independent full node.

Do not label such a replica a community full node.

## Stage A — full-client hardware qualification

`docker-compose.client-lab.yml` runs a Madara full node following public Starknet **Sepolia**.

This stage answers only:

> Can this hardware run the Madara full-node client reliably under a real chain workload?

It does not answer:

> Can this machine independently follow the SwapPulse chain?

That requires Stage B/C.

### Prepare

Copy the example environment file:

```bash
cd chain/node/full
cp .env.example .env
```

Before starting, replace `MADARA_IMAGE` with a verified immutable image digest. Do not use `latest` for a benchmark or support claim.

Set `MADARA_L1_ENDPOINT` to an Ethereum Sepolia endpoint you control. Treat provider keys embedded in that URL as private operational configuration. Do not commit `.env`.

### Start

```bash
docker compose --env-file .env -f docker-compose.client-lab.yml up -d
```

The RPC is bound to host loopback only:

```text
127.0.0.1:19944
```

Check the client:

```bash
curl -fsS http://127.0.0.1:19944/rpc/v0_10_0 \
  -H 'content-type: application/json' \
  --data-binary '{"jsonrpc":"2.0","id":1,"method":"starknet_syncing","params":[]}' \
  | python3 -m json.tool
```

The immutable Stage-A image used in the 2026-09-04 N95 qualification exposes the bare RPC root plus versioned routes through v0.10.0. Its `/rpc/v0_10_2` route returns JSON-RPC `-32700 Parse error`, despite newer Madara documentation advertising v0.10.2. Stage-A tooling is pinned to the behaviour of the exact image under test rather than assuming current-main routing.

### Stop

```bash
docker compose --env-file .env -f docker-compose.client-lab.yml down
```

Do not delete the volume until benchmark data/state-recovery tests are complete.

## Stage B — custom SwapPulse Madara appchain laboratory

This is where full-node work becomes relevant to SwapPulse itself.

The new lab network must use a **new chain ID**. It must not reuse the frozen live chain ID.

Proposed temporary development label:

```text
SWAPPULSE_NODELAB_1
```

The exact felt/chain ID should be generated and pinned in the deterministic genesis manifest before the first shared run.

Stage-B deliverables:

1. Generate a Madara appchain configuration with a unique chain ID.
2. Pin the exact Madara source/image version and checksums.
3. Define deterministic genesis accounts/config without production secrets.
4. Start one sequencer in an isolated development environment.
5. Deploy the existing audited SwapPulse Cairo V2 classes/contracts into that network.
6. Generate a new deployment manifest for the node-lab chain.
7. Run the full Cairo/security regression suite against the same source contracts.
8. Verify V2 permanent-mode behaviour on the lab network separately.
9. Keep the existing live Devnet untouched.

The node-lab deployment must use new test keys. Never copy `.env.relay`, registry private keys, verifier private keys or user keys from the live testnet into the lab.

## Stage C — genuine independent full observer

The critical test is a second independently controlled Madara full node that starts with no sequencer private key and synchronises the same node-lab chain.

Success requires that it can:

- synchronise blocks/state from the network source;
- independently compute/verify the expected state commitments;
- return the same chain ID;
- return the same block hashes at agreed heights;
- return the same deployed contract class hashes;
- survive restart and catch up;
- reject/flag corrupt or conflicting state;
- serve local read RPC without Base44;
- operate without the relay, registry-owner or verifier private keys.

Only after this passes may the project describe the node-lab package as a genuine SwapPulse full observer.

## Stage D — second operator / failure test

Run the second full node on a different physical machine/network/operator.

Test:

- sequencer restart;
- full-node restart;
- 1 hour offline/catch-up;
- 24 hour offline/catch-up;
- network partition;
- low-disk behaviour;
- unclean power loss on Pi-class hardware;
- version mismatch;
- corrupted local database recovery;
- RPC disagreement detection in the lite node.

The lite node should then be configured with both independent full-node RPCs. Its trust mode should move from `single-peer-degraded` to `multi-peer-agreement` when they agree.

## Stage E — consensus / validator design

Do not conflate Madara `--sequencer` with the final community-validator architecture.

Starknet's P2P specification separates sync, mempool and consensus networks, and the final SwapPulse design must explicitly choose how block proposal, consensus/finality, settlement, staking and validator admission work.

The existing `StakingPool` does not automatically become consensus staking.

## Raspberry Pi requirement

The target is ambitious but measurable:

- Pi 4 8GB + USB3 SSD: candidate pruned/full-observer target;
- Pi 5 8GB/16GB + NVMe: preferred low-cost full-observer target;
- N95 mini-PC 16GB: reference low-cost x86 host.

Madara's historical CLI helper documentation cites 4 CPU cores, 8GB RAM and 50GB free disk as a generic starting point, but SwapPulse will publish its own measured requirements rather than treating that as a guarantee.

A Pi is supported only after the benchmark/soak suite passes.

## Security

The full node must never require:

- Base44 login/session credentials;
- the SwapPulse transaction-relay token;
- registry/verifier private keys;
- user private keys;
- private identity evidence;
- AT Protocol app passwords;
- Pokémon API secrets.

A full observer must decide chain validity from public protocol/network state, not Base44.

## Do not publish the lab RPC by default

The client-lab Compose binds RPC to loopback. Do not put it behind Cloudflare/public DNS merely because it works locally.

Public node exposure needs its own method allowlist, rate limiting, resource limits, monitoring and abuse review.
