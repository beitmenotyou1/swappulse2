---
description: >-
  Understand the live V2 network, self-custodial identity and community-operated
  infrastructure.
---

# Network & Web3

Architecture and operational guidance for SwapPulse's Cairo and Starknet trust layer.

{% hint style="warning" %}
Network and staking features remain testnet functionality unless a page explicitly states otherwise. Never treat testnet SWPX as an investment or financial product.
{% endhint %}

## Choose the component you want to understand

| Component         | What it is                                                                           | Start here                                  |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| Full observer     | A Madara node that keeps and verifies its own chain state                            | [Full node and full observer](full-node.md) |
| Lite node         | A low-resource local read layer that checks chain and contract pins across RPC peers | [Lite node](lite-node.md)                   |
| RPC gateway       | The public, unauthenticated and read-only chain interface                            | [Read-only RPC gateway](rpc-gateway.md)     |
| Transaction relay | The authenticated, policy-enforcing server-side write interface                      | [Transaction relay](transaction-relay.md)   |

{% hint style="info" %}
The live `SWAPPULSE_TESTNET` and the isolated `SWAPPULSE_NODELAB_1` are different networks. Do not reuse chain IDs, contract addresses, manifests or authority keys between them.
{% endhint %}

For the overall trust model, see [SwapPulse V2 Live Architecture](v2-live-architecture.md). For the path from the current testnet to independent community infrastructure, see [SwapPulse Node Architecture Roadmap](node-architecture.md).
