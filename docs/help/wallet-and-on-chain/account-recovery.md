---
description: Bind a new device to your smart account
---

# Account Recovery

Bind a new device to your smart account

{% hint style="info" %}
Wallet, SWPX and staking features currently use the SwapPulse testnet unless this page explicitly states otherwise.
{% endhint %}

## When to use recovery

Your signing key lives only on the device that created it, so a lost, wiped, or replaced device means that device can no longer sign for your smart account. Recovery lets you bind a **new** device key to the same account, without SwapPulse ever holding your key.

## How it works

1. Sign in to SwapPulse as normal, then open Recover your account from the Wallet page.
2. Verify the code sent to your account email, key changes always need a fresh code.
3. Start recovery. A new signing key is created on this device and only its public half is sent.
4. Wait out the on-chain waiting period. Nothing changes on your account until it ends.
5. Come back and complete the recovery. Your new device key now controls the account.

## Why the waiting period exists

The delay is your protection. If somebody else ever started a recovery on your account, you would be notified and could cancel it before it takes effect. That is why recovery is deliberately slow rather than instant.

## Cancelling a recovery

While a recovery is scheduled you can cancel it at any point from the same page. Cancelling leaves your existing key in control and clears the pending change.

## Good to know

* Recovery replaces the key on the device you are using, so run it on the device you intend to keep.
* Your anchored cards, attestations, and stake stay with the same account, only the signing key changes.
* Recovery runs on the testnet during the alpha, alongside the rest of the wallet features.

## Open this feature

* [Open Account Recovery in SwapPulse](https://swappulse.org/recover)
* [View the original help route](https://swappulse.org/help/account-recovery)
