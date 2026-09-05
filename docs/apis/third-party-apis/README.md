---
description: >-
  External platforms and provider APIs used by SwapPulse, with status,
  boundaries and integration guidance.
---

# Third-party APIs

SwapPulse integrates with external services for application hosting, Pokémon data, federation, payments, security, notifications, publishing and chain infrastructure. This section distinguishes active integrations from optional, dormant and simulated paths.

## Status meanings

| Status      | Meaning                                                                               |
| ----------- | ------------------------------------------------------------------------------------- |
| Active      | Used by the current application or production infrastructure                          |
| Conditional | Used only when configured, approved or invoked for a specific feature                 |
| Dormant     | Code exists, but the integration is disabled unless explicit requirements are met     |
| Simulated   | The current workflow records or previews an action without calling the named provider |
| Not exposed | Configuration or data models exist, but no callable integration is implemented        |

{% hint style="info" %}
Provider limits, pricing and policies can change. Treat the limits recorded here as application guardrails and verify the provider's current terms before increasing traffic.
{% endhint %}

## Integration principles

* Keep provider credentials in backend secret storage.
* Use server-side adapters rather than calling authenticated provider APIs from the browser.
* Apply caching and local rate limits below provider ceilings.
* Preserve source attribution and licensing metadata.
* Fail safely when optional enrichment is unavailable.
* Do not represent simulated or dormant integrations as live.
* Minimise personal data and redact secrets from logs.

The child pages document every verified provider family and its current SwapPulse status.
