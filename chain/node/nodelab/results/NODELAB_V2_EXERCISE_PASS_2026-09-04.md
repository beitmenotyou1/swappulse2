# SWAPPULSE_NODELAB_1 pre-cutover V2 exercise pass

Date: 2026-09-04

`SWAPPULSE_NODELAB_1` completed the bounded genuine pre-cutover V2 identity/assurance/staking exercise successfully.

## Result

- network: `SWAPPULSE_NODELAB_1`
- chain id: `0x5357415050554c53455f4e4f44454c41425f31`
- IdentityRegistry: `0x717ec7ddc5d87e0e8fd693ea5c93df7ef23ed80d11bc4e7d6086f959a531696`
- StakingPool: `0x44eea955000097144598f6ba1f7d0b47ad5531b217f54963b210ffa74ab68c3`
- test identity id: `0x60c3abeec5c5a731fafeaa4eac43e975bb0e53c2049aae11c9dcbc8e1a321b`
- test SwapPulseAccount: `0x5b822e5947c3883f32a7622557361b663fc146d2ea342fea9381b48b388f823`
- authorised verifier: `0x6a51b1f7a7c9cec10b442ee790c0c21627f362f796cfb57d7e262aa621c6d3b`
- final attestation id: `0xd2c30d1b36145622f3926024cccaa02b37099e5449eda0c10cfd6aa77482f1`
- observer verified height: `1561`
- final self stake: `110000000000000000000` (110 SWPX)
- `verification_v2_required`: `false`

## Security properties proven on the running chain

- fresh user SwapPulseAccount deployment and opaque identity binding succeeded;
- V2 assurance was written by the separately authorised verifier;
- replaying an already-used attestation id was rejected;
- application staking required the verified identity and succeeded at the configured 100 SWPX minimum;
- `increase_self_stake` succeeded and raised self stake to 110 SWPX;
- a short-lived V2 assurance expired according to produced-block time;
- expiry did not erase the immutable assurance/audit record;
- validator/application stake remained locked and intact through verification expiry;
- a new V2 assurance reactivated the identity after expiry;
- explicit verification revocation made the identity ineffective;
- a final fresh V2 assurance restored valid V2 state;
- the independent observer reproduced the final identity, assurance and staking state;
- sequencer and observer returned the same block hash at height 1561;
- the permanent V2 requirement switch remained disabled throughout.

Private keys and local test secret material were not written to this evidence record.

## Next gate

The next operation is the deliberately irreversible node-lab cut-over. It must prove all of the following in one bounded run:

1. `verification_v2_required` becomes true on sequencer and observer;
2. legacy `set_verification()` is rejected with `VERIFY_V2_REQUIRED`;
3. fresh `set_verification_v2()` remains functional;
4. replay protection remains active after cut-over;
5. post-cutover expiry behaves normally while existing stake survives;
6. application self-stake can still be increased after cut-over;
7. a final fresh V2 assurance is reproduced by the observer;
8. invoking `require_verification_v2()` again cannot disable the one-way state.
