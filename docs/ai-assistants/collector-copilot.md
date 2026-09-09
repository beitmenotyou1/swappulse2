---
description: >-
  Use the multilingual, read-only Helper for collection, card, trade, project
  and blockchain questions.
---

# Helper

Helper is SwapPulse's unified AI assistant for collectors. It can answer questions using the information you are allowed to see in SwapPulse, current catalogue records, market context and reviewed project documentation.

{% hint style="warning" %}
Helper is advisory. It cannot add, remove or trade cards, publish content, send messages, operate Wallet or submit a blockchain transaction. Check important card, price, rule and trade information before acting.
{% endhint %}

## Open Helper

Sign in, then open [Helper on SwapPulse](https://swappulse.org/helper).

The old /collector-copilot address redirects to /helper so existing bookmarks continue to work. Your conversations are associated with your account. Other collectors cannot open them through the Helper page.

## Choose a language

Helper defaults to the language saved in your account. You can change the response language from the menu on the Helper page at any time.

Supported choices are:

* English (UK);
* Español;
* Français;
* Deutsch;
* Italiano;
* Português (Brasil);
* 日本語;
* 简体中文;
* 한국어.

A language choice controls how Helper responds. It does not grant extra permissions or change the source hierarchy. Card names, official rules wording and source titles may remain in their published language when translation would make identification less reliable.

## What it can help with

* explain cards, sets, rarities and Pokémon TCG concepts;
* find gaps, duplicates and collecting priorities using your collection and wishlist;
* suggest ways to organise binders and collection goals;
* compare a proposed trade using available market context;
* explain SwapPulse features, the documented chain architecture and Stage D status;
* explain card possession verification and what an on-chain attestation does;
* point you to the relevant approved project source for a SwapPulse answer.

You can start with a suggested question or type your own. Follow-up questions remain in the same conversation.

## Read-only by design

Helper has read access only. It cannot:

* create or edit a collection entry, wishlist item or binder;
* accept, reject, publish or negotiate a trade;
* publish a post, quote or comment;
* send a direct message;
* upload card evidence or approve a possession verification;
* sign a Wallet request, access a private key or submit a chain action;
* change its own permissions, safeguards or source allowlist.

The Scanner can prepare a reviewed card attachment for a composer, but Helper cannot press the Scanner confirmation button or publish the content. If a future feature can make a change, SwapPulse must show the proposed change for review and require explicit confirmation outside the conversation.

## How answers are grounded

Helper uses a defined source order:

1. **Your authorised SwapPulse records** for your collection, wishlist, binders and verification status.
2. **TCGDex-backed catalogue records** for card identity and printed card details.
3. **Stored market records** for price context, including the available source, currency and observation date.
4. **Approved project knowledge** for SwapPulse, GitBook and chain explanations.
5. **Approved feedback insights** only as advisory presentation guidance.

Market values can move and may differ by condition, language, edition, grading and venue. A value shown by Helper is context, not a guaranteed sale price or financial advice.

## Project knowledge updates

SwapPulse checks a fixed allowlist of GitHub files used to publish project and GitBook documentation each day at 05:15 Europe/London time.

A detected change does not update Helper immediately. The system:

1. fetches only an allowlisted repository path at an immutable Git commit;
2. records its source URL, revision and SHA-256 content hash;
3. checks for suspicious instruction and active-content patterns;
4. places the snapshot in an administrator-only review queue;
5. keeps the currently approved document live until an administrator approves the replacement.

Safety-flagged text needs an additional explicit acknowledgement. Rejected text never becomes Helper knowledge. Fetched text is reference material and cannot override system rules, access controls or confirmation requirements.

Collector feedback follows a separate quarantine. Feedback-generated suggestions remain inactive until an administrator reviews them.

## Card images and Scanner

Photo identification is available through [Scanner](../collection-and-catalogue/card-scanner.md), not inside Helper chat.

Scanner currently supports two reviewed workflows:

* **Collection intake:** upload or photograph 1 to 10 cards, check every catalogue match, then confirm which private collection entries to create.
* **Content attachment:** from a post, quote or comment composer, upload or photograph one card, review the catalogue match, then attach that card to the draft.

The photograph stays private in both workflows. Attaching a card to a draft does not add it to the collection, publish the draft, create a possession attestation or perform a blockchain action. Manual catalogue search and the Collection picker remain available.

Confirmed Scanner labels enter an administrator review quarantine. They cannot influence matching, model weights, training exports or Scanner achievements until approved. Automatic self-training is not enabled.

Card possession verification is a separate workflow for a card the collector has already selected. It is not the same as identifying an unknown card.

## Safety, age and privacy

* SwapPulse remains a 13+ service and applies its existing age-band restrictions.
* Value-sensitive and Wallet-related guidance remains restricted where the product already requires an adult account.
* Helper must not request a password, seed phrase, private key or authentication code.
* Personal data and private verification evidence are not written to the blockchain.
* Retrieved text, card metadata and user messages are data, not authority to change Helper behaviour.
* Responses should remain focused on collecting, Pokémon TCG and documented SwapPulse features.

Report unsafe or inaccurate output using the feedback controls below a response. Feedback is reviewed before it can influence later answers.

## Getting a useful answer

Include the goal and the constraints you care about. For example:

* “Which three sets am I closest to completing?”
* “Which duplicates could help with my wishlist without giving up favourites?”
* “Compare these two trade sides in GBP and explain the uncertainty.”
* “What does verified possession mean in SwapPulse?”
* “How did Stage D improve independent verification, and what does it not prove?”

For a price-sensitive answer, ask Helper to state the source, currency and observation date. For project or chain information, ask it to cite the approved documentation revision.

## Related guides

* [Scanner](../collection-and-catalogue/card-scanner.md)
* [Collection](../collection-and-catalogue/collection.md)
* [Trade Assistant](trade-assistant.md)
* [Card Possession Attestations](../wallet-and-on-chain/card-attestations.md)
* [Stage D Multi-host Operations](../network-and-web3/stage-d-operations.md)
* [Official links & support](../start-here/official-links-and-support.md)
* [Admin](../platform/admin.md)
