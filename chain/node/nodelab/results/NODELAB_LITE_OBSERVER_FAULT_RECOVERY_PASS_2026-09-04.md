# SWAPPULSE_NODELAB_1 lite observer fault/recovery pass — 2026-09-04

## Result

The isolated `SWAPPULSE_NODELAB_1` lite verifier correctly failed closed when the independently synchronising Madara observer was deliberately stopped, then automatically recovered two-peer agreement after the observer restarted from its preserved database.

Pre-fault state:

- lite trust mode: `multi-peer-agreement`
- configured peers: `2`
- healthy peers: `2`
- agreement count: `2`
- required agreement: `2`
- contract-pin quorum: `2/2`
- `pins_verified: true`
- `ready: true`
- observer confirmed head before fault: `3133`
- permanent V2 verification independently passed through both Madara RPCs

## Deliberate observer loss

Only `swappulse-nodelab-1-observer-1` was stopped. The sequencer remained healthy and the live legacy SwapPulse RPC gateway, transaction relay and existing lite node remained healthy.

The node-lab lite verifier then reported:

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

A valid read request (`starknet_chainId`) through the lite `/rpc` endpoint also returned HTTP `503` with `NO_VERIFIED_PEER`. The verifier therefore did not silently fall back to trusting the remaining sequencer alone.

## Recovery

The observer was restarted using the existing named volume and returned through its loopback RPC. The lite verifier automatically returned to:

- `ready: true`
- `peer_agreement: true`
- `trust_mode: multi-peer-agreement`
- healthy peers: `2`
- agreement count: `2`
- pin-verified peers: `2`
- `pins_verified: true`
- `independently_verified: true`

The restored observer head was `3137`, above its pre-fault confirmed head `3133`, providing evidence that it resumed from preserved state rather than silently starting a fresh database.

The final full agreement verifier passed again, including permanent V2 state through both Madara RPCs and read-only enforcement on the lite RPC.

## Trust boundary

This proves fail-closed behaviour and automatic recovery for loss of one configured state source. It does **not** prove independent physical-operator decentralisation or permissionless consensus because both Madara processes still run on the same mini-server.

No private key, bearer token or PII is recorded in this evidence file.
