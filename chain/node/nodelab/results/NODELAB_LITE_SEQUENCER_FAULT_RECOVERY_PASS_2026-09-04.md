# SWAPPULSE_NODELAB_1 lite sequencer fault/recovery pass — 2026-09-04

## Result

The isolated `SWAPPULSE_NODELAB_1` lite verifier correctly failed closed when the Madara testing sequencer was deliberately stopped while the independently synchronising full observer remained available. Two-peer agreement recovered automatically after the sequencer restarted from its preserved database.

Pre-fault state:

- lite trust mode: `multi-peer-agreement`
- configured peers: `2`
- healthy peers: `2`
- agreement count: `2`
- required agreement: `2`
- contract-pin quorum: `2/2`
- `pins_verified: true`
- `ready: true`
- sequencer confirmed head: `3353`
- observer confirmed head: `3353`
- permanent V2 state independently verified through both Madara RPCs

## Deliberate sequencer loss

Only `swappulse-nodelab-1-sequencer-1` was stopped. The full observer remained healthy, and the live legacy SwapPulse RPC gateway, transaction relay and existing lite node remained healthy.

The node-lab lite verifier reported:

- `ready: false`
- `peer_agreement: false`
- `trust_mode: multi-peer-disagreement`
- configured peers: `2`
- healthy peers: `1`
- agreement count: `1`
- required agreement: `2`
- `pins_verified: false`
- pin-verified peers: `1`
- `independently_verified: false`
- `last_error: INSUFFICIENT_PEER_AGREEMENT`

`/readyz` returned HTTP `503`.

A valid read request (`starknet_chainId`) through the lite `/rpc` endpoint also returned HTTP `503` with `NO_VERIFIED_PEER`. The verifier therefore did not silently fall back to trusting the surviving observer alone.

## Recovery

The sequencer was restarted from its existing named volume and returned on its loopback RPC. The lite verifier automatically returned to `multi-peer-agreement` after the observer and sequencer again agreed at a common height.

Post-restore heads:

- sequencer: `3355`
- observer: `3354`

Both are at or above their pre-fault confirmed height, providing evidence that the sequencer resumed from preserved state and the observer retained continuity during the producer outage.

The final full agreement verifier passed again, including permanent V2 state through both Madara RPCs and read-only enforcement on the lite RPC.

## Stage-C conclusion

Together with the observer-loss test, this closes the same-host availability fault pair for `SWAPPULSE_NODELAB_1`:

1. observer loss fails closed and recovers from preserved observer state;
2. sequencer loss fails closed and recovers from preserved sequencer state;
3. the surviving peer is never silently promoted to sufficient trust by the lite verifier;
4. live `SWAPPULSE_TESTNET` services remain isolated throughout.

This does **not** prove Byzantine consensus, leader failover, permissionless validation or independent physical/operator decentralisation. Both Madara processes still run on the same mini-server.

No private key, bearer token or PII is recorded in this evidence file.