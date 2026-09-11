# SwapPulse Trade Board Audit

**Audit date:** 11 September 2026  
**Area:** Trade Board, listings, trade threads, matching, watches, templates, trade dashboard/status board, disputes, reputation, trust signals, trade chains, pricing/fairness, AT Protocol federation, cross-posting, notifications and AI Trade Assistant  
**Overall score:** **29/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY**

## Executive summary

SwapPulse already has a broad trading surface: public and scoped TradeListings, threaded negotiation, a status board, personal dashboard, listing templates, wishlist matching, duplicate-card suggestions, fairness estimates, watches, disputes, portable reputation, community vouches, possession-verification badges, trusted-trader filtering, AT Protocol publication, external cross-posting and a read-only AI Trade Assistant.

Several important controls are also correctly designed. `get-visible-trades` centralises most listing visibility decisions; TradeListing realtime events are re-fetched through that server visibility gate before the UI consumes them; AT Protocol federation only permits explicitly public TradeListings; TradeDispute and TradeChain are blocked from public federation; PDS update/delete operations verify local ownership and PDS identity; the possession-sync helper itself requires level-2-or-higher visual possession checks; Achievement mutations are administrator-only; and the deprecated EscrowTrade model is quarantined behind administrator-only RLS.

Those safeguards do not yet make the trading system trustworthy, because the authoritative transaction layer is missing. A TradeListing is still mostly a client-owned social record with user-editable lifecycle and trust fields. There is no server-owned accepted trade agreement that records the two actual counterparties, the exact physical CollectionEntry copies and condition/variant, the agreed terms, participant acceptance, shipping confirmations and receipt confirmations. As a result, the listing owner can self-advance a listing to completed, arbitrary viewers can become de facto “participants” by posting in the thread, feedback attempts to infer the counterparty from chat, and downstream reputation/Achievement/Discord-role systems consume data that can be fabricated by a modified client.

A separate server-side privacy issue is release-blocking: a `circle_scoped` TradeListing is documented and presented as circle-member-only, but the visibility helper allows any viewer when the referenced Circle itself is public. This exposes supposedly scoped listings to non-members.

The audit also found major functional defects: the Watch workflow invokes a non-existent `notifyTradeUpdate` backend function; realtime trade matching compares a listing's wanted cards to the viewer's wishlist instead of comparing its offered cards; current wishlist creation does not populate the DID field used by `wishlist_only` visibility; and the fairness calculator treats USD/EUR `CardPricing` values as pence/GBP while ignoring variant and condition.

Current audit-visible data contained one public open TradeListing and no TradeMessages, disputes, reputation records, TradingFeedback, watches, TradeChains or EscrowTrades. That sparse dataset is not evidence of safety. The findings below are based on current executable trust boundaries and product contracts.

## Scope

This audit covered:

- `/trades` Trade Board
- public, wishlist-only and circle-scoped listing visibility
- listing creation and listing lifecycle
- offered/wanted card selection
- shipping regions, currency, notes and expiry
- possession-verification badges
- Trusted Trader filtering
- `/trade/:tradeId` negotiation threads
- trade messages and realtime updates
- listing status progression, cancellation and completion
- trade watches and status notifications
- disputes and evidence uploads
- trading feedback and portable reputation
- community vouches and trusted-trader proof inputs
- `/trade-dashboard`
- `/trade-board` status Kanban
- `/trade-templates` and template application
- collection-to-trade and duplicate-to-trade entry points
- wishlist matching and Smart Bundles
- pricing and Trade Fairness Calculator
- TradeChain data model and Chain Weaver achievement
- deprecated EscrowTrade model
- AT Protocol TradeListing federation
- public/private federation policy
- external cross-posting
- realtime TradeListing and TradeMessage behaviour
- Discord Verified Trader / Trusted Trader role inputs
- achievements driven by trading records
- read-only AI Trade Assistant
- Terms/Help trading promises
- pagination, accessibility, failure states and release verification

## Method and constraints

The existing Base44 app was inspected directly using its project file, schema and entity APIs. The project-mandated web-agent README URL was requested from the Base44 sandbox first but returned HTTP 403, so the audit continued against the actual application source, entities, workflows, backend functions and audit-visible data.

The Base44 command sandbox currently exposes a separate `/workspace` without the application's `package.json`. Build, lint, typecheck and browser tests therefore could not be rerun against this exact application state from the audit shell. This is an audit-environment limitation, not evidence of a build failure.

No Trade Board functionality was changed during this audit.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Access control and privacy | 6/20 | Central visibility gate is good, but circle-scoped listings have a server-side membership bypass and several service-role paths need stronger ownership binding. |
| Transaction lifecycle and participant integrity | 2/20 | There is no authoritative accepted-trade record or two-party shipping/receipt state. Listing owners self-declare lifecycle transitions. |
| Reputation, verification and trust signals | 2/15 | Possession, reputation, vouches, completion and TradeChain proof inputs contain client-writable trusted fields. |
| Core board/listing workflows | 7/15 | Broad feature coverage, but physical-copy identity, condition, pagination and lifecycle semantics are incomplete. |
| Matching, watches and notifications | 3/10 | Match direction is wrong, wishlist-only visibility is disconnected from current wishlist writes, and the status notification workflow references a missing function. |
| Pricing and fairness | 2/10 | Currency/unit handling is wrong and pricing ignores physical variant/condition. |
| Federation and interoperability | 4/10 | Strong publication policy and bridge ownership checks, but lifecycle reconciliation/cross-post ownership are unsafe. |
| UX, accessibility and release confidence | 3/10 | Useful surfaces exist, but guest gating, pagination, error truth, modal accessibility and exact build verification remain incomplete. |
| **Total** | **29/100** | **High Risk** |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Circle-scoped listing privacy | `get-visible-trades` says circle-scoped listings require confirmed circle membership, but `canViewCircleContent()` returns true for any viewer when the referenced Circle itself has `visibility === 'public'`. A non-member can therefore read a TradeListing labelled “Circle only” if its Circle is public. | Separate “circle is publicly discoverable” from “viewer is a trade-scope member”. For `circle_scoped`, require explicit confirmed membership or curator ownership regardless of Circle visibility. Add signed-out, non-member, former-member and malicious-DID tests. |
| 🔴 P0 | Trade lifecycle authority | There is no server-owned accepted Trade/Agreement record identifying the actual counterparty. The listing owner can directly move `open → pending_ship → completed`; no second party must accept terms, confirm shipping or confirm receipt. Completed TradeListing rows are then consumed by trust/Discord-role logic. | Introduce an authoritative backend TradeAgreement/AcceptedTrade state machine. Freeze agreed participants, exact offered/wanted CollectionEntry IDs, condition/variant and terms; require both-party acceptance; make shipping/receipt transitions participant-specific; derive listing status from agreement state. Client code must not write trusted lifecycle fields directly. |
| 🔴 P0 | Possession verification integrity | `TradeListing.possession_verified` is described as backend-derived, and `syncPossessionVerified()` correctly requires level 2+, but TradeListing owner RLS allows the owner to update every field. A modified client can set `possession_verified: true` directly and receive the same “Verified” badge. | Make possession state backend-only/field-protected. Derive it from owner-bound level-2+ CardVerificationSessions for the exact physical CollectionEntry copies referenced by the trade. Recompute/revoke it whenever the offer changes. |
| 🔴 P0 | Reputation and trading-feedback provenance | `Reputation` and `TradingFeedback` allow client creation with caller-supplied target DID, rater DID, trade reference and rating. The completed listing does not prove the rater was a counterparty. Any viewer of a completed listing can reach the feedback UI, and the owner infers the counterparty from the first non-owner chat message. These records feed portable reputation, achievements and Discord trust roles. | Only a backend trade-finalisation/feedback endpoint may create trading feedback. Derive rater/target/trade from an accepted completed TradeAgreement; permit exactly one rating per participant per agreement; reject self-rating, unrelated trades and duplicate ratings. Treat legacy unverified feedback separately. |
| 🔴 P0 | Trusted Trader / vouch proof integrity | Trusted Trader proof inputs are not authoritative. `Vouch` records allow client-controlled voucher DID/relationship/trade refs, while the achievement engine counts distinct voucher DIDs and TradingFeedback. A malicious client can fabricate proof inputs that later become administrator-issued Achievements and can influence “Trusted only” filtering and Discord roles. | Move vouch creation/revocation to backend operations that derive voucher DID from the authenticated account. For trade_partner/repeat_trader relationships, require completed TradeAgreement evidence. Rebuild Trusted Trader only from verified provenance and migrate/label legacy community-only vouches separately. |
| 🔴 P0 | TradeListing cross-post IDOR | `crossPostDispatcher` service-role loads a caller-supplied `TradeListing` ID to build external cross-post content without proving the listing belongs to the caller or is intentionally public. A user who knows another listing ID can cause its offer metadata to be sent through the attacker's configured external destination. This remains the P0 identified in the backend audit. | Before every service-role TradeListing read, require caller ownership or an explicitly public cross-post-safe projection. Never cross-post wishlist-only/circle-scoped listings for a non-owner. Add foreign/private record tests for every destination. |
| 🔴 P0 | TradeChain credential forgery | TradeChain is presented in Help/Terms as a 3–5-person shipping sequence and drives the `chain_weaver` achievement, but its organiser owns the entire row and can directly set participant DIDs, `shipping_confirmed`, `receipt_confirmed` and `status: completed`. The achievement engine trusts completed chains containing a DID. | Do not accept organiser-written participant confirmations as proof. Create chains through a backend agreement service, require every participant to accept and independently confirm their own shipping/receipt leg, enforce 3–5 unique participants and valid linked trades, and derive completion server-side before issuing Chain Weaver. |
| 🟠 P1 | Trade-message participation | TradeMessage creation does not prove the sender is a participant in an accepted negotiation. `listing_author_id` is caller-supplied and itself grants the listing author read access. A modified client can inject messages into arbitrary trade IDs and target another user as listing author. | Create messages through a backend endpoint that resolves the listing/agreement and derives all participants/author fields. Once a counterparty is accepted, restrict the private negotiation thread to those participants; use a separate public inquiry model if needed. |
| 🟠 P1 | Dispute participant authority | Any signed-in viewer of a `pending_ship` or `completed` listing can open the dispute form. The backend entity create rule verifies only ownership of the new dispute row, not that the filer was a trade participant or that the trade reached the claimed state. | File disputes only against an accepted TradeAgreement and require the caller to be one of its participants. Enforce one active dispute per participant/agreement and validate allowed dispute windows/statuses server-side. |
| 🟠 P1 | Dispute evidence privacy | Trade-dispute photos use generic `UploadFile`, then persistent URLs are stored in the dispute. Evidence may contain addresses, labels, packaging or other sensitive information. The flow does not provide the private-upload/signed-URL guarantees already used by card scanning. | Use private uploads, short-lived signed URLs for authorised moderators/participants, malware/type/size checks and a documented evidence-retention/deletion policy. Never federate dispute evidence. |
| 🟠 P1 | Trade watch notifications | The `Trade Status Notifications` workflow calls backend function `notifyTradeUpdate`, but no such backend function exists in the current function tree. The Watch UI promises notifications on updates/completion that this configured workflow cannot deliver. | Implement and test an authorised `notifyTradeUpdate` function or update the workflow to a supported notification function. Resolve recipients from TradeWatch plus actual participants, honour notification preferences and deduplicate deliveries. |
| 🟠 P1 | Realtime trade matching | `realtime.js` checks `listing.wanted_card_ids` against the current user's wishlist. That alerts when the seller and viewer want the same card, rather than when the listing **offers** a card the viewer wants. | Match viewer wishlist against `offer_card_ids`. If reciprocal matching is desired, separately compare the viewer's owned/tradeable cards with the listing's `wanted_card_ids`. Add directionality tests. |
| 🟠 P1 | Wishlist-only visibility | `get-visible-trades` loads the viewer's wishlists by `{ did: viewer.did }`, but current CardDetail and Explore wishlist creation writes card fields only and does not populate `did`. Newly created local wishlists therefore do not reliably qualify viewers for `wishlist_only` listings. | Bind wishlists by immutable `created_by_id: viewer.id` or create them through a backend operation that stamps the authenticated DID. Backfill existing owner records and test wishlist-only access end to end. |
| 🟠 P1 | Smart Bundle wishlist privacy | `feeds: smart-bundles` service-role reads up to 500 other users' owner-private Wishlist rows and reveals wanted card names/handles to any caller who owns a duplicate. This is an application-level disclosure path even though the central federation policy correctly treats Wishlist as never-federated/private. | Make trade matching an explicit opt-in capability. Return a minimal match token/anonymous candidate unless the wishlist owner has enabled discoverability, and reveal identity/details only after the defined consent/interest step. |
| 🟠 P1 | Smart Bundle identity mapping | Smart Bundles groups matches by `w.author_handle`, but the current Wishlist schema/current create flows do not define/populate `author_handle`. Matches can collapse into an undefined “A collector” bucket and combine unrelated users. | Group by immutable owner ID/DID server-side, then resolve a safe display projection after privacy/opt-in checks. Never use optional display metadata as identity. |
| 🟠 P1 | Fairness calculator currency | `CardPricing.unit` explicitly carries source currency such as USD/EUR. TradeFairnessCalculator ignores `unit`, sums raw source prices and passes them to `formatPrice()`, which divides by 100 and labels the result GBP. A USD/EUR major-unit price can therefore be displayed/calculated as pence/GBP. | Build a pricing-normalisation service with source, currency, major/minor unit semantics, timestamp and FX conversion. Calculate both sides in the listing's chosen currency and display source/as-of data. |
| 🟠 P1 | Fairness calculator completeness | Fairness loads only the latest 200 global CardPricing rows, does not request the exact listing card IDs, and treats a trade as having usable data when only one side has a price. Missing cards can therefore appear as £0 and create a false “significant imbalance”. | Fetch the exact card/variant prices needed for the trade, require adequate coverage on both sides and show “insufficient pricing data” whenever any material item is unpriced. |
| 🟠 P1 | Fairness physical-card semantics | Listings and fairness calculations identify catalogue card IDs only. They do not carry CollectionEntry ID, condition, variant or quantity, even though those characteristics materially change physical-card value. | Bind offers to specific owner CollectionEntry copies and agreed condition/variant/quantity. Price the actual physical variants or explicitly state that the estimate is catalogue-only and cannot assess condition. |
| 🟠 P1 | Listing ownership of offered cards | Trade Board creation lets a user select arbitrary catalogue cards as “You offer” without proving the user owns a matching CollectionEntry. CardDetail “List for Trade” also opens the board without binding the selected owned copy. | Require owned CollectionEntry references for offered physical cards, or clearly support “seeking/available elsewhere” as a distinct listing type. Validate ownership server-side at publication and again at agreement. |
| 🟠 P1 | Collection-to-trade identity loss | Bulk “Move to Trade List” and duplicate flows reduce selected physical CollectionEntries to catalogue ID/name/image. Condition, variant and exact copy identity are lost before listing creation. | Carry CollectionEntry IDs plus condition/variant through the draft and validate them at listing publication. |
| 🟠 P1 | Duplicate-to-trade bypass | Duplicates “List for Trade” directly creates a minimal public TradeListing with no standard visibility/shipping/expiry workflow and no AT bridge/reconciliation path. It bypasses the canonical Trade Board creation flow. | Route every listing source through one backend listing service and shared draft model. Apply the same validation, ownership, visibility, expiry, federation and audit rules regardless of entry point. |
| 🟠 P1 | Federated status drift | TradeThread updates `TradeListing.status` locally for pending/completed but does not update the bridged PDS record. TradeBoard's separate completed action does attempt an update. The same listing can therefore be `pending_ship/completed` locally while remaining `open` on AT Protocol. | Move status transitions to one backend state machine that commits local state and queues/records federation reconciliation. Surface pending federation state and retry until converged. |
| 🟠 P1 | Cancellation orphan risk | On cancellation, `unbridgeRecord()` returns `false` on PDS failure instead of throwing; TradeThread then sets local `bridged:false` and cancels anyway. A public PDS copy can remain orphaned while local metadata says it is no longer bridged. | Do not clear bridge metadata until PDS deletion is confirmed/already absent. Persist a deletion-pending/tombstone state with retry and operator visibility. |
| 🟠 P1 | Scoped-listing federation UX | New-listing creation attempts `bridgeTradeListing()` for `wishlist_only` and `circle_scoped` listings even though the central federation policy intentionally rejects all non-public TradeListings. The UI can report PDS sync failure for a privacy-preserving success. | Only invoke federation for public listings. Treat scoped listings as deliberately local/private and show accurate privacy status. |
| 🟠 P1 | Trade dashboard scoped watches | TradeDashboard resolves watched IDs with direct `TradeListing.filter`. Entity RLS reads only public/owner/admin rows, while authorised wishlist/circle access exists only through `get-visible-trades`. A user can validly watch a scoped listing and later have it disappear from the dashboard. | Resolve dashboard/watch listings through the same server visibility service as the thread and board. |
| 🟠 P1 | Trade status board trust | Status-board columns display owner-declared `pending_ship`/`completed` states as authoritative even though there is no counterparty agreement or receipt confirmation. | Drive Kanban status from the backend TradeAgreement state machine and show per-party confirmation state rather than a single owner-controlled label. |
| 🟠 P1 | Portable reputation scope | `get-portable-reputation` claims to merge cross-PDS/instance tradingFeedback but lists at most 100 records from one shared PDS session/repository rather than resolving the target/rater repositories across the network. The portability claim is stronger than the implementation. | Resolve AT records from their actual repositories/indexed AppView with cursor pagination and signature/provenance validation. Distinguish local legacy feedback from verified federated feedback. |
| 🟠 P1 | Discord trading roles | Discord “Verified Trader” and “Trusted Trader” roles are derived from completed TradeListings, Reputation and Achievements. Because completion and ratings are currently user-forgeable, Discord roles can inherit forged trust. | Suspend automated trading-trust role grants until the underlying TradeAgreement/feedback provenance is authoritative. Recalculate roles after remediation and revoke unsupported legacy grants. |
| 🟠 P1 | First-trade / Trusted Trader achievements | Achievement proofs count TradingFeedback as completed-trade evidence and use Vouch/TradingFeedback for Trusted Trader. Those source records are client-writable, so the admin-issued credential does not make the proof trustworthy. | Rebuild achievement proof inputs from immutable backend TradeAgreement completion and participant-bound feedback/vouches. Version the proof model and re-evaluate existing credentials. |
| 🟠 P1 | Trade Assistant price semantics | The Trade Assistant is correctly read-only, but its instructions tell it to use the same raw CardPricing trend/avg hierarchy as the faulty fairness calculator without requiring currency, variant, condition or freshness normalisation. It can therefore produce confidently wrong balance advice. | Give the agent a safe pricing projection/tool that already normalises currency/variant/freshness. Instruct it to refuse a fairness percentage when price coverage is incomplete. |
| 🟠 P1 | Public-route write gating | `/trades`, `/trade-board` and `/trade/:tradeId` are public routes, but create/watch/message/dispute controls can be reached by signed-out visitors and then fail only when the underlying authenticated operation runs. | Gate write actions by authentication, show a sign-in CTA and preserve the intended return path. Keep public read access separate from authenticated participation. |
| 🟠 P1 | Listing pagination | TradeBoard asks for only 50 visible open listings and has no cursor/load-more. TradeStatusBoard asks for 100. TradeDashboard loads at most 100 own listings/watches. Older but active listings silently disappear from these surfaces. | Add stable server-side cursor pagination and consistent filters to board, status board and dashboard. |
| 🟡 P2 | Negotiating state | TradeListing includes `negotiating`, but the current TradeThread owner action maps both `open` and `negotiating` directly to `pending_ship`; no normal UI transition sets a listing to `negotiating`. | Derive negotiating from an accepted negotiation/proposal or remove the dead state. |
| 🟡 P2 | Expiry lifecycle | Expired listings are hidden by read paths, but no inspected path changes their status from `open` to an explicit expired/closed state. Owner dashboards, federation records and analytics can retain stale “open” state. | Add an explicit expired state or scheduled server closure/reconciliation and update public federation accordingly. |
| 🟡 P2 | Visibility scan cap | `get-visible-trades` reads at most 500 candidate rows then filters visibility in memory. In a busy network, authorised wishlist/circle listings can be starved behind newer rows the viewer cannot see. | Use queryable visibility indexes/materialised membership projections plus cursor pagination instead of scanning a fixed candidate window. |
| 🟡 P2 | Wishlist realtime cap | Realtime matching loads only the latest 200 wishlist rows. Larger wishlists silently stop matching older cards. | Page/cache the complete wishlist or use a backend match service keyed by card IDs. |
| 🟡 P2 | Trade templates “Use” | The dedicated TradeTemplates page navigates to `/trades` with only `draftOffers`; wanted cards, regions, currency, visibility and notes from the saved template are discarded. The in-board template loader applies more fields, so behaviour is inconsistent. | Pass a template ID/full validated draft into the Trade Board and hydrate every supported field through one code path. |
| 🟡 P2 | Circle-scoped templates | TradeTemplate supports `visibility: circle_scoped` but has no `circle_ref`. A saved template cannot identify which Circle the scope belongs to. | Add a validated Circle reference to scoped templates or require the user to select a Circle explicitly when applying the template. |
| 🟡 P2 | TradeChain discoverability | Help and Terms present multi-party Trade Chains as an available trading feature, but source search found no current TradeChain UI or participant workflow. The underlying entity/achievement remains active. | Either implement the secure participant-signed chain workflow or mark/remove the feature from Help/Terms and disable its credential proof until ready. |
| 🟡 P2 | Terms condition contract | Terms say listing owners self-report card conditions, but TradeListing has no structured condition/variant fields and listing creation selects catalogue cards rather than physical copies. | Align the legal/product copy with the real model, or add structured physical-card condition/variant with explicit confirmation. |
| 🟡 P2 | Trade message history | TradeThread loads at most 200 messages and has no history pagination. Long negotiations lose older context in UI and in AI/adjudication workflows that depend on the visible thread. | Add cursor pagination and an authoritative agreement summary independent of chat history. |
| 🟡 P2 | Public listing expiry input | Listing expiry is free datetime input with client-side max of 90 days. A modified client/entity write can bypass this constraint. | Validate expiry, regions, currency, visibility and maximum card counts server-side in the listing-create/update service. |
| 🟡 P2 | Listing metadata authority | Author display fields, DID, AT URI/CID/bridge flags and other federation metadata live on a broadly owner-updatable entity. Even where the bridge validates PDS operations, local UI/queries can consume tampered metadata. | Protect backend-derived identity/federation fields at schema level and update them only through trusted functions. |
| 🟡 P2 | Manual modal accessibility | New Trade Listing and template editor use hand-built fixed overlays rather than the shared accessible Dialog primitive. Focus trapping/restoration, Escape behaviour and dialog semantics are inconsistent. | Migrate trade overlays to the shared accessible Dialog/Sheet primitives and keyboard/screen-reader test them. |
| 🟡 P2 | Native alerts/confirms | Trade flows still rely on `alert()`/`confirm()` for errors, delete confirmation, vouch revocation and some status failures. | Use application Dialog/AlertDialog/toasts with focus restoration and actionable retry states. |
| 🟡 P2 | CardDetail trade hand-off | CardDetail's “List for Trade” link sends the user to `/trades` without preselecting that card or the user's matching CollectionEntry, even when an owned copy is known. | Carry the selected owned copy into the listing draft, preserving condition/variant. |
| 🟡 P2 | Trust-profile portability limits | `getTrustProfile` lists only 100 remote Vouch records from one shared PDS repository. Large or personal-PDS trust graphs are not fully represented despite “portable and verifiable across instances” wording. | Use the canonical federated index/personal repositories with cursor pagination and provenance validation. |
| 🟢 P3 | Wishlist schema drift | Wishlist schema still says records are mirrored to AT Protocol and owner-only through an AppView, while central `federationPolicy.ts` correctly places Wishlist in `NEVER_FEDERATE`. | Update schema/comments/help to match the private local wishlist architecture. |
| 🟢 P3 | TradeDispute / TradeChain schema drift | TradeDispute and TradeChain descriptions/client bridge helpers still describe or attempt PDS mirroring, while central policy correctly blocks both from federation. | Remove stale bridge attempts/descriptions and document them as private application records. |
| 🟢 P3 | Help cross-post wording | Help says “posts, trades, and follows are automatically mirrored to your PDS”. Scoped TradeListings are intentionally not eligible for public federation, so the statement is too broad. | Clarify that only explicitly public TradeListings federate; wishlist/circle-scoped listings remain private/local. |
| 🟢 P3 | Deprecated escrow | **Completed:** EscrowTrade is explicitly marked deprecated/quarantined and all RLS operations are administrator-only; no audit-visible EscrowTrade rows were present. | **Completed:** keep it inaccessible to ordinary clients and remove residual product references unless a new audited escrow design is introduced. |
| 🟢 P3 | Trade Assistant write authority | **Completed:** the Trade Assistant configuration is read-only for TradeListing, TradeMessage, CardPricing, CollectionEntry and AgentInsight, and explicitly forbids listing/message/payment/blockchain mutation. | **Completed:** preserve read-only tool permissions and keep user confirmation outside the agent for all state changes. |
| 🟢 P3 | Audit build verification | Build/lint/type/browser tests could not be rerun from the Base44 audit shell because the mounted `/workspace` does not expose the app package root. | Run release gates against the canonical deployment commit in CI/a correctly mounted checkout and attach immutable evidence to the remediation retest. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Public Trade Board | Strong concept, unsafe trust layer | Server visibility and expiry filtering exist, but transaction state and trust badges are not authoritative. |
| Public listings | Works as discovery | Needs physical CollectionEntry binding and backend creation/update service. |
| Wishlist-only listings | Broken/inconsistent | Current wishlist creation does not populate the DID selector used by visibility checks. |
| Circle-only listings | Release blocker | Non-members can see scoped listings when Circle visibility is public. |
| Listing creation | Functional UI, weak authority | Browser writes listing/trust/federation fields directly and offers arbitrary catalogue cards. |
| Negotiation threads | Functional chat, no participant contract | Any viewer can message; accepted counterparty is never recorded. |
| Trade completion | Unsafe | Owner self-declares completion without second-party receipt/acceptance. |
| Trade Status Board | Useful visualisation | Displays non-authoritative owner-declared lifecycle states. |
| Trade Dashboard | Useful summary | Fixed caps and scoped-watch reads are inconsistent with server visibility. |
| Watches | Broken notification path | Workflow calls missing `notifyTradeUpdate`. |
| Realtime match alerts | Incorrect direction | Compares listing wants to viewer wishlist instead of offers to wishlist. |
| Smart Bundles | Promising but privacy-sensitive | Reads private wishlists service-side without an explicit discoverability/consent model. |
| Trade Templates | Useful | Dedicated “Use” loses most template fields; circle scope lacks Circle reference. |
| Fairness Calculator | Not trustworthy enough for decisions | Currency/unit conversion is wrong and variant/condition/coverage are ignored. |
| Possession Verified badge | Backend helper is strong, field boundary is weak | Level 2+ logic exists but listing owner can set the result directly. |
| Trusted-only filtering | Not trustworthy yet | Achievement itself is admin-issued, but its Vouch/feedback proof inputs are forgeable. |
| Trading feedback | Unsafe | No authoritative counterparty/trade relationship. |
| Portable reputation | Incomplete/untrusted | Source provenance is weak and remote fetch is not truly cross-PDS. |
| Vouches | Community feature with trust-risk | Direct client provenance feeds credential logic. |
| Disputes | Useful moderation concept | Any viewer can file against a completed/pending listing; evidence storage should be private. |
| Trade Chains | Advertised but not securely implemented | No current UI; organiser controls all confirmations/completion and can influence Chain Weaver. |
| Escrow | Correctly disabled | Deprecated/quarantined admin-only model. |
| AT Protocol public TradeListing federation | Good foundation | Public-only policy and PDS ownership checks are strong; status reconciliation still needs hardening. |
| Scoped TradeListing federation | Correct privacy policy | Backend rejects non-public federation; frontend should stop treating this as an error. |
| External cross-posting | Unsafe ownership check | Foreign/private listing ID can be service-role resolved by caller-supplied contentId. |
| Trade Assistant | Safely read-only | Needs corrected pricing projection before fairness guidance is reliable. |

## Verified strengths to preserve

- `get-visible-trades` is the right architectural direction: server-side visibility with expiry filtering rather than trusting frontend filtering alone.
- TradeListing realtime events are treated as invalidation and re-fetched through `get-visible-trades` before emission to UI listeners.
- Central federation policy permits TradeListing publication only when `visibility === 'public'`.
- Central federation policy blocks Wishlist, TradeChain and TradeDispute from public AT repositories.
- AT Protocol update/delete verifies a matching local owned record and enforces PDS-repository identity.
- `syncPossessionVerified()` scopes verification sessions by `created_by_id` and requires verification level 2+ before it sets the possession flag.
- Achievement entity mutation is administrator-only.
- EscrowTrade is quarantined and administrator-only rather than pretending a non-existent escrow service protects users.
- Dispute UI clearly tells collectors that SwapPulse cannot recover money or cards and recommends proof/tracked shipping.
- Trade Assistant is read-only and its instructions explicitly prohibit mutation of TradeListing, TradeMessage, payment and blockchain state.
- Trade Assistant hides raw tool payloads and treats listings/messages/notes as untrusted data rather than instructions.
- Terms correctly state that SwapPulse is a facilitator, not an escrow/broker, and does not guarantee card condition/authenticity/delivery.

## Remediation order

### Phase 0 - release blockers

1. Create an authoritative `TradeAgreement` / accepted-trade backend state machine.
2. Fix `circle_scoped` membership so public Circle discoverability never grants trade-scope access.
3. Make `possession_verified`, status, participant IDs and federation identity fields backend-only.
4. Replace client-created Reputation/TradingFeedback with participant-bound backend feedback after real completion.
5. Rebuild Vouch/Trusted Trader proofs on authenticated provenance and completed-trade evidence where claimed.
6. Fix TradeListing cross-post source ownership/visibility.
7. Disable/rebuild TradeChain proof issuance until participant-signed shipping/receipt completion exists.
8. Recalculate/revoke trading Achievements and Discord trading roles that cannot be proven under the new model.

### Phase 1 - matching, pricing and privacy

1. Fix wishlist-only ownership lookup and backfill owner identity.
2. Correct realtime match direction and move matching to a backend service.
3. Make Smart Bundle identity disclosure explicitly opt-in.
4. Implement the missing TradeWatch status-notification backend path.
5. Replace fairness calculations with exact-card, variant/condition-aware, currency-normalised pricing.
6. Use private dispute evidence storage and participant-authorised access.

### Phase 2 - federation and workflow consistency

1. Route every TradeListing creation/update/cancel/completion through one backend service.
2. Add durable PDS reconciliation/tombstones for status changes and cancellations.
3. Never attempt federation for non-public listings.
4. Make Collection/Duplicates/CardDetail/Template entry points produce the same validated listing draft.
5. Add pagination to board, status board, dashboard, messages, wishes and remote reputation/trust records.
6. Either implement secure TradeChain UI or remove its availability claims and achievement until ready.

### Phase 3 - UX and release confidence

1. Add authenticated action gating to public trade routes.
2. Migrate trade modals to accessible Dialog/Sheet components.
3. Replace native alert/confirm flows with consistent retryable UI.
4. Align Terms/Help/schema comments with actual condition, privacy and federation semantics.
5. Run adversarial multi-account browser/API tests and CI release gates against the exact deployment commit.

## Required regression tests

At minimum, the release suite should prove:

- a non-member cannot view a `circle_scoped` listing even when the Circle is public/discoverable
- former/revoked Circle members immediately lose scoped listing access
- only public listings can be read by guests
- wishlist-only access is based on the authenticated viewer's owner-bound wishlist, never a caller-supplied DID
- a listing owner cannot set `possession_verified` directly
- possession verification is revoked/recomputed when an offered physical card changes
- an offered card must belong to the listing owner at publication/agreement time
- two parties must explicitly accept the same immutable trade terms before shipping state begins
- one participant cannot confirm the other participant's shipping or receipt
- a listing owner cannot unilaterally manufacture a completed trade
- only accepted participants can use the private negotiation thread after agreement
- arbitrary `listing_author_id` values cannot inject/read private trade messages
- only accepted participants can file a dispute
- dispute evidence is private and accessible only through authorised short-lived URLs
- only accepted completed participants can submit feedback
- feedback target/rater/trade IDs are derived server-side and cannot be spoofed
- duplicate/self/unrelated ratings are rejected
- fabricated Vouch/TradingFeedback/TradeListing records cannot earn Trusted Trader, First Trade, Verified Trader or Trusted Trader Discord roles
- TradeChain requires 3–5 unique accepted participants and per-user shipping/receipt confirmations
- fabricated TradeChain completion cannot earn Chain Weaver
- foreign/private TradeListing IDs are rejected by cross-posting
- Watch creates exactly one notification per authorised watcher/participant when status changes
- realtime matching compares listing offers against viewer wants and does not alert on same-direction wants
- Smart Bundle discovery does not reveal private wishlist identity/details without opt-in
- fairness refuses incomplete price coverage
- fairness converts all prices to the selected listing currency with source/as-of metadata
- fairness prices the agreed variant/condition or clearly labels a catalogue-only estimate
- public PDS listing status converges with local state after every update
- cancellation keeps retrying/tombstones PDS deletion until confirmed and never falsely clears bridge metadata
- non-public listings never attempt PDS publication
- templates restore offers, wants, regions, currency, visibility, notes and Circle scope consistently
- active listings/messages beyond current 50/100/200 caps remain reachable through pagination
- expired listings leave open discovery/federation state deterministically
- Trade Assistant remains read-only and cannot bypass normal user confirmation
- Trade Assistant refuses quantitative fairness advice when its pricing projection is incomplete/stale

## Release decision

**The Trade Board should not be treated as production-release ready while any unresolved P0 remains.**

The highest-value change is not another trade feature. It is an authoritative accepted-trade model. Once counterparties, physical copies, agreed terms and participant-specific shipping/receipt confirmations are server-owned, the rest of the system can safely derive completion, possession badges, disputes, reputation, achievements, trusted-trader filtering, Discord roles, notifications and federation from facts rather than client-declared state.
