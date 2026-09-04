---
description: Anchor verified cards and move them
---

# On-Chain Cards & Cross-Chain

Anchor verified cards and move them

{% hint style="info" %}
Wallet, SWPX and staking features currently use the SwapPulse testnet unless this page explicitly states otherwise.
{% endhint %}

## What are on-chain cards?

Once you have verified that you physically hold a card, you can anchor it on the SwapPulse network as your own token. The trust level from your attestation is carried into the token, so the proof of possession travels with it. Anchored cards are bound to the collector who verified them, they are not a market to be traded away from you.

## Anchoring a card

1. Attest the card first, an anchor needs a valid verification.
2. Open On-Chain Cards on the Wallet page.
3. Pick a verified card from the list of cards ready to anchor.
4. Confirm. The card appears under your on-chain cards once the network confirms it.

## Why anchor at all?

An anchored card is a claim nobody can quietly edit, including SwapPulse. It is the difference between a database row that says you own a card and a record you can prove you own. The same verification cannot be reused to anchor the same card twice.

## Cross-chain transfers

Cross-Chain lets you move a token amount or an anchored card from the SwapPulse network to another chain, currently Ethereum, a supported layer 2, or Solana. Choose what you are sending, pick the destination chain, enter the recipient address, and confirm. Recent transfers are listed with their status.

## Transfer status

* **Submitted:** Sent from the SwapPulse network.
* **Pending relay:** Waiting to be delivered on the destination chain.
* **Completed:** Delivered, with a transaction on the destination chain.
* **Refunded or failed:** The transfer did not complete and is reported back to you.

## Check the address

* A destination address cannot be corrected once a transfer is submitted, check it twice.
* The SwapPulse network stays the canonical home for an anchored card.
* Cross-chain features run on the testnet during the alpha.

## Open this feature

* [Open On-Chain Cards & Cross-Chain in SwapPulse](https://swappulse.org/wallet)
* [View the original help route](https://swappulse.org/help/on-chain-cards)
