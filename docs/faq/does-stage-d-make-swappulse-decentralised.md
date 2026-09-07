---
description: What the successful Stage D physical-host test proves, and what it does not.
---

# Does Stage D make SwapPulse decentralised?

No. Stage D proves that a full observer on a second physical machine can independently store and reproduce the tested `SWAPPULSE_NODELAB_1` state. It does not create decentralised block production or independent operator control.

The successful test showed that:

* the remote observer kept its own persistent chain database;
* it reproduced a checkpoint and the permanent V2 contract pins without privileged keys;
* it survived a stop and restart without changing an older block hash;
* a durable lite verifier obtained matching state from the primary sequencer and the remote observer;
* the primary host recovered the sequencer, same-host observer and both managed lite verifiers automatically after a controlled reboot.

The primary mini-server is still the only node-lab block producer. The same person administered both physical hosts, so `operator_independence` remains `false`. SwapPulse should describe this result as **physical-host state-source independence**, not decentralised consensus.

See [Stage D Multi-host Operations](../network-and-web3/stage-d-operations.md), [Full node and full observer](../network-and-web3/full-node.md), [Lite node](../network-and-web3/lite-node.md) and the [Node Architecture Roadmap](../network-and-web3/node-architecture.md).
