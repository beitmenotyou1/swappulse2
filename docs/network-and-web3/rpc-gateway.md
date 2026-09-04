---
description: Host and secure the public read-only SwapPulse Starknet RPC gateway.
---

# Read-only RPC gateway

The SwapPulse RPC gateway is the public **read path** into the chain. It accepts a deliberately small set of Starknet JSON-RPC methods and forwards them to a private upstream node. It is not a blockchain node and it never submits transactions.

Live public endpoint:

```
https://rpc.swappulse.org/rpc
```

{% hint style="danger" %}
Never publish the raw Shardlabs Devnet RPC on port `5050`. It exposes transaction submission and privileged `devnet_*` methods. Publish only the allowlisted gateway through HTTPS.
{% endhint %}

## How it operates

1. A browser, Base44 backend, explorer or lite node sends one JSON-RPC request to the HTTPS endpoint.
2. The TLS proxy or Cloudflare Tunnel forwards it to the gateway's loopback port.
3. The gateway validates the path, body size, JSON-RPC shape, client rate and method.
4. An approved request is forwarded to the private upstream RPC on the Docker network.
5. The response is size-limited and returned with `no-store` and `nosniff` headers.
6. A write, batch or administration request is rejected before it reaches the upstream node.

The repository default maps the gateway to `127.0.0.1:8080`. The current reference host uses `127.0.0.1:18080` to avoid local port conflicts. The public URL does not change when the loopback mapping changes.

## Functionality

The gateway supports the read and simulation methods needed by the SwapPulse app, explorer, reconciler and verification tooling:

| Category              | Allowed methods                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Network and blocks    | `starknet_specVersion`, `starknet_chainId`, `starknet_blockNumber`, `starknet_getBlockWithTxHashes` |
| Transactions          | `starknet_getTransactionByHash`, `starknet_getTransactionReceipt`, `starknet_getTransactionStatus`  |
| Contracts and classes | `starknet_getClassHashAt`, `starknet_getClass`, `starknet_getClassAt`                               |
| Account and calls     | `starknet_getNonce`, `starknet_call`, `starknet_estimateFee`                                        |

The following are always denied:

* `starknet_addInvokeTransaction`;
* `starknet_addDeployAccountTransaction`;
* every other unlisted method;
* every `devnet_*` method;
* JSON-RPC batch requests.

## Built-in limits

| Control            | Current value                         |
| ------------------ | ------------------------------------- |
| Request body       | 64 KiB maximum                        |
| Upstream response  | 4 MiB maximum                         |
| Upstream timeout   | 8 seconds                             |
| Default rate limit | 180 requests per client IP per minute |
| Redirects          | Rejected for upstream requests        |
| Cache              | `Cache-Control: no-store`             |

These are application-layer safeguards, not a replacement for firewalling, TLS, tunnel access controls, external rate limiting, monitoring and host patching.

## Host the gateway

{% stepper %}
{% step %}
### Prepare the chain host

Install Docker Engine, Docker Compose, Git and Node.js 22 or newer. Obtain the current repository:

```bash
git clone https://github.com/beitmenotyou1/swappulse2.git
cd swappulse2/chain/infra
cp .env.example .env
```

Create a private random Devnet seed and put it in `.env`. Do not commit `.env`.
{% endstep %}

{% step %}
### Configure loopback ports and the public URL

The default values are:

```
SWAPPULSE_RAW_RPC_PORT=5050
SWAPPULSE_GATEWAY_PORT=8080
SWAPPULSE_PUBLIC_RPC_URL=https://rpc.swappulse.org/rpc
SWAPPULSE_RPC_RATE_LIMIT=180
```

If port `8080` is already used, set `SWAPPULSE_GATEWAY_PORT=18080`. Keep the raw RPC mapping on loopback in every case.
{% endstep %}

{% step %}
### Start the private node and gateway

```bash
docker compose up -d --build devnet rpc-gateway
docker compose ps
```

The gateway container runs with a read-only filesystem, no Linux capabilities and `no-new-privileges`.
{% endstep %}

{% step %}
### Test an allowed read locally

Set the actual local gateway port for your host:

```bash
GATEWAY_PORT=8080

curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/healthz"

curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/rpc" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -m json.tool
```

On the reference host, use `GATEWAY_PORT=18080`.
{% endstep %}

{% step %}
### Prove privileged methods are blocked

```bash
curl -i "http://127.0.0.1:${GATEWAY_PORT}/rpc" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"devnet_getPredeployedAccounts","params":{}}'

curl -i "http://127.0.0.1:${GATEWAY_PORT}/rpc" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":3,"method":"starknet_addInvokeTransaction","params":{}}'
```

Both requests must return HTTP `403`.

Run the automated policy test as well:

```bash
node rpc-gateway/smoke-policy.mjs
```
{% endstep %}

{% step %}
### Publish only the gateway through HTTPS

Configure a dedicated reverse proxy or named tunnel:

```
https://rpc.swappulse.org/rpc -> http://127.0.0.1:8080
```

Use `18080` on hosts configured with that mapping. Do not create any public route to `127.0.0.1:5050`.
{% endstep %}

{% step %}
### Verify the public path

```bash
curl -fsS https://rpc.swappulse.org/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' \
  | python3 -m json.tool

curl -i https://rpc.swappulse.org/rpc \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":2,"method":"devnet_mint","params":{}}'
```

The read must succeed and the privileged method must remain blocked. Then verify the deployment manifest:

```bash
cd ../scripts/tooling
node verify-network.mjs ../../deployments/swappulse-testnet.json
```
{% endstep %}
{% endstepper %}

## Example application request

Read a contract without granting write authority:

```bash
curl -fsS https://rpc.swappulse.org/rpc \
  -H 'content-type: application/json' \
  --data '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "starknet_call",
    "params": [
      {
        "contract_address": "0x...",
        "entry_point_selector": "0x...",
        "calldata": []
      },
      "latest"
    ]
  }'
```

Use addresses and selectors from the verified public deployment manifest. Do not copy private keys, tokens or Base44 records into RPC calls.

## Use with Base44

`ChainNetworkConfig` should contain only the normal public HTTPS RPC URL and verified public contract pins. It must not contain:

* embedded RPC credentials;
* a raw localhost URL;
* the transaction relay URL or token;
* any private key.

Base44's verifier reads the gateway independently before activating a network configuration. A successful health check alone is not enough. Chain ID, class hashes, registry owner, verifier and contract wiring must match the canonical manifest.

## Use with a full observer

In a future community deployment, the same gateway design can sit in front of a reviewed full-observer RPC instead of the current Devnet upstream. Keep the public method allowlist and abuse controls. Do not expose the full node directly simply because its RPC is read-capable.

## Monitoring and maintenance

Monitor:

* `/healthz` availability;
* allowed-request latency and error rate;
* HTTP `403`, `413`, `429` and `502` rates;
* upstream node health and chain progress;
* denied-method logs;
* tunnel or reverse-proxy health;
* host memory, storage and network use.

After any gateway, node, proxy or tunnel update, repeat:

1. an allowed `starknet_chainId` request;
2. a denied `devnet_*` request;
3. a denied transaction-submission request;
4. `smoke-policy.mjs`;
5. `verify-network.mjs` through the public URL.

## Troubleshooting

| Response                         | Meaning                                                  | Action                                                                                           |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `403`                            | Method is not on the read allowlist                      | Use the [transaction relay](transaction-relay.md) through the Base44 backend for approved writes |
| `400`                            | Invalid JSON-RPC or a disabled batch                     | Send one valid JSON-RPC 2.0 request                                                              |
| `413`                            | Request exceeds 64 KiB                                   | Reduce the request. Do not raise the limit without an abuse review                               |
| `429`                            | Client exceeded the minute limit                         | Reduce polling or review the rate limit and proxy client-IP forwarding                           |
| `502`                            | Upstream timeout, invalid response or oversized response | Check the private node, Docker network and logs                                                  |
| Public timeout but local success | Tunnel, DNS or TLS fault                                 | Inspect the proxy path without exposing the raw node                                             |

## Related pages

* [Transaction relay](transaction-relay.md)
* [Lite node](lite-node.md)
* [Full node and full observer](full-node.md)
* [Infrastructure Operations](infrastructure-operations.md)
