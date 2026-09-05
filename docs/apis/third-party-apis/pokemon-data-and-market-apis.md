---
description: >-
  Canonical Pokémon catalogue, species, pricing and affiliate-provider
  integrations.
---

# Pokémon Data and Market APIs

SwapPulse keeps catalogue identity separate from optional market enrichment. TCGDex supplies the canonical card and set IDs. Other providers add species, price or affiliate data only when a conservative match is available.

## Provider matrix

| Provider            | Status                      | Purpose                                                | Authentication               |
| ------------------- | --------------------------- | ------------------------------------------------------ | ---------------------------- |
| TCGDex              | Active                      | Canonical cards, sets, languages and catalogue pricing | None                         |
| PokéAPI             | Active                      | Species and game enrichment                            | None                         |
| PokéWallet          | Conditional                 | TCGPlayer and Cardmarket variant prices                | Backend API key              |
| PokemonPriceTracker | Conditional, licence-gated  | RAW, graded and recent sold-price enrichment           | Backend API key              |
| TCGplayer           | Dormant unless pre-approved | Direct catalogue and market prices                     | Approved backend credentials |
| Impact              | Conditional                 | Validated TCGplayer affiliate deep links               | Backend Basic authentication |

## TCGDex

Base API: `https://api.tcgdex.net/v2`\
Assets: `https://assets.tcgdex.net`

TCGDex is the canonical catalogue and identifier namespace for SwapPulse. The application supports its 17 language codes and can use `@tcgdex/sdk` where appropriate. Client-side calls are held below 10 requests per second, with retry and caching controls.

Use returned IDs exactly. Do not derive an ID from a translated name.

## PokéAPI

Base API: `https://pokeapi.co/api/v2`

PokéAPI adds species and game information. SwapPulse joins a card to a species only through TCGDex `dexId`. It does not guess a Pokémon from the card name. Responses are cached server-side and no API key is required.

## PokéWallet

Base API: `https://api.pokewallet.io`

The backend maps one canonical TCGDex card to PokéWallet and returns normalised TCGPlayer and Cardmarket variants. Ambiguous matches are rejected.

| Guardrail                  | Value                                  |
| -------------------------- | -------------------------------------- |
| Provider free-tier ceiling | 100 requests/hour and 1,000/day        |
| SwapPulse soft ceiling     | 80 requests/hour and 800/day           |
| Card response cache        | 6 hours                                |
| Search and set cache       | 24 hours                               |
| Mapping cache              | 30 days                                |
| Stale fallback             | Up to 7 days during temporary failures |

The key stays on the backend. Pro-only and unreleased provider operations are not proxied.

## PokemonPriceTracker

Base API: `https://www.pokemonpricetracker.com/api/v2`

SwapPulse performs one strict `limit=1` query using the card name, set and collector number. A fully enriched card can consume three credits: base data, history and graded/eBay data.

| Guardrail                          | Value                                     |
| ---------------------------------- | ----------------------------------------- |
| Free-plan allowance                | 100 credits/day and 60 calls/minute       |
| SwapPulse soft ceiling             | 80 credits/day and 45 calls/minute        |
| Result cache                       | 24 hours                                  |
| Public production on Free/API plan | Blocked unless explicit permission exists |

Free and API plans are treated as development or non-commercial unless the provider's current terms and written permission say otherwise. Business or Enterprise configuration can enable production use. The function must not become a replacement data feed.

## TCGplayer

Base API: `https://api.tcgplayer.com`

The direct integration is dormant unless SwapPulse already has approved TCGplayer credentials and `TCGPLAYER_APPROVED_USE=true`. The provider is not granting general new API access, so the code must not imply that a new key can be obtained.

Default SwapPulse safety ceilings are 30 calls/minute and 1,000/day. Product mappings are cached for 30 days and prices for 6 hours. The client is read-only and exposes no store, order, inventory, customer, buylist or seller-price mutation.

## Impact affiliate links

Base API: `https://api.impact.com`

Impact is used only to create or retrieve validated TCGplayer affiliate deep links when the programme is active and permits the use. Authentication uses an Account SID and token on the backend.

Only approved HTTPS TCGplayer destinations are accepted. The application uses an 800 request/hour soft ceiling against the usual 1,000/hour provider allowance and can cache links for 30 days. If the affiliate operation is unavailable, SwapPulse falls back to the normal product URL and keeps the required affiliate disclosure.

## Display and failure rules

* Identify the source, currency and retrieval time beside market data.
* Treat prices as informational estimates, not guaranteed sale values.
* Preserve provider attribution and licensing terms.
* Keep canonical card pages usable when optional enrichment fails.
* Never expose a provider key or bearer token to the browser.
