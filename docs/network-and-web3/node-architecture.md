---
description: Node Architecture documentation for SwapPulse.
---

# SwapPulse Node Architecture Roadmap

This document defines the target architecture for community-operated SwapPulse nodes. It deliberately separates the **current network reality** from the decentralised architecture we want to build.

## 1. Current reality

There are two deliberately separate environments:

1. The live `SWAPPULSE_TESTNET` uses a single Shardlabs Starknet Devnet runtime on the always-on mini-server. Its public read gateway, protected relay and lite node are live.
2. The isolated `SWAPPULSE_NODELAB_1` uses a Madara testing sequencer and a separately synchronising full observer with different databases and a unique chain ID. The two-node consistency, V2 deployment, application exercise, permanent V2 cut-over and lite-node agreement tests passed on 4 September 2026.

Live infrastructure:

| Public surface                  | Local service                                            | Upstream                                        |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| `https://rpc.swappulse.org/rpc` | Read-only RPC gateway on loopback                        | Private Starknet Devnet RPC on `127.0.0.1:5050` |
| `https://relay.swappulse.org`   | Authenticated, allowlisted transaction relay on loopback | Private Starknet Devnet RPC on `127.0.0.1:5050` |

Node-lab infrastructure:

| Component                | Host endpoint                  | Connection                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------ |
| Madara testing sequencer | `127.0.0.1:19950`              | Produces isolated node-lab blocks                |
| Madara full observer     | `127.0.0.1:19951`              | Synchronises through the internal feeder gateway |
| Feeder gateway           | Docker bridge port `8080` only | Never published to the host or Internet          |
| Lite agreement verifier  | `127.0.0.1:18101`              | Compares sequencer and observer state            |

The node-lab observer has no sequencer or deployer private key and reproduced the final V2 state from its own database. Both nodes currently run on the same physical mini-server, and only the testing sequencer produces blocks. This is independent state synchronisation, not independent operators or permissionless consensus.

The current community `StakingPool` is an on-chain economic/accountability layer for SwapPulse operator services. **It is not currently decentralised block consensus.**

A second machine cannot become a real consensus validator merely by running the existing Docker Compose file.

Dedicated hosting guides:

* [Full node and full observer](full-node.md)
* [Lite node](lite-node.md)
* [Read-only RPC gateway](rpc-gateway.md)
* [Transaction relay](transaction-relay.md)

## 2. Goal

The long-term goal is a network where independent community members can run useful SwapPulse infrastructure without needing data-centre hardware or specialist expertise.

Target principles:

* low hardware barrier;
* verifiable participation;
* no privileged keys in browser software;
* open-source node packaging;
* multiple independent operators;
* resilience against a single home/server failure;
* clear separation between reading, storing, indexing and consensus roles;
* incentives tied to measurable useful work rather than simply leaving a process running;
* user self-sovereignty;
* no private personal data replicated as part of node operation.

Raspberry Pi 4/5-class devices are important target hardware, but support must be proven by benchmarks for each node role before it is advertised as production-ready.

## 3. Node roles

### 3.1 Lite node

A lite node is the lowest-resource community node.

Target responsibilities:

* maintain trusted/verifiable chain headers/checkpoints required by the final protocol;
* verify proofs/commitments available to the client mode;
* query multiple full nodes/RPC peers rather than trusting one server;
* relay user-signed transactions to approved ingress peers;
* provide local read access for Wallet/Explorer/client software;
* detect conflicting/unavailable peers;
* optionally participate in peer discovery/health reporting.

A lite node should **not** claim to independently store and execute the complete historical chain unless it actually does.

Target hardware profile:

```
Raspberry Pi 4 4GB: stretch target for minimal client mode
Raspberry Pi 4 8GB: primary Pi 4 lite-node target
Raspberry Pi 5 8GB+: preferred low-cost lite node
64-bit Linux
SSD strongly preferred over SD card for sustained operation
```

Exact CPU/RAM/storage/bandwidth requirements remain benchmark outputs, not promises.

### 3.2 Full observer node

A full observer independently synchronises and verifies the full chain state required by the chosen SwapPulse appchain/rollup architecture.

Target responsibilities:

* execute/verify all required state transitions;
* store current state;
* retain the configured amount of block/history data;
* serve read RPC to local or authorised remote clients;
* validate blocks/batches produced by network operators;
* reject invalid state transitions;
* participate in peer-to-peer propagation where supported;
* supply independently verified data to local Explorer/Wallet services.

A full observer does not automatically have block-production authority.

Target hardware tiers to benchmark:

```
Tier L: Raspberry Pi 4 8GB + USB3 SSD
Tier M: Raspberry Pi 5 8GB/16GB + NVMe
Tier H: x86-64/ARM mini PC, 16GB+ RAM, NVMe
```

The project objective is to make Tier L practical in a pruned/full-observer mode if performance data proves it safe. If it does not, the requirement must be published honestly rather than lowering validation guarantees.

### 3.3 Validator / sequencer / block producer

This is a future role and does **not** exist as decentralised consensus on the current Devnet.

The exact name depends on the final Starknet appchain/rollup consensus architecture.

Possible responsibilities:

* accept transactions from the network;
* propose/order blocks or batches;
* execute transactions;
* participate in consensus/finality;
* post required commitments/proofs to settlement;
* maintain an economic bond;
* be slashable for objectively provable protocol faults where safe/appropriate.

A validator must also be capable of full verification. A low-resource `lite node` must never be described as a validator unless the final protocol specifically enables that security model.

### 3.4 Archive/indexer node

Explorer-style history is a separate resource problem from consensus validation.

An archive/indexer node can provide:

* complete transaction/address history;
* event indexing;
* API/search indexes;
* historical analytics;
* explorer acceleration.

This role may need substantially more disk than a pruned full validator/observer.

Separating indexing from validation is what allows ordinary full nodes to remain affordable while still supporting a rich Etherscan-style Explorer through volunteer/community indexers.

### 3.5 Gateway/relay node

During migration, some community nodes may provide read gateways, transaction relays or peer gateways without holding consensus power.

These services must be labelled accurately.

## 4. Proposed network evolution

### Phase 0: current hardened V2 testnet

Status: complete baseline.

* one Devnet runtime;
* read-only public RPC gateway;
* hardened authenticated transaction relay;
* permanent V2 identity policy;
* SWPX/staking/application contracts live;
* community operator staking is not consensus.

### Phase 1: reproducible observer package

Status: working on the same-host node lab; independent physical-host/operator deployment remains pending.

Goal: make it easy for another machine to reproduce and independently verify the public chain state/read surface.

Deliverables:

* one-command/containerised observer setup;
* no production private keys included;
* deterministic config from a public network manifest;
* peer/bootstrap configuration;
* health/readiness endpoints;
* public verification script;
* Pi/mini-PC benchmark harness;
* documentation for backup/upgrade/recovery.

The current node-lab observer already runs without relay, owner, verifier, sequencer or deployer keys and reproduces the expected state. The remaining success criterion is to repeat that result on an independently administered physical machine and prove restart, offline catch-up and upgrade behaviour.

### Phase 2: lite client

Status: v0.1 prototype is runnable. It verifies chain and contract pins and detects multi-peer agreement or disagreement. Cryptographic storage-proof or consensus-proof verification remains future work.

Goal: low-resource client that can verify enough network information to avoid blindly trusting a single SwapPulse RPC.

Deliverables:

* multiple peer/RPC support;
* checkpoint/proof verification appropriate to the chosen protocol;
* local Wallet/Explorer endpoint;
* signed transaction relay;
* offline/peer-conflict diagnostics;
* Pi 4/5 package.

### Phase 3: multi-operator development network

Status: the one-sequencer/one-observer Madara topology is proven on one host. Multiple independent operators and consensus/finality are not yet implemented.

Goal: replace the single-runtime assumption with an actual multi-node network architecture.

Before implementation, select/validate the appropriate Starknet appchain/rollup stack and consensus/settlement model.

Requirements:

* multiple independent operators;
* no single shared validator private key;
* deterministic genesis/network config;
* peer discovery;
* fault/restart tests;
* consensus/finality tests;
* network partitions;
* malicious/invalid proposal testing;
* state-sync testing;
* version upgrade procedure.

### Phase 4: permissionless/community validator testnet

Goal: allow eligible community operators to join using documented public software.

Requirements before opening participation:

* objective validator admission/exit rules;
* staking/bond integration;
* tested slashing/fault policy;
* key rotation/recovery;
* governance emergency procedures with transparent limits;
* Sybil/economic analysis;
* reward model;
* monitoring and reproducible node builds.

### Phase 5: hardened decentralised network

Goal: remove single-operator assumptions from critical network availability/validation.

This is the point where marketing can accurately describe community validators as securing/validating the network, provided independent security/reliability evidence supports it.

## 5. Hardware benchmark protocol

Do not define support only by whether the process starts.

Each candidate device must be tested for:

* initial sync time;
* steady-state block processing latency;
* peak RAM;
* swap behaviour;
* disk usage;
* disk write amplification;
* CPU temperature/throttling;
* bandwidth;
* restart recovery time;
* catch-up after 1h/24h offline;
* proof/verification latency;
* RPC latency under load;
* sustained operation (minimum multi-day soak test);
* upgrade/migration time.

### Suggested acceptance profile

A device can be labelled supported for a role only if it:

* maintains chain head within the role's required tolerance;
* does not persistently thrash swap;
* does not corrupt state across forced restart;
* can catch up after realistic downtime;
* stays within safe thermal/storage limits;
* passes verification/state-root checks;
* has enough free storage headroom for expected growth.

## 6. Raspberry Pi design principles

To make low-cost hardware viable:

* use 64-bit OS builds;
* prefer SSD/NVMe, not long-term chain writes to low-end SD cards;
* support pruning for non-archive full nodes;
* make indexer/history optional;
* minimise unnecessary Docker/service overhead in node-only images;
* avoid requiring Base44/PDS/WordPress/community services on the same device;
* expose metrics/health with low overhead;
* document safe cooling/power supply requirements;
* provide unattended upgrade paths with rollback.

A Pi running a node should not need to host the entire SwapPulse website stack.

## 7. Network identity and keys

Node/operator identity must be separate from ordinary user private identity.

Potential public node information:

* operator smart-account address;
* validator/node public key;
* peer/node ID;
* software version;
* service endpoint;
* stake/bond;
* uptime/service proofs.

Never distribute:

* validator private key;
* Base44 relay token;
* registry/verifier admin private key;
* user signer private key;
* PDS admin password.

## 8. SWPX incentives

The goal is to reward useful, verifiable network contribution, not simply claimed uptime.

Potential future reward categories:

* validator/block-production work;
* independently verified full-node availability;
* archive/indexer service;
* proof-generation/verification service where applicable;
* relay/gateway service;
* network health/availability commitments.

Rewards should be based on objective on-chain or cryptographically verifiable evidence where possible.

### What not to do

Do not pay solely because a central Base44 database says a node was online.

Do not create a browser-controlled privileged faucet for operator rewards.

Do not promise a fixed financial return.

Do not enable rewards before the emission/tokenomics impact is explicitly reviewed.

## 9. Staking integration

The existing `StakingPool` provides a starting economic primitive but it must not be assumed to be the final consensus staking mechanism.

Future consensus integration needs to decide:

* whether validator stake is the same pool or a separate contract;
* validator minimum stake;
* delegation rules;
* commission;
* exit/unbonding;
* slashable offences;
* who/what can prove a slash condition;
* reward accounting;
* governance constraints.

Security-sensitive slashing logic should favour objectively provable protocol violations over subjective admin judgement.

## 10. Governance

Community participation may eventually include protocol governance.

Governance should be staged and bounded.

Possible progression:

1. signalling polls;
2. on-chain proposal records;
3. time-delayed parameter changes;
4. narrowly scoped executable governance;
5. broader governance only after security review.

Critical safety constraints:

* governance must not expose private identity data;
* emergency powers must be transparent and limited;
* upgrades need delay/review mechanisms where practical;
* token wealth alone should not automatically grant unlimited control over user identity/security.

## 11. Lite-node trust model

A lite node should minimise trust, not merely forward all requests to `rpc.swappulse.org`.

The final design should prefer:

* multiple independently operated peers;
* verifiable headers/checkpoints/proofs;
* local validation of responses where feasible;
* detection of peer disagreement;
* pinned network/genesis identifiers;
* signed/versioned network manifests.

If a capability cannot be independently verified by the lite client, the UI/docs must disclose the remaining trust assumption.

## 12. Full-node trust model

A full observer should be able to derive/verify the canonical state under the final protocol without trusting Base44.

Base44 may consume full-node data but must not be required for the node to decide whether a chain state transition is valid.

## 13. Explorer/indexer architecture

A future full explorer should query independent indexer services rather than force every validator/full node to maintain expensive address-history indexes.

Proposed model:

```
full nodes / validator nodes
       |
       +--> event/block stream
                    |
                    v
            community indexers
                    |
                    v
            explorer query API
```

The public Explorer should be capable of comparing/failing over between multiple indexers once available.

## 14. Network upgrades

Every node release should have:

* semantic/versioned node software;
* supported protocol version range;
* migration instructions;
* rollback boundaries;
* checksums/signatures for release artifacts;
* network upgrade activation height/time where required;
* testnet rehearsal before mandatory upgrades.

## 15. Security tests for the decentralised phase

At minimum:

* invalid blocks/batches;
* equivocation/double proposal where relevant;
* replayed transactions;
* invalid signatures;
* stale/future protocol versions;
* peer flooding/resource exhaustion;
* corrupt snapshot/state sync;
* malicious RPC/indexer response;
* network partition;
* validator offline/rejoin;
* key rotation;
* validator exit;
* reward manipulation;
* slashing manipulation;
* low-disk/low-memory behaviour;
* clock skew;
* unclean power loss on Pi-class hardware.

## 16. Privacy

Nodes should replicate public chain data only.

Private Base44 records, private AT/PDS credentials, identity evidence and private messages must not become node-state requirements.

## 17. Packaging goal

Eventually the node UX should be closer to:

```bash
curl -fsSL <verified installer> | less
# inspect first

swappulse-node install --role lite
# or
swappulse-node install --role full

swappulse-node status
swappulse-node verify
swappulse-node update
```

The actual installer should be signed/versioned and should not be introduced until the node implementation exists.

## 18. Definition of done for 'community full nodes'

SwapPulse should only claim community full-node support when:

* independent machines can join from public documentation;
* they independently verify the intended canonical state;
* at least one supported low-cost hardware profile passes benchmark/soak tests;
* no production private keys are shared with operators;
* state sync/recovery works;
* network upgrade process is documented;
* monitoring demonstrates more than one independent operator.

## 19. Definition of done for 'community validators'

SwapPulse should only claim decentralised/community validation when:

* multiple independent operators genuinely participate in block/batch consensus/finality;
* removing the original mini-server does not halt all validation permanently;
* validator keys are independently controlled;
* validator admission/exit is documented;
* fault/malicious validator tests pass;
* staking/reward/slashing semantics are live and independently verifiable;
* public network metrics prove distribution.

## 20. Next implementation step

Do **not** jump directly from the current Devnet into public permissionless validation.

The next engineering task should be Phase 1:

1. evaluate the appropriate Starknet appchain/rollup node stack for SwapPulse;
2. define a deterministic public network manifest/genesis model;
3. build an independent observer/full-node prototype;
4. create the benchmark harness;
5. test Raspberry Pi 4/5 and mini-PC profiles;
6. publish measured results;
7. only then design the multi-validator migration.
