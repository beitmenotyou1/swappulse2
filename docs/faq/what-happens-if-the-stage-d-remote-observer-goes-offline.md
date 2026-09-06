---
description: >-
  How the cross-host lite verifier behaves when its remote full observer is
  unavailable.
---

# What happens if the Stage D remote observer goes offline?

The cross-host lite verifier fails closed. With exactly two configured peers, both peers must be healthy, match the expected chain and contract pins, and agree on the common block hash.

If the remote observer is unavailable, the verifier reports insufficient peer agreement, `/readyz` returns HTTP `503`, and the local read-only `/rpc` endpoint also refuses requests rather than silently trusting the remaining sequencer.

The remote observer's normal stop script preserves its named database volume. After restarting it, operators must rerun the checkpoint and permanent V2 verification and confirm that lite-node agreement has returned.

The tested Stage D canary used a separate loopback port, so the existing same-host verifier and the live SwapPulse services were not replaced or stopped. The same-host observer should remain available as a fallback until the cross-host verifier has a durable, reboot-tested service definition.

See [Full node and full observer](../network-and-web3/full-node.md) for restart verification and [Lite node](../network-and-web3/lite-node.md) for readiness and quorum behaviour.
