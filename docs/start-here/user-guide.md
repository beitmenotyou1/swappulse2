---
description: User Guide documentation for SwapPulse.
---

# SwapPulse User Guide

This guide is for collectors using SwapPulse as a normal website or app. You do not need to understand AT Protocol, Starknet or Web3 to use the core Pokémon TCG and community features.

## 1. Getting started

1. Open SwapPulse and create an account or sign in.
2. Complete your public collector profile.
3. Choose your language and accessibility preferences.
4. Start with **Explore** if you want to discover cards and community content.
5. Add cards to **Collection** if you want to track what you own.
6. Use **Wallet** only when you want SwapPulse chain features such as SWPX, identity assurance, staking or on-chain proofs.

SwapPulse is in active development. Testnet features can change, and testnet SWPX has no promise of real-world financial value.

## 2. Main navigation

### Home

Your main community feed. Depending on your account/federation state, Home can include activity from collectors you follow and other relevant SwapPulse content.

Typical uses:

* read posts;
* react/comment where enabled;
* discover active collectors;
* jump into cards, profiles, trades and community spaces.

### Explore

Explore is the main discovery area. Use it to browse beyond your immediate follow graph.

You can use Explore to find:

* Pokémon TCG cards and sets;
* public posts;
* collectors;
* trending/community content;
* relevant social/discovery features as they are added.

### Collection

Collection is your personal Pokémon TCG inventory.

Typical workflow:

1. search for a card;
2. add it to your collection;
3. record relevant collection details;
4. use collection data in binders, trade matching and portfolio/market features;
5. optionally use card verification/on-chain features where available.

### SwapPulse Wallet

The Wallet is the self-custodial/Web3 area. The top overview is designed to feel familiar to mainstream wallet users while the deeper SwapPulse-specific identity and collector tools live underneath.

The Wallet can show:

* SWPX testnet balance;
* smart-account address;
* Receive/copy controls;
* Get testnet SWPX;
* V2 identity assurance;
* account-recovery status;
* card possession attestations;
* on-chain cards;
* staking/operator actions;
* bridge tools;
* public transaction history;
* direct links to the Chain Explorer.

If your V2 verification expires or is revoked, your identity and existing on-chain history are not deleted. New value-bearing actions such as staking/bridging fail closed until eligibility is restored.

### Binders

Binders let you organise cards into curated groups rather than treating your collection as one flat list.

Use binders for:

* favourite sets;
* trade binders;
* showcase collections;
* deck/project planning;
* themed collections.

### Trade Board

The Trade Board is for collector-to-collector trading workflows.

Typical flow:

1. create or browse a listing;
2. review cards offered/wanted;
3. express interest or start a trade thread;
4. communicate and agree details;
5. use trade status tools to track progress.

Always verify the other party, card condition and shipping/payment arrangements yourself. A social/profile/trust signal is not a guarantee against fraud.

### Circles

Circles are community groups. They can be used for local collectors, specialist sets, trading groups, event communities or other interests.

### Meetups

Meetups help organise real-world or community events. Use ordinary personal-safety precautions when meeting people in person. Do not publicly post sensitive home/private address information when a safer venue can be used.

### Live Now

Live/community spaces provide real-time participation features such as live rooms/spaces where enabled.

### Notifications

Shows activity relevant to your account, including social, trade, system and other application notifications.

### Messages

Private messaging area. Treat private messages as private communications, but do not use them as a password/secret store.

### More

The More menu contains secondary tools such as search, feeds, market/community utilities, settings and other features. On mobile it is independently scrollable so the full menu remains accessible on small screens.

## 3. Pokémon TCG features

### Cards and sets

SwapPulse uses TCGDex-backed data for the card catalogue. Card pages can include artwork, set information and other catalogue data made available by the integration.

### Market/pricing

Pricing data is periodically synchronised and should be treated as informational. Prices can lag live marketplaces and do not constitute a guaranteed sale or purchase price.

### Grading

Grading-related features are tools for organising or recording collector information. Unless explicitly connected to a recognised grading provider, SwapPulse should not be treated as the grading authority for a physical card.

### Card verification and on-chain cards

SwapPulse can create possession/verification records and on-chain card records. On-chain records are proofs/metadata about the SwapPulse workflow, not magical proof that a physical card can never be lost, sold, swapped or counterfeited later.

## 4. Social and AT Protocol features

SwapPulse uses the AT Protocol to make identity and social data more portable/federated than a closed social network.

In practice this can include:

* a DID-backed identity;
* a SwapPulse/PDS handle;
* profile/follow data;
* records published to a Personal Data Server;
* federation/synchronisation with compatible AT Protocol services;
* imported or bridged social graph information.

You do not need to understand DIDs to use the site. Think of the AT Protocol layer as the part that helps your social identity/data become less dependent on a single database.

### PDS and app passwords

A Personal Data Server stores AT Protocol records. Some integrations may use app passwords or server-side credentials. Never paste an app password into a public post, issue, screenshot or chain transaction.

### Federation delays

Federated changes can take time to propagate. A profile/follow/post may appear locally before or after another compatible service sees it. Sync/reconciliation jobs are used to reduce those differences.

## 5. Wallet and identity

### Smart account

Your SwapPulse chain identity is linked to a Starknet smart account. The public account address is safe to share in the same sense as other blockchain public addresses, but it should not be confused with a private key.

### V2 identity assurance

The V2 identity card can show:

* assurance Type;
* assurance Level;
* Active/Expired/Revoked state;
* expiry time;
* last public-chain reconciliation.

The blockchain does **not** store your name, email, date of birth or identity documents. It stores opaque commitments and public assurance metadata only.

### Recovery

Recovery is delayed on-chain to reduce the risk of an attacker instantly replacing your signer. If recovery is scheduled, the Wallet can show the waiting state and when it becomes executable.

### Public transaction history

Transaction hashes in Wallet are clickable and open the dedicated Chain Explorer transaction page.

## 6. SWPX

SWPX is the current SwapPulse testnet token used for testing staking and other on-chain application flows.

The faucet can issue testnet SWPX according to backend eligibility/cooldown rules.

Do not treat testnet balances as guaranteed financial assets.

## 7. Community staking

The staking UI supports the current testnet operator/delegation lifecycle.

Depending on your chain state, you may see actions for:

* registering a community operator;
* increasing self-stake;
* delegating to an operator;
* starting undelegation;
* withdrawing after the unlock period;
* exiting an operator position.

If you already run an operator, the UI must offer **Increase operator self-stake** rather than attempting a duplicate registration.

The current staking pool is an economic/accountability mechanism on the current testnet. It is not yet proof that SwapPulse runs decentralised multi-validator block consensus.

## 8. Cross-chain tools

Bridge features are experimental/testnet functionality.

Before sending:

1. verify the destination chain;
2. verify the recipient address;
3. verify the asset type and amount;
4. understand that bridge completion may require relaying/reconciliation;
5. keep the transaction hash for troubleshooting.

The appchain remains the canonical home for the current SwapPulse asset model unless/until the architecture explicitly changes.

## 9. Chain Explorer

Open **Chain Explorer** from the footer.

The explorer is read-only and visually separated from the social site.

You can:

* search a block number;
* paste a transaction hash;
* paste a block hash/address;
* open latest blocks;
* open latest transaction hashes;
* inspect transaction execution/finality/fee information;
* view smart-account/contract class and nonce information;
* view SwapPulse-indexed public activity for an account.

### Address history limitation

The current public Starknet RPC is not a full Etherscan-style address-history indexer. SwapPulse therefore labels app-linked address history as **SwapPulse-indexed activity** rather than claiming it is a complete archive of every possible transaction touching the address.

## 10. Language and accessibility

SwapPulse currently supports nine main UI locales:

* English (UK);
* Spanish;
* French;
* German;
* Italian;
* Portuguese (Brazil);
* Japanese;
* Chinese (Simplified);
* Korean.

New permanent UI strings should be added through the translation system rather than hard-coded in one language.

Accessibility priorities include:

* keyboard navigation;
* visible focus indicators;
* semantic headings/landmarks;
* skip links;
* accessible names for icon-only controls;
* screen-reader friendly status text;
* usable contrast;
* honouring reduced motion/accessibility settings where supported;
* mobile menus that remain scrollable at small viewport heights.

## 11. Privacy and security

### Never share

Do not share:

* private keys;
* seed phrases;
* relay tokens;
* verifier/admin signing secrets;
* PDS admin/app passwords;
* password reset codes;
* 2FA recovery secrets.

### On-chain privacy

SwapPulse's Cairo identity architecture is deliberately designed to keep private personal data off-chain.

### Browser security

Privileged relay/verifier/admin signing logic must remain server-side. Browser code should never receive trusted backend private keys.

## 12. Troubleshooting

### A chain action is locked

Check:

* V2 assurance state;
* private verifier eligibility;
* chain expiry;
* whether the action is already submitted/pending;
* network status;
* Wallet/Chain Explorer transaction history.

Expired/revoked assurance is intentionally fail-closed for value-bearing actions.

### A federation change has not appeared

Allow time for PDS/federation/firehose reconciliation. If it remains missing, use the account/federation diagnostics available to administrators/support.

### Card/pricing data looks stale

Catalogue and price information is synchronised on schedules. Check the service/status page before assuming the underlying card catalogue has failed.

### A transaction is pending

Open its transaction hash in Chain Explorer and review execution/finality state. Application mirrors may lag the public chain until reconciliation runs.

### The Wallet shows old state

Use **Refresh identity from chain** where available. Chain state is authoritative for the Web3 layer.

## 13. Status and help

Use:

* `/help` for in-app help;
* `/status` for service health;
* `/chain/` for public chain inspection;
* the repository documentation for developer/operator details.

## 14. For developers and contributors

If you want to change SwapPulse rather than merely use it, continue with:

* [documentation home](https://swappulse.gitbook.io/swappulse-docs/);
* [contributor guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/contributing);
* [project architecture](https://swappulse.gitbook.io/swappulse-docs/developers/project-architecture);
* [developer onboarding guide](https://swappulse.gitbook.io/swappulse-docs/developers/developer-onboarding);
* [change protocol](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/change-protocol);
* [forking and rebranding guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/forking-and-rebranding);
* [node architecture roadmap](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/node-architecture);
* [V2 live architecture](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/v2-live-architecture).
