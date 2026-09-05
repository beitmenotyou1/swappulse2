---
description: Run and verify the experimental SwapPulse Madara full-observer node safely.
---

# Full node and full observer

A SwapPulse **full observer** maintains its own chain database, follows the network, verifies the state it receives and serves Starknet read RPC from locally verified data. It is the node role for operators who want stronger assurance than forwarding requests to somebody else's RPC.

{% hint style="warning" %}
Full-observer support is currently an engineering and node-lab capability. The live `SWAPPULSE_TESTNET` still uses the separate Shardlabs Starknet Devnet runtime. The tested `SWAPPULSE_NODELAB_1` observer has one sequencer and does not provide permissionless consensus or independent-operator decentralisation.
{% endhint %}

## What this node does

The current Madara observer can:

* synchronise confirmed blocks and state from the node-lab sequencer;
* maintain its own persistent database;
* verify the configured chain ID and reproduce block hashes at a common confirmed height;
* expose a local Starknet JSON-RPC interface for verification and application reads;
* reproduce deployed V2 contract class hashes and application state;
* restart from its preserved volume and catch up;
* operate without Base44, the transaction relay or privileged application keys.

It does **not**:

* produce blocks merely because it runs in full mode;
* participate in permissionless consensus or finality;
* become a validator through the current `StakingPool`;
* hold user keys, identity evidence or Base44 private records;
* replace an archive indexer for rich historical search;
* make its raw RPC safe for public exposure.

## Node roles compared

| Role              | Stores and verifies chain state | Produces blocks          | Typical use                                          |
| ----------------- | ------------------------------- | ------------------------ | ---------------------------------------------------- |
| Full observer     | Yes                             | No                       | Independent reads, state verification and resilience |
| Testing sequencer | Yes                             | Yes, in the isolated lab | Orders and produces node-lab blocks                  |
| Archive/indexer   | Yes, plus extended indexes      | No                       | Explorer history, search and analytics               |
| Lite node         | No complete state database      | No                       | Low-resource checks across one or more RPC peers     |

## Current tested implementations

### Madara Stage A

`chain/node/full` follows public Starknet Sepolia to qualify the client and hardware. It answers whether a host can run Madara under a real synchronisation workload. It does not make the host a SwapPulse full node.

The current guarded profile uses:

* loopback RPC `127.0.0.1:19944`;
* an immutable Madara image digest;
* a persistent Docker volume;
* a 3 GiB memory limit, two logical CPUs and a 512 PID limit;
* no automatic restart during qualification.

The reference Intel N95 mini-server passed the short restart and recovery test with Madara `v0.11.0-alpha.9`, pinned to digest `sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6`. Extended Sepolia sync also revealed substantial storage I/O and write amplification, so this is not a production full-history support claim.

### SWAPPULSE\_NODELAB\_1 full observer

`chain/node/nodelab` runs the first SwapPulse-specific two-node topology:

| Component         | Host endpoint                   | Purpose                                                                 |
| ----------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Testing sequencer | `127.0.0.1:19950`               | Produces blocks for the isolated development network                    |
| Full observer     | `127.0.0.1:19951`               | Synchronises into a separate database with no sequencer or deployer key |
| Feeder gateway    | Docker bridge only, port `8080` | Supplies state from sequencer to observer, never published to the host  |

The network identity is:

```
SWAPPULSE_NODELAB_1
0x5357415050554c53455f4e4f44454c41425f31
```

On 4 September 2026, the observer reproduced the permanent V2 flag, identity assurance and staking state with the same block hash as the sequencer. The lite verifier then reached `multi-peer-agreement` across the two separate databases.

Later fault tests stopped the observer and sequencer separately. In both cases, the lite verifier returned HTTP `503` from `/readyz` and `/rpc` rather than trusting the surviving peer alone. Agreement recovered automatically after the stopped node restarted from its preserved volume.

Both nodes were on the same physical host, so these results prove separate state, fail-closed read behaviour and restart recovery. They do not prove separate operator control or permissionless consensus.

### Stage D preparation

`chain/node/stage-d` now contains the first host packages for moving the full observer to a second physical machine:

* an opt-in Compose override that binds the sequencer feeder gateway only to the primary host's Tailscale IPv4 address;
* a read-only preflight that checks the private bind, reviewed image and node-lab state;
* a confirmation-gated enable script that recreates only the node-lab sequencer, waits for same-host agreement to recover and rechecks the live RPC, relay and lite node;
* a checkpoint generator that records a public confirmed block number and hash for remote verification;
* a public, secret-free remote-observer environment template;
* a resource-limited remote Madara Compose service with no private signing key;
* a remote-host preflight and guarded start script;
* a checkpoint and permanent-V2 verification script;
* a clean stop script that preserves the remote observer's named volume.

{% hint style="warning" %}
Stage D has not passed. The complete guarded workflow is now present, but the repository does not yet contain a successful second-host evidence record. Do not expose the feeder gateway, remove the same-host observer or describe the node lab as physically independent until the remote workflow and verification gate pass on the intended machines.
{% endhint %}

The planned second-host test must use a private overlay such as Tailscale, reproduce the exact chain ID, checkpoint block hash and permanent V2 contract pins, preserve its own database across restart, and then replace the same-host observer as one of the lite verifier's peers. Even after that, `operator_independence` remains false if one person administers both machines.

### Prepare the Stage D remote observer

Run this workflow only when the second physical host is ready, both machines have reviewed Tailscale IPv4 addresses in `100.64.0.0/10`, and the same-host node lab and lite verifier are healthy.

{% stepper %}
{% step %}
#### Enable the primary host's private gateway

From `chain/node/stage-d` on the primary host:

```bash
export NODELAB_STAGE_D_TAILSCALE_IP=<primary-100.x.y.z>
bash primary-gateway-preflight.sh

NODELAB_CONFIRM_STAGE_D_GATEWAY=YES \
  bash enable-primary-gateway.sh

bash create-primary-checkpoint.sh
```

The guarded enable script refuses a non-Tailscale bind, recreates only the node-lab sequencer if required, waits for same-host agreement to return, and rechecks the live RPC, relay and lite node. It publishes the feeder gateway as `<primary-Tailscale-IP>:19952` to the private overlay only.
{% endstep %}

{% step %}
#### Configure the remote host

Install the repository and Docker prerequisites, then install the verification tooling and create the remote environment file:

```bash
cd swappulse2/chain/scripts/tooling
npm ci

cd ../../node/stage-d/remote-observer
cp .env.example .env.remote
```

In `.env.remote`, replace both example `100.64.0.x` values with the primary and remote hosts' actual Tailscale IPv4 addresses. Keep the immutable `MADARA_IMAGE` digest and the `SWAPPULSE_NODELAB_1` identity unchanged unless a new image has completed qualification.
{% endstep %}

{% step %}
#### Transfer the public checkpoint

Copy `stage-d-primary-checkpoint.json` from the primary host to the remote host. This file contains public block and hash evidence only.

Do not transfer `.env.local`, sequencer keys, deployment keys, registry-owner keys, verifier keys or user keys.
{% endstep %}

{% step %}
#### Start and verify the remote observer

From `chain/node/stage-d/remote-observer` on the remote host:

```bash
bash preflight.sh
bash start.sh
bash verify.sh /path/to/chain /path/to/stage-d-primary-checkpoint.json
```

The verification must prove the exact chain ID, confirmed checkpoint block hash, permanent V2 deployment pins and full-observer mode without a private signing key. Its RPC must remain bound only to the remote host's Tailscale address, normally on port `19961`.
{% endstep %}

{% step %}
#### Prove restart and lite-peer recovery

Stop the remote observer with `bash stop.sh`, confirm its named volume remains, restart it and repeat verification. Only then replace the same-host observer endpoint in the lite verifier and require `multi-peer-agreement` again.

Do not remove the same-host observer or report Stage D as passed until the repository contains this evidence.
{% endstep %}
{% endstepper %}

## Host requirements

Use a dedicated or carefully resource-limited 64-bit Linux host.

| Resource | Current guidance                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| CPU      | Four cores recommended for the reference lab; the supplied node-lab caps each node at two CPUs                     |
| Memory   | 16 GB on the reference shared host; each node-lab container is capped at 2 GiB                                     |
| Storage  | SSD or NVMe with monitored free space and write endurance; do not use a low-end SD card for sustained chain writes |
| Software | Docker Engine, Docker Compose, Git, Bash and standard command-line tools                                           |
| Network  | Stable outbound connectivity; inbound node RPC is not required for the same-host lab                               |
| Time     | Working system time synchronisation                                                                                |

Pi 4 and Pi 5 devices remain candidate hardware. Do not describe them as supported full observers until their restart, catch-up, storage, thermal and multi-day soak tests pass.

## Host the tested node-lab observer

{% stepper %}
{% step %}
### Obtain the current repository

```bash
git clone https://github.com/beitmenotyou1/swappulse2.git
cd swappulse2/chain/node/nodelab
```

If the repository already exists, use its normal authenticated update workflow and review the changes before starting containers.
{% endstep %}

{% step %}
### Prepare local configuration

```bash
bash prepare-nodelab.sh
bash preflight-nodelab.sh
```

Preparation creates `.env.image` and a mode-`0600` `.env.local`. They contain the immutable image selection and fresh node-lab-only keys. Never commit, print or reuse those keys on the live testnet.
{% endstep %}

{% step %}
### Start and verify the sequencer

```bash
bash start-sequencer.sh
bash verify-sequencer.sh
```

The verification must return the exact node-lab chain ID and at least one confirmed block before you start the observer.
{% endstep %}

{% step %}
### Start the full observer

```bash
bash start-observer.sh
bash verify-nodelab.sh
```

The final verifier checks both chain IDs, compares the block hash at the common confirmed height, confirms the observer has no sequencer private key, and verifies that the separate live SwapPulse services remain healthy.
{% endstep %}

{% step %}
### Inspect the local RPCs

```bash
curl -fsS http://127.0.0.1:19950 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}'

curl -fsS http://127.0.0.1:19951 \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"starknet_blockNumber","params":[]}'
```

For a meaningful comparison, use `verify-nodelab.sh`. Two different block heights alone do not prove disagreement because the observer may be catching up.
{% endstep %}

{% step %}
### Stop without deleting state

```bash
bash stop-nodelab.sh
```

Normal stop preserves both named volumes. Do not add `-v` to a Compose down command unless you deliberately intend to destroy the lab databases and have already preserved the required evidence.
{% endstep %}
{% endstepper %}

## V2 contracts in the node lab

The tested lab contains the same audited V2 contract suite as the application baseline, deployed with fresh lab-only authorities. Its canonical manifest is:

```
chain/deployments/swappulse-nodelab-1.json
```

Never import node-lab addresses into the live Base44 `ChainNetworkConfig`. The live and lab networks have different chain IDs, deployments, keys and operational purposes.

The deployment, assurance exercise and irreversible V2 cut-over scripts are engineering harnesses. Run them only from a clean, tested `chain/` workspace and only when you deliberately intend to reproduce the development-network evidence. A failed cut-over command must be investigated on-chain before any retry because the one-way transaction may already have committed.

## Operating guidelines

### Keep the RPC local

The raw Madara RPC should remain bound to `127.0.0.1`. If users need remote reads, place the [read-only RPC gateway](../apis/read-only-rpc-gateway.md) in front of a reviewed upstream and publish only the gateway through HTTPS.

### Monitor the host

Watch:

* container state and restart count;
* confirmed head and observer lag;
* free disk space, database growth and I/O pressure;
* memory availability and sustained swap activity;
* CPU temperature and throttling on small hardware;
* RPC latency and error rate;
* successful restart and catch-up after maintenance.

Useful commands:

```bash
docker compose ps
docker stats --no-stream
df -h
vmstat 1 5
bash verify-nodelab.sh
```

### Preserve reproducibility

* Pin the full container image by immutable digest. Never benchmark `latest`.
* Preserve the public network and deployment manifests with any backup.
* Keep sequencer and observer databases separate.
* Test an upgrade against a copied or fresh volume before touching the only working state.
* Record the image digest, chain ID, block height and verification result for each qualification.

## Security checklist

Never place any of these on a community full observer:

* relay bearer token;
* registry-owner or verifier private key;
* user smart-account private key;
* Base44 secret or session credential;
* private age-verification evidence;
* AT Protocol app password;
* Cloudflare account-wide credential.

A full observer validates public protocol state. It must not depend on private Base44 data to decide whether a state transition is valid.

## Troubleshooting

| Symptom                              | Check                                                         | Safe response                                                               |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Observer height trails the sequencer | Container logs, feeder-gateway reachability and disk pressure | Allow catch-up, then rerun `verify-nodelab.sh`                              |
| Chain IDs differ                     | `.env.local`, chain override and image digest                 | Stop the lab and correct configuration. Do not merge or copy databases      |
| Common-height hashes differ          | Exact common height, image version and database integrity     | Treat as a verification failure and isolate the affected state              |
| RPC is unreachable                   | Loopback port ownership and `docker compose ps`               | Fix the local bind or container health. Do not widen the bind to `0.0.0.0`  |
| Disk is nearly full                  | Database size and Docker volume location                      | Stop cleanly and expand or migrate storage before corruption risk increases |
| New image fails against old data     | Migration notes and clean-volume result                       | Preserve the old volume as evidence and retest with a fresh volume          |

## Related pages

* [Lite node](lite-node.md)
* [Read-only RPC gateway](../apis/read-only-rpc-gateway.md)
* [Transaction relay](../apis/transaction-relay-api.md)
* [SwapPulse Node Architecture Roadmap](node-architecture.md)
* [Cairo and Starknet Chain Overview](chain-overview.md)
