# SwapPulse Lite Node v0.1

This package is the first working SwapPulse lite-node prototype. It is designed to run on low-cost 64-bit Linux hardware and to reduce blind trust in a single public RPC without pretending that the current single Devnet is already a decentralised network.

## What it verifies today

The lite node reads the public network manifest in `../config/swappulse-testnet.json` and verifies:

- the expected SwapPulse chain ID;
- the pinned class hash for each deployed V2 contract;
- current block height for every configured RPC peer;
- a common block hash at the lowest healthy peer height;
- whether multiple independent RPC peers agree on that common block.

It persists the latest observed common checkpoint to `/data/checkpoint.json`.

## Trust modes

### `single-peer-degraded`

Only one RPC is configured. The node can verify that the endpoint returns the expected chain and contract pins, but it cannot detect a dishonest canonical RPC by comparison with an independent peer.

This is the expected state on the current SwapPulse V2 baseline until a second independently operated RPC exists.

### `multi-peer-pending`

Multiple peers are configured but a comparison has not completed yet.

### `multi-peer-agreement`

A majority of configured peers agree on the block hash at the common comparison height and the required contract pins are present.

This is stronger than trusting one RPC, but it is still **multi-source agreement**, not a cryptographic Starknet light-client proof and not decentralised consensus.

### `multi-peer-disagreement`

Configured peers disagree or there is insufficient agreement. The node reports the conflict instead of silently selecting a canonical answer.

## HTTP surface

The service listens on `127.0.0.1:18100` by default when started with the supplied Compose file.

- `GET /healthz` — process health only.
- `GET /readyz` — current chain/pin readiness and trust state.
- `GET /status` — public-safe detailed peer status.
- `GET /metrics` — low-overhead Prometheus text metrics.
- `POST /rpc` — local read-only Starknet JSON-RPC proxy through the best healthy pinned peer.

The local RPC proxy denies batches and every write/admin/devnet method. It is intentionally narrower than a normal full-node RPC.

## Start

```bash
cd chain/node/lite
cp .env.example .env
mkdir -p data

docker compose up -d --build
```

Check it:

```bash
curl -fsS http://127.0.0.1:18100/healthz
curl -fsS http://127.0.0.1:18100/status | python3 -m json.tool
curl -fsS http://127.0.0.1:18100/metrics
```

Check the local read-only RPC:

```bash
curl -fsS http://127.0.0.1:18100/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -m json.tool
```

A write must be rejected:

```bash
curl -i http://127.0.0.1:18100/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_addInvokeTransaction","params":[]}'
```

Expected result: HTTP `403`.

## Adding independent peers

Set a comma-separated list in `.env`:

```text
SWAPPULSE_RPC_PEERS=https://rpc.swappulse.org/rpc,https://second-independent.example/rpc
```

Do not add two hostnames that ultimately proxy the same underlying node and call that decentralisation. The second peer should be independently operated and independently synchronised.

## Security

- No relay token is needed.
- No registry/verifier private key is needed.
- No Base44 secret is needed.
- No user signing key is needed.
- HTTP peers are accepted only on loopback; remote peers must use HTTPS.
- URLs containing embedded credentials are rejected.
- The local JSON-RPC surface is read-only and rate-limited.
- Contract pins come from the public frozen V2 network manifest.

## Raspberry Pi target

The service itself has no npm dependencies and runs on Node 22. The intended initial target is a Pi 4/5 running a 64-bit Linux distribution with an SSD.

The process being small enough to start on a Pi is **not** sufficient for a support claim. The benchmark harness must still measure sustained CPU, RAM, swap, disk and network behaviour.

## What this is not yet

This is not yet a cryptographic Starknet light client. In particular it does not currently verify storage proofs or consensus signatures locally. Madara's current public feature table reports `starknet_getStorageProof` as unavailable in its default profile, so the next proof-verifying lite-client stage depends on the selected SwapPulse appchain/proof architecture rather than pretending a JSON-RPC comparison is equivalent to proof verification.

It is also not a validator and cannot produce blocks.

## First live mini-server verification

On 4 September 2026, lite-node v0.1 was started on the reference Intel N95 mini-server alongside the existing frozen V2 Devnet, RPC gateway and transaction relay without restarting or modifying those services.

Observed live evidence:

- process/container health: healthy;
- canonical upstream: `https://rpc.swappulse.org/rpc`;
- chain ID: `0x534e5f5345504f4c4941`;
- observed block height: 51;
- observed common block hash: `0x308206d5becb7b7cf0d37a4175136a35d34b616873fc7d96b5d0968d025b463`;
- frozen V2 contract pins: verified;
- local read-only RPC: working;
- `starknet_addInvokeTransaction`: rejected with HTTP 403 / `METHOD_NOT_ALLOWED`;
- trust mode: `single-peer-degraded`;
- peer agreement: false;
- independently verified: false.

That result is the expected security posture while only one genuine SwapPulse RPC/node exists. The block height/hash above are test evidence from that run, not permanent network constants.

Use `verify-lite-live.sh` for the repeatable read-only verification sequence.

## Next lite-node milestones

1. Run against two genuinely independent SwapPulse full-node RPCs.
2. Add signed/versioned network manifests.
3. Add checkpoint signatures/finality evidence from the next network architecture.
4. Add proof verification where the chosen protocol exposes sufficient proofs.
5. Add optional signed-transaction forwarding to multiple approved ingress peers without holding user private keys.
6. Package and benchmark on Pi 4 8GB, Pi 5 8GB/16GB and the current N95 mini-PC.
