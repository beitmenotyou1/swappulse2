# SWAPPULSE_NODELAB_1 permanent V2 cut-over pass — 2026-09-04

## Result

`SWAPPULSE_NODELAB_1` completed the irreversible IdentityRegistry V2 cut-over successfully.

Public cut-over evidence reported:

- `ok: true`
- `irreversible: true`
- chain ID `0x5357415050554c53455f4e4f44454c41425f31`
- `verification_v2_required: true`
- legacy V1 verification rejected immediately after cut-over
- legacy V1 verification still rejected after a post-cutover V2 assurance expired
- V2 replay protection remained active after cut-over
- post-cutover V2 assurance expiry was observed on produced blocks
- final V2 assurance remained active
- final verification type `1`, level `3`
- validator/application-operator status remained active
- self stake increased from `110000000000000000000` to `115000000000000000000` using `increase_self_stake`
- independent observer reproduced the final state at height `1966`
- sequencer and observer returned the same block hash at height `1966`
- live legacy SwapPulse RPC gateway, transaction relay and lite-node service stayed healthy throughout

## Permanent switch transaction

`require_verification_v2()` committed in transaction:

`0x37f398aa05b4101df2960b5706a855ad98851c4efc22b014c6e83c28f197248`

The harness then invoked the idempotent owner entrypoint a second time and verified that the permanent flag remained true:

`0x9a848d71ae50a559d6b289054d02142dbfaa7df3383dcabf685eddf1de52c0`

There is intentionally no contract method to turn this requirement off.

## Post-cutover security proofs

The cut-over harness proved all of the following against real node-lab state rather than test cheats:

1. `verification_v2_required()` became true on the sequencer.
2. The full observer independently reproduced the true flag.
3. Legacy `set_verification()` reverted with `VERIFY_V2_REQUIRED` immediately after the switch.
4. A new `set_verification_v2()` transaction still succeeded.
5. Reusing its attestation id reverted with `ATTESTATION_REPLAY`.
6. The already-registered application operator used `increase_self_stake` rather than duplicate registration.
7. A short-lived post-cutover V2 assurance expired normally.
8. Expiry did not free the consumed replay id, remove the audit assurance, disable the permanent flag or remove application stake.
9. Legacy V1 remained blocked after expiry.
10. A final non-expiring V2 assurance restored active verification.
11. Sequencer and observer reproduced the same final identity, assurance and staking state.

## Trust boundary

This proves the permanent V2 application/identity semantics on the isolated Madara node-lab. It does **not** claim permissionless consensus or independent physical operators. The current lab has one testing sequencer and one independently synchronising full observer on the same reference host.

No private key or PII is recorded in this evidence file.
