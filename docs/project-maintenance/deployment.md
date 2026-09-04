---
description: Deploy and operate the complete SwapPulse application and network stack.
---

# Deployment Guide

This document describes the **current** SwapPulse deployment model. It replaces older documentation that described the application as Base44-only or treated Polygon/PulseChain deployment paths as the main Web3 architecture.

## 1. Current production/testnet architecture

SwapPulse is a multi-service system:

```
Users
  |
  v
swappulse.org
  |
  +--> Base44-hosted React application / backend functions / entities / workflows
  |
  +--> AT Protocol / PDS / federation services
  |
  +--> TCGDex and other approved external data services
  |
  +--> https://rpc.swappulse.org/rpc
  |       read-only Starknet RPC gateway
  |
  +--> https://relay.swappulse.org
          authenticated transaction relay
                 |
                 v
          always-on mini-server
                 |
          Starknet Devnet runtime
```

The live V2 Web3 baseline runs on the mini-server. Base44 orchestrates application and trusted backend workflows but is not itself the blockchain runtime.

## 2. Deployment responsibilities

### Base44

Responsible for:

* React site hosting/build deployment;
* backend functions;
* Base44 entities and RLS;
* workflows/schedules;
* authentication;
* application secrets;
* application-to-chain reconciliation;
* AT Protocol/TCG/social orchestration.

### Mini-server

Responsible for the current SwapPulse Starknet testnet infrastructure:

* Starknet Devnet;
* read-only RPC gateway;
* hardened transaction relay;
* host-side privileged Starknet keys required by the current testnet model;
* public HTTPS/tunnel connectivity.

### Public endpoints

Canonical chain endpoints:

```
https://rpc.swappulse.org/rpc
https://relay.swappulse.org
```

The raw Devnet RPC is bound to localhost and must not be exposed directly to the public internet.

## 3. Source control and Base44 sync

The repository is Git-connected to the Base44 application.

Base44 MCP/remote-dev file changes are committed/synchronised by the platform. Git remains the project history and review surface.

Before a substantial feature group:

1. save a Base44 checkpoint;
2. make the focused change;
3. run the relevant tests;
4. verify live/user-facing behaviour;
5. update docs;
6. save a post-feature checkpoint.

See [change protocol](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/change-protocol).

## 4. Frontend build

The Base44 project config uses:

```json5
{
  "site": {
    "installCommand": "npm install",
    "buildCommand": "npm run build",
    "serveCommand": "npm run dev",
    "outputDirectory": "./dist"
  }
}
```

Local/repository checks:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

### Current Base44 sandbox-shell limitation

The Base44 MCP file API can read/write the authoritative project normally, but the current sandbox command shell has intermittently mounted an empty `/workspace` and therefore cannot be trusted to prove `npm run build` for this project.

Until that platform issue is resolved, run the final frontend checks from an actual Git checkout such as the mini-server copy:

```bash
cd ~/swappulse2

git status --short
npm install
npm run typecheck
npm run lint
npm run build
```

Do not interpret `MODULE_NOT_FOUND /workspace/...` from the broken MCP shell as an application compile result.

## 5. Base44 publication

Normal application publication is performed through the existing Base44 app, not by creating a replacement app.

Before publishing:

* review the latest checkpoint;
* ensure frontend checks pass from a real checkout;
* verify migrations/schema/RLS changes;
* verify any new server-side secret names are registered;
* test primary user flows;
* verify accessibility/localisation for changed UI;
* verify `/status` and Web3 readiness if chain features changed.

## 6. Base44 secrets

Secrets must be stored in server-side environment/secret management only.

Examples of current security-sensitive categories:

* transaction relay URL/token;
* age/identity verifier webhook secret;
* AT Protocol/PDS credentials;
* email/push credentials;
* payment provider secrets;
* security/encryption keys.

Never expose secret values in:

* frontend `VITE_*` variables unless the value is explicitly public;
* committed `.env` files;
* `ChainNetworkConfig` public fields;
* screenshots;
* README/issues/PRs;
* browser local storage.

## 7. AT Protocol / PDS deployment

The application includes PDS/federation functions and workflows.

Deployment responsibilities include:

* PDS URL/credentials;
* handle/domain configuration;
* app-password handling;
* custom lexicon registration;
* PDS synchronisation;
* firehose ingestion;
* federation finalisation;
* profile/follow/record reconciliation.

Changes to PDS identity or lexicons should be treated as compatibility-sensitive changes and rehearsed before production.

Relevant functions/workflows live under:

```
base44/functions/atproto-*
base44/functions/*pds*
base44/functions/firehose-ingest
base44/functions/register-lexicons
base44/functions/federation-*
base44/workflows/PDS Sync.jsonc
base44/workflows/Firehose Ingestion.jsonc
base44/workflows/Federation Finalization.jsonc
```

## 8. TCGDex/catalogue deployment

Catalogue/pricing/localisation services are application dependencies, not chain dependencies.

Key workflows currently include:

* `TCGDex Catalog Sync`;
* `Pricing Sync`;
* `Localization Sync`.

If TCGDex is unavailable, collection/social functionality should degrade gracefully where possible rather than taking down the chain or authentication stack.

## 9. Current Cairo/Starknet toolchain

The known-good V2 baseline uses:

```
Scarb 2.13.1
Starknet Foundry 0.51.2
universal-sierra-compiler 2.8.0
```

Use the repository-pinned/verified versions for contract work. Do not casually upgrade compiler/testing versions as part of an unrelated frontend change.

## 10. Chain tests

Run from a real checkout:

```bash
cd ~/swappulse2/chain
bash scripts/test-chain.sh
```

Known frozen baseline:

```
Collected 64 tests
63 passed
0 failed
1 intentionally ignored
```

The wrapper separately verifies the zero-public-key constructor rejection required by the current Foundry behaviour.

A lower test count or a newly failing test is a blocker for chain deployment unless explicitly investigated and approved.

## 11. Relay policy tests

Before replacing/restarting the relay after source/policy changes:

```bash
cd ~/swappulse2/chain/infra/tx-relay
node smoke-policy.mjs
```

The hardened policy regression includes checks for:

* allowed deployment/recovery calls;
* wrong class rejection;
* arbitrary invoke rejection;
* Devnet method rejection;
* missing token rejection;
* idempotent identity registration;
* V2 assurance requirements;
* faucet identity/cooldown enforcement;
* V2 cut-over confirmation/proof enforcement;
* post-cut-over idempotency after proof expiry;
* permanent V2 readiness reporting.

## 12. Canonical deployment manifest

The canonical current deployment manifest lives at:

```
chain/deployments/swappulse-testnet.json
```

Do not construct Base44 ChainNetworkConfig values from memory or placeholder addresses.

The correct order for a new independent deployment/network is:

1. build/test contracts;
2. deploy contracts;
3. generate canonical manifest;
4. independently verify manifest through approved public RPC;
5. import/create Base44 ChainNetworkConfig;
6. run Base44 Verify & Activate;
7. configure relay pins;
8. verify `/readyz`;
9. exercise a genuine identity/verification/value flow;
10. perform any irreversible protocol switch only after all prerequisites pass.

For the existing SwapPulse V2 network, the irreversible V2 switch is already complete. Do not rerun it as a normal deployment step.

## 13. Verify deployment against public RPC

From the repository tooling directory:

```bash
cd ~/swappulse2/chain/scripts/tooling

SWAPPULSE_VERIFY_RPC_URL="https://rpc.swappulse.org/rpc" \
node verify-network.mjs ../../deployments/swappulse-testnet.json
```

Expected high-level state includes:

```
ok: true
identity_verification_mode: V2
verification_v2_required: true
ecosystem_ready: true
```

The verifier should also confirm the expected class hashes/addresses for the live V2 contract set.

## 14. Chain services

Current Compose services include:

* `devnet`;
* `rpc-gateway`;
* `tx-relay`.

Inspect without exposing secrets:

```bash
cd ~/swappulse2/chain/infra

docker compose \
  --env-file .env \
  --env-file .env.relay \
  --profile provisioning \
  ps
```

## 15. Relay replacement

When only relay source/policy changes:

1. run chain/relay tests first;
2. build `tx-relay` only;
3. replace `tx-relay` with `--no-deps`;
4. do not restart Devnet/RPC gateway unnecessarily;
5. verify local `/readyz`;
6. verify public `/readyz`;
7. verify an idempotent/read-safe policy probe if relevant.

Avoid broad Compose restarts during a relay-only change.

## 16. Readiness

The authenticated relay `/readyz` response should confirm the network pins and readiness, including:

```
ok: true
identity_verification_mode: v2
verification_v2_required: true
ecosystem_ready: true
```

Never print the bearer token when testing readiness.

## 17. V2 permanent cut-over

The V2-only verification requirement is already active and one-way.

Operational rules:

* do not attempt to disable it;
* do not call the irreversible transition unnecessarily;
* a retry should return idempotently without a new transaction;
* individual V2 assurance expiry/revocation does not change the global permanent flag;
* legacy V1 verification remains unavailable.

## 18. Chain identity provisioning

`ChainIdentity` should be created by the normal Base44 provisioning flow, not manually inserted by operators.

The private Base44 mirror contains mappings/metadata required for reconciliation, while public chain state remains authoritative for confirmed Web3 state.

Do not manually create identity rows to bypass provisioning checks.

## 19. Chain reconciliation

The project includes scheduled `Chain Event Reconcile` behaviour plus user/admin reconciliation functions.

Reconciliation should:

* read public chain state;
* update Base44 mirrors;
* preserve audit/history;
* mark expiry/revocation correctly;
* close completed staking lifecycle records;
* never manufacture a chain-confirmed state without chain evidence.

## 20. Current Base44 workflows

The repository currently defines workflows including:

* AI moderation for posts/trades/messages;
* Agent Learning Loop;
* Weekly Feed Digest;
* Onboarding Emails;
* Trade Status Notifications;
* Notification Ingestion;
* Status Monitoring;
* Collection Trade Opportunity Alert;
* Help Article Promo;
* Federation Finalization;
* Activation Lifecycle;
* Localization Sync;
* Firehose Ingestion;
* New Message Notifications;
* Portfolio Snapshot Capture;
* TCGDex Catalog Sync;
* Weekly Sentiment Report;
* Achievement Recalculation;
* Promo Poster;
* Chain Event Reconcile;
* PDS Sync;
* Toxic Label Handling;
* Proof of Usership Aggregation;
* Story Expiry;
* Pricing Sync;
* Wishlist Alerts;
* Weekly Digest;
* Poll Resolution;
* Weekly SEO Audit.

The JSONC files under `base44/workflows/` are authoritative for their actual schedules/settings. Do not copy a stale schedule table into this document and assume it remains correct forever.

## 21. Public Chain Explorer deployment

The Chain Explorer is part of the React application and uses the approved read-only Base44 `chain-explorer` backend/RPC path.

Routes:

```
/chain/
/chain/block/:blockId
/chain/tx/:txHash
/chain/address/:address
```

It must not receive relay credentials and must not expose write-capable Devnet methods.

## 22. Monitoring

Check:

* Base44 `/status` and workflow failures;
* public RPC availability;
* public relay availability;
* local Compose service state;
* host memory/disk/OOM health;
* failed systemd units;
* reconciliation lag;
* failed chain action codes.

### Current host baseline

The post-cut-over mini-server diagnostic showed:

* no OOM events;
* no failed systemd units;
* healthy root disk/inodes;
* available RAM despite full swap occupancy;
* no persistent live `si`/`so` swap activity;
* one harmless zombie associated with a long-running Temporal service;
* healthy Devnet/RPC/relay services.

Full swap occupancy alone is not a reason to force `swapoff`. Check `MemAvailable` and live `vmstat si/so` first.

## 23. Backup and rollback

### Application

Use Git history and Base44 checkpoints.

### Chain infrastructure

Back up configuration/manifests and follow the chain infra guides. Do not back up by copying plaintext private-key output into documentation.

### Irreversible state

Some on-chain changes cannot be rolled back. The V2 requirement is an intentional example.

A rollback plan applies to software/config around an irreversible state, not to pretending the chain state can be undone.

## 24. Security pre-release checklist

* [ ] no secrets in frontend bundle;
* [ ] no new public RLS exposure;
* [ ] no PII added to chain storage/events;
* [ ] public RPC still read-only;
* [ ] relay allowlist unchanged or explicitly reviewed;
* [ ] chain class/address pins verified;
* [ ] relevant tests pass;
* [ ] accessibility/localisation checked;
* [ ] AT/PDS compatibility reviewed for federation changes;
* [ ] docs updated;
* [ ] checkpoint created.

## 25. Legacy Polygon/PulseChain code

The repository may still contain historical/optional Polygon/PulseChain-era functions or schemas.

They are **not the canonical V2 SwapPulse identity/token/staking deployment path**.

Do not provision legacy private keys or deploy legacy contracts merely because old code remains in the repository.

Any legacy feature retained for compatibility should be explicitly documented, isolated and removed when no longer required.

## 26. Node/decentralisation future

The current mini-server Devnet is not the final full-node/validator network.

Before deploying public community node software, follow [node architecture roadmap](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/node-architecture):

1. independent observer prototype;
2. benchmark harness;
3. Raspberry Pi/mini-PC measurement;
4. lite-client design;
5. multi-operator dev network;
6. validator/reward architecture;
7. permissionless/community rollout only after security evidence.

## 27. Post-deploy smoke checks

After an application-only release:

* open Home/Explore/Collection/Wallet;
* verify primary navigation/mobile More;
* verify one AT/federation read path;
* verify TCG card/search path;
* verify Chain Explorer home;
* verify a known transaction detail route;
* verify Wallet still fails closed if assurance is expired;
* verify no unexpected console/server errors.

After a chain/relay release, additionally run the full chain/readiness verification described above.

## 28. Related documentation

* [documentation home](https://swappulse.gitbook.io/swappulse-docs/)
* [user guide](https://swappulse.gitbook.io/swappulse-docs/start-here/user-guide)
* [project architecture](https://swappulse.gitbook.io/swappulse-docs/developers/project-architecture)
* [V2 live architecture](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/v2-live-architecture)
* [node architecture roadmap](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/node-architecture)
* [change protocol](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/change-protocol)
* [forking and rebranding guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/forking-and-rebranding)
* [contributor guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/contributing)
* [security audit](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/security-audit)
* [chain overview](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/chain-overview)
* [operator guide](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/operator-guide)
* [infrastructure operations guide](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/infrastructure-operations)
* [mini PC migration guide](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/mini-pc-migration)
