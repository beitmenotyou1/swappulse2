---
description: Create your self-custodial smart account
---

# On-Chain Identity

Create your self-custodial smart account

{% hint style="info" %}
Wallet, SWPX and staking features currently use the SwapPulse testnet unless this page explicitly states otherwise.
{% endhint %}

## What is an on-chain identity?

Your on-chain identity is a smart account on the SwapPulse network that belongs only to you. It is what signs your attestations, holds your anchored cards, and carries your staking position. It is bound to a signing key created and encrypted inside your own browser, so it cannot be taken over by the platform.

## Setting it up

1. Confirm your age band in Settings, wallet features require 18+.
2. Open the Wallet page. It checks that the network is verified and ready.
3. Create your device signer. The private key is generated and encrypted on this device.
4. Reserve your identity. Only the public key is sent, never the private key.
5. Secure your identity on chain. This deploys your account and registers it.

## Understanding the status

* **Pending:** Your identity is reserved but not yet confirmed by the network.
* **Registered:** Confirmed on chain. You can now attest, anchor, stake, and bridge.
* **Recovered:** Restored through the recovery process after a lost signer.
* **Merged:** Consolidated with another identity record for the same collector.
* **Failed:** A setup step did not complete. Your reservation is safe, you can retry.

## One device, one signer

A reserved identity is bound to the signer that reserved it. If you open the Wallet on a different device, SwapPulse tells you that this device holds a different signer and will not let you overwrite it, because a mismatched signer can never produce a valid signature. Use the recovery process instead of replacing the signer.

## Keep your key

* Clearing your browser storage removes the encrypted signer from that device.
* SwapPulse cannot recreate your private key for you, that is what self-custody means.

## Open this feature

* [Open On-Chain Identity in SwapPulse](https://swappulse.org/wallet)
* [View the original help route](https://swappulse.org/help/chain-identity)
