---
description: Publishing webhooks, share flows, search discovery and media embeds.
---

# Discovery, Publishing and Media APIs

SwapPulse can publish notifications to selected channels, generate discovery documents and render approved media embeds. Some provider-labelled cross-posting paths are simulations, not active API integrations.

## Publishing status

| Destination                             | Status                 | Implementation                                                                     |
| --------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| Discord                                 | Active when configured | Validated incoming webhook                                                         |
| Telegram                                | Active when configured | Bot API `sendMessage`                                                              |
| Bluesky automated cross-post dispatcher | Simulated              | Records or previews the action; federation features use separate AT Protocol paths |
| Mastodon automated cross-post           | Simulated              | No live OAuth provider call                                                        |
| Nostr automated cross-post              | Simulated              | No live relay publication                                                          |
| Twitter/X automated cross-post          | Simulated              | No live OAuth provider call                                                        |
| Native share and share intents          | Active client feature  | Redirect or operating-system share sheet, not a stored provider API                |

## Discord

Webhook destinations are accepted only when the HTTPS host and path match the strict allowlist. The webhook URL is a secret because it authorises posting.

Payloads should be length-limited, escaped and free of private application data. Rotate a webhook after exposure.

## Telegram

SwapPulse uses the Telegram Bot API `sendMessage` operation. The bot token format is validated and the token remains server-side. Validate the destination chat, escape content for the selected parse mode and handle provider rate limits.

## Simulated destinations

The cross-post dispatcher currently simulates Bluesky, Mastodon, Nostr and Twitter/X publication paths. Do not tell users that these provider OAuth integrations are active. AT Protocol federation elsewhere in SwapPulse is a separate working subsystem.

## Search discovery endpoints

The SwapPulse sitemap and robots endpoints return XML and plain text for search crawlers. They are owned service endpoints, not third-party APIs. Consumers should respect cache and content-type headers.

## Media embeds

The application can render approved embed URLs for:

* YouTube
* Vimeo
* Twitch
* TikTok
* Spotify
* Dailymotion

These are media embeds, not privileged provider API integrations. Normalise and validate the URL before rendering, use the provider's supported embed host and apply browser content-security policy.

## Share guidance

* Do not include private identifiers or secrets in share URLs.
* Obtain explicit user action before opening external share targets.
* Label simulated publisher actions clearly.
* Keep provider tokens and webhook URLs out of browser code and logs.
* Respect provider content, attribution and automation policies.
