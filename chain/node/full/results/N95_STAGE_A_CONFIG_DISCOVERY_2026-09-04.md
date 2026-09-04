# N95 Madara Stage-A configuration discovery — 2026-09-04

This note records the first guarded Madara Stage-A launch on the SwapPulse reference Intel N95 mini-server.

## Outcome

The trial **did not reach hardware qualification** because Madara exited during startup before meaningful sync/resource testing began.

The guarded launcher correctly detected the stopped container and shut down only the isolated `swappulse-full-lab` Compose project. The live SwapPulse Devnet, RPC gateway, transaction relay and lite node remained running.

## Evidence

Madara successfully:

- started as role `Full Node`;
- selected Starknet Sepolia (`SN_SEPOLIA`);
- detected the x86-64/Linux host;
- opened `/var/lib/madara`;
- created database version 12;
- reached initial L1 gas-price setup.

It then panicked with:

```text
Oracle is needed if no fix_strk_per_eth is set
```

This is a runtime configuration requirement in the pinned Madara image, not evidence of insufficient CPU/RAM/disk.

## Root cause

The current Madara CLI exposes `--strk-per-eth` / `MADARA_STRK_PER_ETH` and optional oracle configuration. Its gas-price worker requires one of those sources when updating the STRK/ETH quote.

For Stage-A hardware qualification SwapPulse now supplies a fixed lab-only `MADARA_STRK_PER_ETH=1.0`, avoiding an unrelated external price-oracle dependency. This value is not a production pricing assumption and must not be carried into a production/appchain design without review.

## Host safety

At failure time the host retained roughly 4.1 GiB available RAM and subsequent one-second `vmstat` samples showed no active swap-in/swap-out. The failure happened before a meaningful Madara workload was established.

## Classification

`CONFIGURATION_DISCOVERY`, not `HARDWARE_FAIL`.
