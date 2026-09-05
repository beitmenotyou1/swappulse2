---
description: >-
  Licensing, attribution and usage boundaries for third-party services and
  content.
---

# Third-party Notices

SwapPulse is built with and integrates third-party open-source software, hosted services, public protocols and data sources. A SwapPulse software licence applies only to material the SwapPulse rightsholders/contributors are entitled to license.

This file is not a substitute for the licence files shipped with individual dependencies. Dependency licences in package managers/source distributions remain authoritative for those components.

## TCGdex

SwapPulse uses TCGdex for Pokémon Trading Card Game catalogue/data functionality and uses the `@tcgdex/sdk` package.

Upstream resources:

* https://tcgdex.dev/
* https://github.com/tcgdex/cards-database
* https://github.com/tcgdex/javascript-sdk

The TCGdex cards-database repository states that the database is licensed under the MIT License and that it is not produced, endorsed, supported or affiliated with Nintendo or The Pokémon Company. TCGdex SDK repositories are also published under MIT licensing.

TCGdex remains an independent third-party project. SwapPulse does not claim ownership of TCGdex, its name, its API service or third-party rights that may be represented in data returned by the service.

If a SwapPulse distribution copies/substantially redistributes TCGdex MIT-licensed source/database material rather than merely calling the hosted API, preserve the applicable upstream MIT copyright/licence notices as required by that licence.

## PokéWallet

SwapPulse optionally uses the PokéWallet hosted API for cached Pokémon TCG market-price enrichment, including data aggregated from TCGPlayer and CardMarket. TCGDex remains SwapPulse's canonical catalogue/identity source for cards.

Upstream resources:

* https://www.pokewallet.io/
* https://www.pokewallet.io/api-docs

PokéWallet is a hosted third-party service and remains subject to its own terms, usage tiers and rate limits. The API key used by SwapPulse must remain in backend secret management and must never be shipped in browser code, logs or source control.

## PokemonPriceTracker

SwapPulse includes an optional integration with the PokemonPriceTracker hosted API for RAW card prices, graded sold-price data and recent price history.

Upstream resources:

* https://www.pokemonpricetracker.com/
* https://www.pokemonpricetracker.com/docs
* https://www.pokemonpricetracker.com/licensing

PokemonPriceTracker is a hosted third-party service. Its data, API service, terms, subscription limits and commercial-use permissions are not licensed under SwapPulse's MPL-2.0 licence.

The provider's dedicated licensing page (last updated 17 August 2026) distinguishes non-commercial/personal/development use from revenue-bearing deployments and says revenue-bearing apps/sites require Business. Some separate pricing/marketing pages currently contain broader "commercial use" wording for lower plans. SwapPulse follows the stricter dedicated licensing page until the provider confirms otherwise in writing. It therefore fails closed for ordinary public production display when configured on Free/API plans unless the maintainer has explicit permission covering the deployment and deliberately enables the documented override.

The provider also prohibits redistributing its data as a competing/substitute data API or bulk data product. SwapPulse's integration is therefore a product UI enrichment only, not a public PokemonPriceTracker proxy/feed.

The API key must remain in backend secret management and must never be committed to source code or shipped to browser clients.

## TCGplayer

SwapPulse includes an optional direct TCGplayer API integration for read-only Pokémon catalogue matching and market-price cross-checks.

Upstream resources:

* https://docs.tcgplayer.com/docs/welcome
* https://docs.tcgplayer.com/docs/getting-started
* https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions

TCGplayer currently states that it is no longer granting new API access. SwapPulse therefore supports only existing authorised TCGplayer developer credentials. The provider's API Terms limit use to the purpose approved by TCGplayer and reserve the right to limit excessive or unreasonable request volume.

SwapPulse keeps `TCGPLAYER_PUBLIC_KEY` and `TCGPLAYER_PRIVATE_KEY` in backend secret management, caches the resulting Bearer token in server memory only, and requires `TCGPLAYER_APPROVED_USE=true` before any provider request is sent. Store/inventory/order/buylist mutation endpoints are deliberately outside the integration.

When TCGplayer pricing is displayed, SwapPulse identifies TCGplayer as the source, links to the relevant TCGplayer product, and displays the provider-required notice: “This product uses TCGplayer data but is not endorsed or certified by TCGplayer.”

TCGplayer content/data remains subject to TCGplayer's own API Terms and is not licensed under SwapPulse's MPL-2.0 licence. If API use is terminated, maintainers must follow TCGplayer's termination/data-deletion obligations for cached TCG Content.

### Impact affiliate tracking

SwapPulse can create TCGplayer affiliate deep links through the separate Impact.com Partner API. Impact authentication is backend-only using `IMPACT_ACCOUNT_SID` and a scoped `IMPACT_AUTH_TOKEN`; neither value is returned to browsers or committed to source control.

The backend sends Impact only the validated TCGplayer destination URL and generic tracking metadata required to create the link. It does not include a SwapPulse user ID, email address, AT Protocol identifier, private collection notes or Web3 identity. Generated links are cached to minimise Impact API traffic. If a user chooses to follow an affiliate tracking link, subsequent click/conversion attribution is handled by Impact/TCGplayer under their own terms and privacy policies.

SwapPulse displays an affiliate disclosure next to active affiliate links. Impact's API rate limits and tracking-link rules remain third-party service terms and are not governed by SwapPulse's MPL-2.0 licence.

## PokéAPI

SwapPulse optionally uses the public PokéAPI for Pokémon species and game-data enrichment. The integration is linked through National Pokédex IDs supplied by TCGDex and caches fetched resources server-side in line with PokéAPI's fair-use guidance.

Upstream resources:

* https://pokeapi.co/
* https://pokeapi.co/docs/v2

PokéAPI and its data remain third-party resources subject to their own terms/licensing. SwapPulse does not claim ownership of PokéAPI or the Pokémon intellectual property represented by that data.

## Pokémon and related intellectual property

Pokémon, Pokémon character names, card artwork, game artwork and associated trademarks/copyrights are owned by their respective rightsholders, including Nintendo, Creatures Inc., GAME FREAK inc. and/or The Pokémon Company/The Pokémon Company International as applicable.

SwapPulse is an independent community project and is not affiliated with, endorsed by, sponsored by or approved by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company.

A SwapPulse source-code licence does **not** grant rights to use third-party Pokémon names, logos, characters, card artwork or other protected material.

Fork maintainers are responsible for ensuring they have lawful rights/permissions for the content, branding, data and media used by their fork.

Relevant public rights/terms information includes:

* https://www.pokemon.com/uk/legal/terms-of-use
* https://www.pokemon.com/us/legal/copyright

## Base44

SwapPulse uses Base44 as its application/orchestration platform, including managed application services, entities, authentication, backend functions and workflows.

The SwapPulse repository licence does not license the Base44 platform itself. Base44 services and SDK components remain subject to their own applicable terms and licences.

## AT Protocol

SwapPulse integrates AT Protocol concepts and services including decentralised identifiers, PDS/federation and related protocol functionality.

AT Protocol specifications, libraries and implementations remain subject to their own licences and terms. SwapPulse's licence applies only to SwapPulse-owned integration/application code.

## Cairo, Starknet and OpenZeppelin

SwapPulse's Web3 layer is built using Cairo/Starknet tooling and established OpenZeppelin Cairo components where appropriate.

Cairo, Starknet tooling, OpenZeppelin components and other chain dependencies remain subject to their own upstream licences. Their inclusion does not transfer their copyrights/trademarks to SwapPulse.

## Other hosted services and protocols

The audited application also contains active or conditional integrations with Stripe Checkout, Cloudflare Turnstile and Tunnel, SMTP providers, Web Push, Have I Been Pwned Pwned Passwords, Bluesky AppView, PLC directory services, Google DNS over HTTPS, Discord webhooks, the Telegram Bot API and approved media-embed providers.

These services, protocols, content and provider APIs remain subject to their own current terms, privacy notices, rate limits and intellectual-property rights. SwapPulse's MPL-2.0 licence does not license a provider's service or data.

For the implementation status, credential boundary and usage guidance for each integration, see [Third-party APIs](../apis/third-party-apis/).

The current repository does not expose a working NowPayments donation API. It also treats automated Mastodon, Nostr and Twitter/X cross-post paths as simulated. Their names in configuration or dispatcher code must not be interpreted as a live service integration.

## npm and other dependencies

See `package.json`, lockfiles and individual dependency distributions for applicable third-party software licences.

The repository's project licence must not be read as replacing or overriding an individual dependency's licence.

## User content

Content posted/uploaded by users remains subject to the site's Terms, privacy policies, user rights and applicable law. Open-sourcing the SwapPulse application source does not place user posts, messages, uploaded images or personal data under the source-code licence.

## Trademarks and project identity

An open-source code licence generally grants copyright/patent permissions specified by that licence. It should not be interpreted as a blanket trademark licence to present an independent fork as the official SwapPulse service.

Independent forks should use branding that avoids misleading users about origin, endorsement, network identity, token identity or operator status.

## Reporting an issue

If you believe a third-party attribution, licence notice or intellectual-property boundary in this repository is incomplete or incorrect, please open a GitHub issue or submit a focused documentation pull request without including confidential information.
