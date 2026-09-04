# N95 Madara Stage-A RPC and clean-stop result — 2026-09-04

Status: **PASS**

This result closes the remaining short-run RPC and graceful-stop checks for the pinned Madara Stage-A Sepolia hardware qualification. It does not make the host a SwapPulse full node and it is not yet a long-term production hardware support claim.

## RPC verification

Using the pinned Stage-A Madara image and the v0.10.0 user RPC route, the node returned valid JSON-RPC results for:

- `starknet_chainId` → `0x534e5f5345504f4c4941` (`SN_SEPOLIA`);
- `starknet_syncing` → active sync object;
- `starknet_blockNumber` → `77524` at the verification point;
- `starknet_specVersion` → `0.10.0`.

The active sync response reported:

- starting block: 0;
- current block: 77524;
- highest observed block: about 14.55 million.

Madara logs independently showed state progress around blocks 77516–77528 and successful RPC calls to the v0.10.0 methods.

The exact pinned image exposes the bare root plus versioned routes through v0.10.0. Its `/rpc/v0_10_2` route returns JSON-RPC `-32700 Parse error`, so Stage-A tooling is pinned to v0.10.0 for this image.

## Pre-stop resource snapshot

Immediately before the controlled stop:

- Madara CPU snapshot: about 164.7%, roughly 1.65 logical CPU cores;
- Madara memory: about 2.56 GiB of the 3 GiB cap;
- network I/O: about 15.2 GB received / 285 MB transmitted;
- Docker block I/O counters: about 705 GB read / 1.24 TB written;
- PIDs: 10.

The large block-I/O counters are not direct NAND wear measurements, but they demonstrate substantial storage activity/write amplification during initial sync and justify avoiding an unattended full Sepolia sync on the always-on reference host.

## Clean stop

`stop-client-lab.sh` stopped only the isolated `swappulse-full-lab` Compose project.

Verified after stop:

- Madara container removed cleanly;
- host RPC port 19944 released;
- named database volume `swappulse-full-lab_madara-full-lab-data` preserved;
- live SwapPulse RPC gateway remained healthy;
- live transaction relay remained healthy;
- live lite node remained healthy;
- live Devnet remained running.

No live SwapPulse chain service was restarted or reconfigured.

## Host after stop

Immediately after stop:

- host available memory recovered to about 6.3 GiB;
- swap remained allocated but one-second `vmstat` samples showed no sustained swap-in/swap-out activity;
- I/O pressure still reflected the recent heavy workload in rolling PSI averages, while subsequent one-second I/O activity fell sharply.

This is consistent with residual rolling pressure metrics after a storage-heavy workload rather than a continuing Madara process load.

## Next test

Restart the same pinned image using the preserved database volume and verify that:

1. the database opens at the prior persisted state rather than starting from genesis;
2. `starknet_blockNumber` is near or above the prior 77524 checkpoint;
3. synchronisation resumes and advances;
4. the live SwapPulse services remain healthy;
5. a short benchmark captures actual container CPU, memory, network and block-I/O deltas plus host PSI;
6. Madara stops cleanly again with the volume preserved.

Only after restart/catch-up and a longer controlled soak should the N95 Stage-A hardware qualification be considered complete.
