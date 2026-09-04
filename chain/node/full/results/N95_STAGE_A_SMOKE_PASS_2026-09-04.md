# N95 Madara Stage-A smoke result — 2026-09-04

Status: **STAGE_A_RUNTIME_SMOKE_PASS**

This is a short hardware/runtime qualification result for a Madara full node following Starknet Sepolia. It is not a production hardware support claim and it does not make the host a SwapPulse full node.

## Test environment

- Host: SwapPulse reference Intel N95-class mini-server, x86_64, 4 logical CPUs, about 15 GiB RAM.
- Madara image: `ghcr.io/madara-alliance/madara@sha256:5d0b3aca9478b564caf79cd73816c2deb40370e042c0ab7f01942feabf916feb`.
- Role: Madara full node following Starknet Sepolia.
- Stage-A limits: 3 GiB RAM, 2 CPU cores, 512 PIDs, no automatic restart loop.
- Existing live SwapPulse Devnet, RPC gateway, transaction relay and lite node remained running throughout.

## Guarded smoke window

The guarded Stage-A trial ran for 180 seconds without tripping any host or live-service guard.

Observed `MemAvailable` stayed at roughly 6.7–7.0 GiB during the guarded run and Linux memory PSI `some avg10` remained `0.00`.

The live SwapPulse RPC gateway, transaction relay and lite node remained healthy.

## Genuine sync evidence

Madara opened/created its database and actively synchronised Starknet Sepolia.

Observed log progression included:

- sync at block 730 of about 14.53 million;
- sync at block 854;
- sync at block 1095;
- reported rates roughly 6–8.7 blocks/second during the observed window;
- L1→L2 message processing;
- occasional `Rate limited, retrying` messages.

Because upstream rate limiting occurred, the observed blocks/second figure is not a pure CPU/storage benchmark and must not be extrapolated as the host's maximum sync throughput.

## Resource evidence

At the end of the guarded 180-second window:

- Madara memory: about 271 MiB of the 3 GiB cap;
- PIDs: 10;
- network I/O: about 21.3 MB received / 1.37 MB transmitted;
- block I/O: about 199 MB read / 96.1 MB written.

At roughly four minutes runtime:

- Madara CPU snapshot: 155.3%, approximately 1.55 logical CPU cores;
- Madara memory: about 304 MiB;
- network I/O: about 28.3 MB received / 1.92 MB transmitted;
- block I/O: about 200 MB read / 130 MB written;
- database volume: about 78.93 MB;
- host available memory: about 6.8 GiB;
- memory PSI `some` and `full` avg10: 0.00;
- I/O PSI avg10: `some=0.88`, `full=0.14`.

`vmstat` showed no sustained swap-in/swap-out activity after the cumulative first row, with only a small isolated swap-in sample. There was no evidence of active swap thrashing caused by Madara during this smoke window.

## RPC verifier issue

The first `verify-client-lab.sh` run returned JSON-RPC `-32700 Parse error` for `starknet_chainId`, `starknet_syncing` and `starknet_blockNumber` while the Madara process remained running and its logs showed active sync.

Container resource-limit checks and all live SwapPulse health checks passed in that verifier run.

This is classified as a **local verifier/request-construction issue**, not a Madara runtime failure. Direct literal-JSON RPC verification is required before the RPC portion of Stage A is marked passed.

## Qualification status

Passed:

- process startup;
- Sepolia network selection;
- database creation/open;
- real block/state synchronisation;
- L1 activity processing;
- guarded resource use;
- coexistence with live SwapPulse services;
- no sustained memory pressure or swap thrashing during the short run.

Pending:

- direct JSON-RPC verification;
- corrected repeatable verifier;
- 10-minute benchmark schema-v2 run;
- restart/catch-up test;
- longer soak test;
- initial/full sync sizing and database growth measurement.

Stage A remains a Starknet Sepolia Madara hardware qualification only. `SWAPPULSE_NODELAB_1` and an independently synchronising SwapPulse observer are later stages.
