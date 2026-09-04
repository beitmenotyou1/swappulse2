# SwapPulse community node development

This directory contains the decentralisation work that follows the frozen V2 application/contract baseline.

The current live `SWAPPULSE_TESTNET` is still a single Shardlabs Starknet Devnet runtime. Nothing in this directory changes that fact, and none of these packages should be described as decentralised consensus until the migration phases in `docs/NODE_ARCHITECTURE.md` are actually completed.

## Current packages

```text
chain/node/
├── config/
│   └── swappulse-testnet.json     public frozen V2 network pins
├── lite/
│   ├── server.mjs                 working multi-RPC lite-node prototype
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── README.md
├── full/
│   └── ...                        Madara full-node/appchain qualification lab
├── nodelab/
│   └── ...                        SWAPPULSE_NODELAB_1 sequencer/observer lab
└── benchmark/
    └── ...                        hardware/soak measurement tooling
```

## Architecture decision

For the **next SwapPulse appchain/full-node laboratory**, the initial client choice is **Madara**.

Reasons:

- it is a Starknet client written in Rust;
- it supports full-node, sequencer and devnet operating modes;
- it supports custom chain IDs;
- it supports current versioned Starknet JSON-RPC routes;
- it supports feeder-gateway state synchronisation between Madara nodes;
- its appchain tooling is explicitly aimed at custom Starknet-based chains;
- it has L3 support when settlement on Starknet is selected.

This is a laboratory/architecture decision, not an irreversible production commitment. Pathfinder and Juno remain useful independent reference implementations for public Starknet and interoperability testing.

## Why the live Devnet is not being converted in place

The current Shardlabs Devnet persists its own dump and produces blocks locally. It does not expose the peer/state-sync network needed to turn a second machine into an independently synchronising full node.

Starting a second Devnet with the same seed would create another deterministic local network, not a live follower of the existing chain.

Therefore the correct migration is:

1. keep the frozen V2 live baseline operating unchanged;
2. build and benchmark the lite node now;
3. run a Madara client/full-node lab independently;
4. build a new custom SwapPulse appchain test network with deterministic genesis;
5. deploy the same audited Cairo V2 contract suite into that new network;
6. prove a separate full node can sync and independently reproduce state;
7. run compatibility/regression tests against both networks;
8. only after an explicit migration review consider moving product traffic.

## Node roles

### Lite

Low-resource local verification/read layer. The v0.1 implementation works now and honestly reports degraded trust when only one upstream RPC exists.

### Full observer

A future Madara follower that independently stores and verifies the new SwapPulse appchain state. It has no privileged browser/API keys and does not automatically produce blocks.

### Sequencer/validator candidate

Future block-production/consensus role. This is not enabled merely by running the full-node package.

### Indexer

Separate history/search service for a richer Chain Explorer. Archive/indexing storage is intentionally not imposed on every full node.

## Non-negotiable security boundaries

Community node packages must never contain or require:

- `SWAPPULSE_TX_RELAY_TOKEN`;
- registry-owner private keys;
- identity-verifier private keys;
- Base44 API/provider secrets;
- user smart-account private keys;
- private age-verification evidence;
- PDS admin credentials.

Only public chain state, public manifests and node/operator public metadata belong in node synchronisation.

## Network naming

The frozen live network remains:

```text
SWAPPULSE_TESTNET
```

The Madara migration lab/new network must use a **different chain ID**. Reusing the current chain ID for an independent incompatible chain would create replay/confusion risk.

The first isolated multi-node development network is now pinned as:

```text
SWAPPULSE_NODELAB_1
felt: 0x5357415050554c53455f4e4f44454c41425f31
```

It is a disposable development-network identity, not the final production/mainnet chain ID. It must never be confused with or substituted for the frozen live `SWAPPULSE_TESTNET`.

## Development rule

Every node milestone must answer two separate questions:

1. **Does the process run?**
2. **What security property does it actually verify?**

A process starting successfully is never enough to claim full-node, validator or decentralised-network support.
