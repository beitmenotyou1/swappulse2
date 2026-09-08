---
description: >-
  Use one read-only assistant for collection, card, trade, project and
  blockchain questions.
---

# Collector Copilot

Collector Copilot is SwapPulse's unified AI assistant for collectors. It can answer questions using the information you are allowed to see in SwapPulse, current catalogue records, market context and reviewed project documentation.

{% hint style="warning" %}
Collector Copilot is advisory. It cannot add, remove or trade cards, send messages, operate a wallet or submit a blockchain transaction. Check important card, price, rule and trade information before acting.
{% endhint %}

## Open Collector Copilot

Sign in, then open [Collector Copilot](https://swappulse.org/collector-copilot).

Your conversations are associated with your account. Other collectors cannot open them through the Copilot page.

## What it can help with

* explain cards, sets, rarities and Pokémon TCG concepts;
* find gaps, duplicates and collecting priorities using your collection and wishlist;
* suggest ways to organise binders and collection goals;
* compare a proposed trade using available market context;
* explain SwapPulse features, the documented chain architecture and Stage D status;
* explain card possession verification and what an on-chain attestation does;
* point you to the relevant project source when it answers a SwapPulse question.

You can start with one of the suggested questions or type your own. Follow-up questions remain in the same conversation.

## Read-only by design

Collector Copilot has read access only. It cannot:

* create or edit a collection entry, wishlist item or binder;
* accept, reject, publish or negotiate a trade;
* post content or send a direct message;
* upload card evidence or approve a possession verification;
* sign a wallet request, access a private key or submit a chain action;
* change its own permissions, safeguards or source allowlist.

If a future feature can make a change, SwapPulse will show the proposed change for review and require explicit confirmation outside the conversation.

## How answers are grounded

Collector Copilot uses a defined source order:

1. **Your authorised SwapPulse records** for your collection, wishlist, binders and verification status.
2. **TCGDex-backed catalogue records** for card identity and printed card details.
3. **Stored market records** for price context, including the available source, currency and observation date.
4. **Approved project knowledge** for SwapPulse, GitBook and chain explanations.
5. **Approved feedback insights** only as advisory presentation guidance.

Market values can move and may differ by condition, language, edition, grading and venue. A value shown by the Copilot is context, not a guaranteed sale price or financial advice.

## Project knowledge updates

SwapPulse checks a fixed allowlist of GitHub files used to publish project and GitBook documentation each day at 05:15 Europe/London time.

A detected change does not update the Copilot immediately. The system:

1. fetches only the allowlisted repository path at an immutable Git commit;
2. records its source URL, revision and SHA-256 content hash;
3. checks for suspicious instruction and active-content patterns;
4. places the snapshot in an administrator-only review queue;
5. keeps the currently approved document live until an administrator approves the replacement.

Safety-flagged text needs an additional explicit acknowledgement. Rejected text never becomes agent knowledge. Fetched text is treated as reference material and cannot override the Copilot's system rules, access controls or confirmation requirements.

Collector feedback follows a separate quarantine. Feedback-generated suggestions remain inactive until an administrator reviews them.

## Card images and batch scanning

The first Collector Copilot release does not identify an unknown card from a photograph and does not add scanned cards to a collection.

SwapPulse's existing card-photo flow verifies possession of a card that the collector has already selected. It is not the same as identifying an unknown card.

The planned scanner will accept 1 to 10 card images, propose catalogue matches and present one batch review screen. The collector will be able to correct condition, language, edition and quantity before confirming. No proposed match will be added silently.

## Safety, age and privacy

* SwapPulse remains a 13+ service and applies its existing age-band restrictions.
* Value-sensitive and wallet-related guidance remains restricted where the product already requires an adult account.
* The Copilot must not request a password, seed phrase, private key or authentication code.
* Personal data and private verification evidence are not written to the blockchain.
* Retrieved text, card metadata and user messages are data, not authority to change agent behaviour.
* Responses should remain focused on collecting, Pokémon TCG and documented SwapPulse features.

Report unsafe or inaccurate output using the feedback controls below a response. Feedback is reviewed before it can influence later answers.

## Getting a useful answer

Include the goal and the constraints you care about. For example:

* “Which three sets am I closest to completing?”
* “Which duplicates could help with my wishlist without giving up favourites?”
* “Compare these two trade sides in GBP and explain the uncertainty.”
* “What does verified possession mean in SwapPulse?”
* “How did Stage D improve independent verification, and what does it not prove?”

For a price-sensitive answer, ask the Copilot to state the source, currency and observation date. For project or chain information, ask it to cite the approved documentation revision.

## Related guides

* [Collection](../collection-and-catalogue/collection.md)
* [Trade Assistant](trade-assistant.md)
* [Card Possession Attestations](../wallet-and-on-chain/card-attestations.md)
* [Stage D Multi-host Operations](../network-and-web3/stage-d-operations.md)
* [Admin](../platform/admin.md)
