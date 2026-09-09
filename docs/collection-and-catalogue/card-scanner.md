---
description: >-
  Upload or photograph Pokémon TCG cards, review catalogue matches, then add
  cards to a collection or attach one reviewed card to a draft.
---

# Scanner

Scanner helps signed-in collectors identify Pokémon TCG cards from photographs. It grounds suggestions in the TCGDex catalogue and always pauses for review before a card is added or attached.

{% hint style="warning" %}
A scan result is a suggestion, not proof of identity, authenticity, condition, grading or value. Check the artwork, set, collector number and finish before confirming.
{% endhint %}

## Where Scanner helps

Scanner is available at the points where typing card details creates the most friction:

| Workflow | Cards per scan | Result after review | Scanner does not do |
| --- | ---: | --- | --- |
| Collection intake | 1 to 10 | Creates the private collection entries you explicitly confirm | It does not publish, attest or tokenise the cards |
| Post composer | 1 | Attaches the reviewed catalogue card to the draft | It does not publish the post |
| Quote composer | 1 | Attaches the reviewed catalogue card to the quote draft | It does not publish the quote |
| Comment composer | 1 | Attaches the reviewed catalogue card to the comment draft | It does not publish the comment |

Manual catalogue search and the Collection picker remain available. You can use them instead of Scanner or use them to correct a suggestion.

## Open Scanner

For collection intake:

* select **Scanner** in the main navigation;
* or open [Scanner on SwapPulse](https://swappulse.org/scan);
* upload existing images or select **Take a photo** on a supported device.

For a post, quote or comment:

1. open the relevant composer;
2. select **Scanner**;
3. upload or photograph one card;
4. review the proposed catalogue match;
5. select **Use in post** only when the match is correct.

The draft remains unpublished until you select its normal publish action.

## Prepare useful photographs

Use one card per image. For the clearest result:

1. place the card on a plain background;
2. keep the whole front of the card inside the frame;
3. use even lighting and avoid sleeve or surface glare;
4. keep the card name, set symbol and collector number visible;
5. use a sharp, upright image whenever possible.

Accepted formats are JPEG, PNG and WebP. Each image can be up to 10 MB. A collection batch can contain up to 10 images and 50 MB in total. A composer scan accepts one image.

## What happens during analysis

| Step | What SwapPulse does | What it does not do |
| --- | --- | --- |
| Private upload | Stores each selected image as private account data | It does not create a public post |
| Temporary access | Creates a short-lived signed link for authenticated analysis | It does not publish the signed link or save it in the scan result |
| Visual reading | Extracts visible clues such as name, set, collector number, language and rarity | It does not treat text inside an image as an instruction |
| Catalogue matching | Searches TCGDex and ranks catalogue candidates using visible clues | It does not invent a catalogue identity when there is no useful match |
| Review | Shows the proposed catalogue identity and confidence | It does not accept the suggestion for you |
| Confirmation | Performs only the action described by the current workflow | It does not perform a Wallet or blockchain action |

The image model reads visible clues. Candidate identity is then grounded in canonical catalogue records and ranked using deterministic matching. This separates visual interpretation from the catalogue identity used by the site.

## Collection intake review

For every image:

1. compare the photograph with the proposed catalogue artwork;
2. check the card name, set and collector number;
3. review the suggested condition and finish;
4. set the quantity, from 1 to 20 copies;
5. leave **Add this card** enabled only when the selection is correct;
6. use **Find another card** to search manually;
7. skip an image if no suitable match is available.

Select **Confirm and add batch** only when the batch is correct. SwapPulse creates one private collection record for each confirmed copy. Skipped images are not added.

{% hint style="info" %}
Card possession verification is a separate workflow. Scanner identifies a catalogue record. It does not prove that a collector possesses an authentic card.
{% endhint %}

## Composer review

The composer workflow deliberately accepts one image. It presents up to three catalogue candidates and lets you search manually if none is right.

When you select **Use in post**:

* the reviewed catalogue card is attached to the draft;
* the photograph remains private;
* no collection entry is created;
* no post, quote or comment is published;
* no possession attestation, listing, trade or blockchain record is created.

You can remove the attachment or replace it before publishing.

## Safe retry behaviour

Collection confirmation requires an online write. If the network fails after some entries were created, the review controls lock and the page offers **Retry final check**. Keep the page open and use that action. SwapPulse reuses the collection entry IDs already created for the batch so it can finish without duplicate copies.

A failed composer attachment leaves the draft, collection and blockchain unchanged. Choose the photo again or attach a card through manual search.

## Scanner corrections and approval

After successful review, SwapPulse can record a private catalogue label showing whether a proposed card was confirmed or corrected. Every label starts quarantined and inactive.

A quarantined label cannot affect matching, model weights, training exports or Scanner achievements. An administrator must review it before acceptance. Private card photos are not copied into the correction record or shown in the review queue.

Scanner does not train itself automatically.

## Privacy and retention

Card photos and scan sessions are private account data. Analysis uses short-lived signed links and does not persist those links in the result.

Scan-session metadata and correction labels are included in account-data export and account-deletion cleanup. The photograph is not attached to a public post by the composer workflow. Only the reviewed catalogue reference is attached.

Scanner does not place photos, private collection notes or scan prompts on the blockchain. A separate, explicit workflow is required for possession verification or any supported on-chain action.

Avoid including faces, addresses, labels, documents or other personal information. Crop the image to the card whenever possible.

## Language behaviour

Scanner receives the signed-in account language for its interface and analysis request. It may detect a different printed card language from the photograph. Always confirm the exact edition and language in the catalogue result.

## Best next integration points

Current integration covers collection intake and social composition, which removes the most repeated manual entry without changing user intent.

Useful future integrations, each requiring a separate reviewed implementation, include:

* pre-filling a trade listing while leaving price, condition and publication to the collector;
* selecting cards for a binder or wishlist;
* starting a grading record without claiming a professional grade;
* pre-filling possession-attestation details before the separate evidence and signing steps.

Scanner should never silently publish content, approve authenticity, decide a grade, set a trade value, attest possession or submit a blockchain transaction.

## Limits and rate protection

Current safeguards include:

* 1 to 10 images per collection batch;
* exactly 1 image per composer scan;
* 10 MB maximum per image;
* 50 MB maximum per collection batch;
* per-account analysis rate limits;
* a 24-hour collection-session confirmation window;
* 15-minute signed image access links.

These controls protect privacy, provider capacity and catalogue quality.

## Troubleshooting

### No useful match appears

Use a brighter, sharper image with less glare. Make sure the collector number and set symbol are visible. Use manual catalogue search or skip the image.

### The condition or finish looks wrong

Treat those values as suggestions. Change them before collection confirmation. A photograph is not professional grading.

### Scanner says it needs a connection

Reconnect before analysing or confirming. Scanner writes are not queued offline because the backend must validate the catalogue choice and exact result.

### Collection confirmation was interrupted

Use **Retry final check** when offered, then inspect Collection before scanning the same cards again.

### A wrong card is attached to a draft

Remove it from the composer and use Scanner or manual search again. Nothing is published until you choose the normal publish action.

## Ask Helper

Open [Helper](../ai-assistants/collector-copilot.md) for read-only help with duplicates, set gaps, binder organisation, wishlist priorities or trade context.

Helper can explain Scanner and analyse collection records it is allowed to read. It cannot process a photo in chat, confirm a scan or change a record.

## Related guides

* [Collection](collection.md)
* [Composing Posts](../social-and-community/compose.md)
* [Posts & Replies](../social-and-community/post-detail.md)
* [Helper](../ai-assistants/collector-copilot.md)
* [Card Possession Attestations](../wallet-and-on-chain/card-attestations.md)
* [Privacy Policy](https://swappulse.org/privacy)
