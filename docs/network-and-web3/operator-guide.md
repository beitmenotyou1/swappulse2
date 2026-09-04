---
description: >-
  Operate current SwapPulse infrastructure and understand the path to community
  nodes.
---

# Community Operator Guide

SwapPulse is being designed so that network services can be maintained by community members rather than by one permanent central operator. This document explains the current testnet, the live application-staking model and the path to permissionless network operation.

## Important: what is live today

The current `SWAPPULSE_TESTNET` is a Starknet Devnet-based development network. It has a canonical runtime and does **not** yet have decentralised sequencer/validator consensus.

That means:

* community members can run the lite node, compatible infrastructure, monitoring, indexing and experimental full-observer services;
* the live testnet `StakingPool` can bond operators to application and service responsibilities;
* staking on the current testnet must **not** be described as securing decentralised consensus;
* production token rewards are **not live** until the Phase 2 contracts, reward policy and governance parameters are deployed and published;
* running a node today does not create an entitlement to future tokens or financial returns.

The long-term target is an appchain/rollup architecture where a permissionless operator set can participate in the network protocol itself. At that point the same staking and operator identity model can be extended to consensus/sequencing duties.

## Operator model

SwapPulse uses the term **community operator** in the product. Some Cairo and Base44 fields still use the historical word `validator` for ABI compatibility. Those names do not imply that the current Devnet has decentralised validators.

An operator is expected to:

1. maintain an always-on service or node;
2. keep software and security updates current;
3. monitor health, storage, memory and connectivity;
4. preserve and verify chain state backups where their role requires state;
5. publish only public endpoints intended for public use;
6. keep private keys, relay tokens, tunnel credentials and admin secrets server-side;
7. respond to incidents and planned upgrades;
8. follow the published protocol version and network configuration;
9. provide verifiable service evidence when the reward system requires it.

## Staking design

The live testnet `StakingPool` provides an economic bond for community-operator participation. It is application staking, not consensus staking.

### Self-stake

A community operator registers with:

* its Starknet smart-account address;
* the opaque on-chain identity bound to that account;
* a minimum self-stake;
* an optional commission rate, capped by the contract.

Registration requires an active, verified identity belonging to the caller. An operator cannot borrow another collector's identity or Proof-of-Usership score.

### Delegation

Collectors can delegate stake to an operator they trust. Delegation increases that operator's active stake weight without transferring ownership of the delegator's identity.

### Active stake vs locked stake

The contract deliberately tracks two different totals:

* `total_staked`: stake currently contributing to active operator weight;
* `total_locked_stake`: all tokens still escrowed by the staking pool, including tokens waiting through the unbonding period.

When an undelegation begins, the amount stops contributing active weight immediately but remains locked until the unbonding period ends.

### Unbonding

Exiting is intentionally delayed. This prevents an operator from instantly removing its economic bond after harmful behaviour becomes detectable.

A second undelegation cannot reset an existing unlock window. Operator self-stake remains slashable while it is unbonding.

### Slashing

The current testnet contract supports owner-governed slashing while governance is still centralised.

Current contract safety properties include:

* only the authorised owner can slash;
* a slash cannot exceed 50% of the operator's currently slashable self-stake in one action;
* slashed tokens are burned rather than transferred into an owner-controlled treasury;
* an operator falling below the minimum self-stake is removed from active weight;
* remaining self-stake enters the normal timed withdrawal path rather than becoming stranded.

Before production, slashing authority must move to a documented governance or cryptographically provable service-fault process. A single administrator must not retain arbitrary production slashing power.

## Rewards and earning the token

The intended incentive loop is:

1. an operator bonds SwapPulse tokens;
2. delegators may back that operator;
3. the operator performs eligible network duties;
4. objective service evidence is recorded for a reward epoch;
5. the reward mechanism allocates the published epoch reward according to eligible service and stake rules;
6. an operator may receive its published commission from rewards attributable to delegated stake;
7. provable harmful behaviour can reduce or slash the operator's bond.

**Reward distribution is not live yet.** The repository currently contains the staking/accountability primitives, but a production reward distributor and governance policy must be implemented, tested and deployed before anybody is promised token earnings.

Rewards must be based on useful, measurable work, not simply on leaving a process running. Candidate service duties include:

* RPC availability and correctness;
* chain/indexer replication;
* event indexing and Base44 synchronisation;
* attestation or verification services under an approved verifier policy;
* archival/state availability;
* future sequencer/validator duties once SwapPulse runs a genuinely decentralised appchain/rollup.

## Proof of Usership

Proof of Usership can scale the weight of stake that already exists. It must never create security weight from nothing.

The current design aggregates approved platform activity into a bounded score and commitment. Private activity details stay off-chain. An operator with zero stake receives zero staking weight regardless of usership score.

## Running infrastructure today

The reference runtime lives under `chain/infra` and uses Docker Compose.

The canonical SwapPulse deployment currently exposes:

* raw Devnet RPC: localhost only, never public;
* read-only public RPC gateway: `rpc.swappulse.org`;
* authenticated write relay: `relay.swappulse.org`;
* live lite node: localhost only on the reference host;
* privileged relay/admin credentials: host-only environment files or a secret manager.

The separate `SWAPPULSE_NODELAB_1` environment has one Madara testing sequencer and one full observer with independent state databases. It is a development proof, not a replacement for the live testnet or a permissionless validator network.

Never expose the raw Devnet RPC to the Internet. Devnet includes administrative methods that are intentionally blocked by the public RPC gateway and transaction relay policy.

### Minimum host practices

A community host should have:

* a supported Linux distribution;
* Docker and Docker Compose;
* persistent SSD storage;
* reliable network connectivity;
* automatic security updates or a documented patch routine;
* host firewalling;
* SSH restricted to a private network such as Tailscale or equivalent;
* monitoring and alerting;
* tested backups where state persistence is part of the role.

The project currently uses Node.js 22.x for Starknet tooling. Contract development uses the pinned Scarb, Cairo, Starknet Foundry and Universal Sierra Compiler versions documented in [chain overview](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/chain-overview).

## Security rules

Operators must never publish or commit:

* Starknet private keys;
* seed phrases;
* `.env.relay`;
* relay bearer tokens;
* Cloudflare tunnel credential JSON;
* Cloudflare account-wide `cert.pem`;
* Base44 secrets;
* age-verification data or other personal identity evidence.

The blockchain stores only pseudonymous identifiers, commitments, verification metadata and other public chain state. Names, email addresses, dates of birth, identity documents and raw verifier responses stay off-chain.

## Required checks before serving traffic

For the reference testnet runtime:

```bash
cd chain/scripts/tooling
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

The result must report `"ok": true`.

The transaction relay must also pass its policy smoke test:

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

The suite must confirm that authorised operations work and that arbitrary invokes, Devnet administration methods, wrong account classes and unauthenticated requests are blocked.

For Cairo changes, run the pinned contract suite on a host with the toolchain installed:

```bash
cd chain
SCARB_BIN=scarb SNFORGE_BIN=snforge bash scripts/test-chain.sh
```

Do not deploy a contract class if the Cairo build or Foundry suite fails.

## Becoming a permissionless operator

The intended production onboarding path is:

1. create or recover a self-custodial SwapPulse smart account;
2. obtain an active on-chain identity verification without placing PII on-chain;
3. install the open-source operator software;
4. synchronise and verify the network configuration;
5. publish the required service endpoint and operator metadata;
6. acquire the required minimum stake through the production distribution mechanism;
7. approve and bond that stake in `StakingPool`;
8. register as a community operator;
9. pass automated health/service checks;
10. begin eligible service epochs;
11. receive rewards only under the published reward policy;
12. remain subject to unbonding and provable-fault penalties.

The goal is that no special relationship with SwapPulse is required beyond satisfying the public protocol and security requirements.

## Roadmap to genuine decentralised maintenance

Before the phrase "anyone can maintain the blockchain and earn rewards" is literally true, SwapPulse must complete these steps:

* complete external review of the deployed OpenZeppelin-based token and staking contracts before real value is introduced;
* implement a deterministic reward distributor with replay/duplicate protection;
* publish reward epochs, emissions, commission rules and supply limits;
* replace central testnet slashing with governance/provable-fault rules;
* define operator discovery and signed service metadata;
* add multi-operator state/indexing services;
* migrate from the single Devnet runtime to an appchain/rollup design with a permissionless sequencer/validator or equivalent operator set;
* test malicious operators, downtime, equivocation where applicable, replay, state recovery and governance failure modes;
* complete an external security review before real value is introduced.

Until those steps are complete, documentation and UI must describe rewards and decentralised consensus as **planned**, not live.

## Related documentation

* [Full node and full observer](full-node.md), current Madara and node-lab status
* [Lite node](lite-node.md), low-resource multi-RPC verification and local reads
* [Read-only RPC gateway](rpc-gateway.md), public read hosting and method policy
* [Transaction relay](transaction-relay.md), protected write hosting and policy controls
* [Cairo and Starknet chain overview](chain-overview.md), contract architecture and privacy boundary
* [Mini PC migration](mini-pc-migration.md), reference always-on runtime migration
* [Zorin local relay](zorin-local-relay.md), historical local relay notes
* `chain/deployments/swappulse-testnet.json` - public deployment metadata only

SwapPulse's objective is permissionless participation without surrendering user custody or privacy. Operators should be able to earn for useful, verifiable work, while users keep control of their own accounts and sensitive identity data remains off-chain.
