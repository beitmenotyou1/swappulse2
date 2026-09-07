---
description: The status checks and fields that define a healthy Stage D deployment.
---

# How do I check whether Stage D is healthy?

Run the status script for both managed lite services on the primary host:

```bash
cd chain/node/stage-d/reboot-support
bash status.sh .env

cd ../lite-service
bash status.sh .env
```

Both checks should pass. Each service should report `ready: true`, `multi-peer-agreement`, two healthy peers, two verified pin sets, `peer_agreement: true`, `independently_verified: true`, `observer_state_independent: true` and `last_error: null`.

The honest operator field remains `operator_independence: false` while one person controls both hosts. That value is expected and is not a health failure.

Port `18101` checks the primary sequencer against the same-host observer. Port `18102` checks the primary sequencer against the remote observer. One healthy service does not erase a failure in the other trust path.

If either `/readyz` endpoint returns HTTP `503`, inspect its `/status` response and restore the missing peer, private route, matching block state or contract pins. Do not reduce the required quorum.

See [Stage D Multi-host Operations](../network-and-web3/stage-d-operations.md) for endpoint commands, failure handling and rollback boundaries.
