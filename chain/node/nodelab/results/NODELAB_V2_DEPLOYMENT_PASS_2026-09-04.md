# SWAPPULSE_NODELAB_1 V2 deployment pass — 2026-09-04

Status: **PASS**

The audited SwapPulse Cairo V2 suite was deployed to the persistent two-node `SWAPPULSE_NODELAB_1` Madara network and independently verified through both the sequencer and observer.

## Network

- network: `SWAPPULSE_NODELAB_1`
- chain ID: `0x5357415050554c53455f4e4f44454c41425f31`
- sequencer RPC: `127.0.0.1:19950`
- observer RPC: `127.0.0.1:19951`
- observer privilege separation: PASS
- live SwapPulse Devnet/RPC/relay/lite isolation: PASS

## Fresh authority

The registry owner/deployer and verifier are separate fresh `SwapPulseAccount` contracts created specifically for the node-lab. The deterministic Madara devnet account was used only as a one-time bootstrap fixture and is not a SwapPulse authority.

## Deployed V2 contracts

- IdentityRegistry: `0x717ec7ddc5d87e0e8fd693ea5c93df7ef23ed80d11bc4e7d6086f959a531696`
- NativeToken (SWPX): `0x2986d89c16806cd8f7347b9ca960eb38589d26bdcd68fd4f98f246e2a7c13e6`
- CardNft: `0x2c42a168f1e83030d0851fb911b803b49219bf3bb4470512637e673d69db0ba`
- ProofOfUsership: `0x1be5cf5d304085b14db171b44208c2f6356d84dc9de56141266cbe05a385854`
- StakingPool: `0x44eea955000097144598f6ba1f7d0b47ad5531b217f54963b210ffa74ab68c3`
- BridgeAdapter: `0x4b314af54ab47ff455668d43c3c92ee73bc2e83918d2b886fd5ef79d7ba6ed4`

The `SwapPulseAccount` class was already declared during authority bootstrap.

## Verification

Both nodes independently verified:

- exact node-lab chain ID;
- IdentityRegistry class hash and owner;
- separate authorised verifier;
- SwapPulseAccount declaration;
- SWPX, CardNft, ProofOfUsership, StakingPool and BridgeAdapter class hashes;
- ownership of support contracts;
- StakingPool token/registry/usership wiring;
- BridgeAdapter token/CardNft wiring;
- BridgeAdapter NativeToken minter permission;
- CardNft bridge configuration;
- staking parameters;
- external bridge destinations remain disabled.

`ecosystem_ready` was `true` through both RPCs.

## V2 cut-over state

`identity_verification_mode` is `V2`, but `verification_v2_required` remains **false**.

This is intentional. The irreversible `require_verification_v2()` switch must not be invoked until the node-lab has completed a genuine V2 identity/assurance transaction, replay rejection, expiry/revocation checks and staking-path verification.

## Canonical manifest

Tracked public manifest:

`chain/deployments/swappulse-nodelab-1.json`

No private key or private identity data is included in the manifest or this result note.
