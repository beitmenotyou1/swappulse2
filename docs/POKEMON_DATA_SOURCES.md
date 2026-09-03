# SwapPulse Pokémon Data Sources

SwapPulse deliberately combines several Pokémon/TCG data providers, but each provider has a narrow role. They are not treated as interchangeable catalogues.

## Source-of-truth hierarchy

| Provider | SwapPulse role | Canonical? | Browser credential? | Cache strategy |
|---|---|---:|---:|---|
| TCGDex | Card/set catalogue, card IDs, images, TCG details, baseline pricing | Yes, for card identity | No secret | Local catalogue + browser/offline cache |
| PokéAPI | Pokémon species/game enrichment via National Pokédex ID | No | No key | Persistent backend resource cache |
| PokéWallet | TCGPlayer/CardMarket market cross-check | No | Never | Persistent market/mapping cache + quota ledger |
| PokemonPriceTracker | RAW/condition, graded sold-price and recent-history enrichment | No | Never | 24-hour card cache + credit ledger + stale fallback |
| TCGplayer | Direct TCGplayer product/pricing cross-check for existing authorised developer accounts | No | Never | 30-day mapping + 6-hour pricing cache + usage ledger |

When provider records disagree about which card is being described, the TCGDex card remains the SwapPulse identity.

## TCGDex

TCGDex is the canonical Pokémon TCG catalogue used throughout collection, trade, scanner and Card Detail workflows.

SwapPulse stores/references TCGDex card IDs rather than provider-specific enrichment IDs. This keeps collection records stable if a market provider is unavailable or replaced later.

Typical TCGDex data includes:

- card/set identity;
- names and localisation;
- collector number;
- rarity;
- card category;
- attacks, weaknesses and other TCG fields;
- images/variants;
- National Pokédex IDs for Pokémon cards;
- baseline TCGPlayer/CardMarket pricing where supplied.

## PokéAPI

PokéAPI adds information about the Pokémon represented by a card, not another copy of the TCG card catalogue.

The join is numeric:

```text
TCGDex card.dexId -> PokéAPI pokemon/species resources
```

SwapPulse does not parse card names to guess species. Trainer/Energy cards and Pokémon cards without a usable `dexId` simply omit the species panel.

Resources are cached persistently because PokéAPI asks clients to cache responses and the underlying species/game information changes slowly.

## PokéWallet

PokéWallet is an optional market cross-check for TCGPlayer/CardMarket pricing and variants.

Security/performance rules:

- `POKEWALLET_API_KEY` is backend-only;
- browser code sends only the TCGDex card ID to SwapPulse;
- mapping is conservative and ambiguous results are rejected;
- market responses are cached for hours;
- mappings are cached longer;
- SwapPulse maintains a soft quota below the provider Free limit;
- stale data may be served during short provider/rate-limit failures;
- TCGDex remains available if PokéWallet is unavailable.

SwapPulse does not use PokéWallet's authenticated image endpoint by default because TCGDex already supplies card imagery and market quota is better spent on unique information.

## PokemonPriceTracker

PokemonPriceTracker adds the information that most clearly complements the other sources:

- RAW/condition/printing pricing;
- graded sold-price data;
- recent price history;
- plan-appropriate additional grading/market fields.

### Free-plan budget

Current Free-plan assumptions used by the client are:

- 100 credits/day;
- 60 requests/minute;
- 3 days of history;
- basic card = 1 credit;
- history = +1 credit/card;
- graded/eBay data = +1 credit/card.

A fully enriched card is therefore budgeted at 3 credits. SwapPulse reserves headroom and stops fresh upstream work at 80 credits/day and 75% of the request-rate ceiling.

Card results are cached for 24 hours, matching the provider's daily-price-update model. No collection-wide/background bulk refresh runs on Free.

### Licensing gate

PokemonPriceTracker's dedicated licensing page says revenue-bearing apps/sites require Business and explicitly treats product-linked donations as revenue. Some separate pricing/marketing pages currently contain broader commercial-use wording for Free/API plans.

SwapPulse follows the stricter dedicated licensing page until the provider resolves the inconsistency in writing.

Therefore:

```text
Free/API + ordinary public user
    -> no provider call
    -> no credits spent
    -> panel hidden

Free/API + authenticated SwapPulse admin
    -> development/evaluation call permitted by SwapPulse policy
    -> quota/caching rules apply

Business/Enterprise
    -> public product enrichment can be enabled
```

A maintainer who receives explicit written permission for a different use may deliberately set the documented public-use override. The override must not be used merely to bypass the provider plan requirement.

### Redistribution boundary

SwapPulse uses PokemonPriceTracker data only to power its own product UI. It does not provide:

- a public PokemonPriceTracker proxy API;
- downloadable bulk provider datasets;
- a replacement price feed;
- third-party access keys to cached provider data.

## Privacy boundary

None of these enrichment calls require SwapPulse to send a user's:

- name;
- email;
- Base44 account ID;
- AT Protocol DID;
- Starknet identity/account;
- age/verification evidence;
- private collection notes.

The backend sends card/species catalogue identifiers and metadata only.

## Failure behaviour

External enrichment is non-critical.

```text
TCGDex unavailable
    -> canonical catalogue path is degraded

PokéAPI unavailable
    -> species profile omitted / cached copy used

PokéWallet unavailable or quota-limited
    -> market cross-check omitted / stale cache used

PokemonPriceTracker unavailable, quota-limited or licence-gated
    -> graded/recent panel omitted / permitted stale cache used

TCGplayer unconfigured, not approved, unavailable or rate-limited
    -> direct TCGplayer panel omitted / cached pricing used where permitted
```

A failure in an enrichment provider must never block collection access, trading, social features, Wallet, AT Protocol functionality or the Cairo/Starknet V2 layer.

## Secrets

Provider credentials belong only in Base44 managed secrets/environment configuration.

Current secret/config names:

```text
POKEWALLET_API_KEY
POKEMON_PRICE_TRACKER_API_KEY
POKEMON_PRICE_TRACKER_PLAN
POKEMON_PRICE_TRACKER_PUBLIC_USE_ALLOWED
TCGPLAYER_PUBLIC_KEY
TCGPLAYER_PRIVATE_KEY
TCGPLAYER_APPROVED_USE
TCGPLAYER_SOFT_CALLS_PER_MINUTE
TCGPLAYER_SOFT_CALLS_PER_DAY
```

Do not place secret values in `.env` files committed to Git, frontend code, screenshots, issue reports or documentation.

## References

- TCGDex: https://tcgdex.dev/
- PokéAPI: https://pokeapi.co/docs/v2
- PokéWallet: https://www.pokewallet.io/api-docs
- PokemonPriceTracker API: https://www.pokemonpricetracker.com/docs
- PokemonPriceTracker licensing: https://www.pokemonpricetracker.com/licensing
- TCGplayer developer docs: https://docs.tcgplayer.com/docs/welcome
- TCGplayer API Terms: https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions
- Third-party boundaries: `THIRD_PARTY_NOTICES.md`
