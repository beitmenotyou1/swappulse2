---
description: >-
  External payment, bot-protection, email, push and password-safety
  integrations.
---

# Payments, Anti-bot and Notifications

These integrations handle money, abuse prevention and outbound delivery. All authenticated provider calls run on the backend.

## Status matrix

| Provider or protocol              | Status                                 | Purpose                                                                                              |
| --------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Stripe Checkout                   | Active for fiat donations              | Hosted payment collection and server-side completion verification                                    |
| Cloudflare Turnstile              | Active                                 | Bot challenges for donations, status subscriptions and guarded actions                               |
| SMTP                              | Conditional                            | Contact and branded email delivery                                                                   |
| Base44 SendEmail                  | Active where used                      | Platform-managed email delivery                                                                      |
| Web Push with VAPID               | Conditional                            | Browser push notifications                                                                           |
| Have I Been Pwned Pwned Passwords | Active where password checks are shown | K-anonymous password-compromise check                                                                |
| ipapi.co and ipwho.is             | Active for first-visit locale          | Coarse locale suggestion                                                                             |
| NowPayments                       | Not exposed                            | Configuration and data-model remnants exist, but no callable donation/IPN integration is implemented |

## Stripe Checkout

SwapPulse creates hosted Checkout sessions on the server for GBP donations. The accepted amount is between £0.50 and £10,000.

A client redirect is not proof of payment. The backend must retrieve or verify the completed session before recording a successful donation. Keep Stripe keys server-side and make completion handling idempotent.

## Cloudflare Turnstile

The browser renders the Turnstile challenge, then the backend submits the token to the provider's site-verification endpoint. The client result alone is not trusted.

* bind validation to the intended action
* reject missing, expired or already-used tokens
* keep the secret key on the server
* fail closed for protected money or write operations

## Email

SwapPulse can send through configured SMTP and Base44's managed SendEmail integration. SMTP settings are provider-agnostic.

Validate recipient addresses, escape user-provided content and avoid placing sensitive data in email. Store credentials in backend secret storage. Delivery success means the provider accepted the message, not that a person read it.

## Web Push

Web Push uses VAPID credentials. The public VAPID key may be supplied to a subscribing browser, but the private key must remain server-side. Remove expired subscriptions after permanent delivery errors.

## Pwned Passwords

SwapPulse can query:

```
https://api.pwnedpasswords.com/range/<first-five-SHA1-characters>
```

Only the first five hexadecimal characters of the password's SHA-1 hash are sent. Matching happens locally against returned suffixes. A provider outage is non-blocking and the raw password is never transmitted or logged.

## Locale lookup

`ipapi.co/json` is the primary first-visit locale lookup and `ipwho.is` is the fallback. Each has a three-second timeout. The result is a convenience default, not a verified location, and should not be retained as precise tracking data.

## NowPayments status

A `CryptoDonation` data model and a `NOWPAYMENTS_API_KEY` configuration check exist, but the audited repository has no implemented create-donation or IPN webhook function. Therefore crypto payments are not a current SwapPulse API. Do not document or advertise them as live until the complete server-side flow is implemented and reviewed.

{% hint style="warning" %}
The environment name `WIX_CHECKOUT_APP_URL` is a legacy name for the application origin. It does not indicate a Wix API integration.
{% endhint %}
