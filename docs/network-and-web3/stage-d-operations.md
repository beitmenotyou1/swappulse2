---
description: Operate the tested two-host Stage D node lab, durable verifiers and reboot recovery safely.
---

# Stage D Multi-host Operations

Stage D is the tested two-host operating profile for `SWAPPULSE_NODELAB_1`. It places a keyless full observer on a second physical host, compares independently stored state on the primary host, and keeps both verification paths reboot-managed.

{% hint style="success" %}
The reviewed runtime at commit [`eef1b5d7`](https://github.com/beitmenotyou1/swappulse2/commit/eef1b5d710d540521e191fab62fef2987f61aab7) passed a controlled primary-host reboot on 7 September 2026. All seven required containers recovered automatically, retained their recorded identities and preserved the accepted chain history without an operator manually starting services.
{% endhint %}

{% hint style="warning" %}
Stage D is an isolated development node lab. It does not replace `SWAPPULSE_TESTNET`, add a second block producer or prove decentralised consensus. Both physical hosts were controlled by the same operator, so `operator_independence` remains `false`.
{% endhint %}

## How the topology works

| Component | Endpoint | State or trust role |
| --------- | -------- | ------------------- |
| Primary testing sequencer | `127.0.0.1:19950` | Produces node-lab blocks and stores the primary state |
| Same-host full observer | `127.0.0.1:19951` | Keeps a separate local database without sequencing authority |
| Primary feeder gateway | `<primary-Tailscale-IP>:19952` | Supplies the remote observer over the private overlay |
| Remote full observer | `<remote-Tailscale-IP>:19961` | Keeps a persistent database on the second host without signing keys |
| Same-host lite fallback | `127.0.0.1:18101` | Requires agreement between `19950` and `19951` |
| Cross-host lite verifier | `127.0.0.1:18102` | Requires agreement between `19950` and `19961` |

The remote observer synchronises through the feeder gateway. Each lite service checks its two configured peers for:

1. the exact `SWAPPULSE_NODELAB_1` chain ID;
2. the same block hash at the common height;
3. every pinned V2 contract class hash;
4. a complete two-peer quorum.

With exactly two peers, one missing or disagreeing peer makes that verifier fail closed. Its `/readyz` and read-only `/rpc` endpoints return HTTP `503` until agreement is restored.

The two lite services answer different questions. Port `18101` proves agreement between two databases on the primary host. Port `18102` proves agreement across two physical hosts and independently synchronised databases. Neither proves independent human administration.

## Security boundaries

* Keep `19950`, `19951`, `18101` and `18102` on loopback.
* Bind `19952` and `19961` only to the hosts' reviewed Tailscale IPv4 addresses.
* Never publish raw Madara RPC or the feeder gateway to the public Internet.
* Never copy `.env.local`, sequencer keys, deployer keys, registry-owner keys, verifier keys, relay tokens or user keys to the remote host.
* Keep the immutable Madara image digest and the canonical node-lab manifest pinned.
* Use `SWAPPULSE_ALLOW_TAILSCALE_HTTP=1` only with a literal address in `100.64.0.0/10`, after confirming the address belongs to the intended tailnet and the kernel route uses `tailscale0`.
* Do not use `0.0.0.0`, weaken the two-peer quorum or use `docker compose down -v`.
* Do not copy node-lab chain IDs, addresses or keys into the live testnet configuration.

## Installation order

Use a reviewed checkout on both hosts and replace placeholders with the actual private-overlay addresses.

### 1. Enable the primary feeder gateway

From `chain/node/stage-d` on the primary host:

```bash
export NODELAB_STAGE_D_TAILSCALE_IP=<primary-100.x.y.z>
bash primary-gateway-preflight.sh

NODELAB_CONFIRM_STAGE_D_GATEWAY=YES \
  bash enable-primary-gateway.sh

bash create-primary-checkpoint.sh
```

The preflight requires the Tailscale address to belong to the host, port `19952` to be free and the existing node lab to be healthy. The enable script may recreate only the node-lab sequencer, then waits for same-host agreement to recover.

### 2. Start and verify the remote observer

On the second host:

```bash
cd chain/scripts/tooling
npm ci

cd ../../node/stage-d/remote-observer
cp .env.example .env.remote
# Set the primary gateway and remote Tailscale bind.

bash preflight.sh .env.remote
bash start.sh .env.remote
bash verify.sh \
  /absolute/path/to/chain \
  /absolute/path/to/stage-d-primary-checkpoint.json \
  .env.remote
```

Only the public block/hash checkpoint should be copied from the primary host. A running container is not enough. Verification must pass the chain ID, checkpoint hash, permanent V2 manifest and privilege-separation checks.

### 3. Start the durable cross-host verifier

On the primary host:

```bash
cd chain/node/stage-d/lite-service
cp .env.example .env
# Set NODELAB_STAGE_D_LITE_PEERS to 19950 and the remote 19961 address.

bash preflight.sh .env
bash start.sh .env
bash status.sh .env
```

The status check must report two healthy peers, two verified pin sets, `multi-peer-agreement`, `independently_verified: true`, `observer_state_independent: true` and `operator_independence: false`.

### 4. Install the managed same-host fallback

The fallback package lives at `chain/node/stage-d/reboot-support`. It takes over loopback port `18101` from the legacy host process and applies the reviewed full-node restart policy.

Before handover, identify the exact legacy PID, executable, server source, working directory and checkpoint. Retain an allowlisted recovery record and test the rollback launcher.

After the guarded handover makes `18101` free:

```bash
cd chain/node/stage-d/reboot-support
cp .env.example .env

bash preflight.sh .env
bash start.sh .env
bash status.sh .env
```

The fallback compares only `19950` and `19951`. It must keep the Tailscale HTTP opt-in disabled.

## Daily health checks

Run both package status scripts on the primary host:

```bash
cd chain/node/stage-d/reboot-support
bash status.sh .env

cd ../lite-service
bash status.sh .env
```

Inspect the public-safe endpoints when diagnosing:

```bash
curl -fsS http://127.0.0.1:18101/healthz
curl -fsS http://127.0.0.1:18101/readyz
curl -fsS http://127.0.0.1:18101/status | python3 -m json.tool

curl -fsS http://127.0.0.1:18102/healthz
curl -fsS http://127.0.0.1:18102/readyz
curl -fsS http://127.0.0.1:18102/status | python3 -m json.tool
```

A healthy verifier reports:

* `ready: true`;
* `trust_mode: multi-peer-agreement`;
* two configured and healthy peers;
* `pins_verified: true` with two verified pin sets;
* `peer_agreement: true`;
* `independently_verified: true`;
* `observer_state_independent: true`;
* `operator_independence: false`;
* `last_error: null`.

Also monitor container health and restart counts, observer lag, free disk space, database growth, memory, Tailscale reachability and the advancement of the common height.

## Failure behaviour

| Failure | Expected result | Safe operator response |
| ------- | --------------- | ---------------------- |
| Remote observer or Tailscale path unavailable | `18102` returns `503`; `18101` may remain ready | Restore the private route or observer, allow catch-up, rerun remote verification, then require `18102` agreement |
| Same-host observer unavailable | `18101` returns `503`; `18102` may remain ready | Restore `19951` from its preserved database and rerun the fallback status check |
| Sequencer unavailable | Both lite services become unready | Restore the sequencer and require both observer paths to catch up and agree |
| Peers return different hashes | Affected verifier reports disagreement and refuses RPC | Isolate the suspect state source; do not choose a preferred hash manually |
| Contract pins differ | Affected verifier fails pin quorum | Stop relying on that path and verify the manifest, deployment and selected network |
| Tailscale starts late after boot | `18102` remains unready while it polls | Wait for the route and peer to return; do not manually weaken or reconfigure the service |

The same-host fallback is useful for diagnosis and local availability. It does not make a failed cross-host trust check pass.

## Stop and rollback

For the remote observer:

```bash
cd chain/node/stage-d/remote-observer
bash stop.sh .env.remote
```

This removes only the remote observer container and preserves its named volume. After restarting, rerun the full checkpoint and V2 verification and query a block captured before the stop.

For the durable cross-host verifier:

```bash
cd chain/node/stage-d/lite-service
bash stop.sh .env
bash rollback.sh .env
```

For the managed same-host fallback:

```bash
cd chain/node/stage-d/reboot-support
bash stop.sh .env
bash rollback.sh .env
```

The package rollback removes only its own candidate container and preserves checkpoint data. Restoring the retired legacy process or previous full-node restart policies requires the guarded recovery material captured during handover.

## Reboot acceptance

Before reboot, confirm Docker and Tailscale are enabled, all required containers use `restart: unless-stopped`, both verifier status scripts pass and a current block number/hash is recorded.

Reboot only the primary host while the second host remains running. During acceptance:

1. do not manually run a service start command;
2. prove the kernel boot ID changed;
3. wait for all required containers and health endpoints to recover;
4. confirm the recorded container ID set is unchanged;
5. rerun both managed verifier status scripts;
6. query the pre-reboot block from the sequencer, same-host observer and remote observer;
7. require the old hash to match on all three sources and require current three-source agreement.

The 7 September 2026 acceptance retained all seven recorded container identities. Pre-reboot block `133443` with hash `0x60bf26c5e8d8bf1a14ea97f1d13b1d05187f3748331fb6bde5362f16f34cf99` remained available from all three full nodes, and current agreement later reached block `135177`.

Keep the rollback material until the post-reboot evidence has been independently checked.

## What Stage D proves

Stage D proves, for the tested node-lab path:

* a keyless observer can maintain and recover a separate database on another physical host;
* local and cross-host state disagreement can fail closed;
* both verifier paths can recover automatically after a primary-host reboot;
* an accepted pre-reboot block can remain reproducible across all three state databases;
* the live testnet can remain isolated and healthy during the node-lab work.

It does not prove permissionless validation, multiple block producers, cryptographic light-client proofs or independent operator control.

## Related pages

* [Full node and full observer](full-node.md)
* [Lite node](lite-node.md)
* [Community Operator Guide](operator-guide.md)
* [Infrastructure Operations](infrastructure-operations.md)
* [SwapPulse Node Architecture Roadmap](node-architecture.md)
