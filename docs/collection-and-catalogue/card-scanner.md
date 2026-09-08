---
description: >-
  Privately identify 1 to 10 Pokémon TCG cards, review catalogue matches and
  add only the confirmed cards to your SwapPulse collection.
---

# Card Scanner

The Card Scanner helps signed-in collectors identify unknown Pokémon TCG cards from photographs. It accepts a private batch of 1 to 10 images, proposes TCGDex catalogue matches and waits for you to review every result before anything is added.

{% hint style="warning" %}
A scan result is a suggestion, not proof of card identity, authenticity, condition, grading or value. Check the artwork, set, collector number and finish before confirming.
{% endhint %}

## Open the scanner

* Select **Scan** in the main navigation.
* Or open [Scan Cards in SwapPulse](https://swappulse.org/scan).
* You must be signed in.
* The scanner needs an internet connection.

## Prepare useful photographs

Use one card per image. For the clearest result:

1. place the card on a plain background;
2. keep the whole front of the card inside the frame;
3. use even lighting and avoid sleeve or surface glare;
4. keep the card name, set symbol and collector number visible;
5. use a sharp, upright image whenever possible.

Accepted formats are JPEG, PNG and WebP. Each image can be up to 10 MB. A batch can contain up to 10 images and 50 MB in total.

## What happens during analysis

| Step | What SwapPulse does | What it does not do |
| --- | --- | --- |
| Private upload | Stores each selected image as private account data | It does not create a public post |
| Temporary access | Creates a short-lived signed link for authenticated analysis | It does not publish the signed link or save it in the scan result |
| Visual reading | Extracts visible clues such as name, set, collector number, language and rarity | It does not treat text inside an image as an instruction |
| Catalogue matching | Searches TCGDex and ranks up to five candidate cards using the visible clues | It does not invent a catalogue identity when there is no useful match |
| Batch review | Shows the proposed identity, confidence, condition, finish and quantity | It does not add a card silently |
| Confirmation | Creates one private collection entry per confirmed copy | It does not perform a wallet or blockchain action |

Analysis uses the image model to read visible clues. Candidate identity is then grounded in the TCGDex catalogue and ranked using deterministic matching. This separates visual interpretation from the canonical card record.

## Review the batch

For every image:

1. compare the uploaded photo with the proposed catalogue artwork;
2. check the card name, set and collector number;
3. review the suggested condition and finish;
4. set the quantity, from 1 to 20 copies;
5. leave **Add this card** enabled only when the selection is correct;
6. use **Find another card** to search the catalogue manually;
7. skip an image if no suitable match is available.

Low confidence means you should inspect the match more carefully. A high confidence score still does not replace your review.

When the batch is ready, select **Confirm and add batch**. SwapPulse creates one collection record for each confirmed copy. Images you skipped are not added.

{% hint style="info" %}
Card possession verification is a separate workflow. The scanner helps identify and add a catalogue record. It does not prove that a collector physically possesses the card.
{% endhint %}

## Safe retry behaviour

Confirmation requires an online write. If the network fails after some entries were created, the review controls lock and the page offers **Retry final check**. Keep the page open and use that action. SwapPulse reuses the collection entry IDs already created for the batch so it can finish without creating duplicate copies.

If the page was closed after a partial failure, inspect your Collection before scanning the same cards again.

## Scanner corrections and approval

After a successful confirmation, SwapPulse records a private catalogue label for each confirmed image. The label contains:

* the proposed card ID, when one existed;
* the catalogue card you selected;
* the scan session and collection entry IDs;
* the confidence, condition, finish and detected language;
* whether the proposal was confirmed or corrected.

Every label starts with **quarantined** status and **accepted: false**. It cannot affect matching, model weights, training exports or scanner achievements.

An administrator can review the label in **Admin → Platform & Content → Scanner label review**. Approval is explicit. Rejected labels stay inactive. Private card photos are not copied into the correction record or shown in the review queue.

The current Phase 2 scanner does not train itself automatically. The model-weight and training-snapshot schemas remain dormant until a separate, reviewed process is designed and approved.

## Privacy and retention

Card photos and scan sessions are private account data. The authenticated analysis function creates the owner-bound session and controls its lifecycle state; a collector can read or delete only their own session. The function creates 15-minute signed links and does not persist those links.

Scan-session metadata and correction labels are included in the collector's account-data export and account-deletion cleanup. Private file references remain associated with the scan session and follow SwapPulse's private-file retention controls.

The scanner does not place card photos, private collection notes or scan prompts on the blockchain. Collection entries remain private application records unless you separately use another sharing or verification feature.

Avoid including faces, addresses, labels, documents or other personal information in the photograph. Crop the image to the card whenever possible.

## Limits and rate protection

The current safeguards are:

* 1 to 10 images per batch;
* 10 MB maximum per image;
* 50 MB maximum per batch;
* 5 analysis batches per account per hour;
* 30 analysed images per account per hour;
* 24-hour scan-session confirmation window;
* 15-minute signed image access links.

These limits protect privacy, provider capacity and catalogue quality. They may be revised as the scanner is evaluated.

## Troubleshooting

### No useful match appears

Use a brighter, sharper image with less glare. Make sure the collector number and set symbol are visible. Select **Find another card** and search by card name or collector number, or skip the image.

### The condition or finish looks wrong

Treat these values as suggestions. Change them before confirmation. Condition is not professional grading, and a photograph may not reveal edge wear, surface damage or print variation accurately.

### The scanner says it needs a connection

Reconnect before analysing or confirming. Scanner writes are deliberately not queued offline because the backend must validate the catalogue choice and exact collection entries before creating a quarantined label.

### Confirmation was interrupted

Do not press Start over if the page says that entries were already created. Use **Retry final check**. Then inspect your Collection to confirm the final number of copies.

### A card was added incorrectly

Open your Collection and correct or remove the collection record using the normal collection controls. Scanner suggestions are not irreversible and do not create a blockchain transaction.

## Ask the Collector Copilot

After scanning, open the [Collector Copilot](../ai-assistants/collector-copilot.md) for read-only help with duplicates, set gaps, binder organisation, wishlist priorities or trade context.

The Copilot can explain how the scanner works and analyse collection records it is allowed to read. It cannot scan a photo inside chat, press the confirmation button or add a card for you.

## Related guides

* [Collection](collection.md)
* [Card Detail Pages](card-detail.md)
* [Collector Copilot](../ai-assistants/collector-copilot.md)
* [Card Possession Attestations](../wallet-and-on-chain/card-attestations.md)
* [Privacy Policy](https://swappulse.org/privacy)
