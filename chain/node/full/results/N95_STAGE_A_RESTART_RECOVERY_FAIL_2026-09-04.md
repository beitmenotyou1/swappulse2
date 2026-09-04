# N95 Madara Stage-A restart/recovery result — 2026-09-04

Status: **STAGE_A_RESTART_RECOVERY_FAIL_FOR_PINNED_APRIL_IMAGE**

This result applies to the immutable Madara image used for the first N95 Stage-A qualification:

`ghcr.io/madara-alliance/madara@sha256:5d0b3aca9478b564caf79cd73816c2deb40370e042c0ab7f01942feabf916feb`

The image was created on 2026-04-27.

This is a client/database restart failure, not an N95 hardware failure and not a failure of the live SwapPulse Devnet, RPC gateway, transaction relay or lite node.

## Pre-restart state

Before shutdown the node had successfully synchronised Starknet Sepolia to approximately block 77,524 and exposed working Starknet JSON-RPC v0.10.0.

The database volume had grown to about 26.23 GiB. The Madara container was then stopped through the isolated Compose project with its named data volume preserved. Existing live SwapPulse services remained healthy.

## Restart evidence

On restart Madara successfully reopened the existing database rather than creating a new one:

- `Opening database at: /var/lib/madara`
- `Starting chain with block: confirmed block: #77540`
- `Database head status: latest_full_block=77540, starting sync from block #77541`

This proves that the persisted chain head survived shutdown and the node did not restart from genesis.

## Failure

Shortly after resuming the sync pipeline, Madara downloaded/applied the next block range and exited with:

```text
Error: Applying global trie step for block_range=77541..77542

Caused by:
    Global state root mismatch: expected 0x4e7cecf8d1c62f01363b18e077613d79d3c1397c7aec1b0022fc9bea72a93bd, got 0x709df6c3512e121ca2e1de9de28807aac9abacd3d79432ba1c1377f65f525cf
```

The Stage-A guard detected the process exit and stopped only the isolated Madara project. The live SwapPulse RPC gateway, transaction relay and lite node remained healthy.

The preserved Madara volume was approximately 26.49 GiB after the failed restart and must be treated as forensic state. Do not reopen it with the same image, delete it, migrate it in place or reuse it for `SWAPPULSE_NODELAB_1`.

## Upstream correlation

Current Madara upstream contains a graceful-shutdown hardening fix merged on 2026-06-10 (PR #1118) after this pinned image was built. The upstream audit found a real shutdown hazard in which global-trie work offloaded to a detached Rayon worker could continue after sync cancellation while the main process proceeded toward the final database flush and process teardown. The merged fix now waits for outstanding global Rayon tasks before the final flush and backend shutdown.

This is strongly consistent with the observed restart-time trie inconsistency, but it is not sufficient to claim the shutdown bug is definitively the root cause of this exact database mismatch.

## Qualification consequence

Passed for the April image:

- startup;
- Sepolia full-node sync;
- resource guard operation;
- v0.10.0 user RPC;
- coexistence with live SwapPulse services;
- clean container stop with volume preservation;
- database head reopening after restart.

Failed for the April image:

- safe restart/catch-up from the persisted database;
- global-trie consistency after restart.

Therefore the April image is **not acceptable** as the basis for `SWAPPULSE_NODELAB_1` or a production/community full-node package.

## Next action

Freeze the old 26.49 GiB volume for forensics and perform a new bounded Stage-A restart test using a fresh volume and a newer immutable Madara image that includes the June shutdown hardening. Verify the image revision before use. Do not migrate the old database in place.
