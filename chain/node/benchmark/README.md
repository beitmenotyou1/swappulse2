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
DURATION_SECONDS=3600 \
OUTPUT=lite-1h.json \
node benchmark.mjs
```

For a multi-day soak test use a larger duration, for example 259200 seconds for three days.

## Madara full-client benchmark

After the client lab is running:

```bash
cd chain/node/benchmark
NODE_ROLE=full \
NODE_ENDPOINT=http://127.0.0.1:19944/rpc/v0_10_2/ \
DURATION_SECONDS=3600 \
OUTPUT=madara-full-1h.json \
node benchmark.mjs
```

## Measurements

Each sample includes:

- host load averages;
- CPU busy percentage between samples;
- available RAM;
- total/free/cached swap where Linux exposes it;
- CPU temperature where a common thermal sysfs path exists;
- disk total/free capacity for `DISK_PATH`;
- RPC/status latency;
- node role-specific health/sync information.

The final report includes availability, average/peak CPU, minimum available RAM, minimum swap-free, maximum temperature and average/maximum RPC latency.

## What this first harness does not yet measure

The first version does not yet calculate:

- disk write amplification/I/O operations per second;
- network bytes/sec by process/container;
- Madara database growth rate directly;
- blocks/sec catch-up rate from logs;
- power draw;
- kernel PSI memory/CPU/I/O pressure;
- Docker container-specific RSS/CPU independent of the host.

Those are planned for the next benchmark iteration after the first live measurements tell us which signals are most useful.

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
