# N95 Madara Stage-A final benchmark pass — 2026-09-04

## Scope

This is a short-run hardware qualification of the post-hardening Madara client on the SwapPulse reference N95 mini-server. It is **not** a claim that this host has completed a full Starknet Sepolia historical sync or that the hardware is production-certified for indefinite full-history operation.

Image under test:

- tag used for discovery: `ghcr.io/madara-alliance/madara:v0.11.0-alpha.9`
- immutable digest: `sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6`
- RPC used for cross-version qualification tooling: bare local user-RPC root `http://127.0.0.1:19944`

Resource guards:

- memory: 3 GiB
- CPU: 2 logical CPUs
- PIDs: 512
- restart policy: none
- host RPC exposure: loopback only

## Final five-minute benchmark

The benchmark collected 60 samples at five-second intervals while the node was actively synchronising Sepolia.

- availability: **100%**
- failed samples: **0**
- host CPU busy average: **26.47%**
- host CPU busy maximum: **71.6%**
- minimum host MemAvailable: **5,900,750,848 bytes**
- minimum swap free reported: **0 bytes**
- CPU temperature: unavailable from the current sensor path
- RPC latency average: **34.52 ms**
- RPC latency maximum: **596.8 ms**
- Madara container CPU average: **37.84%**
- Madara container CPU maximum: **200.8%**
- Madara container memory average: **848,623,042.67 bytes** (~809 MiB)
- Madara container memory maximum: **1,005,164,954 bytes** (~959 MiB)
- container network receive delta: **68.7 MB**
- container network transmit delta: **2.64 MB**
- container block read delta: **135.6 MB**
- container block write delta: **684 MB**
- memory PSI `some avg10` maximum: **0.29**
- I/O PSI `some avg10` maximum: **9.07**

The final live snapshot after the benchmark showed approximately 1.097 GiB container memory and the node still operating under the configured 3 GiB / 2 CPU limits.

## Sync progress and recovery context

Before the final benchmark the recovered v2 database was already operating beyond the prior restart checkpoint. During the final qualification run:

- observed starting sync marker: `8681`
- pre-benchmark RPC current block observed: `10722`
- final verification current block observed: `15231`
- final `starknet_blockNumber` observed: `15235`
- `starknet_chainId`: `SN_SEPOLIA`
- RPC verifier: `PASS`

The node had previously passed a controlled stop/restart test using the same post-hardening image and fresh v2 database, advancing from pre-stop head `6424` to at least `8681` after restart with no global state-root mismatch.

## Isolation result

Throughout the benchmark and final stop:

- live SwapPulse RPC gateway remained healthy
- live SwapPulse transaction relay remained healthy
- live SwapPulse lite node remained healthy
- the live SwapPulse Devnet was not restarted or modified
- the Stage-A Madara container was stopped after the benchmark with its volume preserved

## Interpretation

**Stage-A short-run N95 qualification: PASS.**

The N95 has enough CPU and memory headroom for the next SwapPulse node-lab phase. Storage write amplification and I/O pressure remain the dominant resource concern during historical full-node sync, so no further long Sepolia catch-up run is justified on the always-on reference host.

This result authorises progression to the isolated `SWAPPULSE_NODELAB_1` development network. It does not authorise a production full-history support claim.