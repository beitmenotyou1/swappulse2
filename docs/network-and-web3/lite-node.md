---
description: Host the low-resource SwapPulse lite node and understand its trust modes.
---

# Lite node

The SwapPulse lite node is a small local verification and read layer. It checks the expected network and V2 contract pins across one or more RPC peers, records a common checkpoint and exposes a deliberately narrow local Starknet RPC.

You may also hear this called a **light node**. The current package uses the name `lite` to avoid implying that it already implements a complete cryptographic Starknet light-client protocol.

{% hint style="info" %}
The runnable v0.1 package reduces blind trust and detects disagreement between configured peers. It does not yet verify storage proofs or consensus signatures locally.
{% endhint %}

### What it does

The node reads `chain/node/config/swappulse-testnet.json` and verifies:

* the expected chain ID;
* the pinned class hash at every configured V2 contract address;
* the current height of every healthy RPC peer;
* the block hash at the lowest common healthy height;
* whether a majority of configured peers agree;
* whether the manifest declares independent observer state and operator control.

It stores the latest common checkpoint in `data/checkpoint.json` and selects the lowest-latency healthy pinned peer for local read requests.

It does not:

* store or execute the complete chain;
* produce blocks;
* hold relay, verifier, Base44 or user secrets;
* turn two URLs for the same underlying server into decentralisation;
* replace a full observer or archive indexer;
* prove consensus by comparing JSON-RPC responses alone.

### Trust modes

| Mode                      | Meaning                                                                     | What you should do                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `single-peer-degraded`    | One pinned peer is healthy, but no independent comparison is possible       | Safe for ordinary testnet reads with the disclosed single-source trust assumption                                        |
| `multi-peer-pending`      | Several peers are configured and the first comparison is still running      | Wait for the next poll before relying on agreement status                                                                |
| `multi-peer-agreement`    | A majority agrees at the common height and the required contract pins match | Use the local read endpoint, while remembering this is multi-source agreement rather than a proof-verifying light client |
| `multi-peer-disagreement` | Peers disagree or cannot form the required majority                         | Fail closed, inspect peers and do not silently choose a chain                                                            |

On the current live `SWAPPULSE_TESTNET`, one genuine execution source is available, so the expected mode is `single-peer-degraded` and `independently_verified` remains `false`.

The same-host `SWAPPULSE_NODELAB_1` test reached `multi-peer-agreement` using the sequencer and separate full-observer databases. Stage D later repeated the comparison across two physical hosts: the primary sequencer and a keyless remote full observer agreed on the same checkpoint, permanent V2 pins and later common block hashes. Both machines were still administered by the same operator, so this proves physical-host state-source independence rather than independent-operator decentralisation.

### Verified agreement and fault recovery

The node-lab evidence now covers the complete same-host availability fault pair:

| Test                  | Observed state                                                        | Verified behaviour                                                                                              |
| --------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Both peers healthy    | Two of two peers agreed and both passed the V2 contract-pin checks    | `ready: true`, `pins_verified: true`, `multi-peer-agreement` and read-only RPC available                        |
| Observer stopped      | One of two peers remained healthy                                     | `ready: false`, `pins_verified: false`, `INSUFFICIENT_PEER_AGREEMENT`, and HTTP `503` from `/readyz` and `/rpc` |
| Sequencer stopped     | One of two peers remained healthy                                     | `ready: false`, `pins_verified: false`, `INSUFFICIENT_PEER_AGREEMENT`, and HTTP `503` from `/readyz` and `/rpc` |
| Stopped peer restored | The peer restarted from its preserved database and agreement returned | `ready: true`, both contract-pin checks passed and `multi-peer-agreement` recovered automatically               |

This behaviour matters because a read proxy can otherwise appear healthy while silently falling back to one source. The current implementation gates `/rpc` on the complete readiness condition, so losing the required peer or contract-pin quorum also stops proxied reads with `NO_VERIFIED_PEER`.

{% hint style="info" %}
These tests cover availability loss and recovery. They do not test Byzantine consensus, validator failover, leader election, proof verification or independent operator control.
{% endhint %}

### Durable Stage D verifiers

The isolated cross-host canary passed on 6 September 2026. On 7 September it was promoted to a reviewed Docker Compose service and accepted through a controlled primary-host reboot.

| Service | Peers | Purpose |
| ------- | ----- | ------- |
| Same-host fallback on `127.0.0.1:18101` | Primary sequencer `19950` and same-host observer `19951` | Preserves local two-database verification when the private overlay or remote host is unavailable |
| Cross-host verifier on `127.0.0.1:18102` | Primary sequencer `19950` and remote observer `19961` | Detects disagreement across separate physical hosts and state databases |

Both services require two healthy peers, two matching contract-pin sets and the same block hash at the common height. Both bind only to loopback, run with a read-only root filesystem, drop Linux capabilities, enable `no-new-privileges` and use `restart: unless-stopped`.

The cross-host service is packaged under `chain/node/stage-d/lite-service`:

```bash
cd chain/node/stage-d/lite-service
cp .env.example .env
# Set the remote peer to its literal Tailscale IPv4.
bash preflight.sh .env
bash start.sh .env
bash status.sh .env
```

The same-host fallback is packaged under `chain/node/stage-d/reboot-support`. Its handover must be guarded because port `18101` must be released by the legacy process and recovery material must be retained:

```bash
cd chain/node/stage-d/reboot-support
cp .env.example .env
bash preflight.sh .env
bash start.sh .env
bash status.sh .env
```

Do not perform that handover by killing an unknown process. Confirm the exact PID, executable, source, working directory and checkpoint first, then create a tested rollback launcher.

The controlled reboot proved that Docker restored both managed verifiers without an operator running `start.sh`. Their recorded container identities were retained, both returned to `ready: true`, and an older pre-reboot block remained identical across the sequencer, same-host observer and remote observer.

{% hint style="warning" %}
With exactly two peers in either service, both must remain healthy and agree. If one peer is unavailable, that verifier returns HTTP `503` from `/readyz` and `/rpc`. Do not weaken the quorum. The other verifier may provide a separate diagnostic path, but it is not a substitute for the failed trust condition.
{% endhint %}

Use [Stage D Multi-host Operations](stage-d-operations.md) for the full topology, daily checks, reboot acceptance and rollback boundaries.

### HTTP interface

The supplied Compose package binds to `127.0.0.1:18100`.

| Endpoint      | Method | Purpose                                                                          |
| ------------- | ------ | -------------------------------------------------------------------------------- |
| `/healthz`    | `GET`  | Confirms that the process is running                                             |
| `/readyz`     | `GET`  | Returns readiness, pins, peer agreement and errors; returns `503` when not ready |
| `/status`     | `GET`  | Public-safe peer and checkpoint details                                          |
| `/metrics`    | `GET`  | Low-overhead Prometheus text metrics                                             |
| `/rpc` or `/` | `POST` | Read-only Starknet JSON-RPC through the best verified peer while readiness holds |

The local RPC accepts a small read allowlist, denies JSON-RPC batches, caps request bodies at 64 KiB and rate-limits clients. Write, admin and `devnet_*` methods are rejected.

### Host requirements

The service has no runtime npm dependencies and runs in the supplied Node 22 container.

Recommended starting point:

* 64-bit Linux;
* Docker Engine and Docker Compose;
* one CPU core and modest memory headroom;
* persistent storage for the small checkpoint file;
* reliable network access to at least one approved RPC;
* SSD storage if the same device also runs heavier node services.

In the first ten-minute Intel N95 test, the container used roughly 29 to 49 MiB of memory and remained available for every sample. This is evidence from one short run, not a universal minimum. Pi 4 and Pi 5 support still needs dedicated restart, network-loss, low-disk and multi-day soak tests.

### Host the lite node

{% stepper %}
{% step %}
#### Obtain the current repository

```bash
git clone https://github.com/beitmenotyou1/swappulse2.git
cd swappulse2/chain/node/lite
```
{% endstep %}

{% step %}
#### Create the local configuration

```bash
cp .env.example .env
mkdir -p data
```

With `SWAPPULSE_RPC_PEERS` left blank, the service uses the canonical peer in the public manifest. To choose peers explicitly, edit `.env`:

```
SWAPPULSE_RPC_PEERS=https://rpc.swappulse.org/rpc,https://second-independent.example/rpc
SWAPPULSE_ALLOW_TAILSCALE_HTTP=0
SWAPPULSE_LITE_PORT=18100
POLL_INTERVAL_MS=15000
PIN_CHECK_INTERVAL_MS=300000
RPC_TIMEOUT_MS=5000
RPC_RATE_LIMIT_PER_MINUTE=120
```

Remote peers use HTTPS by default. Plain HTTP is accepted for `localhost`, `127.0.0.1` or `::1`. A deliberately separate opt-in, `SWAPPULSE_ALLOW_TAILSCALE_HTTP=1`, also permits a remote HTTP peer only when its hostname is a literal IPv4 address inside `100.64.0.0/10`. The policy continues to reject ordinary LAN addresses, public HTTP addresses, hostnames that merely resolve into Tailscale, embedded credentials and non-HTTP protocols. The opt-in validates the URL shape, so the operator must also confirm that the address belongs to the intended tailnet and that the kernel route uses Tailscale.
{% endstep %}

{% step %}
#### Start the service

```bash
docker compose up -d --build
docker compose ps
```

The container runs read-only, drops all Linux capabilities, enables `no-new-privileges` and publishes only to host loopback.
{% endstep %}

{% step %}
#### Verify health and trust state

```bash
curl -fsS http://127.0.0.1:18100/healthz
curl -fsS http://127.0.0.1:18100/status | python3 -m json.tool
curl -fsS http://127.0.0.1:18100/metrics
```

For the live baseline, `ready: true` together with `trust_mode: single-peer-degraded` is expected. Do not change the label simply to make the status appear stronger.
{% endstep %}

{% step %}
#### Test the local read-only RPC

```bash
curl -fsS http://127.0.0.1:18100/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -m json.tool
```

Confirm that a write is denied:

```bash
curl -i http://127.0.0.1:18100/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"starknet_addInvokeTransaction","params":[]}'
```

Expected result: HTTP `403` with `METHOD_NOT_ALLOWED`.
{% endstep %}

{% step %}
#### Stop or update safely

```bash
docker compose down
```

This preserves `data/checkpoint.json`. To update, review the repository changes, rebuild the image, start the service and recheck `/readyz`, `/status` and the blocked-write test.
{% endstep %}
{% endstepper %}

### Example status interpretation

A healthy single-peer response has this shape:

```json
{
  "role": "lite",
  "ready": true,
  "trust_mode": "single-peer-degraded",
  "configured_peer_count": 1,
  "healthy_peer_count": 1,
  "pins_verified": true,
  "peer_agreement": false,
  "independently_verified": false,
  "last_error": null
}
```

The block height and hash will change as the chain advances. Never copy values from an old example into a manifest as if they were permanent pins.

### Choosing peers honestly

Use peers that represent distinct state sources. Before describing two peers as independent, confirm that they have:

* separate node databases;
* separate synchronisation processes;
* different operators or meaningful administrative separation;
* no hidden reverse proxy to the same upstream;
* the same signed or reviewed network manifest;
* matching chain and contract pins.

The lite node requires a majority of all configured peers, not merely a majority of those that answered. With two configured peers, both must agree.

### Monitoring

Prometheus metrics include readiness, peer agreement, independent-verification state, healthy peer count, pin-verified peer count and common height.

Alert when:

* `/readyz` returns `503`;
* `trust_mode` becomes `multi-peer-disagreement`;
* healthy or pin-verified peer counts fall;
* the common height stops advancing while upstream chains continue;
* latency or timeout errors persist;
* `checkpoint.json` cannot be written.

The checkpoint is an observation record, not authoritative chain state. Losing it does not lose funds or identities. The node will rebuild its status from the configured peers.

### Security guidelines

* Keep the service bound to loopback unless you have a separate authenticated local-network design.
* Do not place `SWAPPULSE_TX_RELAY_TOKEN` or any private key in `.env`.
* Keep remote peers on HTTPS unless you deliberately use the narrow Tailscale HTTP opt-in with a literal `100.64.0.0/10` address.
* Never use the opt-in for ordinary LAN or public HTTP addresses, and never put credentials in a peer URL.
* Do not expand the local method allowlist to include writes.
* Keep the network manifest reviewed and version-controlled.
* Treat peer disagreement as a fault, not as an inconvenience to bypass.
* Do not market `multi-peer-agreement` as cryptographic proof verification.

### Troubleshooting

| Status or symptom                                   | Likely cause                                                                              | Check                                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `NO_HEALTHY_PINNED_PEER`                            | RPC unavailable, wrong chain ID or pins not checked                                       | Peer URL, TLS, timeout and manifest                                                                                         |
| `INSUFFICIENT_PIN_QUORUM`                           | Too few peers match every contract class hash                                             | Contract addresses, class hashes and network selection                                                                      |
| `INSUFFICIENT_PEER_AGREEMENT`                       | Common-height hashes differ or peers are unavailable                                      | Each peer's status and block hash at the reported common height                                                             |
| HTTP `429`                                          | Local client exceeded the configured minute limit                                         | Reduce polling or raise the limit carefully                                                                                 |
| HTTP `503` from `/rpc`                              | No healthy verified peer or required multi-peer quorum is available                       | Resolve upstream health, agreement or pin failure before retrying                                                           |
| Checkpoint write warning                            | `data/` permissions or storage problem                                                    | Directory ownership, free space and read-only mount configuration                                                           |
| `HTTP_RPC_PEER_MUST_BE_LOCAL_OR_APPROVED_TAILSCALE` | Remote HTTP was used without the narrow opt-in, or the address is outside `100.64.0.0/10` | Prefer HTTPS. For a reviewed Tailscale peer, use its literal `100.x.y.z` address and set `SWAPPULSE_ALLOW_TAILSCALE_HTTP=1` |

### Related pages

* [Full node and full observer](full-node.md)
* [Stage D Multi-host Operations](stage-d-operations.md)
* [Read-only RPC gateway](../apis/read-only-rpc-gateway.md)
* [Transaction relay](../apis/transaction-relay-api.md)
* [SwapPulse Node Architecture Roadmap](node-architecture.md)
