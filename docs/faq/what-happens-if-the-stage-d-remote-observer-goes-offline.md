---
description: >-
  How the cross-host lite verifier behaves when its remote full observer is
  unavailable.
---

# What happens if the Stage D remote observer goes offline?

The cross-host lite verifier fails closed. With exactly two configured peers, both peers must be healthy, match the expected chain and contract pins, and agree on the common block hash.

If the remote observer is unavailable, the verifier reports insufficient peer agreement, `/readyz` returns HTTP `503`, and the local read-only `/rpc` endpoint also refuses requests rather than silently trusting the remaining sequencer.

The remote observer's normal stop script preserves its named database volume. After restarting it, operators must rerun the checkpoint and permanent V2 verification and confirm that lite-node agreement has returned.

The durable cross-host verifier on `127.0.0.1:18102` therefore becomes unready. The separate managed fallback on `127.0.0.1:18101` can continue comparing the primary sequencer with the same-host observer, but it represents a different, local trust path. Operators must not report the cross-host trust condition as healthy merely because the fallback remains available.

Both services recovered automatically in the controlled primary-host reboot test. A remote-host outage still requires the remote observer to return, catch up and pass the full checkpoint and V2 verification before `18102` is trusted again.

See [Stage D Multi-host Operations](../network-and-web3/stage-d-operations.md) for daily checks and recovery, [Full node and full observer](../network-and-web3/full-node.md) for restart verification and [Lite node](../network-and-web3/lite-node.md) for quorum behaviour.
