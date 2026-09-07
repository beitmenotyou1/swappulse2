# Stage D reboot-managed cross-host lite service

This package turns the proven `127.0.0.1:18102` cross-host lite canary into a durable Docker Compose service. It compares the primary `SWAPPULSE_NODELAB_1` sequencer with the keyless observer on a second physical host.

It deliberately does **not** replace the existing verifier on `127.0.0.1:18101`, remove the same-host observer, modify the live `SWAPPULSE_TESTNET`, or claim independent operator control.

## What the service proves

The service becomes ready only when both configured peers:

1. return the exact node-lab chain ID;
2. reproduce the same block hash at the common height;
3. reproduce every pinned V2 contract class hash.

With exactly two peers, losing either peer makes `/readyz` and `/rpc` fail closed with HTTP `503`. The remote peer receives no sequencer, deployer, registry-owner, verifier, relay or user key.

## Reboot behaviour

Compose uses `restart: unless-stopped`. Docker therefore restarts the container after a host reboot unless an operator deliberately ran `stop.sh`. The process may start before Tailscale is ready, but it remains unready and keeps polling until both peers are reachable and agree.

Host networking is used because the local sequencer is intentionally bound to `127.0.0.1:19950`. The lite HTTP server is explicitly bound back to `127.0.0.1:18102`, so it is not published on LAN, Tailscale or public interfaces.

## Prepare

```bash
cd chain/node/stage-d/lite-service
cp .env.example .env
```

Edit only the remote peer address in `.env`:

```text
NODELAB_STAGE_D_LITE_PEERS=http://127.0.0.1:19950,http://<remote-Tailscale-IP>:19961
```

The remote value must be a literal Tailscale IPv4 in `100.64.0.0/10`. The preflight also requires the kernel route to use `tailscale0`. Do not place private keys, bearer tokens or credentials in this file.

## Start and verify

```bash
bash preflight.sh .env
bash start.sh .env
bash status.sh .env
```

`status.sh` requires two healthy peers, two verified pin sets, `multi-peer-agreement`, `independently_verified: true`, `observer_state_independent: true`, and the honest disclosure `operator_independence: false`.

## Stop

```bash
bash stop.sh .env
```

This stops only the `18102` candidate. It preserves the container and checkpoint data, and verifies that the existing verifier on `18101` remains healthy.

## Roll back

```bash
bash rollback.sh .env
```

Rollback removes only the candidate container. It preserves `data/checkpoint.json`, then verifies the existing `18101` verifier and same-host `19951` observer. It never removes a Docker volume or touches the live testnet.

## Reboot acceptance test

Before treating the service as durable:

1. record `status.sh` output and the current common block hash;
2. reboot only the primary host through its normal administrative process;
3. wait for Docker and Tailscale to return;
4. run `status.sh` again without manually running `start.sh`;
5. verify the common height advances and the older block still matches on both full nodes;
6. confirm `18101`, `19951`, the remote observer and all live testnet services remain healthy.

Do not replace `18101` or remove the same-host observer during this acceptance test. A later cut-over requires its own reviewed change and rollback checkpoint.
