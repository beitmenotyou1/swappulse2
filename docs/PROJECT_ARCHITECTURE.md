# SwapPulse Project Architecture

This document explains how the complete SwapPulse product fits together: Pokémon TCG data, the collector/community application, AT Protocol federation, Base44 orchestration and the Cairo/Starknet Web3 layer.

## 1. Product goal

SwapPulse is not a blockchain explorer with a card theme and it is not merely a social network with a wallet attached.

The product goal is to give Pokémon TCG collectors one community platform for:

- card discovery and collection management;
- binders and showcase organisation;
- market/pricing context;
- trading and trade-status workflows;
- profiles, follows, posts, comments and discovery;
- community groups, meetups and live participation;
- portable/federated AT Protocol identity/social records;
- optional self-custodial identity and public verification;
- optional staking, proofs and chain participation.

The Web3 layer is intentionally optional for ordinary collector browsing/social activity. It is used where public, replay-resistant, self-custodial or portable trust is useful.

## 2. High-level architecture

```text
                              +-----------------------+
                              |      Collectors       |
                              | browser / mobile/PWA  |
                              +-----------+-----------+
                                          |
                                          v
+----------------------+       +-----------------------+       +----------------------+
| TCGDex               |<----->| React SwapPulse UI    |<----->| AT Protocol / PDS    |
| card/set catalogue   |       | collector + social   |       | DID / federation     |
+----------+-----------+       +-----------+-----------+       +----------+-----------+
           |                               |                              |
           |                               v                              |
           |                   +-----------------------+                  |
           +------------------>| Base44 app layer      |<-----------------+
                               | entities / functions  |
                               | auth / workflows/RLS  |
                               +-----------+-----------+
                                           |
                                           | server-side policy/orchestration
                                           v
                               +-----------------------+
                               | hardened tx relay     |
                               +-----------+-----------+
                                           |
                                           v
                               +-----------------------+
                               | Cairo / Starknet V2   |
                               | identity / SWPX /     |
                               | staking/cards/proofs  |
                               +-----------+-----------+
                                           |
                                           v
                               +-----------------------+
                               | read-only public RPC  |
                               | Chain Explorer        |
                               +-----------------------+
```

## 3. Frontend

The frontend is a React/Vite application under `src/`.

Important areas:

- `src/pages/`: routed pages;
- `src/components/`: shared features/components;
- `src/components/chain/`: Wallet, staking, bridge and on-chain card UI;
- `src/lib/i18n/`: translation dictionaries;
- `src/api/base44Client.js`: Base44 client integration.

### Navigation/product surfaces

The primary product areas include Home, Explore, Collection, SwapPulse Wallet, Binders, Trade Board, Circles, Meetups, Live Now, Notifications and Messages.

The Chain Explorer is intentionally routed outside the normal social-site layout so it behaves like a dedicated blockchain tool while remaining part of the same application.

## 4. Pokémon TCG data layer

SwapPulse uses multiple Pokémon data providers for distinct purposes rather than treating them as interchangeable databases:

- **TCGDex** is the canonical card/set catalogue and SwapPulse card-ID namespace.
- **PokéAPI** provides optional species/game enrichment linked by TCGDex National Pokédex IDs.
- **PokéWallet** provides optional cached TCGPlayer/CardMarket market cross-checks.
- **PokemonPriceTracker** provides optional RAW/graded sold-price/recent-history enrichment, subject to provider plan/licensing constraints.
- **TCGplayer** provides an optional direct TCGplayer catalogue/pricing cross-check for existing authorised developer accounts.

TCGDex remains authoritative when provider records disagree about card identity.

Relevant backend areas include functions such as:

- `tcgdex`;
- `get-cards`;
- `get-card-detail`;
- `get-sets`;
- `search-cards`;
- `sync-tcgdex-catalog`;
- pricing/localisation workflows.

Base44 records/cache are used so collection, trade and social workflows can reference stable application data without coupling every request directly to a third-party API call.

Pricing/enrichment providers are accessed only through narrow Base44 backend functions. Their credentials never ship to the browser. Each provider has its own persistent cache and quota/fallback policy so one upstream outage or rate-limit event cannot take down the canonical catalogue.

PokemonPriceTracker is additionally licence-gated: ordinary production users receive no provider data while SwapPulse is configured on a non-commercial Free/API plan. Admin-only development/evaluation can still exercise the integration without enabling public use.

TCGplayer is approval-gated: current TCGplayer documentation says new API access is no longer granted, and existing keys may only be used for the purpose approved by TCGplayer. SwapPulse therefore requires existing developer credentials plus `TCGPLAYER_APPROVED_USE=true` before it sends any direct TCGplayer request. Only catalog/product/pricing reads are implemented; seller/store mutation APIs are outside the product architecture.

### Why this is separate from Web3

A card name, set number or TCGDex image does not need a blockchain transaction just to be displayed. Blockchain is reserved for trust/proof/ownership-like workflows where immutability and self-custody add value.

## 5. Community and social application layer

Base44 entities/functions implement normal application functionality including:

- profiles;
- collection entries;
- trade listings and trade conversations;
- notifications;
- messages;
- circles;
- meetups;
- starter packs;
- feeds;
- moderation;
- achievements;
- market/portfolio snapshots;
- status monitoring.

### Row-level security

Private/user-owned application data should use restrictive row-level security. Web3 mirrors are not a reason to expose private Base44 user mappings publicly.

The chain can contain a public opaque identity ID while Base44 privately maps it to the authenticated application user.

## 6. AT Protocol architecture

The AT Protocol layer is responsible for portable/federated social identity and records.

The repository contains functions for:

- AT Protocol authentication;
- resolving AT actors;
- PDS provisioning/migration;
- PDS app-password management;
- updating handles;
- publishing standard/custom records;
- registering SwapPulse lexicons;
- federation diagnostics;
- profile/follow import;
- PDS sync;
- firehose ingestion;
- notification ingestion;
- bridge/synchronisation logic.

### Identity model

The AT Protocol DID and the SwapPulse chain identity are related at the application level but are not the same identifier.

They serve different purposes:

- AT Protocol DID: portable/federated social identity;
- Base44 user ID: private local application/auth identity;
- chain identity ID: opaque public Starknet identity reference;
- smart-account address: public self-custodial blockchain account.

Do not collapse these into one database field or write private Base44 identifiers on-chain.

## 7. Base44 orchestration

Base44 is the coordination layer between frontend, social/federation data, TCG workflows and chain state.

It provides:

- authentication;
- backend functions;
- entity storage;
- RLS;
- workflows;
- reconciliation;
- moderation/security systems;
- external service integration.

### Trusted operations

Privileged chain operations must be initiated server-side, never by embedding trusted private keys in frontend JavaScript.

The intended path is:

```text
browser request
  -> authenticated Base44 function
  -> eligibility / ownership / policy checks
  -> hardened relay
  -> allowlisted Starknet transaction
  -> chain
  -> reconciliation
```

## 8. Cairo/Starknet V2 architecture

The chain source lives under `chain/`.

The live V2 architecture includes:

- `identity_registry.cairo`;
- `swap_pulse_account.cairo`;
- `native_token.cairo`;
- `card_nft.cairo`;
- `proof_of_usership.cairo`;
- `staking_pool.cairo`;
- `bridge_adapter.cairo`.

### Identity privacy

Private personal information must remain off-chain.

Allowed public concepts include:

- opaque IDs;
- commitments/hashes;
- verifier/attester addresses;
- verification type/level;
- timestamps/expiry;
- revocation state;
- replay IDs;
- public smart-account bindings.

### Permanent V2 state

The registry has completed the one-way V2 requirement cut-over. Legacy V1 verification cannot be re-enabled.

Individual V2 attestations can still expire or be revoked. That must not change the global permanent V2 policy.

## 9. SWPX and staking

SWPX is the current native testnet token used by the Web3 product layer.

The current staking pool supports:

- operator registration;
- operator self-stake increases;
- delegation;
- undelegation;
- withdrawals after an unlock period;
- operator exit;
- slashing/economic controls implemented by the contract.

Base44 mirrors/reconciliation improve UX, but the public chain is authoritative for confirmed staking state.

## 10. CardNft and card proofs

The CardNft/verification architecture allows SwapPulse to bind public on-chain records to a card-verification workflow.

Important distinction:

- TCGDex catalogue metadata describes the card product;
- SwapPulse collection records describe a user's application collection;
- a verification session describes the verification workflow;
- a ChainCardToken/on-chain record describes the resulting public chain state.

No on-chain record should claim more about a physical object than the verification process actually established.

## 11. Proof of Usership

Proof of Usership is intended to turn aggregate application participation into an opaque/public commitment that can be checked on-chain without exposing private interaction history.

The safe architecture is:

```text
private Base44 activity data
      |
      v
server-side aggregation / anti-gaming rules
      |
      v
opaque score/commitment/proof material
      |
      v
Cairo ProofOfUsership contract
```

Raw private message history, emails, private profile details or sensitive behavioural logs must not be published to the chain.

## 12. Bridge architecture

`BridgeAdapter` is the appchain-side bridge component. Base44 contains transfer/queue/reconciliation records.

Bridge UX must distinguish:

- appchain source transaction;
- relay state;
- destination transaction;
- replay protection;
- failure/refund state.

The bridge layer is experimental/testnet and should not be marketed as production-grade cross-chain custody until external-chain relayers and security assumptions are independently hardened.

## 13. Chain Explorer architecture

The Chain Explorer uses the approved read-only public RPC.

It supports:

- chain summary;
- blocks;
- transactions/receipts;
- smart-contract/smart-account address data;
- latest transaction hashes;
- SwapPulse-indexed address activity.

It does not expose the privileged transaction relay or raw localhost-only Devnet RPC.

## 14. Infrastructure

Current chain infrastructure runs on the always-on mini-server.

Key services:

- Starknet Devnet runtime;
- read-only RPC gateway;
- authenticated transaction relay;
- public HTTPS routing/tunnel.

Canonical endpoints:

```text
https://rpc.swappulse.org/rpc
https://relay.swappulse.org
```

Raw Devnet `5050` remains localhost-only.

## 15. Scheduled workflows

The Base44 project currently includes workflows for areas such as:

- TCGDex catalogue sync;
- pricing sync;
- localisation sync;
- PDS sync;
- firehose ingestion;
- federation finalisation;
- notification ingestion;
- status monitoring;
- chain event reconciliation;
- Proof of Usership aggregation;
- moderation;
- portfolio snapshots;
- digests/alerts.

The workflow files under `base44/workflows/` are the source of truth for actual configured schedules.

## 16. Security boundaries

### Browser

May receive public data and user-authorised transaction payloads. Must not contain privileged keys.

### Base44 backend

May access application secrets according to function scope and performs trusted policy/eligibility checks.

### Transaction relay

Restricts supported Starknet methods/contracts/classes. Holds host-side privileged transaction authority required by the current provisioning/verification model.

### Public RPC

Read-only. It should not expose Devnet write methods.

### Chain

Authoritative for public Web3 state.

## 17. Failure model

The application should fail closed for value-bearing operations.

Examples:

- expired private verification -> staking/bridge locked;
- expired chain verification -> staking/bridge locked;
- revoked assurance -> staking/bridge locked;
- duplicate operator registration -> blocked;
- immature withdrawal -> blocked;
- unsupported relay method -> blocked;
- unverified deployment pins -> network not activated.

Read-only identity/history should remain available where safe.

## 18. Localisation and accessibility

All major public UI changes should support the nine offered locales and the project's accessibility settings.

Do not make the Web3 surfaces English-only just because contract/RPC terms originate in English.

## 19. AI-assisted development

ChatGPT and Base44 are core development tools used across the product and chain implementation. AI assistance does not change the trust model: generated code must pass the same security, testing and review requirements as manually written code.

## 20. Where to go next

- End-user behaviour: `docs/USER_GUIDE.md`
- V2 chain detail: `docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md`
- Node roadmap: `docs/NODE_ARCHITECTURE.md`
- Contribution: `CONTRIBUTING.md`
- Forking: `docs/FORKING_AND_REBRANDING.md`
- Change governance: `docs/CHANGE_PROTOCOL.md`
- Deployment: `DEPLOYMENT.md`
