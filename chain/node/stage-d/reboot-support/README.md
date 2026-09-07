# Stage D reboot support

This opt-in package closes the boot-management gaps found before the first Stage D primary-host reboot test. It does not change the node-lab's safe default configuration.

The base `chain/node/nodelab/docker-compose.yml` deliberately keeps both full nodes at `restart: "no"`. `primary-restart.override.yml` changes that behaviour only for a reviewed Stage D deployment. It must be combined with the existing private-gateway override whenever Compose reconciles the primary node-lab.

The package also replaces the legacy host-managed verifier on `127.0.0.1:18101` with a restricted Docker service. That fallback compares only the local sequencer on `19950` with the same-host observer on `19951`. The independently synchronised, cross-host verifier remains on `127.0.0.1:18102`.

## Safety boundaries

- No private key, relay token or credential belongs in `.env`.
- Neither lite service binds to LAN, Tailscale or public interfaces.
- The same-host observer database and remote observer database are retained.
- The live `SWAPPULSE_TESTNET` services are not part of either Stage D Compose project.
- The fallback does not improve operator independence. It preserves a local recovery path.

## Prepare

Copy the public template and keep its exact peer set:

```bash
cd chain/node/stage-d/reboot-support
cp .env.example .env
```

Run `preflight.sh` only after a controlled handover has stopped the legacy process and made port `18101` free. The handover must retain the old process source, checkpoint, PID record and an allowlisted recovery environment until the reboot test passes.

## Full-node restart policy

The reviewed effective primary configuration is:

```bash
docker compose -p swappulse-nodelab-1 \
  --env-file "$NODELAB_DIR/.env.local" \
  --env-file "$NODELAB_DIR/.env.image" \
  -f "$NODELAB_DIR/docker-compose.yml" \
  -f ../primary-gateway.override.yml \
  -f primary-restart.override.yml \
  config --quiet
```

For an already running and verified deployment, the restart-policy change can be applied without recreating either database container by using `docker update --restart unless-stopped` on the exact sequencer and observer container IDs. Capture their previous policies first and restore them during rollback.

## Managed fallback

After the controlled handover makes `18101` free:

```bash
bash preflight.sh .env
bash start.sh .env
bash status.sh .env
```

The service uses `restart: unless-stopped`, a read-only root filesystem, no Linux capabilities, `no-new-privileges`, host networking for the loopback-only peers and an explicit `127.0.0.1:18101` application bind.

## Stop and rollback

```bash
bash stop.sh .env
bash rollback.sh .env
```

`stop.sh` preserves the fallback container and checkpoint. `rollback.sh` removes only that fallback container and preserves its data directory. Restoring the original host process and the previous full-node restart policies belongs to the guarded deployment rollback, using the recovery state captured before handover.

## Reboot acceptance

Do not reboot merely because the container starts. First verify that Docker and Tailscale are enabled, both full nodes and both lite services use `unless-stopped`, all four node-lab endpoints agree, and the three live testnet health endpoints pass.

After reboot, verify that no operator manually started a node service, the cross-host verifier reproduces its pre-reboot checkpoint, the same-host fallback is ready, and every existing live service recovered. Keep the old host-process recovery record until that evidence is complete.
