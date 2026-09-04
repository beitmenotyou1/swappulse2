# N95 Stage A v2 restart/recovery pass — 2026-09-04

Status: PASS for post-hardening Madara restart/recovery qualification on the N95 mini-server.

This run used a fresh Compose project and fresh database volume, separate from the preserved failed April-image evidence volume.

## Image

- Candidate tag used for discovery: `ghcr.io/madara-alliance/madara:v0.11.0-alpha.9`
- Immutable digest: `ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6`
- Image created: `2026-07-15T14:41:20.662089973Z`
- Architecture: amd64
- Stage-A project: `swappulse-full-lab-v2`
- Fresh state volume: `swappulse-full-lab-v2_madara-full-lab-data`
- Old forensic volume preserved untouched: `swappulse-full-lab_madara-full-lab-data`

## First guarded sync

- Guard duration: 300 seconds
- Container remained running for the full window.
- Memory PSI remained effectively zero, with a brief maximum observed `some avg10=0.18`.
- MemAvailable stayed roughly 6.5 GiB or higher.
- Final container snapshot: about 101.9 MiB / 3 GiB RAM, 169% CPU at snapshot, 23.7 MB RX / 2.16 MB TX, 44 MB read / 322 MB write, 18 PIDs.
- Sync progressed to approximately block 6248 during the guarded window and continued after it.
- Gateway rate limiting was observed but handled by retries.
- No global state-root mismatch occurred.
- Live SwapPulse RPC gateway, transaction relay and lite node remained healthy.

## RPC verification before stop

`verify-client-lab.sh` returned `VERIFY: PASS`.

Observed:

- chain ID `0x534e5f5345504f4c4941` (`SN_SEPOLIA`)
- `starknet_syncing` current block 6424
- `starknet_blockNumber` 6424
- resource limits: 3 GiB memory, 2 CPUs, 512 PIDs, restart disabled
- all live SwapPulse service health checks passed

Saved pre-stop confirmed head: `6424`.

## Controlled stop

The node was stopped while actively syncing using the post-hardening image and Docker stop grace of 330 seconds.

- Stop completed successfully in approximately 1 second.
- Container/network were removed.
- Fresh v2 database volume remained present.
- Old forensic volume remained present and separate.
- Live SwapPulse RPC gateway, transaction relay and lite node remained healthy.
- I/O PSI cooled to near zero within the following minute.

## Restart from preserved v2 database

The same `swappulse-full-lab-v2` project and fresh v2 volume were restarted under the same guard for another 300 seconds.

- Container remained running for the full window.
- MemAvailable remained around 6.4 GiB or higher.
- Memory PSI stayed effectively zero after a small startup transient.
- Final container snapshot: about 285.4 MiB / 3 GiB RAM, 1.18% CPU at the final snapshot, 29.2 MB RX / 2.24 MB TX, 100 MB read / 457 MB write, 10 PIDs.
- Sync advanced through 8271, 8294, 8528 and reached 8681 during the captured log tail.
- Since the saved pre-stop head was 6424 and the restarted node advanced to 8681, persistence and post-restart progress were demonstrated.
- No `Global state root mismatch` occurred during the guarded restart window.
- Existing live SwapPulse services remained healthy.

## Conclusion

The post-hardening Madara candidate passed the targeted Stage-A recovery qualification that the April image failed:

- fresh sync: PASS
- RPC: PASS
- resource isolation: PASS
- controlled stop while syncing: PASS
- persistent database reuse: PASS
- post-restart forward progress beyond saved head: PASS
- no state-root mismatch during recovery window: PASS
- live SwapPulse service isolation: PASS

This is a short-run hardware/recovery qualification, not a claim that the N95 can complete or sustainably serve the entire Starknet Sepolia history. The earlier long Sepolia run showed substantial storage amplification and I/O pressure, so further full-history Sepolia syncing is not recommended on this always-on host merely for qualification.

Next step: run one short container-specific benchmark on the post-hardening v2 client, then stop it and move to the isolated `SWAPPULSE_NODELAB_1` architecture work.