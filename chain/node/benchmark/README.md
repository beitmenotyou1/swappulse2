# SwapPulse Node Benchmark Harness

This harness records host resource usage and node/RPC responsiveness without requiring any npm dependency.

It is intended for:

- Raspberry Pi 4 8GB + SSD;
- Raspberry Pi 5 8GB/16GB + NVMe;
- the current Intel N95 mini-PC;
- future community node hardware profiles.

## Lite-node benchmark

Start the lite node first, then run:

```bash
cd chain/node/benchmark
NODE_ROLE=lite \
NODE_ENDPOINT=http://127.0.0.1:18100 \
CONTAINER_NAME=swappulse-lite-node-swappulse-lite-1 \
DURATION_SECONDS=3600 \
OUTPUT=lite-1h.json \
node benchmark.mjs
```

`CONTAINER_NAME` is optional, but strongly recommended for Docker-hosted nodes. Benchmark schema v2 records the actual node container's CPU, RAM, network I/O and block I/O in addition to host-level measurements.

For a multi-day soak test use a larger duration, for example 259200 seconds for three days.

## Madara full-client benchmark

After the client lab is running:

```bash
cd chain/node/benchmark
NODE_ROLE=full \
NODE_ENDPOINT=http://127.0.0.1:19944/rpc/v0_10_2/ \
CONTAINER_NAME=swappulse-full-lab-madara-full-lab-1 \
DURATION_SECONDS=3600 \
OUTPUT=madara-full-1h.json \
node benchmark.mjs
```

## Measurements

Each sample includes:

- host load averages;
- host CPU busy percentage between samples;
- available RAM;
- total/free/cached swap where Linux exposes it;
- CPU temperature where a sensible thermal sysfs value is available;
- Linux PSI CPU/memory/I/O pressure where supported;
- disk total/free capacity for `DISK_PATH`;
- RPC/status latency;
- node role-specific health/sync information;
- optional Docker container CPU, RAM, network I/O, block I/O and PID count.

The final report includes availability, average/peak host CPU, minimum available RAM, minimum swap-free, maximum valid temperature, average/maximum RPC latency, Docker container averages/peaks and I/O deltas, plus peak PSI memory/I/O pressure.

## What this first harness does not yet measure

Benchmark schema v2 now adds Docker container and Linux PSI measurements. It still does not directly calculate:

- disk write amplification or IOPS;
- per-interval container network throughput rates (the report stores cumulative deltas across the run);
- Madara database growth rate by database directory;
- blocks/sec catch-up rate from logs;
- power draw.

Those remain planned for the full-node qualification phase.

## Support rule

Do not call a device supported merely because the report exists or because availability is high over a short test.

Before a full-node hardware profile becomes supported it must also pass:

- initial sync;
- restart recovery;
- catch-up after realistic downtime;
- unclean shutdown test;
- low-disk behaviour;
- multi-day soak;
- state/hash comparison against an independent node.

The benchmark JSON should be kept with the node release/test evidence so support claims are reproducible.

The first reference result is documented in `results/N95_LITE_10M_2026-09-04.md`. It is a short-run pass, not a production support claim.
