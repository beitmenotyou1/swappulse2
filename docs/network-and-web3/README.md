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
| Stage D operations       | Two-host topology, durable verifiers, reboot recovery and rollback       | Stage D Multi-host Operations       |
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

The node lab has passed same-host state consistency, V2 deployment and cut-over reproduction, reversible peer-loss tests, a second-physical-host observer, durable same-host and cross-host lite verification, and a controlled primary-host reboot. On 7 September 2026, all seven required containers recovered automatically without a manual service start, retained their identities and reproduced a pre-reboot block through all three full-node state sources.

This proves physical-host state-source independence and reboot recovery for the tested path. It does not prove independent operator control, decentralised sequencing or permissionless consensus. The same-host observer and managed `18101` fallback remain available, while the durable `18102` verifier compares the primary sequencer with the keyless remote observer. Both machines must continue to be described as one operator while that remains true.

Use [Stage D Multi-host Operations](stage-d-operations.md) for the tested topology, start and status commands, failure behaviour and rollback boundaries.
