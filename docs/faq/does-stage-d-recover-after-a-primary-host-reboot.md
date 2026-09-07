---
description: What the controlled Stage D reboot proved about automatic recovery.
---

# Does Stage D recover after a primary-host reboot?

Yes, the tested deployment recovered automatically in the controlled reboot on 7 September 2026.

The primary host returned with the same seven recorded container identities. The sequencer, same-host observer, same-host lite fallback, cross-host lite verifier and three live testnet services all recovered through their reviewed restart policies. No operator manually ran a service start command after the reboot.

Both managed verifiers returned to `ready: true`. The newest recorded pre-reboot block remained identical on the sequencer, same-host observer and keyless remote observer, and the three sources agreed at a later common height.

This is evidence for the tested configuration, not a guarantee for every host or future version. Operators should still record a checkpoint, confirm Docker and Tailscale boot readiness, retain rollback material and repeat the acceptance checks after meaningful runtime changes.

See [Stage D Multi-host Operations](../network-and-web3/stage-d-operations.md) for the reboot checklist and [What happens if the Stage D remote observer goes offline?](what-happens-if-the-stage-d-remote-observer-goes-offline.md) for fail-closed behaviour.
