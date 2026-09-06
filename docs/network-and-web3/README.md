---
description: >-
  Understand the live SwapPulse V2 network, Cairo contracts, verification
  policy, chain state, self-custodial identity and community-operated
  infrastructure.
---

# Network & Web3

Architecture, contract and operational guidance for SwapPulse's Cairo/Starknet trust layer.

{% hint style="warning" %}
Network and staking features remain testnet functionality unless a page explicitly states otherwise. Never treat testnet SWPX as an investment or financial product.
{% endhint %}

## Start with the layer you need

| Topic                   | What it covers                                                           | Guide                               |
| ----------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| Live V2 architecture    | End-to-end Base44 / Cairo / relay trust model                            | SwapPulse V2 Live Architecture      |
| Cairo contracts         | Contract-by-contract responsibilities, live pins and security invariants | Cairo Contracts Reference           |
| Cairo/Starknet overview | Toolchain, deployment discipline and architecture split                  | Cairo and Starknet Chain Overview   |
| Identity registry       | Identity binding, V2 assurance, replay protection and revocation         | Identity Registry                   |
| Permanent V2            | One-way V2-only policy and expiry semantics                              | Permanent V2 Verification Policy    |
| Verifier logic          | Private verifier -> Base44 -> relay -> on-chain assurance                | Verifier Logic and Assurance        |
| Chain state             | Authority hierarchy, reconciliation and fail-closed mirrors              | Chain State and Reconciliation      |
| Community staking       | Operator/delegation lifecycle and staking rules                          | Community Staking                   |
| Full observer           | Madara node with its own verified state database                         | Full node and full observer         |
| Lite node               | Low-resource peer/pin checking and read-only RPC                         | Lite node                           |
| Transaction relay       | Protected policy-enforcing write boundary                                | Transaction Relay API and Policy    |
| Read-only RPC           | Public read gateway and supported RPC policy                             | Read-only RPC gateway               |
| Operator operations     | Current infrastructure duties and community-node path                    | Community Operator Guide            |
| Node roadmap            | Path toward independent community infrastructure                         | SwapPulse Node Architecture Roadmap |

## Live network identity

The live application network is `SWAPPULSE_TESTNET`.

Its V2 identity policy is permanently enabled:

```
identity_verification_mode = V2
verification_v2_required = true
```

The isolated `SWAPPULSE_NODELAB_1` is a different engineering network. Do not reuse chain IDs, addresses, manifests or authority keys between the live testnet and the node lab.

## Read versus write boundaries

Public reads use the reviewed read-only RPC path.

Privileged or user-approved writes use Base44 orchestration and the narrow transaction relay policy. The browser never receives registry/verifier private keys or the relay bearer token.

## Privacy rule

Personal identity evidence remains off-chain. The public chain contains opaque identity references, commitments, generic assurance metadata, timestamps, expiry/revocation and other protocol state, not plaintext personal data.

## Node-lab status

The same-host node lab has passed two-node state consistency, V2 deployment/cut-over reproduction, lite-node multi-peer agreement and observer/sequencer availability-loss recovery tests.

Stage D introduces a second physical host through a private overlay, but infrastructure should not be described as independently operated until the remote-host evidence and operator-independence requirements are actually satisfied.
