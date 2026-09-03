# SwapPulse

SwapPulse is an open, community-focused Pokémon TCG platform that combines collecting, trading, social discovery, federation through the AT Protocol, and a privacy-preserving Web3 layer built with Cairo and Starknet.

The project is designed so that a collector can use it as a normal card-community website without needing to understand blockchain technology, while advanced users can opt into self-custodial identity, on-chain proofs, staking, chain exploration and future decentralised network participation.

SwapPulse has been developed across the application and blockchain stack with **ChatGPT and Base44 as core development tools**, under human direction, review and testing. Base44 provides the application/orchestration layer; Cairo and Starknet provide the blockchain trust and smart-contract layer.

> Pokémon, Pokémon TCG and related trademarks belong to their respective owners. SwapPulse is an independent community project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures Inc. or The Pokémon Company.

## What SwapPulse is

SwapPulse brings several normally separate tools into one collector-focused product:

- a Pokémon TCG collection manager;
- card and set discovery powered by TCGDex data;
- market and pricing views;
- trade listings, trade threads and trade status workflows;
- binders, wishlists and collection organisation;
- profiles, follows, feeds, posts, comments and reactions;
- Circles, Meetups, live spaces and community discovery;
- notifications, private messages and starter packs;
- AT Protocol identities, federation and PDS-backed social data;
- a self-custodial SwapPulse smart account;
- privacy-preserving V2 identity assurance;
- SWPX testnet tokens and community staking;
- on-chain card possession and card-token infrastructure;
- Proof of Usership infrastructure;
- a read-only SwapPulse Chain Explorer;
- bridge infrastructure for future cross-chain asset movement;
- account-recovery and WebAuthn-oriented security tooling.

The intention is not to force Web3 into normal collector activity. The social and TCG experience remains usable as a familiar web application. Blockchain features are added where public verification, self-custody, replay protection, portable trust or network participation genuinely benefit from it.

## The four layers

```text
Collectors and community
        |
        v
+------------------------------+
| React / SwapPulse interface  |
| cards, trades, feeds, wallet |
+------------------------------+
        |
        v
+------------------------------+
| Base44 application layer     |
| auth, entities, workflows,   |
| moderation, orchestration    |
+------------------------------+
   |                        |
   |                        +------------------------------+
   v                                                       v
+----------------------+                       +---------------------------+
| AT Protocol / PDS    |                       | Cairo / Starknet V2       |
| DID, federation,     |                       | identity, SWPX, staking,  |
| social graph, posts  |                       | cards, proofs, recovery   |
+----------------------+                       +---------------------------+
        |
        v
+----------------------+
| Pokémon data sources       |
| TCGDex canonical catalogue |
| PokéWallet market data     |
| PokemonPriceTracker prices |
| PokéAPI species enrichment |
+----------------------------+
```

### 1. Pokémon TCG layer

TCGDex remains the canonical catalogue and card-ID source for Pokémon cards and sets. PokéWallet is used only as an optional, cached TCGPlayer/CardMarket market-price enrichment layer. PokemonPriceTracker adds optional RAW, graded sold-price and recent-history enrichment where its subscription/licensing terms permit the deployment. PokéAPI provides optional species/game enrichment linked by TCGDex National Pokédex IDs. SwapPulse builds collector workflows around those sources, including:

- browsing cards and sets;
- collection tracking;
- card detail pages;
- market/pricing synchronisation;
- wishlists and trade matching;
- binders;
- grading-related workflows;
- card verification and on-chain card anchoring.

The TCGDex catalogue is periodically synchronised into the Base44 application layer so the rest of the site does not need to make every page depend on a live third-party request. PokéWallet and PokemonPriceTracker requests are server-only, persistently cached, protected by provider-specific safety budgets, and fail soft so a pricing-provider outage cannot take down card pages. PokemonPriceTracker public production use is additionally fail-closed unless the configured plan/permission allows the site's deployment model. PokéAPI resources are also cached server-side and are never joined by guessing from a card name.

### 2. AT Protocol layer

SwapPulse uses the AT Protocol so identity and social activity can become more portable than a conventional closed social network.

The codebase includes support for:

- AT Protocol DIDs and handles;
- Personal Data Server (PDS) provisioning and migration;
- app passwords and account linking;
- custom SwapPulse lexicons/records;
- feed and profile synchronisation;
- follow-graph import and bridging;
- firehose ingestion;
- federated profile/search behaviour;
- publishing standard AT Protocol records where appropriate;
- community labels and moderation bridges.

Base44 still provides application state and orchestration, but the AT Protocol layer is the direction of travel for portable social identity and federated community data.

### 3. Base44 application layer

Base44 powers the hosted application, backend functions, entities, row-level access control, workflows and application orchestration.

Important responsibilities include:

- authentication and user sessions;
- private user-to-chain mappings;
- collection and trade records;
- notifications and messages;
- scheduled catalogue/pricing/federation workflows;
- security and moderation functions;
- chain reconciliation;
- server-side calls to the authenticated transaction relay;
- keeping privileged secrets out of browser code.

### 4. Cairo / Starknet Web3 layer

The V2 Web3 layer is implemented in Cairo and runs on the current SwapPulse Starknet testnet environment.

The deployed architecture includes:

- `IdentityRegistry`;
- `SwapPulseAccount` smart-account class;
- SWPX native token;
- `CardNft`;
- `ProofOfUsership`;
- `StakingPool`;
- `BridgeAdapter`.

The blockchain stores only public/opaque trust material. **Names, email addresses, dates of birth, identity documents and private verification evidence must never be written on-chain.**

On-chain identity data is limited to concepts such as:

- opaque identity identifiers;
- wallet/account bindings;
- hashes and commitments;
- assurance type and level;
- attester/verifier references;
- timestamps and expiry;
- revocation state;
- replay protection;
- recovery/ownership events.

See [docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md](docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md) for the live V2 architecture and security baseline.

## Current V2 baseline

The V2 cut-over is complete and the permanent V2 requirement is active.

Known-good regression baseline:

```text
Cairo / Starknet Foundry: 64 collected
63 passed
0 failed
1 intentionally ignored and separately verified

Relay policy regression: passed
Hardened relay: live
Local /readyz: healthy
Public /readyz: healthy
V2-only requirement: permanent
Cut-over retry: idempotent, zero extra transaction
Expiry regression: passed
Recovery from expiry: passed
Existing operator stake survives expiry
Expired/revoked verification fails closed for new staking/bridge writes
```

The frozen deployment baseline checkpoint is documented in the V2 architecture guide. New development should preserve these invariants rather than reopening the irreversible cut-over flow.

## Main site areas

| Area | What it is for |
| --- | --- |
| Home | Personal/community activity feed |
| Explore | Discover cards, posts, collectors and community content |
| Collection | Track owned Pokémon TCG cards |
| Wallet | SwapPulse smart account, SWPX, identity, staking, card proofs and bridge tools |
| Binders | Organise cards into public/private collection views |
| Trade Board | Find and manage collector-to-collector trades |
| Circles | Community groups and focused collector spaces |
| Meetups | Community events and real-world coordination |
| Live Now | Live/community spaces |
| Notifications | Activity and system notifications |
| Messages | Private messaging |
| More | Additional community, market, feed, settings and utility features |
| Chain Explorer | Public read-only view of blocks, transactions and smart-account activity |

A detailed end-user walkthrough is in [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Chain Explorer

The public explorer lives at `/chain/` and is intentionally separated visually from the social application.

It supports:

- latest blocks;
- latest transaction hashes;
- block detail pages;
- transaction detail pages;
- smart-contract/smart-account address pages;
- SwapPulse-indexed smart-account activity;
- direct links from Wallet transaction history;
- language switching and accessibility settings.

The current RPC does not pretend to provide a full Etherscan-style archive index. Address history shown by SwapPulse is explicitly labelled as **SwapPulse-indexed activity** where it comes from application records already linked to public transaction hashes.

## SwapPulse Wallet

The Wallet is designed to feel familiar to users of mainstream self-custody wallets while keeping SwapPulse-specific identity and collector features visible.

It includes:

- SWPX balance overview;
- smart-account address;
- receive/copy controls;
- testnet funding;
- direct Chain Explorer links;
- V2 identity assurance state;
- expiry/revocation visibility;
- account-recovery protection;
- card possession attestations;
- on-chain card records;
- staking/operator controls;
- bridge controls.

Critical signing/relay trust does **not** live in browser code. User-approved wallet actions should be signed by the user where appropriate; privileged administrative/verifier/relay operations remain backend-side.

## Community staking

Community staking currently provides economic accountability and participation around SwapPulse operator services.

The UI/backend support:

- operator registration;
- increasing operator self-stake;
- delegation;
- undelegation;
- timed withdrawal;
- operator exit;
- chain reconciliation.

The current Starknet Devnet runtime is **not yet a decentralised multi-validator consensus network**. Do not describe the existing staking pool as proof that multiple community machines are currently producing/validating blocks.

The planned full-node/lite-node architecture is documented separately in [docs/NODE_ARCHITECTURE.md](docs/NODE_ARCHITECTURE.md).

## Full nodes and lite nodes roadmap

SwapPulse intends to evolve from the current single-runtime testnet into a network where independent community operators can run useful infrastructure on affordable hardware.

Target roles include:

- **lite/client node**: low-resource read/relay/proof-verification client;
- **full observer node**: independently stores/verifies the full required chain state/history for its configured mode;
- **validator/sequencer/operator role**: participates in the future consensus/settlement design once the network architecture genuinely supports it;
- **archive/indexer role**: optional higher-storage service for explorer/history workloads.

Raspberry Pi-class hardware is a target, not an unverified marketing claim. Hardware requirements must be established through repeatable benchmark profiles before a device is advertised as supported for a given node role.

## How to use SwapPulse

Quick path for a normal collector:

1. Create or sign in to your SwapPulse account.
2. Set up your public collector profile.
3. Use **Explore** to find cards, sets, collectors and community content.
4. Add cards to **Collection** and organise them in **Binders**.
5. Create or respond to listings on the **Trade Board**.
6. Follow collectors, join Circles and use community/social features.
7. Use **Wallet** only when you want the self-custodial/Web3 features.
8. When a transaction hash appears, open it in the **Chain Explorer** for public chain details.

More detail: [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Repository map

```text
src/                       React frontend
src/pages/                 Main site pages
src/components/            Shared UI/features
src/lib/i18n/              Nine-language UI dictionaries
base44/entities/           Base44 entity schemas / RLS
base44/functions/          Backend functions
base44/workflows/          Scheduled workflows
base44/shared/             Shared backend utilities
chain/src/                 Cairo smart contracts
chain/tests/               Starknet Foundry tests
chain/infra/               Devnet, RPC gateway and relay infrastructure
chain/scripts/             Build/test/deployment verification tooling
docs/                      User, developer, architecture and governance docs
```

## Development

### Requirements

For the web/Base44 layer:

- Node.js / npm;
- Base44 development tooling where required;
- access to the appropriate Base44 app/environment.

For the Cairo layer, use the versions pinned by the repository/tooling. The known V2 baseline uses:

```text
Scarb 2.13.1
Starknet Foundry 0.51.2
universal-sierra-compiler 2.8.0
```

### Frontend-only development

```bash
npm install
npm run dev
```

### Base44 local development

```bash
base44 dev
```

### Cairo tests

```bash
cd chain
bash scripts/test-chain.sh
```

The chain test wrapper also performs the separately verified zero-public-key constructor rejection required by the current Foundry version.

### Relay policy tests

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

Never put relay tokens, verifier/admin private keys, PDS credentials or other privileged secrets in browser code, committed `.env` files, screenshots or issue reports.

## How the AT Protocol side works

At a high level:

1. a user has or receives an AT Protocol identity/DID;
2. SwapPulse stores only the application mapping required to connect that identity to local features;
3. PDS-backed records and social graph data are synchronised/bridged by backend functions and workflows;
4. firehose and federation processes bring relevant remote changes into the application;
5. Base44 remains the app orchestration/cache layer rather than pretending to replace the decentralised identity model.

Developers should start with the AT-related functions under `base44/functions/`, especially the PDS, firehose, identity-resolution and bridge/sync functions.

## How the Web3 side works

A simplified V2 flow:

```text
User / Wallet
    |
    v
Base44 authenticated function
    |
    +--> eligibility / RLS / policy checks
    |
    v
Authenticated transaction relay
    |
    +--> strict method / contract / class-hash allowlist
    |
    v
SwapPulse Starknet contracts
    |
    v
Public RPC + reconciliation back into Base44
```

The public RPC is read-only. The raw Devnet RPC remains host-local. Privileged transaction authority is not exposed directly to the public browser application.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md).

The short version:

1. create a fork;
2. create a focused feature/fix branch;
3. make the smallest safe change;
4. preserve privacy, accessibility and localisation requirements;
5. run relevant frontend/backend/chain tests;
6. document behaviour changes;
7. submit a pull request with evidence of testing and security impact.

Changes to Web3, identity, authentication, PDS/federation, permissions, secrets or irreversible network policy require a higher review bar than ordinary visual changes.

## Forking SwapPulse to make your own project

SwapPulse is intentionally structured so communities can study and adapt the architecture, but there is an important legal prerequisite:

> **SwapPulse is licensed under the Mozilla Public License 2.0 (MPL-2.0).** You may use, modify, distribute and commercially build on SwapPulse subject to the MPL-2.0 terms. Modifications to MPL-covered files that you distribute must remain available under MPL-2.0. Third-party Pokémon material, APIs, hosted services and separately licensed dependencies are not relicensed by SwapPulse.

The practical fork process is documented in [docs/FORKING_AND_REBRANDING.md](docs/FORKING_AND_REBRANDING.md).

That guide covers:

- forking/cloning;
- replacing SwapPulse branding;
- configuring a new Base44 app;
- choosing whether to keep or remove Pokémon/TCGDex functionality;
- configuring a new AT Protocol/PDS identity namespace;
- deploying an independent Cairo/Starknet network instead of reusing SwapPulse addresses;
- generating new secrets and keys;
- running tests;
- publishing your fork;
- contributing improvements upstream.

Never copy production/testnet private keys, relay tokens, PDS passwords or verifier secrets from SwapPulse into a fork.

## Change governance

The project change process is documented in [docs/CHANGE_PROTOCOL.md](docs/CHANGE_PROTOCOL.md).

Core principles:

- preserve the frozen V2 security invariants;
- document breaking changes;
- checkpoint before substantial feature groups;
- keep sensitive personal data off-chain;
- no privileged browser keys;
- maintain translations for all supported languages;
- maintain keyboard/screen-reader/accessibility behaviour;
- test migrations and rollback paths;
- never present experimental decentralisation features as production consensus before they are independently verified.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

The current production architecture is **not** “Base44 only”. It consists of:

- Base44-hosted web/backend/orchestration services;
- AT Protocol/PDS/federation services;
- external TCG data sources such as TCGDex;
- an always-on mini-server hosting the current Starknet Devnet, read-only RPC gateway and hardened transaction relay;
- Cloudflare/public HTTPS routing for the approved RPC/relay endpoints.

Canonical chain endpoints:

```text
https://rpc.swappulse.org/rpc
https://relay.swappulse.org
```

Raw Devnet port `5050` must remain localhost-only.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Project architecture](docs/PROJECT_ARCHITECTURE.md)
- [Pokémon data providers](docs/POKEMON_DATA_PROVIDERS.md)
- [V2 live architecture](docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md)
- [Node architecture roadmap](docs/NODE_ARCHITECTURE.md)
- [Forking and rebranding](docs/FORKING_AND_REBRANDING.md)
- [Change protocol](docs/CHANGE_PROTOCOL.md)
- [Contributor guide](CONTRIBUTING.md)
- [Release process](docs/RELEASING.md)
- [Changelog / release history](CHANGELOG.md)
- [Licence decision history](docs/LICENSE_OPTIONS.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Deployment guide](DEPLOYMENT.md)
- [Chain README](chain/README.md)
- [Operator guide](chain/OPERATOR_GUIDE.md)
- [Developer onboarding](docs/developer-onboarding.md)
- [API endpoints](docs/api-endpoints.md)

## Releases and project history

SwapPulse uses versioned GitHub releases for significant website, AT Protocol, Base44, Web3, infrastructure and documentation updates.

Release history is kept from oldest to newest in [CHANGELOG.md](CHANGELOG.md). Each version also has full release notes under `.github/releases/`, and [RELEASE_MANIFEST.json](RELEASE_MANIFEST.json) is the machine-readable source used by the GitHub release publisher.

Current release line:

```text
v0.1.0  Frozen V2 live baseline
v0.2.0  Identity and staking product layer
v0.3.0  Navigation and standalone Chain Explorer
v0.4.0  Wallet overview UX refresh
v0.5.0  Complete project handbook and deployment documentation
v0.6.0  Automated GitHub release discipline
v0.7.0  MPL-2.0 and multi-source Pokémon enrichment
v0.8.0  PokemonPriceTracker graded and recent-market enrichment
```

Future significant updates should follow [docs/RELEASING.md](docs/RELEASING.md) and explain what was added, changed, removed, why it changed, security/privacy impact, compatibility/migration impact, accessibility/localisation work and checks actually performed.

## Open-source and licensing principles

The project direction is community-readable, inspectable and contribution-friendly. Architecture, trust boundaries and security-sensitive changes should be documented rather than hidden behind marketing language.

SwapPulse-owned source code and original project documentation are licensed under **Mozilla Public License 2.0 (MPL-2.0)**. See the root [LICENSE](LICENSE) file. MPL-2.0 permits personal and commercial use, modification and redistribution while requiring distributed modifications to MPL-covered files to remain under MPL-2.0.

The historical licence comparison remains available in [docs/LICENSE_OPTIONS.md](docs/LICENSE_OPTIONS.md), but MPL-2.0 is now the selected project licence.

MPL-2.0 applies only to material the project has the right to license. It does **not** relicense Pokémon artwork/trademarks, TCGDex, PokéAPI, PokéWallet, PokemonPriceTracker, Base44's platform, user content or separately licensed dependencies. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## AI-assisted development disclosure

ChatGPT and Base44 are core development tools used throughout the SwapPulse site and blockchain work. They have been used for architecture, implementation, debugging, testing support, documentation and iterative product work across the React/Base44 and Cairo/Starknet stacks.

AI-generated or AI-assisted code is **not exempt from review**. Human direction, test evidence, security review and the same contribution standards apply regardless of whether a change was handwritten or AI-assisted.

## Project status

SwapPulse remains under active development. Testnet features, APIs, schemas and user-facing workflows can evolve. Security/privacy invariants, irreversible V2 state and public claims about decentralisation must be treated much more conservatively than ordinary UI features.
