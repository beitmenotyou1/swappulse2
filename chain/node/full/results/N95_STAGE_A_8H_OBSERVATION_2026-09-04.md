# N95 Madara Stage-A eight-hour observation — 2026-09-04

Status: **RUNTIME_PASS_WITH_IO_PRESSURE**

This is an extended observation of the guarded Madara full-node client following Starknet Sepolia on the reference Intel N95-class mini-server. It is not a production support claim and it does not make the host a SwapPulse full node.

## RPC compatibility discovery

The immutable Stage-A image is:

`ghcr.io/madara-alliance/madara@sha256:5d0b3aca9478b564caf79cd73816c2deb40370e042c0ab7f01942feabf916feb`

Observed RPC behaviour:

- bare root `http://127.0.0.1:19944` returned the expected `SN_SEPOLIA` chain ID;
- `/rpc/v0_7_1` returned the expected chain ID;
- `/rpc/v0_8_1` returned the expected chain ID;
- `/rpc/v0_9_0` returned the expected chain ID;
- `/rpc/v0_10_0` returned the expected chain ID;
- `/rpc/v0_10_2` returned JSON-RPC `-32700 Parse error`;
- root `rpc_methods` advertised user methods through v0.10.0 and did not advertise v0.10.2.

Stage-A verification and benchmark defaults are therefore pinned to v0.10.0 for this exact image.

## Eight-hour sync evidence

After about eight hours the node remained running and logs showed genuine state synchronisation at roughly block 76,324 of about 14.55 million.

The instantaneous log rate around the observation point was roughly 0.8 blocks/second, significantly slower than the initial 6–8.7 blocks/second smoke-window rate. Earlier logs also showed upstream rate limiting. No claim is made that either rate represents the hardware maximum.

## Resource snapshot

At the eight-hour observation point:

- Madara container memory: about 2.544 GiB of the 3 GiB Stage-A cap (84.8%);
- Docker CPU snapshot: about 205.6% while limited to 2 CPUs;
- network I/O: about 14.8 GB received / 278 MB transmitted;
- Docker block I/O counters: about 670 GB read / 1.2 TB written;
- persistent database volume: about 26.23 GB;
- host available memory: about 3.8 GiB;
- swap: effectively full, but no sustained swap-in/swap-out was observed in the subsequent one-second vmstat samples;
- memory PSI avg10: 0.00 for both `some` and `full`;
- I/O PSI avg10: about `some=5.34`, `full=3.36`;
- I/O PSI avg60: about `some=10.22`, `full=7.34`.

The large gap between the 26.23 GB database and the cumulative Docker block-I/O counters indicates substantial storage activity/write amplification during initial sync. Docker block-I/O counters are not identical to physical SSD NAND writes, so they must not be treated as a direct SSD-wear measurement, but the result is enough to justify limiting unattended full-sync tests on the always-on host.

## Host coexistence

The live SwapPulse Devnet, RPC gateway, transaction relay and lite node remained running. Memory pressure remained low, but sustained I/O pressure became material during the extended sync.

## Decision

The N95 passes the extended **runtime stability** observation, but this result does not yet qualify it for an unrestricted initial full sync on the shared always-on host.

Next steps:

1. verify read RPC using the image-compatible v0.10.0 route;
2. perform a controlled clean stop while preserving the database volume;
3. verify the live SwapPulse services remain healthy after stop;
4. perform a guarded restart/catch-up test from the preserved database;
5. run a short benchmark-v2 window after restart using the corrected v0.10.0 endpoint;
6. move custom SwapPulse network work to `SWAPPULSE_NODELAB_1` rather than continuing an unnecessarily long Sepolia initial sync.

Do not infer Raspberry Pi support from this result. Pi support still requires dedicated measured runs on Pi hardware with suitable SSD/NVMe storage.
