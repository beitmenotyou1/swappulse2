---
description: Species, market and price-enrichment endpoints.
---

# Enrichment API

Enrichment endpoints combine canonical catalogue records with species, market or pricing data. Provider coverage varies by language, set and card.

## Pokémon enrichment

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/pokemon-enrichment" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## PokéWallet market data

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/pokewallet-market" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Pokémon Price Tracker market data

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/pokemon-price-tracker-market" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## TCGplayer market data

{% openapi src="https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml" path="/functions/tcgplayer-market" method="post" %}
[https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml](https://raw.githubusercontent.com/beitmenotyou1/swappulse2/main/openapi.yaml)
{% endopenapi %}

## Guidance

* Expect a successful catalogue result even when optional enrichment is unavailable.
* Show the provider, currency and retrieval time beside market data.
* Do not use market estimates as financial advice or a guaranteed sale price.
* Respect provider licensing, approval and attribution requirements.
