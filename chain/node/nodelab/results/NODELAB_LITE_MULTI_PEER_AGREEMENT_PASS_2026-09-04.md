# SWAPPULSE_NODELAB_1 lite multi-peer agreement pass — 2026-09-04

## Result

The isolated `SWAPPULSE_NODELAB_1` lite verifier reached and independently verified `multi-peer-agreement` across the Madara sequencer and full observer.

Observed public-safe evidence:

- network: `SWAPPULSE_NODELAB_1`
- chain ID: `0x5357415050554c53455f4e4f44454c41425f31`
- configured peers: `2`
- healthy peers: `2`
- agreement count: `2`
- required agreement: `2`
- contract-pin verified peers: `2`
- `pins_verified: true`
- `peer_agreement: true`
- trust mode: `multi-peer-agreement`
- common height: `2924`
- common block hash: `0x5988c31f9aebe731b2247631b5a03839acbeb985e9ec310d644046ecfddce44`
- `observer_state_independent: true`
- `operator_independence: false`
- local lite read-only RPC returned the expected node-lab chain ID
- `starknet_addInvokeTransaction` was rejected with HTTP `403` / `METHOD_NOT_ALLOWED`
- both `127.0.0.1:19950` and `127.0.0.1:19951` independently verified the full schema-v2 deployment manifest
- both full-node RPCs reproduced `verification_v2_required: true`
- both full-node RPCs reproduced `ecosystem_ready: true`

## Trust boundary

This result proves agreement between two separate Madara state/database processes and catches one-source state faults better than the earlier single-peer lite mode.

It does **not** prove independent physical operators, permissionless consensus or cryptographic light-client proof verification. The sequencer and observer currently share the same physical mini-server, so `operator_independence` correctly remains false.

The next fault-injection gate deliberately stops only the observer and requires the hardened lite verifier to fail closed, stop proxying reads, and recover automatically once the observer is restored from its preserved database.

No private keys, credentials or personal identity data are recorded in this evidence file.
