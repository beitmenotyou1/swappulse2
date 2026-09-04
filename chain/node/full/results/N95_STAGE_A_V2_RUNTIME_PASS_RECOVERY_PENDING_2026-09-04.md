# N95 Madara Stage A v2 runtime pass, recovery evidence pending

Date: 2026-09-04
Host: SwapPulse mini-server (Intel N95, Ubuntu Server)
Purpose: qualify a post-shutdown-hardening Madara build on a fresh volume without touching the live SwapPulse chain or the preserved April-image evidence volume.

## Candidate

- Image tag resolved locally: `ghcr.io/madara-alliance/madara:v0.11.0-alpha.9`
- Immutable digest: `sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6`
- Image creation time: 2026-07-15T14:41:20Z
- Compose project: `swappulse-full-lab-v2`
- Fresh volume: `swappulse-full-lab-v2_madara-full-lab-data`
- Old failed-volume evidence preserved separately: `swappulse-full-lab_madara-full-lab-data`
- Resource guards: 3 GiB memory, 2 CPU, 512 PIDs, 330s stop grace.

## First fresh-v2 run

The first guarded run stayed healthy for about 272 seconds with approximately 6.4 GiB MemAvailable and near-zero memory PSI. The operator interrupted it with Ctrl-C before the requested 300-second window completed. `guarded-stage-a.sh` correctly caught the interrupt and stopped only the v2 Compose project while preserving the fresh v2 volume.

Because the container was already stopped, the verification/RPC commands issued immediately afterwards correctly failed to connect. These are not Madara runtime failures.

## Restarted v2 run

The same v2 project/volume was started again after a one-minute I/O cooldown. The guarded 300-second run completed without a guard trip.

Observed during the completed run:

- container stayed running for the full guarded window;
- MemAvailable remained roughly 6.4 GiB;
- memory PSI `some avg10` stayed at 0.00 throughout the visible samples;
- final container snapshot: about 169 MiB / 3 GiB memory, ~0.49% CPU at the snapshot;
- sync advanced through confirmed/state block 4157 during the visible log tail;
- observed sync rates were commonly ~6.5 to 8 blocks/s, with upstream rate-limit retries;
- one transient L1 fee-history `request beyond head block` error was logged, but the node continued syncing;
- live SwapPulse RPC gateway, tx relay, devnet and lite node remained separate and healthy;
- final stop removed only the v2 container/network and preserved the v2 named volume.

## Current conclusion

**Fresh post-hardening runtime: PASS.**

The N95 can run the reviewed post-hardening Madara candidate under the current resource guards without destabilising the live SwapPulse stack.

**Restart/recovery: EVIDENCE PENDING.**

The operator interrupted the first run before the planned pre-stop block height was captured, and the second run's startup log lines were not retained after its later Compose `down`. Therefore this transcript does not yet conclusively prove that the completed second run resumed from the first run's persisted non-zero head rather than starting fresh.

A short follow-up restart should capture the startup `Starting chain with block` / `Database head status` lines, query a non-zero initial block, wait briefly, confirm forward progress without `Global state root mismatch`, then cleanly stop again. No long Sepolia sync is needed.
