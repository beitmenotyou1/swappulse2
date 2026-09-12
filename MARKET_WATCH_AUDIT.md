# SwapPulse Market Watch Audit

**Audit date:** 12 September 2026  
**Scope:** Market Watch dashboard, pricing ingestion, market movers, portfolio summary, price alerts, realtime alerts, scheduled alerts, card-detail pricing, price-history surfaces, external market enrichment, Market Watch Assistant, notification integration, privacy, scalability, documentation and release verification  
**Overall score:** **24/100**  
**Risk:** **High**  
**Release status:** **NOT RELEASE READY**  
**Status:** Complete with critical residual actions

## Executive summary

SwapPulse already has a substantial market-data foundation. It integrates TCGDex as the canonical card catalogue and price source, stores normalized `CardPricing` rows, runs a scheduled pricing refresh, exposes price alerts, calculates market movers, shows a collection portfolio summary, surfaces card-level market data from TCGDex, and has optional PokéWallet, PokemonPriceTracker and direct TCGplayer enrichment. The external-provider layer contains several controls worth preserving: API credentials remain server-side, provider caches are admin-only, canonical TCGDex card identity is retained, ambiguous provider mappings fail closed, PokéWallet and TCGplayer have explicit soft-budget controls, PokemonPriceTracker public-use licensing is fail-closed, and TCGplayer use is gated on an explicit approved-use configuration.

The feature is nevertheless not release ready because its core price semantics are wrong in multiple user-facing paths. TCGDex returns Cardmarket prices in EUR and TCGplayer prices in USD as major-unit decimal values. Market Watch divides those values by 100 before display, making prices roughly 100 times too small. Scheduled and realtime price alerts then compare those raw USD/EUR major-unit values directly with alert thresholds stored as GBP pence, so alerts can trigger when they should not or fail when they should trigger. Card Detail has the opposite-looking but related problem: it multiplies a source-currency amount by 100 and then formats it as GBP without any exchange-rate conversion.

TCGDex's current documentation independently confirms the expected semantics: Cardmarket uses EUR, TCGplayer uses USD, values such as `0.08` and `25.09` are decimal marketplace prices, and Cardmarket `trend` is a trend **price**, not a percentage. The current SwapPulse dashboard therefore misinterprets both amount scale and, in one fallback path, the meaning of `trend`.

The alert architecture is also fragmented. Market Watch creates `SavedSearch` alerts, the realtime manager watches `Wishlist.max_price`, and the scheduled alert workflow scans both `SavedSearch` and open trades. Those paths use different identifiers, data limits, delivery mechanisms and preference enforcement. The scheduled path bypasses the central notification dispatcher, while the realtime browser path attempts to call the admin-only `notify-system-event` function and therefore cannot persist/deliver a normal user's realtime price alert even though a local toast can still appear.

The product also overstates several capabilities. The Market Watch page labels the latest 60 global pricing rows as “Tracked Prices” even though no Market Watch watchlist exists. Help documentation promises add/remove tracking, price-history charts, rise-above and fall-below alerts, period-based market movers and a portfolio updated from current market prices, but those capabilities are not implemented as described. The Market Watch Assistant says it monitors listings and can trigger alerts even though its tool configuration is read-only and cannot access TradeListing or write alert records.

Current audit-visible entity queries returned no `CardPricing` or `SavedSearch` rows. This is not treated as proof that production has no pricing/alerts; it means this audit cannot assert a live exposure or working-data count. The findings below distinguish code-confirmed defects from live-data evidence.

No Market Watch functionality was changed during this audit.

## Method and constraints

The existing Base44 app was inspected directly through its project file/entity APIs. The project-mandated Base44 web-agent README URL was requested first from the Base44 sandbox and returned HTTP 403, so the audit continued against the existing app source, schemas, backend functions, workflows, agents and audit-visible entity data.

TCGDex's current public market-pricing documentation was also checked to verify source currencies and field semantics. It confirms that Cardmarket prices are EUR, TCGplayer prices are USD, and Cardmarket `trend` is a monetary trend price rather than a percent change.

The Base44 command sandbox again exposed `/workspace` without the application's `package.json`; therefore a current `npm run build` could not be executed from that sandbox. This is an audit-environment limitation rather than evidence that the product build itself fails.

## Score breakdown

| Area | Score | Notes |
| --- | ---: | --- |
| Price correctness and currency handling | 2/20 | Core dashboard, alert comparison and card-detail formatting disagree on units/currencies. |
| Alert integrity and notification delivery | 3/20 | Multiple alert models, wrong comparisons, preference bypass and failed realtime persistence. |
| Pricing coverage, history and freshness | 4/15 | Scheduled ingestion exists, but fixed windows/starvation, no durable price history and weak freshness presentation remain. |
| Watchlist and portfolio behaviour | 4/15 | Portfolio is capped/stale and “Tracked Prices” is not a user watchlist. |
| External market APIs and secret handling | 7/10 | Strong server-side keys, caching and licensing controls; anonymous quota exhaustion remains. |
| Market Watch Assistant | 2/10 | Read-only tools are good, but price conversion, capability claims, advice framing and inherited Markdown/prompt-injection issues remain. |
| UX, accessibility and release confidence | 2/10 | Public/auth state is inconsistent, alert UX diverges, docs overclaim and dedicated regression coverage was not found. |
| **Total** | **24/100** | **High Risk** |

## Findings

| Priority | Area | Finding | Required action |
| --- | --- | --- | --- |
| 🔴 P0 | Market price display | `MarketWatch.jsx` treats `CardPricing` values as minor currency units and renders `(m.price / 100).toFixed(2)`. `syncPricing` stores TCGDex decimal marketplace values directly, for example Cardmarket EUR `0.08` or TCGplayer USD `25.09`. The dashboard therefore displays materially wrong prices, typically about 100× too small. | Introduce one canonical pricing representation. Store/source major-unit amount plus ISO currency and, where a GBP display is required, convert through an explicit FX service before formatting. Never divide TCGDex values by 100 unless the stored value is explicitly a minor-unit integer. Add known-value regression tests for USD/EUR examples. |
| 🔴 P0 | Price-alert comparison | `SavedSearch.max_price` and `Wishlist.max_price` are defined/stored as pence, but both `checkWishlistAlerts` and realtime `checkPriceAlert` compare those integers directly with `CardPricing.low/avg`, which are major-unit USD/EUR values. The comparison also ignores FX. Price alerts can therefore be false positives or false negatives by orders of magnitude. | Make alert thresholds carry an explicit currency and minor/major-unit contract. Normalize source quotes and thresholds to the same currency/scale before evaluation. Persist the source quote, FX rate/as-of time and normalized comparison amount used for every trigger. |
| 🔴 P0 | Card-detail market price | Card Detail takes a raw TCGDex source amount, multiplies by 100 and passes it to `formatPrice`, which always formats GBP. A USD/EUR amount can therefore be presented as the same numeric amount in pounds without currency conversion. The primary card price can misstate both currency and value. | Replace `formatPrice` use on source-market quotes with a currency-aware formatter. Either display the source currency exactly or perform a documented FX conversion with source/as-of metadata. Keep collection pence formatting separate from market-quote formatting. |
| 🔴 P0 | Market Watch Assistant output boundary | **Inherited from the LLM/Agent audit:** `market_watch` is among specialist agents lacking the full explicit untrusted-data/prompt-injection boundary used by stronger agents, while its UI renders model output through unrestricted `ReactMarkdown`. The project-wide audit classified this as a P0 Markdown/external-fetch exfiltration class and that priority must be preserved here. | Add the shared indirect-prompt-injection policy to the Market Watch agent, field-minimise tool results, disable remote images/raw external media in Markdown and route generated external links through the safe confirmation layer. Add adversarial market-agent tests. |
| 🟠 P1 | Manual price refresh | The visible “Sync now” button invokes `syncPricing`, but `syncPricing` requires an authenticated admin. Normal collectors and guests therefore cannot perform the advertised refresh, and `MarketWatch.runSync()` silently catches the failure. | Remove the user-facing manual sync action or replace it with a safe read/revalidation endpoint that cannot trigger unrestricted global synchronization. Surface last successful sync and errors instead of silently failing. |
| 🟠 P1 | Pricing-sync fairness | `syncPricing` only reads the latest 500 CollectionEntry rows, 500 Wishlist rows and 200 open TradeListing rows globally, then processes only the first 80 distinct card IDs. Because each run starts from the same deterministic windows/order, cards outside those windows can starve indefinitely despite the comment that later runs will “mop up” the remainder. | Use durable cursors/work queues and per-card `last_priced_at` scheduling. Paginate source entities to exhaustion or maintain a dedicated tracked-card index, then fairly rotate stale/unpriced cards across runs. |
| 🟠 P1 | Tracked-prices truth | Market Watch labels `CardPricing.list('-updated_date', 60)` as “Tracked Prices”. Those are the latest global pricing rows, not cards selected/tracked by the current user. No Market Watch watchlist entity or add/remove tracking flow was found. | Create an owner-scoped MarketWatchItem/PriceWatch entity keyed by canonical card ID, or rename the section to accurately describe global recent pricing. Documentation and UI must use the same model. |
| 🟠 P1 | Portfolio valuation source | Market Watch calculates portfolio value from `CollectionEntry.market_value || purchase_price`. `syncPricing` updates `CardPricing`, not `CollectionEntry.market_value`, so the Market Watch portfolio does not actually update from the pricing sync advertised by the product. | Provide one server-side valuation service joining owned CollectionEntry records to current normalized pricing by card/variant/condition, with currency and freshness. Keep cost basis separate from estimated market value. |
| 🟠 P1 | Portfolio completeness | Market Watch loads only the latest 200 CollectionEntry records and presents their sum/count as “Your Portfolio”. Collectors with more than 200 cards receive an incomplete total and count without warning. | Use server-side aggregates over the complete owner collection and cursor-paginate item detail. Never label a capped subset as a total portfolio. |
| 🟠 P1 | Price history durability | `syncPricing` updates one `CardPricing` row per card/source in place. It does not append snapshots, so SwapPulse has no durable Base44 time series from which to reconstruct historical prices. | Add immutable `PriceSnapshot` records or time-series storage keyed by canonical card ID, source, variant, currency and provider timestamp. Define retention/rollups and expose query windows for charts. |
| 🟠 P1 | Provider freshness provenance | TCGDex supplies per-source `updated` timestamps, but `syncPricing` discards them. `CardPricing` has no provider `fetched_at`/`source_updated_at` field, so the UI cannot distinguish a recently synced stale provider quote from a genuinely recent market quote. | Persist provider update time, fetch time, source and currency on every quote/snapshot. Show an “as of” timestamp and stale state in Market Watch and agents. |
| 🟠 P1 | Market-mover fallback | When avg30/avg7 are unavailable, Market Watch uses `Math.round(p.trend)` as the percentage change. TCGDex defines Cardmarket `trend` as a monetary trend price, not a percent movement. A €12 trend price can therefore render as “12%”. | Never use a price field as a percentage. Derive percentage change only from comparable historical values such as avg7 vs avg30, or mark change unavailable. |
| 🟠 P1 | Empty-threshold alerts | `PriceAlertModal` tells the user that leaving target price blank will notify only when an open trade lists the card. `checkWishlistAlerts` instead makes `priceMatch` true whenever `max_price == null` and any matching pricing row exists. Such alerts can fire merely because a price exists even when no trade is listed. | Separate trade-availability watches from price-threshold alerts. If no price threshold exists, do not treat a pricing row as a price match. Add exact tests for blank-threshold behaviour. |
| 🟠 P1 | Threshold direction | Help documentation promises “rises above” and “falls below” conditions, but SavedSearch has no direction field and the backend only checks price `<= max`. The documented rise-above alert cannot be created or evaluated. | Add explicit direction/operator (`below`, `above`) plus threshold currency/value, and evaluate state transitions server-side. Update UI/docs together. |
| 🟠 P1 | Threshold crossing semantics | Alerts are not based on a crossing event. Once the condition is true, `checkWishlistAlerts` can trigger it again every 24 hours while the price remains on the same side of the threshold. | Persist the last evaluated state/quote and notify only on false→true crossing unless the user explicitly chooses recurring reminders. Make cooldown a user-visible secondary control, not the condition itself. |
| 🟠 P1 | Alert card identity | `SavedSearch` has no canonical `card_id`. Market Watch alerts created from `/market` normally contain only a free-text `card_name` and blank set code. The scheduled matcher compares lowercased names and can match the wrong printing/set/source. | Store immutable canonical card ID and selected source/variant on every price watch. Resolve free text through a card picker before creation and evaluate by ID, not display name. |
| 🟠 P1 | Alert filters ignored | SavedSearch contains `rarity`, `condition`, `variant` and `shipping_regions`, but `checkWishlistAlerts` ignores those fields when matching pricing/trades. Users can believe an alert is scoped more narrowly than the evaluator actually enforces. | Either remove unsupported fields from this alert model or enforce every selected dimension against canonical price/trade projections. |
| 🟠 P1 | Notification preference bypass | Scheduled price alerts send email/web push directly from `checkWishlistAlerts`. They do not use `notificationDispatcher`, so Settings event-type toggles, push-channel selection, quiet hours, daily push limits and `NotificationPreference.paused` are not centrally enforced. | Route all alert delivery through the same notification preference/dispatcher service. Treat email consent/channel preferences separately and enforce them server-side before every delivery. |
| 🟠 P1 | Notification-channel divergence | The scheduled alert function uses a legacy single `User.push_subscription`, creates no in-app `Notification`, and ignores current multi-device `PushToken` records. This conflicts with the unified notification architecture and the UI promise that price alerts appear in Notifications. | Create one server-side price-alert event, then let the central dispatcher create the in-app record and deliver to all active PushTokens/email channels according to preferences. |
| 🟠 P1 | Failed-delivery cooldown | `checkWishlistAlerts` records `last_triggered_at` and starts the 24-hour suppression window even when every requested push/email delivery fails. A transient failure can suppress the user's next valid alert for a day. | Mark an alert triggered only after the authoritative notification event is accepted/durably queued. Track per-channel delivery status and retry failures without duplicating successful channels. |
| 🟠 P1 | Scheduled-alert scale | The hourly workflow scans at most 500 SavedSearch rows, 500 CardPricing rows and 200 open TradeListings. There is no cursor loop, so older alerts/prices/listings can be permanently excluded from evaluation. | Paginate to completion or maintain indexed per-watch evaluation queues. Record scan cursors/coverage metrics and alert when backlog age exceeds the promised SLA. |
| 🟠 P1 | Alert-service abuse | SavedSearch creation is directly available to the owner entity API. UI bot protection is only a client wrapper and can be bypassed by a modified client. A user can create enough new SavedSearch records to occupy the global newest-500 scan window and starve other users' older alerts. | Move price-watch creation through a backend endpoint with per-user uniqueness, count/rate limits and canonical card validation. Change evaluation to fair owner/card queues so one account cannot monopolise global capacity. |
| 🟠 P1 | Restricted trade alert privacy | `checkWishlistAlerts` service-role reads all `TradeListing` rows with `status:'open'` and does not use the `get-visible-trades` visibility gate. Wishlist-only or circle-scoped listings can therefore influence an alert for a user who is not authorised to see that listing, leaking restricted-listing existence/activity. | Evaluate trade availability through the same visibility-authorised projection used by Trade Board. Never use unrestricted service-role trade rows to generate recipient-facing alerts. |
| 🟠 P1 | Realtime alert persistence | Browser realtime calls `notify-system-event` to persist/send a price alert, but that backend is admin-only. A normal user can receive the local `market.price_alert` toast while the server call fails and no durable Notification/push is created. | Move realtime threshold evaluation and notification creation server-side, or expose a narrowly scoped self-notification endpoint that derives recipient/condition from authoritative data and cannot notify arbitrary users. |
| 🟠 P1 | Dual alert models | Scheduled Market Watch alerts use `SavedSearch`; realtime price alerts use `Wishlist.max_price`. Creating an alert in Market Watch does not populate Wishlist and setting a wishlist budget does not create SavedSearch. The two systems can therefore disagree about which cards are watched and when they notify. | Consolidate on one authoritative PriceWatch model and have wishlist integration reference it explicitly. Retire duplicate alert state. |
| 🟠 P1 | Realtime create events | While connected, `realtime.js` runs price-alert evaluation only for CardPricing `update` events, not newly created CardPricing rows. A newly priced card can miss realtime evaluation until reconnect/catch-up or a later update. | Treat create/update as invalidation and evaluate the authoritative PriceWatch server-side for both. |
| 🟠 P1 | Realtime watchlist scale | `realtime.js` loads only 200 Wishlist rows. Wishlist entries beyond that window are not considered for realtime price alerts. | Paginate owner wishlist/watch state or, preferably, remove browser-side alert authority and evaluate indexed watches server-side. |
| 🟠 P1 | Realtime TCGplayer coverage | Realtime price alert evaluation only reads `pricing.low ?? pricing.avg`. TCGplayer `CardPricing` rows populated by `syncPricing` primarily use `normal_market`, `normal_low`, `holofoil_market`, etc., so those rows may never satisfy realtime alert evaluation. | Normalize provider quotes into one comparable field per selected variant before alert evaluation. Do not make alert logic provider-shape dependent. |
| 🟠 P1 | Stale-price presentation | Market Watch shows no provider/fetch timestamp or stale warning. A `CardPricing` row can be old but is presented as current “Tracked Prices” and used in movers. | Add provider update/fetch timestamps, stale thresholds by provider and prominent stale/unknown states. Exclude stale records from movers/alerts or require explicit fallback labelling. |
| 🟠 P1 | Multi-source duplication | CardPricing stores separate TCGplayer and Cardmarket rows for the same card, but Market Watch treats each row as an independent tracked/mover item. The same card can appear twice with incomparable USD/EUR values and different field shapes. | Build a card-level market projection that keeps sources distinct but groups them under one canonical card. Let the user choose source/region/variant rather than mixing source rows as separate “cards”. |
| 🟠 P1 | Card-detail primary source selection | `CardDetail.jsx` chooses `card.pricing.tcgplayer || card.pricing.cardmarket`, then only reads `avg ?? avg30`. TCGplayer pricing is variant-nested and normally lacks those top-level fields, so merely having a TCGplayer object can suppress the primary market-price block even when Cardmarket has valid averages. | Select a source and variant explicitly. Normalize provider data before rendering and fall back to another valid source only under a documented rule. |
| 🟠 P1 | Market Watch Assistant capability claims | The assistant page says the agent “monitors listings”, can “find active listings” and can “trigger alerts”. Its tool config can only read CardPricing, Wishlist and AgentInsight; it has no TradeListing read tool and no alert write tool. | Change UI/help copy to the actual read-only capabilities or add separately authorised, user-confirmed tools. Never claim an action/monitoring capability the agent cannot perform. |
| 🟠 P1 | Market Watch Assistant currency logic | The agent prompt correctly notes that pricing is in major currency units and wishlist budget is pence, but says simply to multiply pricing by 100. It does not account for CardPricing being USD/EUR while the budget is effectively GBP pence. The agent can confidently report false affordability. | Provide the agent a normalized server-side quote in the user's selected currency. Do not ask the model to invent FX conversion. Include source currency, FX/as-of time and quote freshness in the tool projection. |
| 🟠 P1 | Market Watch Assistant advice boundary | **Inherited from the LLM/Agent audit:** the agent explicitly says trending-up cards are a “good time to sell”, trending-down cards a “good time to buy”, and asks the model to “suggest when to act”. Terms say AI output is advisory and not professional advice. | Reframe the agent as descriptive market-data interpretation. Present price movement, uncertainty and source timestamps without directing the user to buy/sell or time the market. |
| 🟠 P1 | Assistant data/capability documentation | Assistant docs say it reads tracked cards, collection value and TCGDex pricing history and gives portfolio insights. The agent has no CollectionEntry tool, no PriceWatch/tracked-card tool and no real historical-price tool. | Align docs/prompts with available tools or add purpose-built, user-scoped read models for portfolio/watch/history with correct currencies and freshness. |
| 🟠 P1 | External provider quota abuse | `pokewallet-market` and `tcgplayer-market` are public read endpoints; once configured/approved, anonymous callers can request many distinct valid card IDs and drive cache misses against a shared provider quota. PokemonPriceTracker similarly becomes public if its production-use flag/plan allows it. One caller can exhaust service-wide enrichment budget. | Add edge/IP/user rate limits and cache-miss budgets, prefer authenticated use for costly enrichment, add global circuit breakers and serve cached data under pressure. Preserve server-only provider credentials. |
| 🟠 P1 | Dedicated regression coverage | Source searches found no dedicated tests for MarketWatch price scaling, FX, mover semantics, SavedSearch evaluation, notification preferences, realtime alert persistence, pricing-sync fairness, stale data, provider mapping or Market Watch Assistant price correctness. | Add unit/integration/adversarial suites for every P0/P1 invariant and gate release on them. Include known TCGDex fixtures for EUR/USD, cross-currency alerts, stale quotes, provider outages and >500-row scale cases. |
| 🟠 P1 | Scheduled pricing release verification | Pricing Sync is an active workflow calling an admin-gated backend, but this audit could not execute the workflow with the platform scheduler identity. Audit-visible CardPricing currently returned zero rows. That is not proof of production failure, but the core scheduled dependency is not independently proven here. | Run the real scheduled workflow in staging/production, record authenticated invocation evidence, prove CardPricing updates, backlog coverage and alerts end to end, then attach immutable release evidence. |
| 🟡 P2 | Movers ranking | Market Watch first sorts all rows by absolute movement and truncates to eight, then derives “Top Gainers” and “Top Losers” from that subset. A large opposite-direction move can crowd a legitimate top gainer/loser out before the per-direction ranking occurs. | Calculate gainers and losers independently from the complete eligible data set, then take top N in each direction. |
| 🟡 P2 | Price-list pagination | Market Watch only loads the latest 60 CardPricing rows and provides no continuation. Even after renaming/adding a real watchlist, cards outside that window are invisible. | Add cursor pagination or server-side card/watch queries with deterministic ordering. |
| 🟡 P2 | “Cards synced” counter | The page displays `prices.length` as “cards synced”, but CardPricing can contain separate TCGplayer/Cardmarket rows for one card. The count is price rows, not unique cards. | Count distinct canonical card IDs and separately report source coverage if useful. |
| 🟡 P2 | Alert-list pagination | `PriceAlertsList` loads only the latest 50 SavedSearch records with no continuation. Older alerts disappear from management even if the scheduler still evaluates them. | Paginate owner alert management and show enabled/disabled state, condition, source, variant, currency and last evaluation. |
| 🟡 P2 | Alert management UX | Market Watch allows create/delete only. There is no edit, pause/resume, threshold-direction change or channel update without deleting/recreating the alert. | Add backend-authoritative edit/pause controls with optimistic UI only after an authoritative save succeeds. |
| 🟡 P2 | Duplicate watches | SavedSearch has no uniqueness constraint for owner + card + condition. Users can create duplicate alerts and receive duplicate scheduled messages. | Enforce a unique logical watch key or explicitly support multiple named conditions with deduplicated event delivery. |
| 🟡 P2 | Alert currency UX | Market Watch's alert modal displays `$`; Card Detail's wishlist alert modal displays `£`; the schema only says pence. These interfaces write the same SavedSearch field while implying different currencies. | Make currency explicit and consistent. Prefer the user's configured display/alert currency and store ISO currency with every threshold. |
| 🟡 P2 | Alert card selection | The Market Watch alert modal accepts free-text card names instead of a canonical catalogue picker. Misspellings/duplicate names silently create alerts that may never match or may match the wrong card. | Use TCGDex-backed autocomplete/card selection and persist canonical card ID/set/variant. |
| 🟡 P2 | Public-route auth state | `/market` is public but renders “Your Portfolio”, Sync and Add Alert controls. Guests resolve collection/alerts to empty/error states and can see actions that require authentication, producing misleading £0/0-card state and late failures. | Separate public market discovery from authenticated portfolio/watch controls. Hide/disable owner actions behind an explicit sign-in CTA. |
| 🟡 P2 | Price-history chart semantics | `PriceHistoryChart` plots avg30→avg7→avg1 as three points and labels them a trend line; its TCGplayer fallback plots Low→Market→High as though those were time points. This is not actual historical price series. | Use stored dated snapshots for charts. If only aggregate ranges/moving averages exist, render them as labelled metrics/ranges rather than a chronological chart. |
| 🟡 P2 | Variant-pricing shape | `CardVariantPricing` expects flattened fields such as `normal_market`/`holofoil_market`, while live TCGDex TCGplayer card objects are nested by variant. The component can omit valid TCGplayer data and does not cover the full reverse-holo shape promised in documentation. | Normalize card pricing before it reaches UI components and support all intended variants through one typed model. |
| 🟡 P2 | Browser enrichment cache | `cardEnrichment.js` can fall back to an IndexedDB response when a fresh request fails, but that browser fallback does not add/update its own stale marker. A previously “fresh” response can be shown later without communicating that the network refresh failed. | Attach client-cache age/fallback provenance and propagate stale status to the UI when using browser fallback. |
| 🟡 P2 | Sync error visibility | `syncPricing` returns only the first five errors, while the Market Watch manual caller silently ignores the entire error response. Operators/users have little visibility into partial provider failures or skipped cards. | Record sync runs with counts, cursor/backlog, provider errors and age metrics. Give admins an operational view and users a simple last-updated/degraded state. |
| 🟡 P2 | Market controls | Market Watch has no search, source selector, variant selector, region/currency selector or time-period control despite presenting global “Top Gainers/Losers”. | Add controls only after the normalized history model exists. Make selected source/currency/period explicit in every derived ranking. |
| 🟡 P2 | Alert latency | Pricing sync runs every 30 minutes while SavedSearch evaluation runs hourly. Documentation says alerts check on a sync cycle and the realtime path implies immediate updates, but actual reliable scheduled latency can approach an hour plus provider age. | Publish a realistic alert SLA and, preferably, evaluate watches immediately after a successful price-sync batch using a queued event pipeline. |
| 🟡 P2 | Realtime dedup state | Browser realtime deduplicates alerts with an in-memory `alertedCards` set. It resets on reload/device change and has no shared state with the scheduled 24-hour cooldown. | Remove client memory as alert authority. Use server-side last-state/event idempotency. |
| 🟡 P2 | Accessibility of alert dialog | `PriceAlertModal` is a custom fixed overlay rather than the shared accessible Dialog primitive. It does not demonstrate focus trapping, focus restoration or `aria-modal` semantics. | Use the shared Dialog/Sheet component, give the dialog an accessible title/description and test keyboard/focus behaviour. |
| 🟡 P2 | Localisation | Several Market Watch subcomponents and the assistant UI contain hardcoded English strings while the main page uses translation keys. Price-alert instructions, channels, empty states and assistant capability text therefore bypass the app's multilingual system. | Move Market Watch/alert/assistant user-facing strings into the supported locale dictionaries and regression-test all nine supported languages. |
| 🟢 P3 | Price-history repository drift | `base44/shared/repository.ts` says Base44 price history is stored in CardPricing and writes `price_data`/`fetched_at`, then queries `-fetched_at`; those fields are absent from the current CardPricing schema, while the main sync updates rows in place. The repository abstraction and self-hosted migration model have drifted from Base44 reality. | Consolidate the price-history contract. Add a real snapshot entity/schema and update repository comments/methods/tests to the deployed model. |
| 🟢 P3 | Documentation drift | Market Watch/help docs promise watchlists, real price-history charts, rise-above/fall-below alerts, period movers and price-synced portfolio valuation that the inspected implementation does not provide. | Rewrite docs to current behaviour immediately, then update them again as the remediation phases land. Do not describe planned features as live. |
| 🟢 P3 | Wishlist schema drift | Wishlist schema text still describes PDS mirroring, while the project's central federation policy currently treats Wishlist as private/non-federated. Market Watch depends on wishlist privacy, so stale schema wording is misleading. | Update schema descriptions/help to match the current privacy-contained federation policy. |
| 🟢 P3 | Audit build verification | The Base44 command sandbox did not expose the app package root (`/workspace/package.json` was absent), so build/lint/typecheck and executable Market Watch regression tests could not be rerun in this audit session. | Run release gates from the canonical exact-commit CI checkout and attach build/test evidence to the remediation retest. |

## Feature-by-feature verdict

| Feature | Verdict | Notes |
| --- | --- | --- |
| Market Watch dashboard | Release blocker | Core stored prices are divided by 100 even though TCGDex values are major-unit USD/EUR. |
| Tracked Prices | Mislabelled/incomplete | Shows latest global CardPricing rows, not a personal tracked-card list. |
| Market movers | Incorrect fallback / limited | avg7-vs-avg30 percent can be meaningful, but `trend` fallback is a price masquerading as percent; source rows are mixed. |
| Top Gainers/Losers | Incomplete ranking | Derived from an absolute-movement top-eight subset rather than independently ranked universes. |
| Manual Sync | Broken for normal users | Visible button invokes admin-only backend and swallows failures. |
| Scheduled Pricing Sync | Good foundation, not scalable | Server-controlled and rate-limited, but fixed windows/first-80 batching can starve cards. |
| Portfolio summary | Misleading | Only latest 200 entries and does not join current CardPricing. |
| Price alerts | Release blocker | Threshold scale/currency is wrong; matching/card identity and delivery semantics are fragmented. |
| Realtime price alerts | Broken durability | Local toast can fire, but normal-user call to admin-only notification backend cannot persist/deliver the event. |
| Scheduled alerts | Functionally unsafe | Wrong unit comparison, preference bypass, failure cooldown and global caps. |
| Trade-availability alert | Privacy-risk | Uses unrestricted service-role open TradeListings rather than visibility gate. |
| Card Detail market price | Release blocker | Can relabel USD/EUR numeric values as GBP without FX and source selection can hide valid pricing. |
| Price-history chart | Not true history | Moving averages/ranges are displayed as chart points; no Base44 snapshot series exists. |
| Variant pricing | Partial | UI shape does not consistently match live TCGDex nested TCGplayer variants. |
| PokéWallet enrichment | Strong provider boundary | Server-only key, canonical matching, cache and soft budgets are good; anonymous shared-budget exhaustion remains. |
| PokemonPriceTracker enrichment | Strong licensing boundary | Public use fails closed unless plan/override permits it; still needs public quota protection if enabled. |
| Direct TCGplayer enrichment | Strong provider boundary | Server-only credentials and approved-use gate are good; shared quota can be exhausted by anonymous cache misses. |
| Market Watch Assistant | Not release ready | Read-only tools are a strength; price conversion, capability claims, advice framing and inherited output-safety gap remain. |
| Notifications integration | Fragmented | Central dispatcher is strong but the scheduled and realtime Market Watch paths do not consistently use it. |
| Documentation | Overclaims | Describes several features that do not exist or behave differently. |

## Verified strengths to preserve

The audit confirmed several controls that should remain:

- `CardPricing` mutation is admin-only while market quote reads are public.
- `syncPricing` is admin-gated and server-side; normal users cannot directly write authoritative price rows.
- TCGDex remains the canonical card identity source for market enrichment.
- Current TCGDex documentation clearly exposes source currency (`EUR` Cardmarket, `USD` TCGplayer) and variant-specific pricing, giving SwapPulse enough information to normalize correctly.
- The TCGDex client has rate limiting and retry/backoff logic.
- SavedSearch direct data is owner-scoped by RLS.
- The central notification dispatcher already supports event toggles, channel choice, quiet hours, push rate limits and multiple PushToken devices; Market Watch should reuse it rather than replace it.
- PokéWallet API keys remain server-side, upstream URLs are fixed, persistent caches are private/admin-only and explicit free-tier safety budgets exist.
- TCGplayer credentials remain server-side and provider use fails closed unless `TCGPLAYER_APPROVED_USE=true`.
- PokemonPriceTracker public production use fails closed unless the configured plan/explicit permission permits it; admins can use restricted plans only for development/evaluation.
- External provider card matching uses canonical TCGDex metadata and conservative confidence thresholds rather than trusting arbitrary provider matches.
- External provider UIs expose stale/cache indicators more clearly than the core Market Watch page.
- TCGplayer affiliate disclosure is surfaced when affiliate links are active.
- Terms explicitly say AI market outputs are suggestions, not professional advice, and third-party price data may be inaccurate/outdated.
- Market Watch Assistant entity tools are read-only; the agent cannot currently mutate listings, alerts or pricing records.

## Remediation order

### Phase 0 - release blockers

1. Define one canonical normalized pricing contract for every market surface:
   - canonical `card_id`
   - source/provider
   - variant/printing
   - source currency ISO code
   - source amount in major units (or an explicitly named minor-unit integer)
   - provider update timestamp
   - SwapPulse fetch timestamp
   - optional normalized display-currency amount
   - FX rate/source/as-of timestamp where conversion occurs.
2. Remove every implicit `/100`, `*100` and hard-coded GBP conversion from source-market quotes unless the value is provably pence.
3. Rebuild alert comparison so threshold and quote share the same currency/scale before evaluation.
4. Fix Card Detail market-price source selection/formatting.
5. Apply the project-wide Market Watch Assistant Markdown/prompt-injection remediation before exposing private wishlist/budget context to model output.

### Phase 1 - one authoritative watch/alert service

1. Create an owner-scoped `PriceWatch`/`MarketWatchItem` model keyed to canonical card ID.
2. Store explicit source, variant, direction, threshold amount, threshold currency, enabled state and last evaluated condition.
3. Create/update/delete watches only through a backend service with uniqueness and per-user limits.
4. Evaluate watches server-side after price-sync events and notify only on defined state transitions.
5. Route all notifications through the central notification dispatcher and consent/channel controls.
6. Use visibility-authorised TradeListing projections for any “available to trade” alerts.
7. Remove/merge the separate Wishlist realtime threshold implementation.

### Phase 2 - pricing coverage and history

1. Replace the fixed first-80 sync with a cursor/work queue and stale-first scheduling.
2. Persist immutable dated price snapshots for source + variant + currency.
3. Build real time-series charts from snapshots rather than moving-average labels.
4. Add stale-age SLAs and operational sync/backlog metrics.
5. Build Market Watch “Tracked Prices” from the current user's PriceWatch records, not a global latest-row list.
6. Compute portfolio estimates server-side over the complete collection with exact variant/condition assumptions and clearly separate cost basis.

### Phase 3 - external APIs, assistant and UX

1. Add edge/user/IP cache-miss quotas to public market-enrichment endpoints.
2. Give the Market Watch Assistant only normalized, timestamped market projections and explicit safe-output rules.
3. Remove prescriptive buy/sell timing language and capability overclaims.
4. Add card autocomplete, alert edit/pause, source/variant/currency/period controls and proper accessible dialogs.
5. Align all Help/GitBook/Terms-facing capability descriptions with what is actually deployed.

## Required regression and adversarial tests

Before declaring Market Watch release ready, test at minimum:

- a known Cardmarket EUR value renders exactly as EUR major units rather than divided by 100;
- a known TCGplayer USD market value renders exactly as USD or through a verified FX conversion;
- no USD/EUR quote is labelled GBP without an FX conversion record;
- GBP alert thresholds compare against normalized GBP quote values, not raw source values;
- above/below crossing fires once on false→true transition and does not repeat every hour/day while unchanged;
- blank price threshold does not fire merely because a pricing row exists;
- alerts are keyed to exact canonical card ID/set/variant;
- two same-name cards from different sets cannot cross-trigger;
- normal/holo/reverse variants cannot cross-trigger unless deliberately configured;
- disabled price-alert event setting suppresses scheduled and realtime delivery;
- master notification pause suppresses Market Watch notifications;
- quiet hours/channel settings behave consistently;
- multi-device PushToken delivery works;
- delivery failure does not incorrectly start the success cooldown;
- >500 alerts and >500 pricing rows are all eventually evaluated fairly;
- one malicious user creating many watches cannot starve other users;
- circle-scoped/wishlist-only trades do not alert unauthorised users;
- CardPricing create and update both cause watch evaluation;
- TCGplayer and Cardmarket rows normalize through the same quote interface;
- stale quotes are labelled/excluded according to policy;
- pricing sync fairly reaches cards beyond the first 80/current entity windows;
- portfolio total includes more than 200 owned cards and uses current normalized quotes;
- price history is reconstructable from immutable snapshots;
- gainers and losers are ranked independently over the selected period/source;
- anonymous cache-miss floods cannot exhaust PokéWallet/TCGplayer/PokemonPriceTracker budgets;
- provider outage/rate limit serves appropriately labelled stale cache and does not corrupt current quote state;
- Market Watch Assistant cannot expose private data through Markdown remote images/links;
- Market Watch Assistant cannot claim to create an alert or scan TradeListings without the corresponding authorised tool;
- assistant affordability answers use normalized currency/scale and include source/as-of information;
- build, lint/typecheck and browser tests run against the exact deployment commit.

## Release decision

**Do not treat Market Watch as release ready while the P0 findings remain.**

The most important architectural change is not a new market provider. SwapPulse already has enough provider data. It needs one canonical, currency-aware quote model and one server-authoritative PriceWatch/alert pipeline. Once those two foundations exist, the current external-provider caches, canonical TCGDex identity mapping, notification dispatcher and read-only Market Watch Assistant can be reused safely rather than replaced.
