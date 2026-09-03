# SwapPulse Developer Onboarding

SwapPulse combines a React/Base44 application, Pokémon TCG catalogue integration, AT Protocol federation and a Cairo/Starknet Web3 layer.

Start with:

- `README.md` for the whole project;
- `docs/PROJECT_ARCHITECTURE.md` for system boundaries;
- `CONTRIBUTING.md` for contribution standards;
- `docs/CHANGE_PROTOCOL.md` before security-sensitive work.

## Tech stack

| Layer | Current technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, Radix/shadcn-style components |
| Application backend | Base44 backend functions (TypeScript/Deno-style runtime) |
| Data | Base44 entities with row-level security |
| Workflows | Base44 scheduled/event workflows |
| Pokémon catalogue | TCGDex integration and local sync/cache |
| Federation | AT Protocol, DIDs, PDS, custom records, firehose/sync |
| Blockchain | Cairo / Starknet |
| Contract testing | Scarb + Starknet Foundry |
| Web3 security components | OpenZeppelin Cairo where appropriate |
| Chain infrastructure | Starknet Devnet + read-only RPC gateway + hardened tx relay |

## Development philosophy

Do not treat the layers as interchangeable.

Examples:

- TCGDex catalogue data does not need to be put on-chain;
- AT Protocol DIDs are not the same thing as Base44 user IDs;
- Base44 private user mappings must not be written into public Cairo storage;
- chain mirrors improve UX but do not override authoritative chain state;
- frontend code must never contain privileged verifier/relay/admin keys.

## Prerequisites

For frontend/Base44 work:

- Git;
- Node.js/npm compatible with the repository;
- access to the appropriate Base44 app/environment if working on hosted backend features.

For chain work:

- Scarb;
- Starknet Foundry;
- required Sierra compiler/tooling versions.

Known frozen V2 toolchain baseline:

```text
Scarb 2.13.1
Starknet Foundry 0.51.2
universal-sierra-compiler 2.8.0
```

Do not upgrade the chain toolchain as a side effect of an unrelated UI change.

## Repository structure

```text
src/
  pages/                 Routed React pages
  components/            Shared UI and feature components
  components/chain/      Wallet/staking/bridge/on-chain UI
  lib/i18n/              Translation dictionaries

base44/
  entities/              Entity schemas and RLS
  functions/             Backend functions
  workflows/             Scheduled/event workflows
  shared/                Shared backend utilities

chain/
  src/                   Cairo contracts
  tests/                 Starknet Foundry tests
  infra/                 Devnet/RPC/relay infrastructure
  scripts/               Build/test/verification tooling
  deployments/           Canonical deployment manifests

docs/                    User/developer/architecture docs
```

## Frontend development

Install dependencies:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Configured checks:

```bash
npm run typecheck
npm run lint
npm run build
```

### Current Base44 MCP shell note

The authoritative Base44 MCP file API can edit/read the project, but the current sandbox command shell has intermittently mounted an empty `/workspace`. Do not treat a `/workspace` `MODULE_NOT_FOUND` error from that shell as proof the project fails to build.

Run final frontend checks from a real Git checkout (for example the mini-server repository) until the sandbox mount issue is fixed.

## Frontend conventions

- use the `@/` import alias;
- reuse existing UI primitives/components;
- use design tokens instead of hard-coded theme colours where possible;
- keep mobile and desktop behaviour aligned;
- do not add duplicate navigation destinations;
- permanent copy must go through the translation system;
- preserve keyboard/screen-reader accessibility;
- use public Chain Explorer routes for public transaction/address links.

## Localisation

Supported primary UI locales:

```text
en-GB
es-ES
fr-FR
de-DE
it-IT
pt-BR
ja-JP
zh-CN
ko-KR
```

For feature-specific vocabulary, consider a dedicated translation bundle (as the Chain Explorer and Wallet do) rather than duplicating strings in components.

## Base44 entities and RLS

Entity schemas live in `base44/entities/`.

Before changing an entity:

1. inspect the current schema;
2. identify whether data is public or user-private;
3. define/read existing RLS;
4. preserve owner/admin restrictions;
5. plan migration/defaults for new required fields;
6. avoid storing chain-private/signing secrets entirely.

Web3 mirrors such as ChainIdentity/StakePosition are application records, not the blockchain itself.

## Backend functions

Functions live under:

```text
base44/functions/<function-name>/entry.ts
```

A typical authenticated function should:

- create the Base44 client from the request;
- authenticate the user;
- validate input;
- enforce ownership/role/policy server-side;
- call external services through approved guarded clients;
- return non-secret machine-readable failures;
- avoid trusting frontend eligibility flags.

### Service-role use

Service-role access can bypass ordinary user RLS. Use it only when the backend function has already established why the caller/action is authorised.

Never expose service-role credentials to the browser.

## Workflows

Workflow definitions live in `base44/workflows/`.

Current categories include:

- TCGDex catalogue and pricing sync;
- PDS/federation/firehose sync;
- notification/status jobs;
- moderation;
- chain event reconciliation;
- Proof of Usership aggregation;
- portfolio/digest/alert jobs.

The workflow files are the source of truth for schedules.

## Pokémon/TCGDex development

Relevant backend functions include the catalogue/search/detail/sync/pricing functions.

Rules:

- keep catalogue metadata separate from user collection state;
- handle third-party API failure gracefully;
- do not overwrite user-entered condition/notes during catalogue refresh;
- pricing is informational, not a guaranteed sale price;
- preserve trademark/independent-project disclosures.

## AT Protocol development

Relevant areas include:

- `atproto-auth`;
- `resolve-atproto-actor`;
- `atproto-bridge`;
- PDS provisioning/migration/password functions;
- `register-lexicons`;
- `firehose-ingest`;
- federation diagnostics/verification;
- PDS/profile/follow sync functions.

### Identity boundaries

Keep these distinct:

- Base44 user ID: private local application identity;
- AT Protocol DID: portable/federated social identity;
- chain identity ID: opaque public Starknet identity reference;
- smart-account address: public blockchain account.

Do not write private Base44 user IDs or PDS credentials to the public chain.

## Cairo/Starknet development

Contracts live in `chain/src/`.

Current V2 set includes:

- IdentityRegistry;
- SwapPulseAccount;
- native SWPX token;
- CardNft;
- ProofOfUsership;
- StakingPool;
- BridgeAdapter.

Run:

```bash
cd chain
bash scripts/test-chain.sh
```

Known baseline:

```text
64 collected
63 passed
0 failed
1 intentionally ignored and separately verified
```

### Contract test expectations

Depending on the change, test:

- unauthorised writes;
- duplicate registration;
- invalid state changes;
- replay attempts;
- revoked identity;
- expired verification;
- invalid/zero addresses;
- ownership/admin changes;
- verifier permissions;
- unexpected/malicious callers;
- fuzz/property cases.

## Relay development

The relay is under:

```text
chain/infra/tx-relay/
```

Run:

```bash
node smoke-policy.mjs
```

The relay is a strict policy boundary. Do not turn it into a generic public Starknet write proxy.

## Chain Explorer development

The explorer uses the read-only backend function:

```text
base44/functions/chain-explorer/
```

Public UI routes:

```text
/chain/
/chain/block/:blockId
/chain/tx/:txHash
/chain/address/:address
```

The explorer intentionally distinguishes RPC-derived chain data from **SwapPulse-indexed activity** linked through public transaction hashes.

Do not claim complete address archive history unless a real indexer has been implemented.

## Security-sensitive changes

Treat changes to these areas as high risk:

- auth/2FA/WebAuthn;
- RLS;
- age/identity verification;
- PDS credentials/federation identity;
- transaction construction/signing;
- relay policy;
- contract ownership/verifier authority;
- staking/slashing/rewards;
- bridge/replay;
- recovery;
- secrets.

Follow `docs/CHANGE_PROTOCOL.md`.

## Documentation

Update docs in the same change when behaviour changes.

Primary docs:

- `README.md`;
- `docs/USER_GUIDE.md`;
- `docs/PROJECT_ARCHITECTURE.md`;
- `docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md`;
- `docs/NODE_ARCHITECTURE.md`;
- `docs/FORKING_AND_REBRANDING.md`;
- `DEPLOYMENT.md`;
- `CONTRIBUTING.md`.

## Forking

For an independent deployment, do not reuse SwapPulse production/testnet secrets, PDS namespace or deployed contract addresses.

Read `docs/FORKING_AND_REBRANDING.md`.

## AI-assisted development

ChatGPT and Base44 are core tools used throughout SwapPulse development.

AI-assisted code receives the same standards as any contribution:

- understand the change;
- test it;
- verify security boundaries;
- do not expose secrets/private user data;
- do not invent APIs/guarantees;
- document important behaviour.

## Pull requests

See `CONTRIBUTING.md` for the full process.
