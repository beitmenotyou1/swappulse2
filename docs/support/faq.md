---
description: >-
  Detailed answers to common questions about SwapPulse, Pokémon TCG features, AT
  Protocol, Wallet, Web3, nodes, privacy, open source, forking and contributing.
---

# All current FAQ answers

This consolidated page preserves the existing SwapPulse questions and answers. New questions are added as individual pages in the dedicated [Frequently Asked Questions](https://swappulse.gitbook.io/swappulse-docs/faq) category, making each answer easier to find, link to and maintain. For step-by-step instructions, follow the links to the detailed guides throughout this page.

{% hint style="info" %}
SwapPulse is actively developed. Testnet Web3 features, node tooling and some integrations may change as the project matures. The [Changelog](../changelog/) records significant releases and changes.
{% endhint %}

## About SwapPulse

### What is SwapPulse?

SwapPulse is an open-source Pokémon TCG collecting, trading and community platform. It combines a normal web application with Pokémon card catalogue data, social/community features, AT Protocol federation and a Cairo/Starknet Web3 layer for self-custodial identity, verification, SWPX testnet assets, staking and public chain records.

The goal is not to turn every collector action into a blockchain transaction. The Web3 layer is used where decentralised trust, verifiable ownership, public attestations or self-custody add real value.

See SwapPulse Project Architecture for the complete system view.

### Is SwapPulse an official Pokémon product?

No. SwapPulse is an independent community project and is not an official Pokémon, Nintendo, Creatures Inc., Game Freak or The Pokémon Company service.

Pokémon names, characters, artwork, card images and other related intellectual property belong to their respective rights holders. SwapPulse does not claim ownership of that third-party material.

See Third-party Notices for the current attribution and usage boundaries.

### Is SwapPulse free to use?

Yes. The current project is intended to be free to use. Donations are optional and help with hosting and infrastructure costs.

Testnet SWPX is not a purchase requirement and has no stated financial value.

### Is SwapPulse open source?

Yes. SwapPulse is released under the Mozilla Public License 2.0 (MPL-2.0) for code owned by the project.

Third-party libraries, APIs, datasets, trademarks, card images and external services keep their own licences and terms. Forking SwapPulse does not grant ownership of Pokémon intellectual property or third-party API content.

See SwapPulse Licence, Third-party Notices and Forking and Rebranding SwapPulse.

### Who is SwapPulse for?

It is designed for Pokémon TCG collectors, traders, community organisers, developers, open-source contributors and people interested in portable social identity and self-custodial Web3 features.

You do not need blockchain knowledge to use the normal collecting and community parts of the site.

## Getting started

### What should I do first after creating an account?

A sensible first route is:

1. complete your profile;
2. browse Explore and find cards or sets you collect;
3. add cards to your Collection;
4. create or follow Binders and community content;
5. follow collectors or join Circles;
6. try the Trade Board if you want to swap cards;
7. only open the SwapPulse Wallet if you want to use the on-chain/testnet features.

See Getting Started with SwapPulse and the SwapPulse User Guide.

### Do I need the SwapPulse Wallet to use the site?

No. The Wallet is for optional on-chain features such as the self-custodial smart account, V2 identity assurance, testnet SWPX, staking, on-chain cards and bridging.

Normal catalogue browsing, social features, community participation and most collection features do not require you to understand or use Starknet.

### Does SwapPulse work on mobile?

Yes. The interface includes mobile navigation, responsive layouts and progressive-web-app behaviour where supported by the browser.

Some advanced tasks, especially development, node hosting and infrastructure administration, are intended for a desktop/server environment rather than a phone.

### What languages does SwapPulse support?

The interface currently supports English, French, German, Spanish, Italian, Portuguese, Japanese, Chinese and Korean.

Use the language selector in the navigation. The Wallet and Chain Explorer also use the selected SwapPulse language for their translated labels and date/time presentation.

## Pokémon TCG data and TCGdex

### Where does SwapPulse get Pokémon card data from?

TCGdex is the primary Pokémon TCG catalogue integration used by SwapPulse, with additional providers used for enrichment where documented.

SwapPulse does not own the TCGdex service or its underlying third-party Pokémon intellectual property. The integration is treated as an external dependency rather than part of the SwapPulse licence.

See Pokémon Data and Market APIs.

### Does the MPL-2.0 licence cover TCGdex data or Pokémon images?

No. The SwapPulse software licence covers SwapPulse-owned source code. It does not relicense third-party API data, card artwork, Pokémon trademarks or other content belonging to external providers or rights holders.

Anyone who forks the project must independently comply with the licences, API terms and intellectual-property rules of every provider they choose to keep using.

### Can I use SwapPulse for another TCG or collecting community?

Yes, technically. The project can be forked and adapted, but you must replace or reconfigure Pokémon-specific integrations, branding, catalogue logic and any third-party API dependencies you do not have permission to use.

The Forking and Rebranding guide explains how to separate the generic platform architecture from Pokémon-specific services.

### How does the card scanner work?

Open **Scan Cards** while signed in and choose 1 to 10 private images. The scanner reads visible clues, checks TCGDex and presents up to five catalogue candidates rather than treating an AI result as unquestionable truth.

Review the identity, condition, finish and quantity for every image. If a suggestion is wrong, choose another candidate, search manually or skip the image. Nothing is added until you confirm the batch.

Confirmed labels begin in quarantine. They cannot affect matching, model weights, training exports or achievements until an administrator approves them. The scanner requires an internet connection. See [Card Scanner](../collection-and-catalogue/card-scanner.md).

### Are card prices guaranteed to be accurate?

No. Market prices are informational estimates from external providers and can be delayed, incomplete or different from the amount a real buyer is willing to pay.

SwapPulse market tools are not financial advice, appraisal guarantees or promises of sale value.

## Collection and trading

### Who owns my collection records?

SwapPulse is designed around user control and portability. Application data may be stored through Base44 and AT Protocol-related systems depending on the feature, while public Web3 state is stored separately on Starknet.

Not every collection field is public or on-chain. Private collection data should remain in the application/private data layer unless a user deliberately creates an on-chain representation.

### Does adding a card to my Collection mint an NFT?

No. A normal collection entry is not the same thing as an on-chain Card NFT.

SwapPulse deliberately separates:

* a private/application collection record;
* a physical-card possession attestation;
* an optional on-chain card/token record.

This prevents ordinary collectors from accidentally publishing or tokenising their entire collection.

### How does trading work?

Collectors can create listings describing what they offer and what they want. Interested users can open a trade conversation and agree the details themselves.

SwapPulse tools can help organise the trade and show supporting information, but users remain responsible for confirming condition, value, shipping arrangements and the identity of the person they trade with.

### Does SwapPulse hold cards or money in escrow?

Do not assume so unless a specific feature explicitly says it provides escrow. The current community trading experience primarily helps collectors discover and organise trades.

Never send money, cards or sensitive information solely because another user claims that SwapPulse guarantees the transaction.

### What are Circles and Starter Packs?

Circles are themed collector groups. Starter Packs are curated onboarding bundles that help newcomers discover collectors, feeds and communities.

Starter Pack inclusion follows consent rules. A collector should not be silently forced into someone else's curated pack.

## AT Protocol and Bluesky

### What is the AT Protocol?

AT Protocol is the decentralised social protocol used by Bluesky and other compatible services. It separates identity and personal data from a single social application, making account portability and federation possible.

SwapPulse uses AT Protocol concepts for portable social identity, records and federation while adding Pokémon-specific collecting and community features on top.

See AT Protocol, Bluesky and PDS APIs.

### Is my SwapPulse account the same thing as my AT Protocol identity?

Not exactly. Several identifiers can exist at once:

* your Base44 application user ID;
* your AT Protocol DID and handle;
* your Starknet smart-account address;
* your opaque SwapPulse chain identity ID.

They serve different purposes and should not be confused or collapsed into one identifier.

### What is a DID?

A DID is a decentralised identifier used by AT Protocol to represent identity independently of a display handle. Handles can change while the DID remains the stable identity reference.

### What is a PDS?

A Personal Data Server, or PDS, stores a user's AT Protocol repository and related account data. The protocol is designed so users are not permanently tied to one application provider.

### Does SwapPulse automatically post everything to Bluesky?

No single rule applies to every record type. Some features may mirror or federate AT Protocol-compatible records, while private/application-only data remains outside public federation.

Use the relevant feature documentation and privacy controls rather than assuming every SwapPulse record becomes a public Bluesky post.

### Can I use a custom domain as my handle?

Where supported, you can verify a custom-domain handle by adding the required DNS record. This proves control of the domain used for the handle.

## Privacy and personal data

### Does SwapPulse put my name or date of birth on the blockchain?

No. This is a core architectural rule.

The chain must not store plaintext names, emails, dates of birth, addresses, identity documents, document images, raw verifier evidence or similar sensitive personal information.

See Identity Registry and Verifier Logic and Assurance.

### What identity information is stored on-chain?

The V2 identity layer can store or reference public blockchain-safe information such as:

* opaque identity IDs;
* smart-account bindings;
* commitments/hashes designed for the verification scheme;
* verification type and level;
* authorised verifier address;
* timestamps and expiry;
* revocation state;
* replay-protection identifiers;
* recovery/migration state;
* public events used for reconciliation.

These records are designed to prove state without publishing the underlying private evidence.

### Is a hash of personal information always private?

No. A plain hash of predictable, low-entropy data such as a date of birth or postcode can often be guessed through dictionary attacks.

SwapPulse's architecture requires an approved commitment design with appropriate domain separation and blinding/salting rather than simply hashing plaintext PII and calling it private.

### Can SwapPulse read my direct messages?

The current direct-message design uses end-to-end encryption, with private encryption material held in the user's browser/device rather than stored as readable message content for the service.

A consequence of this design is that losing the relevant local key material can make old encrypted messages inaccessible on that device.

### What happens if I clear my browser data?

Some locally held credentials or cryptographic material may be removed. This matters especially for end-to-end encrypted messaging and user-controlled wallet/device signing.

Before clearing browser data on a device you rely on, make sure you understand the recovery options for the specific feature.

## SwapPulse Wallet

### What is the SwapPulse Wallet?

It is the site's self-custodial Starknet smart-account interface for the SwapPulse chain/testnet layer.

It shows the smart-account address, SWPX test balance, identity/security state, public transaction links, staking and other supported Web3 features.

See Wallet & Identity.

### Is the Wallet custodial?

The intended model is self-custodial for user-controlled actions. The user explicitly approves/signs actions that should be under their control.

Privileged registry/verifier authority is different and remains server-side behind the protected Base44/relay boundary. Those privileged keys must never be placed in browser code.

### Is the SwapPulse Wallet the same as MetaMask or a general Starknet wallet?

No. It is a product-specific smart-account interface designed around SwapPulse identities and supported contract actions.

The relay intentionally rejects arbitrary contract calls. The Wallet should not be treated as an unrestricted general-purpose RPC wallet.

### What does Receive do?

Receive exposes or copies your SwapPulse smart-account address so another supported system or user can target that account where appropriate.

Always verify the network and address before transferring anything.

### Why does the Wallet say Bridge instead of Send?

The current cross-chain action is a bridge operation, not an ordinary unrestricted token-transfer screen. The UI labels it accurately so users are not misled about what action will happen.

A future ordinary transfer feature should remain visually and technically distinct from bridging.

### What does Identity & Security show?

It summarises public/coarse information such as:

* smart-account and chain identity state;
* V2 assurance status;
* assurance type and level;
* public expiry state;
* recovery protection;
* public transaction history;
* last public-chain reconciliation.

It does not display raw private verifier evidence.

## V2 identity verification

### What is V2 verification?

V2 is SwapPulse's current on-chain assurance format. It records generic assurance metadata and replay protection while keeping private identity evidence off-chain.

For the current value-feature gate, the application expects the configured assurance type, a sufficient assurance level, a non-zero replay/attestation ID, an authorised verifier and current private plus public verification state.

See Verifier Logic and Assurance.

### What does permanent V2 mean?

The registry-wide flag `verification_v2_required = true` permanently rejects the old V1 verification write path.

It does **not** mean every individual user is verified forever. Individual V2 attestations can still expire or be revoked.

See Permanent V2 Verification Policy.

### What happens when my V2 verification expires?

Your permanent identity and smart account remain. Existing public history and existing stake remain on-chain.

New value-bearing actions that require current assurance, such as new staking or bridge writes, are blocked until a fresh V2 assertion is issued and reconciled.

You do not normally need a brand-new identity just because an attestation expired.

### What happens if verification is revoked?

The current verification becomes ineffective, but the identity anchor remains. The revocation stays part of the public audit history and does not switch the network back to V1.

A later valid V2 verification must use a fresh replay/attestation identifier.

### Why does SwapPulse check both Base44 and the blockchain?

The system deliberately uses a split-trust model.

Base44 holds private verifier/application state. Starknet holds the public V2 assertion. Value-bearing features require both sides to be current.

If either side is expired, revoked, missing or inconsistent, the application fails closed.

## Account recovery

### What happens if I lose the device or signer for my smart account?

SwapPulseAccount includes a delayed recovery mechanism. The current recovery delay is 48 hours (`172800` seconds).

The delay is intended to make unauthorised signer changes harder to execute instantly and gives the existing account holder time to react where the recovery design allows.

See Account Recovery.

### Can an admin instantly take over my account?

The recovery path is designed around an on-chain delay rather than an instant browser/admin replacement. Recovery/controller authority is kept server-side and does not belong in frontend code.

The exact recovery transaction must still follow the contract and relay policy.

## SWPX

### What is SWPX?

SWPX is the native/test token used by the current SwapPulse Web3 environment for supported testnet actions such as staking and other on-chain product experiments.

### Is SWPX real money or an investment?

No claim should be made that testnet SWPX has financial value. It is a testnet asset used to exercise the system.

Do not buy testnet SWPX from strangers or treat test balances as an investment opportunity.

### What is the faucet?

The faucet provides a controlled fixed amount of testnet SWPX to an eligible, canonically bound SwapPulse smart account.

The faucet path includes identity binding and cooldown protections. It is not an unrestricted token-mint API.

## Community staking

### What is community staking?

Community staking is the current economic/accountability layer for SwapPulse operators and delegators.

Users can register as a community operator, increase self-stake, delegate to another operator, undelegate, wait through the unbonding period and withdraw according to the contract lifecycle.

See Community Staking.

### Does staking secure the blockchain's consensus today?

No. This distinction is important.

The current `SWAPPULSE_TESTNET` still uses a single Starknet Devnet execution environment. Staking currently represents operator/service accountability, not a decentralised consensus validator set.

Some ABI fields retain the historical word `validator`, but the product calls these participants **community operators**.

### Why can't I register as an operator twice?

The chain already knows whether your smart account is registered. The UI and Base44 draft backend read the authoritative staking state and prevent duplicate registration.

If you are already ACTIVE, the Wallet should offer `increase_self_stake` instead of `register_validator` again.

### Can I immediately withdraw delegated stake?

No. Undelegation begins an unbonding lifecycle. Stake remains locked until the configured delay has passed, after which a separate withdrawal can complete.

### What happens to my stake if my V2 verification expires?

Existing stake remains on-chain. Expiry does not delete the position.

However, new value-bearing staking actions that require current verification are locked until your assurance becomes current again.

### Are operator rewards live?

Do not assume production rewards or financial returns are live merely because staking exists. Reward distribution, governance and any production economic model must be explicitly published, implemented and security-reviewed before they are described as live.

## Cairo and Starknet

### Why does SwapPulse use Cairo and Starknet?

Cairo/Starknet provides the programmable trust layer for public identity references, smart accounts, verification state, token/staking logic, card contracts, bridge logic, replay protection and auditable events.

Base44 remains the application/orchestration layer and does not get replaced by the blockchain.

### What Cairo contracts are deployed?

The current V2 suite includes:

* `IdentityRegistry`;
* `SwapPulseAccount`;
* `NativeToken` / SWPX;
* `CardNft`;
* `ProofOfUsership`;
* `StakingPool`;
* `BridgeAdapter`.

See Cairo Contracts Reference for responsibilities, live addresses/class hashes and security boundaries.

### Does the blockchain contain the whole SwapPulse application?

No. The chain contains only the parts that benefit from public, independently verifiable state.

The normal website, private user mappings, social product, TCG catalogue orchestration, private verifier state and many application workflows remain off-chain.

### How are privileged blockchain writes protected?

They go through a policy-enforcing transaction relay that is only callable by trusted server-side Base44 functions possessing the backend relay credential.

The relay pins the expected chain/contracts and allows only explicitly approved operation shapes. It is not a public unrestricted Starknet RPC proxy.

See Transaction Relay API and Policy.

## Chain state and the Explorer

### Which system is authoritative for on-chain state?

The verified public chain is authoritative for Web3 state. Base44 stores private mirrors and orchestration state, but those mirrors must not override contradictory chain state.

See Chain State and Reconciliation.

### Why does SwapPulse reconcile data back into Base44?

The application needs a private, user-scoped view that can power the UI and policy checks without exposing every internal mapping publicly.

Reconciliation reads the public chain, confirms the state and then updates the Base44 mirror. It is not supposed to invent chain state.

### What is the Chain Explorer?

The Chain Explorer is SwapPulse's public interface for viewing blocks, transactions, addresses and SwapPulse-indexed activity on the current chain environment.

Wallet transaction hashes and smart-account addresses link directly into it.

### Is the Chain Explorer already a complete Etherscan-style archive indexer?

Not yet. The Explorer can show authoritative chain data and SwapPulse-indexed activity, but Starknet JSON-RPC alone does not provide a complete Etherscan-style address-history index.

A dedicated indexer/archive layer is part of the planned next phase so the Explorer can provide richer independent address, event, token, contract and staking history.

## Full and lite nodes

### Do I need to run a node to use SwapPulse?

No. Ordinary users can use the public application and read-only RPC/explorer services.

Running a node is for developers, operators and community members who want to participate in infrastructure testing or future decentralisation work.

### What is a full observer node?

A full observer maintains and verifies its own chain state according to the selected node architecture. It is designed for independent infrastructure observation rather than simply proxying someone else's RPC. The Stage D node lab has now reproduced this role on a second physical host without giving that host privileged signing keys.

See Full node and full observer.

### What is a lite node?

The current lite-node design is a low-resource read and verification layer that checks expected chain and contract pins across one or more RPC peers. A Stage D canary has now compared a local sequencer with a full observer on a second physical host and failed closed when the required two-peer agreement was unavailable.

It should not be confused with a future cryptographic light client unless it actually verifies the required proofs or state commitments.

See Lite node.

### Can I run a node on a Raspberry Pi?

Low-resource hardware, including Raspberry Pi-class devices, is a target for testing, especially for lite/observer roles.

Do not treat Pi 4 full-node or consensus-validator support as guaranteed until the documented benchmarks are completed. USB 3 SSD storage and 64-bit Linux are preferred over heavy database workloads on SD cards.

See SwapPulse Node Architecture Roadmap.

### Does running a node earn SWPX today?

Do not assume so. Future rewards should only be introduced for objectively measurable and verifiable work after the network architecture, reward accounting and security model are ready.

Simply running a process is not enough to prove useful work.

### Are community operators the same as block validators?

Not currently. Community operator staking exists today, but decentralised block-production/consensus participation is a later network phase.

The documentation keeps these roles separate to avoid overstating decentralisation.

## Security

### Are privileged private keys stored in the website JavaScript?

They must not be. Registry-owner, verifier, recovery/controller and relay credentials belong only in protected server/host environments.

User-controlled actions use explicit user/device signing where appropriate.

### Is the public RPC allowed to submit transactions?

The public SwapPulse RPC gateway is designed as a read-only interface. Write authority is separated into the authenticated transaction relay.

This prevents an internet-facing general RPC endpoint from becoming a route to Devnet administration or unrestricted contract writes.

### Can the transaction relay call any Starknet contract?

No. The relay uses an explicit allowlist of approved contracts, methods and transaction shapes. Unknown contracts, privileged entrypoints, unsupported transaction versions and arbitrary Devnet administration requests are rejected.

### What should I do if I find a security issue?

Do not publish secrets, exploit details or private user information in a public issue before the maintainers have had a chance to assess the problem.

Follow the project's security guidance in Security Audit and the repository's security/contribution instructions.

## Open source, licence and third-party rights

### What licence does SwapPulse use?

SwapPulse-owned code uses the Mozilla Public License 2.0 (MPL-2.0).

MPL-2.0 is file-level copyleft: modifications to MPL-covered files generally remain under MPL when distributed, while separate files can use compatible licensing arrangements depending on the circumstances.

Read the actual SwapPulse Licence rather than relying only on this summary.

### Can I use SwapPulse commercially?

The MPL-2.0 permits commercial use of the covered software, subject to its licence obligations.

However, commercial use of a fork still requires you to comply separately with third-party API terms, Pokémon intellectual-property rights, trademarks, privacy law and any other dependencies you keep.

The SwapPulse licence cannot grant rights that SwapPulse itself does not own.

### Can I modify SwapPulse and keep my changes private?

Private/internal modification is different from distributing modified MPL-covered files. If you distribute covered modifications, MPL source-availability obligations can apply to those covered files.

For a real commercial/legal deployment, read the licence text and obtain independent legal advice if needed.

### Can I remove the SwapPulse name and make my own project?

You can fork and rebrand the code according to the software licence, but you must also replace project-specific branding, domains, deployment addresses, keys, secrets, third-party credentials and any assets you are not entitled to reuse.

See Forking and Rebranding SwapPulse.

### Does the licence let me reuse Pokémon logos, artwork or card images?

No. The software licence does not grant rights to third-party intellectual property.

### Does the licence let me use TCGdex however I want?

No. TCGdex is a separate project/service with its own licence, API behaviour and terms. A SwapPulse fork must review those terms independently.

## Contributing

### How can I contribute to SwapPulse?

Fork the repository, create a focused branch, make your changes, test them and open a pull request with a clear description of what changed and why.

Security-sensitive, Cairo, relay, identity, staking and network changes require stronger tests and architectural review than ordinary UI copy changes.

See Contributing to SwapPulse.

### Do I need to understand Cairo to contribute?

No. SwapPulse has many contribution areas: React UI, accessibility, localisation, documentation, Pokémon catalogue integration, AT Protocol, Base44 backend functions, tests, operations and Web3.

Only changes to the Cairo/Starknet layer require Cairo knowledge.

### Can AI-assisted code be contributed?

Yes, but AI-assisted changes are held to the same review, security, attribution and testing standards as code written without AI assistance.

The repository openly documents that ChatGPT and Base44 have been major development tools for SwapPulse under human direction.

### Can I contribute documentation only?

Absolutely. Clear documentation, translations, troubleshooting guides and architecture explanations are valuable contributions.

Documentation must describe the actual working state and must not turn planned features into claims that they are already live.

## Forking and self-hosting

### Can I host my own copy of SwapPulse?

Yes, subject to the MPL-2.0 and the terms of the third-party services you keep using.

A complete independent fork may need its own:

* Base44 application;
* domains and branding;
* AT Protocol/PDS configuration;
* API provider credentials;
* Cairo contract deployments;
* Starknet chain/network configuration;
* relay secrets and signer accounts;
* privacy/terms documents;
* monitoring and backups.

### Can I point my fork at the live SwapPulse contracts?

That is generally the wrong architecture for an independent project. A true independent fork should deploy and verify its own contracts, keys, manifests and authority boundaries rather than silently inheriting SwapPulse's production/testnet trust assumptions.

### Can I use Base44 for my fork?

Yes, if Base44's product and account terms allow your intended use. SwapPulse uses Base44 as the application/orchestration layer, so an independent fork should normally create its own Base44 app rather than modifying the original SwapPulse app.

### Can I replace Base44 entirely?

The codebase could theoretically be adapted, but that is a significant architectural fork because many entities, backend functions, permissions and workflows currently depend on Base44.

It is not a simple configuration toggle.

## Releases and project changes

### How are SwapPulse versions decided?

SwapPulse uses semantic-version-style release discipline.

In general:

* patch versions cover meaningful fixes and smaller improvements;
* minor versions cover substantial new working features or larger UX/architecture additions;
* major versions are reserved for genuinely breaking or migration-heavy changes.

Unfinished scaffolding should not be presented as a completed release.

### Where can I see what changed between versions?

Use the [Changelog](../changelog/) and the corresponding GitHub release notes.

Significant working changes are assessed for a new version. When a change warrants a release, both GitHub and GitBook should be updated with the additions, updates, removals, rationale, security impact, limitations and migration notes.

### Does every documentation edit create a release?

No. Documentation corrections and clarifications do not automatically need a software release if they do not change working product behaviour.

However, documentation should still be updated whenever a new working feature is added, and a significant documentation/operational change can be versioned when it materially changes how the project is used or operated.

## Current network limitations

### Is SwapPulse already fully decentralised?

No. The current live testnet remains a single Starknet Devnet execution environment behind hardened public interfaces.

The isolated node lab has now passed a second-physical-host observer, persistent restart and cross-host lite-agreement test. That proves physical-host state-source independence for the tested path. Independent operators, multi-operator sequencing or consensus, and permissionless validation remain future milestones.

The documentation deliberately avoids calling the current setup decentralised consensus when it is not.

### Why build full and lite nodes if the current network is still single-runtime?

They are stepping stones toward independent state observation, resilience testing, operational separation and eventually a more genuinely decentralised network.

The project is proving each layer rather than relabelling a single Devnet process as a decentralised network.

## Troubleshooting and support

### Where should I look first if something is not working?

Check the in-site System Status page and the Troubleshooting guide. If the issue relates to Web3, also check whether your identity verification is current and whether the relevant public chain service is healthy.

### Why is a Wallet feature disabled even though I can see my account?

A visible smart account does not automatically mean every value feature is currently eligible.

Staking or bridge actions can be disabled when:

* the identity is not yet chain-authoritative;
* private verifier status is not current;
* public V2 verification is expired or revoked;
* assurance type/level does not meet policy;
* chain/network pins cannot be verified;
* the relevant action is invalid for the current on-chain lifecycle state.

### Why does Base44 sometimes show a different status before refreshing?

Base44 contains private mirrors of public chain state. A short delay can exist between a transaction being submitted/confirmed and the corresponding application mirror being reconciled.

For Web3 truth, the verified public chain remains authoritative.

### Why can't the Base44 sandbox shell run a trustworthy production build?

The current Base44 sandbox command shell has been observed mounting an empty `/workspace` even while the authoritative MCP file layer works normally.

Because of that environment limitation, a missing package or source path in that shell is not treated as a real frontend build failure. Final `npm` typecheck/lint/build validation for major UI phases should be run from the actual Git checkout on the mini-server or another trusted clone.

### How do I report a bug or request a feature?

Use the site's feedback tools or the project's GitHub issue/contribution workflow. Include enough detail to reproduce the issue, but never paste passwords, private keys, seed phrases, relay tokens, verifier secrets or private identity evidence.

## Still have a question?

If this page does not answer it, continue with:

* SwapPulse User Guide for normal product use;
* Support and Troubleshooting for problems;
* [Network & Web3](../network-and-web3/) for Cairo, V2 identity, nodes and infrastructure;
* [APIs](../apis/) for integration details;
* [Developers](../developers/) for architecture and development;
* [Project Maintenance](../project-maintenance/) for releases, licence, contributions, deployment and forking.
