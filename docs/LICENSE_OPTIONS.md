# Open-source licence options for SwapPulse

> **Decision: SwapPulse selected Mozilla Public License 2.0 (MPL-2.0) on 2026-09-03.** The comparison below is retained as the decision record and for fork maintainers evaluating alternatives.
>
> This document is a project-planning comparison, not legal advice. Before adopting a licence for a public/commercial project, the maintainer should consider obtaining legal advice, particularly because SwapPulse integrates third-party Pokémon TCG data/media, AT Protocol components and blockchain dependencies.

SwapPulse wants to support:

- open source development;
- community contributions;
- personal forks;
- commercial forks and deployments;
- modification and redistribution;
- clear attribution and legal boundaries;
- continued respect for third-party licences and intellectual property.

Those goals are compatible with several established OSI-approved licences. The main decision is how strongly SwapPulse wants to require downstream modifications to remain open.

## Important boundary: our licence cannot relicense third-party rights

Whatever licence SwapPulse chooses applies only to material for which the SwapPulse copyright holder/contributors have the right to grant that licence.

It does **not** automatically grant rights to:

- Pokémon characters, card artwork, logos, names, trademarks or other Pokémon/Nintendo/Creatures/Game Freak intellectual property;
- third-party images or media;
- TCGdex trademarks/branding;
- Base44's hosted platform/service;
- third-party libraries, SDKs or smart-contract dependencies under their own licences;
- user-generated content where the user retains rights;
- external services accessed through APIs.

TCGdex's public cards-database repository states that the database is licensed under MIT and that it is not produced, endorsed, supported or affiliated with Nintendo or The Pokémon Company. That helps with the database/software layer, but an upstream database licence cannot itself grant rights it does not own in underlying Pokémon artwork or trademarks.

The repository should therefore carry both:

1. a project software licence once selected; and
2. `THIRD_PARTY_NOTICES.md` explaining exclusions and upstream licences.

---

# Option 1: Apache License 2.0

**SPDX:** `Apache-2.0`

## What it allows

Apache 2.0 is a permissive open-source licence. It permits use, modification, distribution and commercial use, including proprietary downstream products, provided its conditions and notices are respected.

## Why it fits SwapPulse

This is one of the strongest fits if the priority is:

- easy community and commercial adoption;
- forks without requiring every derivative to publish all source;
- compatibility with a mixed technology stack;
- explicit contributor patent protection;
- clearer patent termination provisions than MIT/BSD;
- allowing companies, schools, clubs and community groups to build their own versions.

SwapPulse includes smart contracts, backend functions, networking/federation code and potentially future node software. The explicit patent grant is useful in a technically broad project where contributors may develop protocol/network inventions.

## Trade-offs

- Downstream commercial forks can modify SwapPulse and keep their modifications private.
- It does not guarantee that improvements return to the community.
- More text/compliance requirements than MIT.
- A `NOTICE` file may need to be preserved/updated when applicable.

## TCGdex/Pokémon interaction

Apache 2.0 would license SwapPulse code only. It would not change TCGdex's MIT licence and would not grant Pokémon rights.

## Best when

**Maximum reuse + commercial friendliness + explicit patent protection** is the priority.

## Suitability

**Excellent candidate.**

---

# Option 2: Mozilla Public License 2.0

**SPDX:** `MPL-2.0`

## What it allows

MPL 2.0 is a weak/file-level copyleft licence. Anyone can use it commercially and combine it with larger proprietary works. When MPL-covered source files are modified and distributed, those modified covered files generally remain available under MPL.

Mozilla describes the MPL as sitting between permissive licences such as Apache and stronger GPL-family copyleft.

## Why it fits SwapPulse

This is attractive if SwapPulse wants:

- personal and commercial forks;
- commercial integrations;
- a realistic expectation that direct improvements to SwapPulse source files remain open when distributed;
- less licence reach than GPL/AGPL;
- compatibility with third-party modules under different licences;
- explicit patent grants from contributors.

It creates a useful middle ground for a community project: companies can build around SwapPulse, but modifications to the actual MPL-covered files cannot simply be redistributed as closed replacements.

## Trade-offs

- More compliance work than MIT/Apache.
- File boundaries matter, which contributors must understand.
- Hosted-only modifications that are never distributed are generally not forced public merely by network use.
- Some businesses are less familiar with MPL than Apache/MIT.

## TCGdex/Pokémon interaction

Third-party TCGdex code/data can retain its own MIT terms. Pokémon assets remain excluded. The MPL would apply only to the files SwapPulse has rights to license.

## Best when

**Commercial use should remain possible, but direct distributed modifications to SwapPulse should stay open.**

## Suitability

**Excellent candidate and probably the best compromise if community reciprocity matters.**

---

# Option 3: MIT License

**SPDX:** `MIT`

## What it allows

MIT is a very short permissive licence. It allows use, copying, modification, distribution, sublicensing and sale, subject mainly to retaining the copyright/licence notice.

## Why it fits SwapPulse

- Extremely easy for contributors and fork maintainers to understand.
- Commercial and personal forks are straightforward.
- TCGdex's cards database also uses MIT, reducing conceptual licensing friction around that integration.
- Very common across JavaScript/React ecosystems.
- Low compliance burden.

## Trade-offs

- No explicit patent licence comparable to Apache 2.0/MPL 2.0.
- Companies can create closed commercial forks without publishing improvements.
- It offers very little mechanism for ensuring community reciprocity.

## TCGdex/Pokémon interaction

Using MIT for SwapPulse would not mean TCGdex or Pokémon content becomes part of the SwapPulse MIT grant. Separate notices remain essential.

## Best when

**Simplicity and maximum adoption** matter more than requiring downstream openness.

## Suitability

**Very good candidate, especially if simplicity is the main goal.**

---

# Option 4: BSD 3-Clause License

**SPDX:** `BSD-3-Clause`

## What it allows

BSD 3-Clause is permissive and allows source/binary redistribution, modification and commercial use. It also includes a non-endorsement clause preventing the copyright holder/contributors' names from being used to promote derivatives without permission.

## Why it might fit

The non-endorsement wording is useful for a project where independent forks should not imply that their service is officially endorsed by SwapPulse.

It is straightforward for commercial use and for people creating their own collector-community forks.

## Trade-offs

- Like MIT, it does not require downstream modifications to stay open.
- It does not have Apache 2.0's explicit patent-grant structure.
- Trademark/project-brand policy is still needed separately; the non-endorsement clause is not a complete trademark policy.

## Best when

A **simple permissive licence plus explicit non-endorsement protection** is desirable.

## Suitability

**Good candidate, but Apache 2.0 is usually stronger for this project's patent/commercial needs.**

---

# Option 5: GNU General Public License v3

**SPDX:** `GPL-3.0-only` or `GPL-3.0-or-later`

## What it allows

GPLv3 permits commercial and personal use, modification and redistribution, but it uses strong copyleft. When covered derivative software is conveyed/distributed, recipients must receive the corresponding source under GPL-compatible terms.

Commercial use is absolutely allowed; "copyleft" does not mean "non-commercial".

## Why it might fit

- Strong protection against distributed proprietary forks.
- Encourages improvements to remain available to recipients.
- Well-known free-software licence with a large ecosystem.
- Useful if SwapPulse decides the whole application should remain free/open when redistributed.

## Trade-offs

- Stronger compatibility implications for code combined into the same derived work.
- Some commercial contributors/companies avoid GPL projects.
- For a hosted web service, ordinary network access does not by itself trigger the same source-sharing requirement as distribution, leaving the classic SaaS gap.
- More legal/compliance complexity for a mixed application/platform stack.

## Best when

**Distributed derivative applications must remain open source**, even at the cost of some commercial adoption friction.

## Suitability

**Possible, but stronger than the project's stated requirement unless reciprocal openness is a core policy goal.**

---

# Option 6: GNU Affero General Public License v3

**SPDX:** `AGPL-3.0-only` or `AGPL-3.0-or-later`

## What it allows

AGPLv3 is a strong copyleft licence specifically designed to address network/server software. It adds an obligation around making corresponding source available to users interacting with a modified covered program over a network.

Commercial use remains permitted.

## Why it might fit SwapPulse

SwapPulse is primarily a networked website/service with backend functions, federation and future node software. AGPL can prevent a party from taking the code, making significant private server-side improvements, offering the modified service publicly and never sharing those modifications.

This aligns strongly with a "community software should stay community software" philosophy.

## Trade-offs

- Highest commercial adoption friction among the options listed here.
- Some companies and cloud providers have policies restricting AGPL dependencies.
- More complex compliance obligations.
- Could reduce contributions/integrations from organisations that cannot deploy AGPL software.
- Needs careful consideration with the Base44 hosted environment and third-party integration boundaries.

## Best when

**Hosted forks and network services must also return modifications to the community.**

## Suitability

**Strong ideological fit for maximum reciprocity, but probably too restrictive if easy commercial forks are an explicit goal.**

---

# Option 7: dual licensing

Example structures might include:

- MPL-2.0 for the community plus a separate commercial licence; or
- AGPL-3.0 for the community plus a separate commercial licence.

## Why it might fit

Dual licensing can preserve strong open-source reciprocity while offering a separately negotiated route for organisations that need different terms.

## Major complication

To relicense the whole codebase commercially, the project must actually control the necessary copyrights. As outside contributors arrive, that can require a Contributor Licence Agreement (CLA), copyright assignment or another explicit contribution model granting sufficient relicensing rights.

That is a major governance decision and adds contributor friction.

## Suitability

**Not recommended initially unless a deliberate commercial licensing business model is planned.**

---

# Comparison

| Licence | Personal use | Commercial use | Forks | Closed commercial forks | Requires distributed modifications open | Network/SaaS copyleft | Explicit patent grant | Complexity |
|---|---|---|---|---|---|---|---|---|
| Apache-2.0 | Yes | Yes | Yes | Yes | No | No | Yes | Low/medium |
| MPL-2.0 | Yes | Yes | Yes | Partly | Covered modified files | No | Yes | Medium |
| MIT | Yes | Yes | Yes | Yes | No | No | No explicit patent grant | Very low |
| BSD-3-Clause | Yes | Yes | Yes | Yes | No | No | No explicit patent grant | Very low |
| GPL-3.0 | Yes | Yes | Yes | Generally no for distributed derivatives | Yes | No | GPL patent provisions | High |
| AGPL-3.0 | Yes | Yes | Yes | Generally no for covered network derivatives | Yes | Yes | AGPL/GPL patent provisions | High |

---

# Practical recommendation for SwapPulse

Based on the stated goals — open source, community contribution, easy forks, modifications for personal **and commercial** use, clear third-party boundaries — the strongest shortlist is:

## 1. Apache-2.0 — recommended if permissive commercial reuse is the priority

Choose Apache 2.0 if SwapPulse wants the broadest serious open-source/commercial adoption while retaining an explicit patent grant and standard notice obligations.

## 2. MPL-2.0 — recommended if community reciprocity is also important

Choose MPL 2.0 if commercial forks should be allowed but direct modifications to distributed SwapPulse source files should remain open.

## 3. MIT — recommended if absolute simplicity is the priority

Choose MIT if the project's goal is to make reuse as frictionless as possible and the maintainers are comfortable with closed-source commercial derivatives.

For the current goals, **Apache-2.0 or MPL-2.0 are stronger fits than MIT**. Apache gives maximum permissive adoption plus patent clarity; MPL gives a balanced amount of reciprocal openness.

AGPL should only be chosen if the project deliberately decides that hosted modifications must also be published, because that changes the commercial/forking proposition substantially.

---

# Separate trademark/content policy still needed

A software licence is not a trademark licence.

Even after choosing a software licence, SwapPulse should separately state that:

- the SwapPulse name/logo may have separate branding rules;
- Pokémon and related names, marks, artwork and characters belong to their respective rights holders;
- forks may need to rebrand to avoid implying official endorsement;
- third-party data/media remain governed by their original sources/rightsholders;
- an independent fork is not automatically an official SwapPulse deployment.

See `THIRD_PARTY_NOTICES.md` and `docs/FORKING_AND_REBRANDING.md`.

## Reference links

- OSI MIT: https://opensource.org/license/mit
- OSI Apache licence catalogue/search: https://opensource.org/licenses
- Mozilla MPL 2.0: https://www.mozilla.org/MPL/2.0/
- Mozilla MPL FAQ: https://www.mozilla.org/en-US/MPL/2.0/FAQ/
- OSI BSD-3-Clause: https://opensource.org/license/bsd-3-clause
- OSI GPL-3.0: https://opensource.org/license/gpl-3.0
- OSI AGPL-3.0: https://opensource.org/license/agpl-3-0
- TCGdex cards database: https://github.com/tcgdex/cards-database
- Pokémon UK Terms of Use: https://www.pokemon.com/uk/legal/terms-of-use

## Decision status

**Selected: Mozilla Public License 2.0 (MPL-2.0).**

The authoritative licence text is the root `LICENSE` file. MPL-2.0 applies only to SwapPulse-owned/licensable material and does not relicense the third-party content and services identified in `THIRD_PARTY_NOTICES.md`.
