---
description: >-
  Underlying chain RPC, node and tunnel services behind the public SwapPulse
  gateway and relay.
---

# Starknet, Madara and Cloudflare APIs

SwapPulse chain infrastructure combines Starknet JSON-RPC, Madara nodes and Cloudflare Tunnel. Operators must distinguish public hardened gateways from private node and relay ports.

## Component boundaries

| Component                       | Status                                    | Public exposure                                                      |
| ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| SwapPulse read-only RPC gateway | Active                                    | `https://rpc.swappulse.org/rpc`                                      |
| SwapPulse transaction relay     | Active, private caller contract           | `https://relay.swappulse.org`, bearer-protected except liveness      |
| Madara full observer RPC        | Experimental node lab                     | Loopback or private operator network                                 |
| Lite-node local API             | Runnable operator component               | Local by default, port 18100                                         |
| Ethereum Sepolia RPC            | Reference settlement/bootstrap dependency | External upstream used by the Madara configuration                   |
| Cloudflare Tunnel               | Active publishing layer                   | Publishes approved HTTPS hostnames without opening raw service ports |

## Starknet JSON-RPC

The public SwapPulse gateway exposes only an allowlist of read-oriented Starknet methods and blocks transaction submission, Devnet controls and batch requests. Use the dedicated RPC page for the full method and hosting contract.

Example:

```bash
curl 'https://rpc.swappulse.org/rpc' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"starknet_blockNumber","params":[]}'
```

The transaction relay is the separate policy-enforcing write path for trusted SwapPulse backend services.

## Madara nodes

A full observer keeps and verifies its own chain state. Its raw RPC is not intended as an unrestricted public endpoint. The reference node-lab configuration uses an Ethereum Sepolia RPC, including `https://ethereum-sepolia-rpc.publicnode.com`, for settlement or bootstrap duties. That upstream is not a SwapPulse API or availability guarantee.

## Lite-node API

The lite node defaults to port `18100` and provides:

| Path       | Purpose                         |
| ---------- | ------------------------------- |
| `/healthz` | Process liveness                |
| `/status`  | Peer, chain and readiness state |
| `/metrics` | Operator metrics                |
| `/rpc`     | Guarded local RPC access        |

Multi-peer mode checks chain and contract pins across upstreams and fails closed when the configured agreement threshold is not met.

## Cloudflare Tunnel

Cloudflare Tunnel maps approved hostnames to loopback services. It does not make a private API safe by itself.

* bind raw node and relay ports to loopback
* expose only named routes
* keep the relay's bearer authentication enabled behind the tunnel
* rate-limit at the application and edge
* monitor both tunnel health and service readiness
* avoid broad wildcard routes to administrative services

## Operator guidance

Use the full-node, lite-node, RPC-gateway and relay pages for installation, health checks and production hardening. The same-host node lab proves software behaviour, but it does not prove independent physical hosts or independent operators.
