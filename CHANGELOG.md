# SwapPulse Changelog

This changelog records versioned SwapPulse releases from the point where preserved, authoritative deployment checkpoints are available. Older development history remains available through Git history and is not assigned retrospective version numbers without a trustworthy release checkpoint.

SwapPulse is currently in beta, so all versions remain below `1.0.0` until the project is ready to make stronger compatibility guarantees.

## Versioning

SwapPulse uses Semantic Versioning as a practical release convention:

- **MAJOR**: incompatible protocol/application changes after `1.0.0`.
- **MINOR**: significant new user-facing capabilities, product areas or network architecture changes.
- **PATCH**: fixes, hardening, accessibility/localisation improvements and compatible maintenance releases.

Every significant website or protocol update should include:

1. a changelog entry;
2. a dedicated `.github/releases/vX.Y.Z.md` release-note file;
3. a `RELEASE_MANIFEST.json` entry;
4. tests/checks appropriate to the changed layer;
5. an updated version where appropriate;
6. migration, security, privacy, localisation and accessibility notes where relevant.

---

## v0.1.0 — Frozen V2 live baseline

**Historical milestone release.** 2026-09-03

Target checkpoint commit: `a10a91ba8260d34aed78afc08180c875ecdb8247`

### Added
- Live Cairo/Starknet V2 IdentityRegistry architecture.
- SwapPulse smart-account identity integration.
- SWPX native token, staking pool and supporting Web3 contracts.
- Hardened authenticated transaction relay and read-only public RPC gateway.
- Permanent V2-only verification requirement.

### Updated
- Base44 became the application/orchestration layer while Cairo/Starknet became the decentralised trust layer.
- Identity verification became privacy-preserving, with opaque commitments and assurance metadata on-chain rather than PII.

### Security
- 64 Cairo/Foundry tests collected, 63 passed, 0 failed, 1 deliberately ignored and independently verified.
- Relay policy regression passed.
- Expiry, revocation, replay, access-control and staking failure paths verified.

### Rationale
This release marks the first preserved, known-good post-cutover V2 baseline. It is the architectural foundation later product releases build upon.

---

## v0.2.0 — Identity and staking product layer

**Historical milestone release.** 2026-09-03

Target checkpoint commit: `c2ea788da2dd5825cb6631ff2093dab1eb65a203`

### Added
- Clear V2 identity assurance status in Wallet.
- Verification expiry and recovery-state presentation.
- Chain-authoritative operator/staking status.
- User-facing staking lifecycle controls for self-stake increases, delegation, undelegation, withdrawal and operator exit.

### Updated
- Staking reconciliation now follows confirmed chain state rather than treating Base44 mirrors as authoritative balances.
- Duplicate/in-flight lifecycle actions receive additional server-side protection.

### Removed/replaced
- Reliance on a stale local staking mirror as the primary source of operator state.

### Rationale
The secure V2 infrastructure already worked, but users needed understandable product controls. This release exposed that functionality without weakening the frozen chain security model.

---

## v0.3.0 — Navigation and standalone Chain Explorer

**Historical milestone release.** 2026-09-03

Target checkpoint commit: `4b5b6ef7c6adebd70a3936876b10ec5bace47327`

### Added
- Standalone public SwapPulse Chain Explorer application surface.
- Recent block and transaction views.
- Dedicated block, transaction and smart-account address routes.
- SwapPulse-indexed account activity.
- Wallet-to-explorer transaction/address navigation.
- GitHub links in visible footer/navigation surfaces.

### Updated
- Explore stays in primary navigation.
- Chain Explorer moves to a deliberate footer destination.
- Mobile/desktop More navigation becomes scrollable and less cluttered.
- Explorer receives language switching, theme support and accessibility preferences.

### Removed
- Duplicate Wallet and Chain Explorer entries from the More navigation.
- Redundant Explore footer entry.

### Rationale
The explorer needed to feel like a dedicated blockchain tool while the main social navigation needed fewer duplicate destinations.

---

## v0.4.0 — Wallet overview UX refresh

**Historical milestone release.** 2026-09-03

Target checkpoint commit: `bfb29db50942dd1e0c659d08fc0f717c9516fb1a`

### Added
- Asset-first SWPX wallet overview.
- Familiar Receive, Get SWPX, Stake and Send navigation actions.
- Direct smart-account explorer access.
- New wallet localisation bundle for all supported interface languages.

### Updated
- Wallet presentation becomes more familiar to users of mainstream self-custodial wallets while retaining SwapPulse-specific V2 identity, card, staking and bridge features.

### Security
- Signing, relay, eligibility and chain-state authority remain unchanged behind the redesigned presentation.

### Rationale
The original Wallet page was technically strong but read more like an account settings page than a wallet. This release begins the transition to an asset-first, familiar wallet experience.

---

## v0.5.0 — Complete project handbook and deployment documentation

**Historical milestone release.** 2026-09-03

Target checkpoint commit: `3249aaac2b4eec3b5123c38df83ef5954a9e3156`

### Added
- Complete project README covering Pokémon TCG, TCGdex, social/community features, AT Protocol, Base44 and Cairo/Starknet as one architecture.
- User guide.
- Project architecture guide.
- Forking/rebranding guide.
- Change protocol.
- Node architecture roadmap.
- Updated contributor documentation.

### Updated
- Deployment documentation now reflects the real Base44 + PDS/AT Protocol + mini-server Starknet architecture.
- Developer onboarding now uses Cairo/Starknet rather than obsolete Solidity/Polygon assumptions.
- API/function documentation now separates current V2 paths from legacy compatibility code.

### Removed/replaced
- Misleading documentation that described SwapPulse as running entirely on Base44.
- Old PulseChain/Polygon-first wallet and deployment instructions as the canonical architecture.

### Rationale
The repository needed to explain the whole product to collectors, contributors and people wanting to fork the project, not only the Web3 subsystem.

---

## v0.6.0 — Automated GitHub release discipline

**Current release-series change.** 2026-09-03

Target: `main` when this release manifest lands.

### Added
- Structured release history oldest to newest.
- Dedicated release-note files.
- Machine-readable release manifest.
- GitHub Actions release publisher for missing versioned releases.
- Release policy and pull-request release checklist.
- Third-party licensing guidance and separation of project code from third-party Pokémon/TCGDex assets.

### Updated
- Significant future changes must include release notes and a versioned manifest entry before they are treated as a release.

### Rationale
A transparent release process makes it easier for users, contributors and fork maintainers to understand what changed, why it changed and whether an update affects security, privacy, compatibility or deployment.

---

## v0.7.0 — MPL-2.0 and multi-source Pokémon enrichment

**Release milestone.** 2026-09-03

Target checkpoint commit: `063ca7c436c2e8dc7a52f2310bb276fdec900e31`

### Added
- Root Mozilla Public License 2.0.
- PokéAPI species/game enrichment linked by TCGDex National Pokédex IDs.
- Cached PokéWallet TCGPlayer/CardMarket market cross-checks.
- Card Detail Pokémon profile and additional market panels.
- Provider cache/usage monitoring and third-party notices.

### Updated
- About, Terms, README and package metadata consistently use MPL-2.0.
- TCGDex is documented as the canonical catalogue while PokéAPI/PokéWallet remain optional enrichment sources.

### Security/privacy
- Enrichment provider credentials remain backend-only.
- No personal identity or private collection data is required by enrichment requests.
- External provider failures fail soft.

### Rationale
Enrich card detail pages without weakening the stable TCGDex identity/catalogue layer or exposing provider secrets.

---

## v0.8.0 — PokemonPriceTracker graded and recent-market enrichment

**Current release-series change.** 2026-09-03

Target: `main` when this release manifest lands.

### Added
- Server-only PokemonPriceTracker integration.
- RAW/condition, graded sold-price and recent-history Card Detail enrichment.
- Private response cache and provider-credit ledger.
- Admin quota/headroom visibility.
- Provider-specific privacy, API, architecture and licensing documentation.

### Performance/quota
- Free tier is treated as 100 credits/day, 60 requests/minute and 3-day history.
- SwapPulse uses an 80-credit/day soft ceiling and a 75% request-rate ceiling.
- Fully enriched card requests are budgeted as 3 credits and cached for 24 hours.
- No collection-wide/background provider sync is enabled on Free.

### Licensing
- Public production use fails closed on Free/API plans under the provider's dedicated licensing guidance for revenue-bearing deployments.
- Admin development/evaluation remains available without enabling public provider data.
- Provider data is not exposed as a substitute API, feed or bulk export.

### Security/privacy
- `POKEMON_PRICE_TRACKER_API_KEY` remains backend-only.
- Browser requests contain only the canonical TCGDex card ID.
- Conservative matching rejects low-confidence provider candidates instead of guessing.

### Rationale
Add uniquely useful graded and short-history data while preserving TCGDex as canonical, protecting a scarce credit budget and respecting the provider's licensing boundary.
