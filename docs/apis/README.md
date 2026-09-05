---
description: Integrate with SwapPulse and understand every external API dependency.
---

# APIs

SwapPulse exposes a supported product API, a public read-only Starknet RPC and narrowly controlled service interfaces. It also integrates external services for Pokémon data, federation, payments, security, publishing and infrastructure.

{% hint style="warning" %}
A backend function existing in the repository does not automatically make it a public API. The OpenAPI contract is authoritative for supported product endpoints. Keep provider keys, service-role credentials, verifier secrets and relay tokens on trusted servers.
{% endhint %}

## API surfaces

| Surface                  | Audience                                            | Authentication                                 | Write access                             |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Product API              | App developers and approved integrations            | Public or Base44 user session, per operation   | Documented product actions only          |
| Base44 backend functions | First-party app and operators                       | Public, user, admin, webhook or system context | Function-specific                        |
| Starknet RPC gateway     | Browsers, explorers, nodes and tools                | None                                           | No                                       |
| Transaction relay        | SwapPulse backend only                              | Private bearer token and endpoint policy       | Narrow allowlist only                    |
| Service endpoints        | Feed clients, podcast apps, crawlers and monitors   | Public or service-specific                     | Mostly read-only                         |
| Third-party APIs         | SwapPulse backend or browser, depending on provider | Provider-specific                              | Restricted to the documented integration |

## Start here

* [Product API Reference](product-api-reference/)
* [Authentication and Access](authentication-and-access.md)
* [OpenAPI Contract](openapi-contract.md)
* [Backend Function Catalogue](backend-function-catalogue.md)
* [Read-only RPC Gateway](read-only-rpc-gateway.md)
* [Transaction Relay API](transaction-relay-api.md)
* [Webhooks and Service Endpoints](webhooks-and-service-endpoints.md)
* [Third-party APIs](third-party-apis/)

The machine-readable contract is [openapi.yaml on GitHub](https://github.com/beitmenotyou1/swappulse2/blob/main/openapi.yaml).

## Choosing an interface

Use the product API for supported app integrations. Use the public RPC only for approved read-only Starknet methods. Trusted SwapPulse backend services may use the relay for policy-checked writes. Everything else is internal, operational or provider-specific unless its page says otherwise.
