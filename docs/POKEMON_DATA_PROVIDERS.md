# SwapPulse Pokémon Data Providers

SwapPulse deliberately uses multiple Pokémon data services for different jobs. They are not interchangeable and they must not compete for authority over the same concept.

## Source-of-truth hierarchy

1. **TCGDex** is the canonical Pokémon TCG catalogue and SwapPulse card-ID namespace.
2. **PokéAPI** enriches the Pokémon species/game information behind eligible Pokémon cards.
3. **PokéWallet** adds optional TCGPlayer/CardMarket market cross-checks.
4. **PokemonPriceTracker** adds optional RAW/condition, graded sold-price and recent-history enrichment where its subscription/licensing terms permit the deployment.

When an enrichment provider disagrees with TCGDex about which card is being viewed, SwapPulse keeps the TCGDex identity and rejects/omits the enrichment rather than silently remapping the card.

## TCGDex

Role:

- canonical card and set identity;
- card name, collector number, set, rarity and illustrator;
- TCG rules/card text and variants;
- images/catalogue assets;
- baseline TCGPlayer/CardMarket pricing when supplied upstream;
- National Pokédex IDs (`dexId`) used to join Pokémon species enrichment.

Operational model:

- persistent application cache;
- frontend IndexedDB fallback where appropriate;
- catalogue searches and card pages are expected to continue functioning even when optional enrichment providers are unavailable.

## PokéAPI

Role:

- species and National Pokédex information;
- generation;
- game types;
- abilities;
- base statistics;
- height/weight;
- forms/evolution/species metadata;
- multilingual species information where available.

Join rule:

- use TCGDex National Pokédex IDs only;
- never guess species from strings such as `M Charizard EX`, Tag Team names or owner-prefixed card names.

Caching:

- persistent backend cache, currently 30 days;
- no API key;
- PokeAPI is additive and must not make a TCG card unavailable when it fails.

## PokéWallet

Role:

- optional market cross-check;
- TCGPlayer variant prices;
- CardMarket variant/average/trend context;
- provider marketplace links where safe.

Identity rules:

- TCGDex remains canonical;
- mapping compares collector number, card name, set and rarity;
- ambiguous matches are rejected;
- PokéWallet IDs are stored only as provider mappings, never promoted to the SwapPulse canonical card ID.

Free-tier protection:

- provider limit: 100 requests/hour and 1,000/day;
- SwapPulse soft ceiling: 80/hour and 800/day;
- market/card responses: 6-hour persistent cache;
- search/set index: 24-hour cache;
- TCGDex→PokéWallet mapping: 30-day cache;
- safe stale fallback during temporary upstream failure;
- no use of the authenticated image endpoint because TCGDex already supplies card imagery.

Unavailable/paid functionality is not exposed as if it were available on Free.

## PokemonPriceTracker

Role:

- RAW market/condition pricing;
- recent price history;
- graded sold-price data (including PSA/other supported grading data returned by the provider);
- optional card-detail cross-check only.

### Free-tier economics

Provider documentation describes the Free tier as:

- 100 credits/day;
- 60 requests/minute;
- 3-day recent history;
- basic card data: 1 credit/card;
- history: +1 credit/card;
- graded/eBay data: +1 credit/card.

A fully enriched card is therefore budgeted as **3 credits**.

SwapPulse reserves headroom:

- 80 credits/day soft ceiling;
- 45 requests/minute soft ceiling;
- one `limit=1` card request only;
- 24-hour persistent cache because provider pricing has daily granularity;
- no background collection-wide sync;
- no bulk set fetching on Free;
- no population/export/business-only endpoints on Free.

The provider's own returned credit headers are recorded alongside SwapPulse's local quota ledger so the upstream account remains authoritative if local estimates differ.

### Licensing gate

PokemonPriceTracker's dedicated licensing page and Terms state that revenue-bearing deployments require Business/Enterprise and that Free/API are for personal, non-revenue, development/evaluation use. Some separate pricing/marketing pages currently contain broader commercial-use wording for lower plans.

SwapPulse follows the stricter dedicated licensing/Terms position until written clarification says otherwise.

Therefore:

- ordinary public users do not receive PokemonPriceTracker data when `POKEMON_PRICE_TRACKER_PLAN=free` or `api`;
- authenticated admins may exercise the integration for development/evaluation;
- public use becomes eligible when Business/Enterprise is configured;
- `POKEMON_PRICE_TRACKER_PUBLIC_USE_ALLOWED=true` exists only for explicit written permission covering the deployment and must not be used merely to bypass the provider's plan terms.

Provider data is never exposed as a standalone API/feed, bulk dataset or substitute pricing service.

## Backend-only secrets

Provider credentials must never be present in `src/` or browser bundles.

Current server-side secret/config names:

- `POKEWALLET_API_KEY`
- `POKEMON_PRICE_TRACKER_API_KEY`
- `POKEMON_PRICE_TRACKER_PLAN` (defaults to `free`)
- `POKEMON_PRICE_TRACKER_PUBLIC_USE_ALLOWED` (defaults to false)

PokeAPI and TCGDex currently do not require the same private credential pattern for these integrations.

## Frontend behaviour

Card Detail can independently render:

- canonical TCGDex card data;
- TCGDex baseline market data;
- PokéWallet market cross-check;
- PokemonPriceTracker graded/recent-market enrichment when licence/plan policy permits;
- PokéAPI species profile for cards with a valid TCGDex `dexId`.

Each panel must fail independently. A timeout, quota exhaustion, licensing gate or ambiguous mapping from one optional provider must not hide the canonical card page or the output of the other providers.

## Privacy boundary

Enrichment calls are catalogue-level, not user-level.

Do not send these providers:

- email addresses;
- Base44 user IDs;
- AT Protocol private credentials;
- chain private keys;
- private collection notes;
- identity-verification evidence.

The backend should send only the minimum card/set/species metadata required for the requested enrichment.

## Third-party rights

SwapPulse's MPL-2.0 licence covers only SwapPulse-owned/licensable source. It does not relicense:

- Pokémon intellectual property;
- TCGDex;
- PokéAPI;
- PokéWallet;
- PokemonPriceTracker data;
- TCGPlayer, CardMarket, eBay or grading-service data/marks referenced through providers.

See `THIRD_PARTY_NOTICES.md` and the provider's own current terms before changing how data is displayed, stored, redistributed or monetised.

## Adding another provider

Before adding another Pokémon data provider:

1. define the exact unique role it adds;
2. keep TCGDex canonical unless a documented architecture decision changes that;
3. review authentication and browser-secret risk;
4. review rate/credit limits and endpoint cost;
5. implement persistent caching and request coalescing;
6. define a soft budget below the provider limit;
7. define matching confidence and reject ambiguous mappings;
8. review commercial-use, storage and redistribution terms;
9. document privacy/data fields sent upstream;
10. make provider failure fail-soft;
11. add release notes and third-party notices;
12. test compatibility with all existing provider panels before enabling public traffic.
