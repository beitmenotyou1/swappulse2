# SwapPulse Predictions Full Feature Audit

**Audit date:** 12 September 2026  
**Scope:** Predictions page, market poll creation, card selection, pricing snapshots, bullish/bearish/neutral voting, vote changes/removal, tally integrity, expiry/closing, automated outcome resolution, CardPricing dependencies, moderation/reporting, enforcement, notifications, AT Protocol portability, Sentiment Assistant, weekly sentiment reporting, privacy/data rights, localisation, accessibility, documentation, analytics, abuse controls and release verification  
**Overall score:** **18/100**  
**Risk:** **Critical / High Risk**  
**Release status:** **NOT RELEASE READY**  
**Status:** **Source/schema/data audit complete; exact-release build/lint/typecheck/E2E and scheduled-workflow smoke verification unavailable**

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | PR-001 - Ordinary voting cannot keep the authoritative tally consistent | `PollCard.cast()` creates/deletes `SentimentVote` rows and then directly calls `SentimentPoll.update()` to write `vote_counts` and `total_votes`. `SentimentPoll` update RLS permits only the poll creator or an admin, so an ordinary voter can create a vote for somebody else's poll but cannot reliably update that poll's tally. The catch block rolls the UI back, while the vote row may already exist. | Replace direct entity voting with one authenticated backend `cast-sentiment-vote` operation. Derive the voter from auth, validate the poll, enforce one vote per user/poll, atomically create/change/remove the vote and recompute or atomically update the tally server-side. Add adversarial tests proving partial states cannot survive. |
| 🔴 P0 | PR-002 - Default TCGPlayer polls cannot resolve correctly with the current pricing model | The poll creator defaults to `tcgplayer` and reads `CardPricing.avg`. `resolveSentimentPolls` also resolves both sources from `CardPricing.avg`. Current `syncPricing` populates Cardmarket `avg`, but for TCGPlayer it stores variant fields such as `normal_market`, `normal_avg`, `holofoil_market` and `holofoil_avg` and does **not** populate `avg`. Therefore the normal default TCGPlayer path can capture a zero baseline and later read a zero current price, forcing `inconclusive` even though TCGPlayer pricing exists. This matches the current TCGDex model, where TCGPlayer data is variant-based rather than a single average. | Define a canonical resolution price selector per source and card variant. For TCGPlayer, select an explicit variant price such as `marketPrice`/stored `*_market`; for Cardmarket, select the documented non-foil/foil field intentionally. Store source, variant, unit, price and source timestamp in the poll snapshot, and use the same selector at resolution. |
| 🔴 P0 | PR-003 - Poll creators can rewrite authoritative outcome evidence | Poll owners have broad row update rights over `price_at_creation`, `direction`, `expires_at`, `resolution_source`, `vote_counts`, `total_votes`, `outcome`, card identity, DID and AT metadata. A creator can therefore alter the baseline, declared prediction, tally or final outcome after other collectors have voted. `resolveSentimentPolls` trusts those mutable fields. | Make trust-sensitive poll fields backend-only and immutable after creation. Permit only narrowly defined creator edits, if any, before the first vote. Outcome, baseline, source, expiry, tallies and resolution evidence must be service-owned. Preserve an audit trail for any administrative correction. |
| 🔴 P0 | PR-004 - Sentiment Assistant inherits the indirect prompt-injection and Markdown exfiltration chain | `sentiment_conversationalist` reads public/user-visible SentimentPoll, SentimentVote, CardPricing and Post records but lacks the explicit untrusted-record instruction boundary used by hardened agents. Poll questions and posts are attacker-controlled. The UI renders assistant output with unrestricted `ReactMarkdown`, allowing generated remote images/links. A hostile poll or post can therefore steer model output toward an attacker URL and create a credible route for model-visible data to be disclosed or fetched. | Add a shared untrusted-data/prompt-injection policy to the agent, field-minimise tool results, prohibit remote Markdown images/media, route generated external links through the existing confirmation layer and add adversarial tests using malicious poll questions/posts. |
| 🟠 P1 | PR-005 - There is no authoritative one-vote-per-user invariant | `SentimentVote` has no uniqueness constraint on poll plus authenticated user/DID. Direct API clients can create duplicate votes for the same poll, and the page merely picks one row per poll when building `myVotes`. | Enforce one active vote per authenticated user and poll in the backend. Use an idempotency/unique key and return the canonical vote after create/change/remove. |
| 🟠 P1 | PR-006 - Expired unresolved polls remain votable | `PollCard` calculates `expired`, but `cast()` blocks only when `pending` or `resolved`. The vote buttons are rendered whenever `!resolved`. Between `expires_at` and the hourly resolver, a poll can display `Closed` and still accept vote rows. | Enforce `expires_at > server_now` in the backend vote operation and disable controls immediately at expiry in the UI. Resolution must operate on a closed, immutable voting set. |
| 🟠 P1 | PR-007 - Vote switching/removal is a non-transactional multi-step mutation | Switching a vote best-effort deletes the old row, creates a new row, then updates the poll tally. Any intermediate failure leaves the ledger, tally and optimistic UI representing different states. Removing a vote has the same failure window. | Perform vote transitions as one server transaction/idempotent operation. If the storage layer has no multi-record transaction, use a durable mutation record plus reconciliation and compute displayed tallies from authoritative votes until completion. |
| 🟠 P1 | PR-008 - Poll creation has no server-owned validation boundary | The browser directly creates `SentimentPoll`, including baseline price, expiry, source, counters and identity/display metadata. There is no dedicated creation endpoint, idempotency key, abuse boundary or server clock. | Add `create-sentiment-poll`. Derive actor identity from auth, validate canonical card/source/variant, capture price server-side, set zero counters internally, use server time, enforce allowed expiry policy and create the record idempotently. |
| 🟠 P1 | PR-009 - Card identity and display metadata are caller-controlled | `card_id`, `card_uri`, `card_name` and `card_image` are copied from browser-selected data and remain owner-editable. A modified client can create a poll for a nonexistent card or pair one card ID with another name/image. | Resolve the card from the canonical TCGDex-backed catalogue server-side using the submitted ID, then derive card URI/name/image. Reject unknown IDs and never treat caller display metadata as authority. |
| 🟠 P1 | PR-010 - Polls for untracked catalogue cards may never obtain a resolvable price | `syncPricing` only refreshes cards found in collections, wishlists or open trade listings. Predictions can select any catalogue card. Selecting a card that nobody currently tracks can therefore produce `Price not tracked`, a zero baseline and an inevitably inconclusive result, with no poll-specific process to begin tracking it. | On poll creation, fetch/validate the selected source price directly through the trusted pricing service or enqueue that card for tracked pricing. Do not accept a resolvable market prediction without a valid authoritative baseline. |
| 🟠 P1 | PR-011 - Free-text question semantics are disconnected from the resolver | The user can write any 200-character question, but resolution ignores the question and evaluates only whether price moved by more than ±2% in the creator's `direction`. A question such as “Will this rise 20%?” could be marked correct after a 2.1% increase. | Model the resolution rule structurally: metric, direction, target/threshold, source, variant, window and unit. Generate/display the question from those fields or clearly mark free text as commentary that does not affect resolution. |
| 🟠 P1 | PR-012 - Card variant is absent from the prediction and resolution model | TCGPlayer prices are variant-specific and Cardmarket differentiates foil/non-foil pricing, yet SentimentPoll identifies only the card, not normal/holo/reverse or the exact pricing field. The outcome can therefore be about an unspecified market instrument. | Require or derive an explicit card variant/price series for every market prediction and preserve it through baseline and resolution. Show the chosen variant to voters. |
| 🟠 P1 | PR-013 - Price currency/unit is neither captured nor displayed | `CardPricing` stores a `unit` such as USD or EUR, but SentimentPoll stores only a number and even describes it as “pence”. The composer renders `Current {source} avg: {price}` without a unit. This can misrepresent market values and makes historical evidence ambiguous. | Store `price_unit` and source timestamp with both creation and resolution snapshots. Format prices with the correct currency/unit and remove the inaccurate universal “pence” assumption. |
| 🟠 P1 | PR-014 - Creation-price evidence is client-read and therefore forgeable/stale | `CreatePollModal` reads CardPricing in the browser and writes the result back as `price_at_creation`. An alternate client can supply any baseline, while a stale browser can submit an old value. | Capture the baseline inside the authenticated backend creation operation immediately before persistence. Store the pricing record/source timestamp used and reject stale data beyond a defined freshness window. |
| 🟠 P1 | PR-015 - The resolver examines only the newest 200 polls | `resolveSentimentPolls` lists 200 polls and filters that bounded set for expired unresolved rows. If more than 200 newer records exist, an older unresolved poll can fall permanently outside the resolver's scan. | Query unresolved expired polls directly with stable cursor pagination and continue until the eligible set is exhausted or a bounded batch checkpoint is persisted for the next run. |
| 🟠 P1 | PR-016 - Resolution has no durable evidence snapshot | The resolver writes only `outcome`. It does not store resolution price, unit, source record timestamp, resolved_at, movement percentage, rule version or evidence/reference used. A later price refresh cannot reproduce why a prediction was judged correct. | Persist an immutable resolution object containing baseline, final price, unit, variant, source, source timestamps, movement, threshold/rule version, resolved_at and resolver version. |
| 🟠 P1 | PR-017 - Prediction questions have no moderation/reporting path | SentimentPoll is public user-generated text, but `ContentReport` does not accept a sentiment-poll content type, the moderation pipeline has no sentiment context, and PollCard exposes no report action. Spam, harassment, scams or prohibited content can therefore sit outside the normal review tools. | Add `sentiment_poll` to reporting/moderation, provide a Report action, apply human-review-compatible moderation state and filter ineligible polls from discovery. Keep AI advisory rather than autonomous enforcement. |
| 🟠 P1 | PR-018 - Account enforcement is not applied to Predictions discovery | `/predictions` directly lists SentimentPoll rows and does not check AccountStatus/enforcement. A shadow-banned or otherwise feed-ineligible collector's polls remain discoverable here even when their other public content is suppressed. | Load polls through a server discovery endpoint that applies account enforcement and moderation consistently with the rest of the site. |
| 🟠 P1 | PR-019 - Poll and vote creation bypass platform abuse/rate controls | No `ensureBotAllowed`, backend rate limit, per-user poll quota or vote mutation throttle is present. Direct authenticated clients can create large numbers of polls/votes independently of normal UI pacing. | Put both creation and voting behind server-side rate/abuse controls, with idempotency and sensible per-account limits. Add burst and sustained abuse tests. |
| 🟠 P1 | PR-020 - Individual voting choices are publicly readable | `SentimentVote.rls.read` is open. Each row includes voter DID, name/handle and bullish/bearish/neutral choice even though the Predictions UI presents aggregate community sentiment. This enables individual opinion profiling and scraping beyond what is needed for the feature. | Make individual vote rows owner/staff/service-readable unless transparent public voting is an explicit, documented product decision. Expose a privacy-minimised aggregate view to ordinary users and agents. |
| 🟠 P1 | PR-021 - Voter identity is not authoritative | Vote creation is owner-bound only by `created_by_id`; the row's `did`, `voter_name`, `voter_handle`, AT URI/CID and signature fields remain caller-controlled. A modified client can attribute its vote to another DID in public/AI-visible data. | Derive voter DID/profile fields from `auth.me()` server-side and make them immutable. Do not use legacy simulated signatures as proof of voter identity. |
| 🟠 P1 | PR-022 - Poll author identity is similarly caller-controlled | The poll row accepts caller-supplied `did`, `author_name`, `author_handle` and simulated AT metadata. The RLS owner and displayed/federated-style identity can therefore disagree. | Derive author identity from the authenticated account in the creation backend and treat `created_by_id`/canonical DID as authority. |
| 🟠 P1 | PR-023 - Caller-controlled card images can trigger viewer requests to arbitrary hosts | Because `card_image` is writable, a malicious poll can point its `<img>` at an arbitrary HTTPS host. Viewing the poll can disclose normal request metadata to that host. | Derive images from the canonical catalogue or proxy/allowlist remote media. Do not accept arbitrary image URLs in trusted card metadata. |
| 🟠 P1 | PR-024 - Sentiment Poll/Vote AT Protocol portability is not implemented | The client defines/stamps `org.swappulse.sentimentPoll` and `org.swappulse.sentimentVote`, but there are no corresponding Lexicon files, no entries in the deployable Lexicon registry, no firehose mappers, no outbound record builders and no bridge call from poll/vote creation. The stored `at_uri`, `cid` and `sig` are therefore local simulated metadata, not real repository records. | Either implement versioned Lexicons end-to-end, publish them, bridge records to the author's repository and ingest/reconcile them across instances, or stop stamping/marketing these local rows as portable AT records. |
| 🟠 P1 | PR-025 - Personal-data export omits authored SentimentPoll records | `export-my-data` includes SentimentVote but not SentimentPoll, even though authored poll questions, identity metadata and prediction history are user-linked data. | Add SentimentPoll to the maintained personal-data inventory/export and test export against an account with authored polls and votes. |
| 🟠 P1 | PR-026 - Sentiment Assistant is instructed to profile “who voted what” | The agent prompt explicitly tells the model to inspect individual voting patterns, while aggregate counts are enough for community sentiment analysis. This needlessly sends identifiable opinion data into model context. | Give the agent an aggregate sentiment tool/read model only. Remove voter identity from the prompt/tool scope and disclose the minimal data used for analysis. |
| 🟠 P1 | PR-027 - AI “trend” claims have no minimum quorum and are easy to manipulate | The assistant treats strong percentages and high vote counts as trend signals, but there is no minimum voter quorum, uniqueness guarantee or anti-sybil control. One or a few duplicate/spoofed votes can become “100% bullish” and be surfaced as strong consensus. | Establish minimum sample-size/quorum rules and use backend-deduplicated votes. Present sample size alongside percentages and avoid “trend/consensus” language below the threshold. |
| 🟠 P1 | PR-028 - Manual weekly sentiment email ignores explicit recipient consent | The scheduled Weekly Sentiment Report is correctly security-held, but an admin can still invoke `weeklySentimentReport`, which emails every active non-restricted user without checking marketing/report consent or unsubscribe state. | Apply the same explicit consent/unsubscribe boundary to manual and scheduled runs. Keep the schedule disabled until trusted scheduler identity and consent-aware delivery are verified. |
| 🟠 P1 | PR-029 - Weekly sentiment email asks the LLM for prescriptive market recommendations | The weekly report prompt asks for “Recommendations for the coming week” and distributes them to the community. This conflicts with the safer “community mood, not financial advice” framing and can reach younger users. | Restrict broadcasts to factual aggregate sentiment/pricing summaries with source/freshness/uncertainty. Do not tell recipients when or how to act on card prices. |
| 🟠 P1 | PR-030 - Dedicated prediction integrity/security tests are not present | No maintained tests were found proving vote uniqueness, RLS-safe tallying, expired-poll rejection, outcome immutability, TCGPlayer/Cardmarket resolution, variant/currency handling, resolver pagination, moderation, enforcement or malicious direct clients. | Add unit/integration/adversarial suites for the full lifecycle and gate release on them. Include concurrency and retry/failure injection around vote mutations and resolution. |
| 🟠 P1 | PR-031 - There is no immutable close snapshot before resolution | Poll metadata and vote rows remain mutable after `expires_at` until the hourly resolver runs. Combined with owner-writable poll fields and directly mutable voter rows, the set of evidence being judged is not frozen at closing time. | Introduce an explicit `open -> closed -> resolved` server lifecycle. At close, stop vote mutation and persist the canonical vote count/hash plus immutable rule/baseline fields before resolution. |
| 🟡 P2 | PR-032 - “Live results” are not live across clients | Predictions loads once and has no realtime subscription, polling or visible refresh. A user's local optimistic vote changes immediately, but votes cast by other collectors are not reflected until reload. | Add safe realtime invalidation/refetch or periodic refresh and update documentation until live behaviour is verified. |
| 🟡 P2 | PR-033 - Discovery and own-vote history are hard-capped | The page loads only 50 polls and at most 200 of the current user's votes, with no cursor/load-more path. Older polls and vote-state mappings disappear from the UI. | Add server-backed cursor pagination for polls and a direct current-user vote lookup keyed to the displayed poll IDs. |
| 🟡 P2 | PR-034 - Load failures masquerade as an empty predictions community | The page catches load errors, clears polls/votes and renders the same empty state as a genuinely empty dataset. | Keep a separate error state with retry and, where possible, preserve the last successful list. |
| 🟡 P2 | PR-035 - Guest create/vote controls fail instead of guiding sign-in | `/predictions` is public and the New Poll/vote controls are shown to signed-out users. Interaction eventually fails through authentication/identity calls, often silently for voting, rather than presenting a clear sign-in action. | Gate mutation controls on authenticated state or open a sign-in prompt while keeping public poll viewing available. |
| 🟡 P2 | PR-036 - Documentation claims arbitrary multi-option polls that do not exist | Help says users can “write your question and add 2 or more answer options”. The actual product has exactly three fixed choices: Bullish, Bearish and Neutral. | Update help to describe fixed market sentiment choices, or build a separate generic multi-option poll feature rather than conflating it with market prediction polls. |
| 🟡 P2 | PR-037 - Documentation claims creators can manually close polls | Help says “The creator can close voting when ready”, but there is no close control or backend close operation. | Remove the claim or add an authenticated server close action with an immutable close snapshot and clear rules. |
| 🟡 P2 | PR-038 - Documentation implies an optional closing time, but only three fixed durations exist | The UI offers 1, 7 or 30 days and no custom/optional date-time. | Align documentation with the fixed expiry policy, or add a bounded custom closing-time control validated server-side. |
| 🟡 P2 | PR-039 - The “Resolved” tab includes unresolved expired polls | Page filtering sends any expired poll into the tab labelled `Resolved`, even before `outcome` has been set. PollCard can therefore show a closed but unresolved item in a resolved section. | Separate `Open`, `Awaiting resolution` and `Resolved`, or resolve promptly enough that the intermediate state is explicitly represented. |
| 🟡 P2 | PR-040 - Generated question text drifts when direction/expiry changes | The default question is generated only when a card is selected. Changing Bullish/Bearish/Neutral or 1/7/30-day expiry afterwards does not update the text, so stored question wording can contradict the structured direction/window. | Regenerate the default question whenever structured inputs change until the user explicitly customises it, or render the structured rule separately from commentary. |
| 🟡 P2 | PR-041 - Predictions localisation is incomplete | Main page labels are translated, but `PollCard` hard-codes Bullish/Bearish/Neutral, Closed, time-left units, vote labels and resolution text in English. The `poll.*` creation strings were found only in the English translation file, so other supported locales cannot receive a complete native Predictions experience. | Move all Predictions strings into all nine locale resources and add translation-completeness tests. |
| 🟡 P2 | PR-042 - Sentiment Assistant UI is English-only | The assistant page hard-codes title, subtitle, empty state, buttons, placeholder and explanatory copy rather than using the site's i18n layer. | Add localised assistant UI strings and ensure agent response language follows the user's selected supported locale. |
| 🟡 P2 | PR-043 - Create Poll modal lacks complete dialog focus semantics | The custom overlay has no `role="dialog"`, `aria-modal`, focus trap, initial focus, Escape handling or focus restoration. The close aria-label is hard-coded English. | Use the shared accessible Dialog primitive and test keyboard-only/screen-reader interaction, including nested Card Search. |
| 🟡 P2 | PR-044 - Choice/tab controls do not expose selected state semantically | Direction, expiry, source, vote and tab buttons rely mostly on styling to indicate selection; `aria-pressed`/tab roles are not exposed consistently. | Add appropriate toggle/tab semantics and visible focus states, then test screen readers and keyboard navigation. |
| 🟡 P2 | PR-045 - Resolution notifications are not implemented and the dormant route is misaligned | A deep-link mapping exists for `sentiment_resolution` but no producer was found, `Notification.action_type` does not include it, and the route points to `/market` rather than `/predictions` or a specific poll. | If outcome notifications are desired, add a real supported notification type produced by the resolver, link to the relevant prediction and respect notification preferences. Otherwise remove the dead mapping. |
| 🟡 P2 | PR-046 - Price freshness is invisible to poll creators and voters | The UI shows a raw “current average” but not the source update timestamp, retrieval time or freshness status. Prediction resolution is highly time-sensitive, so stale market data can look current. | Show source, currency, variant and “as of” timestamp. Reject or clearly flag stale baselines and store freshness evidence in the poll. |
| 🟡 P2 | PR-047 - Predictions has no dedicated product or operational analytics | No Predictions events were found in `src/lib/analytics.ts`, and there are no lifecycle metrics for poll create, vote mutation, close, resolve, inconclusive causes, pricing freshness or resolver lag. | Add privacy-minimised analytics/metrics from authoritative backend success points, with dashboards for resolution backlog, inconclusive rate and vote/tally reconciliation failures. |
| 🟡 P2 | PR-048 - Exact-release verification could not be run | The Base44 command sandbox currently exposes an empty `/workspace`; `npm run build`, `lint` and `typecheck` all fail with `ENOENT /workspace/package.json`. The required Base44 web-agent README also returns HTTP 403 from that sandbox. | Run build, lint, typecheck, prediction lifecycle tests, scheduler smoke tests and E2E from a correctly mounted exact-commit checkout/CI job before release. Do not treat this source audit as executable release certification. |
| 🟢 P3 | PR-049 - Feature terminology is inconsistent | The same surface is described as Predictions, Polls, Market Polls, market predictions and community sentiment. The `direction` field describes the creator's prediction while the three vote choices describe community sentiment, which makes the product model harder to explain. | Define a clear vocabulary, for example “Market Prediction” for the creator's resolvable claim and “Community Sentiment” for aggregate votes, and use it consistently in UI, schema and docs. |

## Executive summary

Predictions has a clear visual concept but the current implementation cannot be treated as a trustworthy market-prediction or community-sentiment system. The largest problem is that **voting is split across client-side entity mutations**. An ordinary voter can create a SentimentVote, but the poll row belongs to somebody else and its RLS prevents that voter from updating `vote_counts`/`total_votes`. The UI rolls back, while the created vote may remain. Even if that write boundary were relaxed, client-computed counters would still be vulnerable to races, duplicate votes and manipulation.

The automated outcome path has a separate release blocker. Poll creation defaults to TCGPlayer and reads `CardPricing.avg`; the resolver also reads `avg`. Current pricing sync intentionally stores TCGPlayer as variant-specific `normal_market`, `normal_avg`, `holofoil_market`, `holofoil_avg` fields and does not set `avg`. TCGDex's current card schema likewise models TCGPlayer by variant while Cardmarket exposes flat average/trend fields. The safest fix is not to invent a single generic average, but to make **source + variant + price field + currency + timestamp** part of the prediction's immutable rule.

Even where price data exists, the resolver does not resolve the natural-language question. It judges only the creator's direction using a hidden ±2% band. A custom question that promises a larger threshold can therefore receive a “correct” outcome for a much smaller move. The market claim needs a structured resolution rule, with the natural-language question derived from or explicitly separated from that rule.

Poll integrity is also weakened by broad owner writes. The creator can change the baseline, direction, expiry, source, tally and final outcome. Those fields need to become server-owned immediately if outcomes are going to be shown as meaningful historical results or consumed by the Sentiment Assistant.

The AT Protocol story is currently local-only. The frontend defines `org.swappulse.sentimentPoll` and `org.swappulse.sentimentVote`, but this audit found **no deployable Lexicon files, no Lexicon-registry entries, no firehose mappers, no outbound record builders and no bridge calls** for either type. Current AT URIs/CIDs/signatures on those entities are simulated application metadata rather than real repository records. If decentralised sentiment is a product goal, it should be implemented as a genuine versioned Lexicon with repository provenance and cross-instance ingest.

Moderation and privacy also need attention. Poll questions are public user-generated content but are outside the normal reporting/moderation content types. Individual vote rows are publicly readable and include DID/name/handle plus the person's market opinion, while the Sentiment Assistant is explicitly told to inspect “who voted what”. Aggregate sentiment does not require that exposure.

The Sentiment Assistant itself remains read-only, which is good, but it inherits the broader specialist-agent prompt-injection/Markdown issue. Public poll questions/posts are untrusted model input, while assistant output is rendered through unrestricted Markdown. That needs to be hardened before the assistant is release-green.

The scheduled weekly sentiment email is deliberately disabled by a security hold, which is a good safety decision. However, its manual admin path still emails every active user without explicit report/marketing consent and asks the model for recommendations for the coming week. That should remain disabled until consent, age-appropriate messaging and non-prescriptive market framing are enforced.

The audit-visible data store contained **0 SentimentPoll rows, 0 SentimentVote rows and 0 CardPricing rows** during this session. That is an audit-visible observation, not a guarantee that every deployment/environment is empty. It does mean there is no visible prediction history blocking a clean migration to a server-authoritative model.

No functional application code or user data was changed during this audit. The only project change is this audit report.

## Current feature reality

| Capability | Current state | Verdict |
| --- | --- | --- |
| Public Predictions page | Present | Basic newest-first list, 50-row cap |
| Create market poll | Present | Direct browser entity create; no authoritative backend boundary |
| Card selection | Present | Catalogue picker UX, metadata not server-canonicalised |
| Bullish/Bearish/Neutral choices | Present | Fixed three-option market sentiment only |
| 1/7/30 day expiry | Present | Browser/server trust mismatch; no custom/manual close |
| TCGPlayer resolution | Broken by current field mapping | Default path reads an `avg` that sync does not populate |
| Cardmarket resolution | Partial | Flat average available, but variant/unit/evidence semantics incomplete |
| Vote creation | Present | Direct row create, no authoritative uniqueness |
| Vote tally | Broken for ordinary foreign-poll voters | Poll RLS prevents normal tally update |
| Change/remove vote | Present in UI | Non-transactional and divergence-prone |
| Voting after expiry | Incorrectly possible | Blocked only once outcome exists |
| Automated hourly resolution | Implemented in source | 200-poll scan cap; scheduler execution not verified |
| Resolution evidence/history | Not implemented | Outcome only |
| Real-time community results | Not implemented | Local optimistic update only |
| Poll moderation/reporting | Not implemented | Outside report/moderation content types |
| Enforcement filtering | Not implemented | Direct public entity list |
| Abuse/rate limiting | Not implemented | Direct writes bypass bot/rate boundary |
| Individual voter privacy | Weak | Vote identity and choice publicly readable |
| Sentiment Assistant | Present/read-only | Privacy and prompt-injection/Markdown issues remain |
| Weekly sentiment email | Function present; schedule security-held | Manual consent/advice issues remain |
| AT Protocol poll Lexicon | Not implemented | Constants/simulated metadata only |
| Cross-instance poll/vote ingest | Not implemented | No firehose mapper |
| Personal data export | Partial | Votes included; authored polls omitted |
| Account deletion | Local cleanup present | Polls/votes included in local cleanup |
| Localisation | Partial | Main page translated; poll cards/modal coverage incomplete |
| Accessibility | Partial | Basic labels, but custom modal/toggle semantics incomplete |
| Dedicated tests | Not found | Exact release runtime unavailable |

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Core poll functionality | 4/15 | Basic create/view UX exists, but product/docs and close/live behaviour diverge. |
| Vote integrity / concurrency | 1/20 | Core tally path conflicts with RLS and has no atomic uniqueness boundary. |
| Pricing / resolution integrity | 1/20 | Default TCGPlayer path is structurally broken; evidence/rule/variant/unit handling is incomplete. |
| Moderation / abuse / privacy | 3/15 | Public data model works, but moderation, enforcement, abuse controls and voter minimisation are missing. |
| Federation / decentralisation | 0/10 | Sentiment NSIDs are not implemented as real repository records. |
| AI / reporting | 3/10 | Read-only assistant and disabled schedule are strengths, but prompt-injection, privacy, consent and advice issues remain. |
| Data lifecycle / portability | 2/5 | Local deletion covers polls/votes; export misses polls. |
| UI / accessibility / localisation / docs | 4/10 | Clean basic UI but substantial documentation, localisation, signed-out and accessibility gaps. |
| Testing / operations | 0/5 | No dedicated prediction suite found; exact-release checks/scheduler smoke tests unavailable. |
| **Total** | **18/100** | **Critical / NOT RELEASE READY** |

## Verified strengths to preserve

- SentimentPoll and SentimentVote creation require authentication/record ownership at the entity RLS layer.
- CardPricing is public-read but admin-only for mutation, which is the correct direction for an authoritative shared price cache.
- The resolution backend is admin-only and performs resolution under service role rather than trusting an unauthenticated public caller.
- The UI constrains ordinary poll expiry choices to 1, 7 or 30 days and price source to TCGPlayer/Cardmarket.
- Poll question rendering uses normal React text rather than raw HTML, reducing direct XSS risk.
- Poll card images have text alternatives derived from the card name.
- The Sentiment Assistant has read-only entity tools and cannot publish or mutate community content.
- Specialist-agent UI hides raw tool inputs/results instead of exposing private/internal payloads directly.
- The Weekly Sentiment Report schedule is explicitly disabled behind a security hold rather than weakening scheduler authentication or recipient consent.
- Weekly report HTML escapes the model-generated summary before inserting it into email HTML.
- Local account deletion explicitly includes both SentimentPoll and SentimentVote.
- The current audit-visible dataset has no polls/votes/pricing rows, reducing migration risk for a clean server-authoritative redesign.

## Recommended target architecture

### 1. Make poll creation authoritative

Create a backend `create-sentiment-poll` operation that:

- derives the creator from `auth.me()`
- resolves a canonical TCGDex card server-side
- requires an explicit market source and card variant/price series
- fetches an authoritative price snapshot server-side
- stores currency/unit, source timestamp and pricing reference
- uses server time and an allowed close duration
- creates zero tallies internally
- records a versioned resolution rule
- applies rate/bot/moderation checks
- uses idempotency so retries cannot duplicate a poll

### 2. Treat the market claim as structured data

A prediction should have a rule such as:

- `metric`: market price / average / trend price
- `source`: TCGPlayer or Cardmarket
- `variant`: normal, holofoil, reverse, etc.
- `currency/unit`
- `baseline_price`
- `direction`: above / below / within-band
- `threshold` or target
- `closes_at`
- `rule_version`

The displayed question should be generated from this rule, or free-text commentary must be clearly marked as non-authoritative.

### 3. Make voting one atomic backend operation

`cast-sentiment-vote` should:

- derive voter identity from auth
- load the authoritative poll
- reject closed/resolved/ineligible polls
- enforce one vote per user/poll
- support create/change/remove idempotently
- update/recompute tallies server-side
- never accept caller-supplied voter DID/name/handle
- return the canonical aggregate state

For privacy, ordinary clients should receive aggregate counts and the caller's own current vote, not a public list of named voters unless public voting is an explicit documented choice.

### 4. Introduce explicit poll lifecycle states

Use `open -> closed -> resolving -> resolved` (plus `cancelled` where justified). Closing freezes the vote set and rule. Resolution then writes an immutable evidence snapshot. This removes the current expiry-to-hourly-resolver mutation window.

### 5. Make resolution reproducible

The resolver should store:

- baseline and final price
- source and variant
- currency/unit
- upstream/source timestamps
- percentage movement
- threshold/target and rule version
- resolved timestamp
- resolver version
- outcome and, where useful, evidence hash/reference

Use a direct query for unresolved closed polls with cursor pagination rather than scanning the newest 200 records.

### 6. Integrate moderation and enforcement

Predictions discovery should run through the same account-enforcement and moderation policy as other public community content. Add poll reporting and human-review-compatible moderation. Keep AI moderation advisory.

### 7. Implement decentralised sentiment only if it is genuinely portable

If SentimentPoll/Vote are intended to be AT Protocol records:

- define and publish versioned `org.swappulse.sentimentPoll` / `org.swappulse.sentimentVote` Lexicons
- write them to the user's repository with real PDS provenance
- implement firehose/index mappings and reconciliation
- define vote privacy semantics before federation, because repository records are public
- never use local simulated HMAC/CID fields as proof of network authorship

If individual votes should remain private, federate only the poll definition/aggregate commitment rather than public named vote records.

### 8. Harden the Sentiment Assistant

Give the agent aggregate, purpose-built tools rather than raw public voter rows. Add explicit prompt-injection boundaries, safe Markdown rendering, source timestamps and a minimum sample size before describing a sentiment split as consensus/trending.

## Required release tests

Before release, prove at minimum that:

- A normal voter can vote on another collector's poll and the vote/tally commit atomically.
- Direct clients cannot create more than one active vote for the same poll/user.
- Two concurrent vote requests cannot double-count or lose a vote.
- Switching and removing a vote is idempotent under retries/timeouts.
- Voting at or after server-side expiry is rejected even before the resolver runs.
- Poll creators cannot rewrite baseline, source, variant, expiry, tallies or outcome.
- A malicious client cannot set another collector's DID/name/handle on a poll or vote.
- Unknown/mismatched card IDs and display metadata are rejected/canonicalised.
- TCGPlayer normal/holo/reverse pricing resolves through the intended stored field.
- Cardmarket normal/foil pricing resolves through the intended stored field.
- Baseline and resolution snapshots preserve currency/unit and source timestamps.
- A custom/free-text question cannot change or misrepresent the structured resolution rule.
- Untracked catalogue cards either obtain a trusted baseline or cannot create a resolvable poll.
- Stale pricing beyond the freshness policy is rejected/flagged.
- Resolver pagination eventually processes more than 200 unresolved polls.
- A closed poll has an immutable vote snapshot before resolution.
- Resolution evidence can be recomputed from stored source/rule metadata.
- Moderated/hidden/enforced-user polls do not appear in public Predictions discovery.
- Poll questions can be reported and reviewed through the normal moderation tools.
- Poll/vote burst spam is rate-limited server-side.
- Ordinary users cannot enumerate other collectors' individual voting choices unless that is an explicit public feature.
- Aggregate counts exactly match authoritative active votes after reconciliation.
- The Sentiment Assistant never receives unnecessary voter identity fields.
- Malicious poll/post text cannot cause the Sentiment Assistant to disclose other data or trigger remote Markdown media fetches.
- AI trend language is suppressed below the configured quorum/sample threshold.
- Weekly sentiment email sends only to explicitly eligible/consenting recipients and contains descriptive, non-prescriptive market context.
- If federation is enabled, real PDS records round-trip across another instance and repository DID is the authority.
- If votes remain private, no private vote record is written to a public PDS.
- Personal data export contains both the user's authored polls and votes.
- Account deletion removes/anonymises the intended local prediction data according to policy.
- All nine supported locales cover page, poll card, creation and resolution strings.
- Create Poll passes keyboard/focus/screen-reader dialog tests.
- Public signed-out users are clearly prompted to sign in before mutation.
- Pagination works beyond 50 polls and own-vote state remains correct beyond 200 historical votes.
- Build, lint, typecheck, unit/integration/adversarial tests and scheduled workflow smoke tests pass against the exact release commit.

## External references checked

- AT Protocol Lexicon specification: https://atproto.com/specs/lexicon
- AT Protocol Lexicon guide: https://atproto.com/guides/lexicon
- AT Protocol publishing Lexicons: https://atproto.com/guides/publishing-lexicons
- TCGDex Card / pricing reference: https://tcgdex.dev/reference/card

The TCGDex reference confirms that TCGPlayer pricing is represented per variant (`normal`, `holofoil`, etc.) with low/mid/high/market prices, while Cardmarket exposes flat average/trend values plus foil variants. That is why SwapPulse should not resolve both sources through a single generic `CardPricing.avg` field.

## Release decision

**Do not release Predictions as a trustworthy market-outcome or community-consensus feature while PR-001 through PR-004 remain unresolved.**

The safest remediation order is:

**server-owned poll creation and price snapshot -> atomic one-user/one-poll vote endpoint -> fix TCGPlayer/Cardmarket variant pricing -> immutable close/resolution evidence -> lock poll system fields -> moderation/enforcement/rate limits -> voter privacy minimisation -> Sentiment Assistant prompt/Markdown hardening -> export/data rights -> real AT Lexicons only if public federation is desired -> realtime/pagination/docs/localisation/accessibility -> dedicated concurrency/adversarial tests -> exact-release build and scheduler verification.**
