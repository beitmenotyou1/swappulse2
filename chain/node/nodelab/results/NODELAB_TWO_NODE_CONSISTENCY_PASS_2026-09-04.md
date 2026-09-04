# SWAPPULSE_NODELAB_1 two-node consistency pass — 2026-09-04

## Status

PASS for the initial persistent sequencer + independent full-observer topology.

This is a development-network consistency milestone. It is not permissionless consensus, production finality or a mainnet migration claim.

## Network identity

- Human-readable chain ID: `SWAPPULSE_NODELAB_1`
- Starknet felt: `0x5357415050554c53455f4e4f44454c41425f31`
- Madara image: `ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6`

## Persistent sequencer result

The corrected sequencer used:

```text
--base-path /var/lib/madara
host RPC 127.0.0.1:19950 -> container 9944
```

Startup evidence:

```text
Opening database at: /var/lib/madara
Creating new database at version 14
Starting chain with block: empty state
Deploying devnet genesis block
```

Sequencer verification:

```text
chain_id=0x5357415050554c53455f4e4f44454c41425f31
confirmed_head=5
head_block_hash=0x10e9d269cb9d878e0075a86c1e5303d85bdcccf87b7f05c593bb8f2633713ea
SEQUENCER RPC: PASS
VERIFY SEQUENCER: PASS
```

## Independent observer result

The observer used its own persistent volume and `--full` mode. It was not passed `--devnet` or `--private-key`.

At verification time both nodes reported confirmed head 10 and the same block hash:

```text
sequencer_chain_id=0x5357415050554c53455f4e4f44454c41425f31
observer_chain_id=0x5357415050554c53455f4e4f44454c41425f31
sequencer_head=10
observer_head=10
common_height=10
sequencer_hash=0x29a831babcc90b85c48cff250b52840c98176f8f1522faea1d6b2180626766c
observer_hash=0x29a831babcc90b85c48cff250b52840c98176f8f1522faea1d6b2180626766c
NODELAB CONSISTENCY: PASS
observer mode/key separation: PASS
VERIFY NODELAB: PASS
```

## Live network isolation

Throughout the corrected start and verification:

- live SwapPulse RPC gateway: healthy
- live transaction relay: healthy
- live lite node: healthy
- live legacy Devnet was not restarted or mutated

## Security interpretation

This proves that the first SwapPulse-specific Madara testing sequencer and a separate full observer can share the unique node-lab chain identity and reproduce the same confirmed block hash at a common height.

It does **not** prove decentralised consensus because there is still one block-producing testing sequencer.

## Next gate

Before any application traffic or Base44 configuration is pointed at this network:

1. bootstrap fresh node-lab owner/deployer and verifier SwapPulse accounts;
2. run the pinned Cairo V2 unit/security suite in an isolated build workspace;
3. deploy the audited V2 class set to the sequencer RPC;
4. generate `chain/deployments/swappulse-nodelab-1.json`;
5. verify the manifest independently through both sequencer and observer RPCs;
6. only then test a genuine V2 identity/assurance flow and the one-way V2 requirement switch;
7. keep live `SWAPPULSE_TESTNET` configuration unchanged.
