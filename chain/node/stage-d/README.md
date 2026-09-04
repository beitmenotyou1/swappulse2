# Stage D — physically separate full observer

Stage D moves the `SWAPPULSE_NODELAB_1` full observer off the primary mini-server and onto a second physical host. The goal is to remove the single-host fault-domain assumption while preserving the same verified chain state and permanent V2 contract pins.

This stage is **not** a validator/consensus migration. The primary mini-server remains the only block-producing node-lab sequencer. The remote machine runs only `--full` observer mode and receives no sequencer, registry-owner, verifier, deployer or user private key.

## Security model

The remote observer needs two network surfaces:

1. feeder/gateway access from the remote observer to the primary sequencer;
2. read-only observer RPC access from the primary/lite verifier to the remote observer.

For the first physical-host test, both surfaces must use a private overlay such as Tailscale. Do not publish either service on a public interface and do not use `0.0.0.0` as the host bind address.

The provided preflights accept Tailscale IPv4 addresses from `100.64.0.0/10`. A later independent external operator can use an equivalently reviewed private/authenticated transport, but that requires a separate security review.

## Files

Primary host:

- `primary-gateway.override.yml` — opt-in Compose override that publishes Madara feeder/gateway port `8080` only on the primary host's Tailscale IPv4;
- `primary-gateway-preflight.sh` — read-only validation before that override is enabled;
- `create-primary-checkpoint.sh` — creates a public block/hash checkpoint for remote verification.

Remote host:

- `remote-observer/.env.example` — public configuration template, no private keys;
- `remote-observer/docker-compose.yml` — one Madara full observer with a persistent named volume;
- `remote-observer/preflight.sh` — validates the immutable image, private transport, resources and Compose config;
- `remote-observer/start.sh` — starts the observer and waits for its loopback/Tailscale RPC;
- `remote-observer/verify.sh` — verifies chain ID, a primary checkpoint and the permanent V2 deployment manifest through the remote observer;
- `remote-observer/stop.sh` — stops only the remote observer and preserves its database.

## Reviewed image

Stage D initially uses the same reviewed image qualified in Stage A/C:

```text
ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6
```

A different image digest requires fresh qualification.

## Primary gateway exposure

The base node-lab Compose intentionally does not publish Madara's feeder gateway. Stage D adds it only through an explicit override and only on a Tailscale IP:

```text
<TAILSCALE_PRIMARY_IP>:19952 -> sequencer:8080
```

Run the preflight first. Enabling the override may recreate only the node-lab sequencer container, so it must not be done until the second physical host is ready and the same-host lite verifier is healthy. The live `SWAPPULSE_TESTNET` containers remain separate.

## Remote observer

The remote observer runs:

```text
--full
--base-path /var/lib/madara
--preset devnet
--no-l1-sync
```

with the public `SWAPPULSE_NODELAB_1` chain overrides and remote feeder/gateway URLs. It never receives `--devnet` or `--private-key`.

Its RPC must bind only to the remote host's Tailscale IPv4, for example:

```text
100.x.y.z:19961 -> observer:9944
```

## Verification gate

Stage D is not considered passed merely because the remote observer starts. It must:

1. return the exact `SWAPPULSE_NODELAB_1` chain ID;
2. reach confirmed state;
3. reproduce a block hash captured independently on the primary sequencer;
4. reproduce the canonical V2 class hashes and `verification_v2_required=true` through `verify-network.mjs`;
5. expose no private signing key in its container command/environment;
6. continue using its own persistent database across restart;
7. later become one of the lite verifier's configured peers in place of the same-host observer.

Only after that final lite test can we claim **physical-host state-source independence**. If both machines are still operated by the same person, `operator_independence` remains false and must be reported that way.

## Do not do yet

- do not remove the same-host observer before the remote observer passes;
- do not change live `SWAPPULSE_TESTNET` RPC/relay settings;
- do not import node-lab addresses into production `ChainNetworkConfig`;
- do not expose the feeder gateway or observer RPC to the public Internet;
- do not copy `.env.local` or any node-lab authority/private-key file to the remote host.