---
description: Licensing documentation for SwapPulse.
---

# Licensing

## SwapPulse Licensing Options

> **Historical decision record:** SwapPulse selected the Mozilla Public License 2.0 (MPL-2.0) on 3 September 2026. The root `LICENSE` file is authoritative. This comparison is retained only to document the alternatives considered and must not be read as a current recommendation for Apache-2.0 or another licence.
>
> This document is a project-planning comparison, not legal advice. For a public commercial/community project that interacts with third-party intellectual property and hosted data services, obtain appropriate legal review if practical.

SwapPulse wants to be genuinely open source: people should be able to inspect the code, contribute improvements, fork it, modify it and create personal or commercial derivatives.

At the same time, the repository integrates third-party technology and data that SwapPulse does not own. The project licence must therefore be clear about what it does and does not license.

### The key rule: licence our code, not somebody else's rights

A SwapPulse licence can cover copyrightable source code and documentation owned by the SwapPulse contributors/rightsholders.

It does **not** automatically license:

* Pokémon names, characters, card artwork, logos or other Pokémon intellectual property;
* TCGdex trademarks/branding;
* content or data whose rights belong to third parties;
* Base44 platform code/services;
* AT Protocol implementations or dependencies owned by their respective authors;
* Cairo/Starknet/OpenZeppelin libraries owned by their respective authors;
* npm dependencies;
* user-created content;
* third-party APIs merely because SwapPulse calls them.

Those materials remain governed by their own licences, terms and applicable law.

TCGdex's public cards-database repository states that its database is MIT-licensed and not produced, endorsed, supported or affiliated with Nintendo or The Pokémon Company. Official TCGdex SDK repositories are also presented as MIT-licensed. That is helpful for using TCGdex software/data under those licence terms, but it does not transfer ownership of underlying Pokémon intellectual property to TCGdex or SwapPulse.

### Option 1: Apache License 2.0

#### What it allows

* commercial use;
* private use;
* modification;
* distribution;
* sublicensing under the licence conditions;
* forks and proprietary products built from the code.

#### Important characteristics

Apache-2.0 is permissive, but more explicit than MIT. It includes an express patent licence from contributors and a patent-termination mechanism.

Recipients generally need to preserve required copyright/licence notices and note significant modifications where applicable.

#### Why it fits SwapPulse

This is a strong fit if the goal is maximum community/commercial adoption while keeping legal terms clearer for a project that includes cryptography, identity, wallet and blockchain components where patent language can be useful.

It does **not** require commercial forks to publish their changes.

#### Third-party impact

Apache-2.0 would apply only to SwapPulse-owned code. TCGdex, Pokémon material and dependencies keep their own terms.

#### Trade-off

A company could fork SwapPulse, improve it privately and distribute a proprietary derivative without contributing those improvements upstream.

#### Suitability

**Very strong candidate.**

***

### Option 2: MIT License

#### What it allows

* commercial use;
* private use;
* modification;
* distribution;
* sublicensing;
* proprietary forks.

#### Important characteristics

MIT is short, well understood and extremely permissive. It mainly requires preservation of the copyright/licence notice and provides a broad warranty disclaimer.

#### Why it fits SwapPulse

TCGdex's cards database is itself MIT-licensed, and many JavaScript/open-source dependencies use MIT. Choosing MIT would make the project simple for contributors and fork maintainers to understand.

#### Third-party impact

The same separation still applies: an MIT licence on SwapPulse does not make Pokémon artwork or third-party API content MIT-licensed by SwapPulse.

#### Trade-off

MIT has no explicit patent grant comparable to Apache-2.0 and imposes almost no obligation on forks to share improvements.

#### Suitability

**Excellent if simplicity and maximum reuse are the top priorities.**

***

### Option 3: Mozilla Public License 2.0 (MPL-2.0)

#### What it allows

* personal and commercial use;
* modification;
* distribution;
* use alongside proprietary code.

#### Important characteristics

MPL is a **file-level copyleft** licence.

If someone distributes a modified MPL-covered file, the source for that covered file generally remains available under MPL. Larger proprietary works can still combine MPL and non-MPL files.

#### Why it fits SwapPulse

MPL offers a useful middle ground for a community project:

* companies can build commercial products and extensions;
* improvements to existing SwapPulse-covered files are more likely to remain open when distributed;
* separate proprietary modules can coexist.

This can align well with the project's wish to encourage community reciprocity without making every larger application that integrates SwapPulse GPL-style copyleft.

#### Third-party impact

MPL applies only to covered files to which SwapPulse has rights. Third-party components remain under their existing licences.

#### Trade-off

It is more complex for contributors/fork maintainers than MIT or Apache-2.0 and requires more care when reorganising files or combining code.

#### Suitability

**Strong candidate if reciprocal improvements are important.**

***

### Option 4: GNU General Public License v3.0 (GPL-3.0)

#### What it allows

GPL is open source and allows commercial use, modification, distribution and forks.

#### Important characteristics

GPL uses strong copyleft. When a derivative work is distributed, the corresponding covered source generally must remain available under GPL-compatible terms.

GPLv3 also contains patent provisions and protections around installation information in certain consumer-device contexts.

#### Why it might fit

It is attractive if the project's central goal is ensuring distributed derivatives remain free/open source.

#### Web-app limitation

Ordinary GPL does not generally require a service operator to provide source merely because users interact with modified GPL software across a network without receiving a copy.

For a web-first project like SwapPulse, this means GPL may not achieve the reciprocity some people expect from it.

#### Trade-off

Strong copyleft can reduce willingness of some commercial organisations to integrate the project, especially where they want proprietary combined works.

#### Suitability

**Suitable if strong redistribution copyleft is desired, but less aligned with maximum commercial integration.**

***

### Option 5: GNU Affero General Public License v3.0 (AGPL-3.0)

#### What it allows

AGPL remains an open-source licence and permits commercial use, modification and distribution.

#### Important characteristics

It extends strong GPL-style copyleft to software modified and made available for users to interact with over a network. This is particularly relevant to hosted web applications.

#### Why it might fit SwapPulse

If the goal is:

> Anyone can commercially host or fork SwapPulse, but modified hosted versions should offer their corresponding source to users

then AGPL is one of the clearest established open-source approaches.

#### Trade-off

AGPL can significantly reduce adoption by companies whose policies avoid AGPL dependencies or who want proprietary SaaS modifications.

It also requires more disciplined licence-compliance processes for forks.

#### Suitability

**Strongest candidate for network/SaaS reciprocity, weakest candidate for frictionless commercial adoption.**

***

### Option 6: GNU Lesser General Public License v3.0 (LGPL-3.0)

#### Purpose

LGPL is primarily designed for reusable libraries rather than complete web applications.

It lets proprietary applications link/use the licensed library while modifications to the LGPL library itself remain subject to LGPL obligations.

#### SwapPulse fit

It could make sense for a future reusable SwapPulse SDK/client library, but is less natural as the main licence for the complete website/backend/contracts repository.

#### Suitability

**Consider for standalone libraries, not the first choice for the whole repository.**

***

### Option 7: BSD 3-Clause

#### What it allows

Like MIT, BSD-3-Clause is permissive and permits commercial use, modification and redistribution.

#### Distinctive feature

It includes a non-endorsement clause preventing contributors' names from being used to promote derived products without permission.

#### Why it might fit

It is simple and business-friendly while giving a little more explicit protection against implied endorsement than MIT.

#### Trade-off

Like MIT/Apache, it does not require forks to contribute changes back. It also lacks Apache-2.0's explicit patent grant.

#### Suitability

**Good permissive alternative, although Apache-2.0 generally offers more useful terms for this project.**

***

### Option 8: EUPL 1.2

#### What it is

The European Union Public Licence is an OSI-approved copyleft licence created for European public-sector/open-source contexts and available in multiple official languages.

#### Why it might fit

SwapPulse has a UK/European context and values open/community development. EUPL provides explicit European-law framing and copyleft obligations.

#### Trade-off

It is less familiar to the global JavaScript/blockchain community than MIT, Apache, MPL, GPL or AGPL, potentially increasing contributor/commercial compliance questions.

#### Suitability

**Legitimate but probably not the simplest fit for SwapPulse's international contributor audience.**

***

### Options I would not recommend for the stated goal

#### Source-available licences marketed as open source

Licences such as BSL variants or SSPL-style terms can impose restrictions that mean the software is not OSI-defined open source.

If SwapPulse's stated promise is true open source with commercial forks permitted, avoid calling a source-available/non-OSI licence "open source".

#### Creative Commons licences for software

Creative Commons itself recommends using software-specific licences for software. CC licences can still be useful for appropriate original documentation or non-software media, but should not normally be the main source-code licence.

#### Public-domain-style dedication as the only project licence

CC0/Unlicense-style approaches can be attractive for maximum freedom, but patent, jurisdiction and warranty clarity are generally less suitable for a security-sensitive wallet/blockchain application than established software licences such as Apache-2.0 or MIT.

***

## Best fits for SwapPulse

### Historical permissive candidate: Apache-2.0

For the requirements currently stated:

* genuine open source;
* community contribution;
* personal forks;
* commercial forks;
* ability to build independent community variants;
* legal clarity;
* wallet/identity/blockchain code;
* no requirement that every commercial derivative must publish all changes;

**Apache License 2.0 was the strongest permissive candidate considered before the project selected MPL-2.0.**

Why Apache over MIT for SwapPulse:

1. both permit commercial and private forks;
2. both are widely understood;
3. Apache includes an explicit contributor patent grant;
4. Apache has clearer patent-termination language;
5. this is useful for a project involving cryptographic identity, blockchain contracts, wallet/recovery flows and protocol implementations;
6. third-party assets can still be clearly excluded via notices.

### Selected project licence: MPL-2.0

SwapPulse chose MPL-2.0 because the desired social contract is:

> Commercial use and proprietary extensions are welcome, but when you distribute modifications to SwapPulse's existing covered files, those modified files should remain open.

It is a good compromise between permissive licensing and strong GPL/AGPL copyleft.

### Alternative if hosted forks must share modifications: AGPL-3.0

Choose AGPL only if requiring hosted/SaaS forks to offer their modified source is more important than reducing commercial adoption friction.

***

## Selected project licensing structure

With MPL-2.0 selected, the project structure is:

* `LICENSE`: Mozilla Public License 2.0 for SwapPulse-owned and licensable source code.
* [Third-party notices](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/third-party-notices): provider attribution, dependency notices, trademark disclaimers and platform boundaries.
* [Documentation home](https://swappulse.gitbook.io/swappulse-docs/): concise licensing and non-affiliation notice.
* [Licensing guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/licensing): rationale and history of the licence choice.

Use a separate documentation licence only when there is a strong reason. Keeping code and original project documentation under the same MPL-2.0 terms is simpler unless media or document reuse needs differ.

## TCGdex-specific considerations

TCGdex being MIT-licensed does not mean SwapPulse owns TCGdex.

Recommended practices:

* identify TCGdex as a third-party data/API provider;
* link to its project/licence;
* preserve required MIT copyright/licence notices for TCGdex code/database portions actually redistributed, where applicable;
* do not imply TCGdex endorses SwapPulse;
* do not place a SwapPulse copyright notice over third-party material in a way that implies ownership;
* keep an integration boundary so a fork can replace TCGdex with another card catalogue.

Using an API is also different from copying the API provider's entire database into the repository. Any cached/redistributed datasets should be reviewed separately for applicable licence and third-party-content concerns.

## Pokémon-specific considerations

A software licence cannot solve Pokémon trademark/copyright questions.

The project's source licence should explicitly exclude third-party trademarks, logos, character/card artwork and other materials that SwapPulse does not own.

Keep the site's non-affiliation statement prominent. Avoid wording suggesting official Pokémon/Nintendo/Creatures/GAME FREAK endorsement.

If forks replace the TCG domain, they should remove Pokémon branding/assets and supply content they are entitled to use.

## Contribution ownership

Whichever licence is chosen, decide whether contributions are accepted under an inbound=outbound model:

> By submitting a contribution, you agree that your contribution is licensed under the same licence as the project.

This is common and simpler than requiring a separate Contributor Licence Agreement initially.

A CLA can be considered later if there is a concrete governance/relicensing need, but it adds contributor friction and should not be introduced casually.
