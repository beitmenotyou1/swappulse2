# SwapPulse Chain Explorer Full Feature Audit

**Audit date:** 13 September 2026  
**Scope:** Public Chain Explorer `/chain/`, summary/latest-block view, block lookup, transaction lookup, generic hash resolution, smart-account/contract address lookup, SwapPulse-indexed address activity, direct Wallet deep links, Base44 `chain-explorer` backend, `ChainNetworkConfig` trust boundary, public read-only RPC gateway, Starknet RPC compatibility, error handling, cache behaviour, abuse resistance, privacy, accessibility, localisation, API documentation, performance, observability and release verification.  
**Status:** Source/schema/live-config audit complete. Exact-release build/lint/typecheck, browser E2E and independent live RPC smoke verification were unavailable from the Base44 audit runner.  
**Overall score:** **36/100**  
**Risk:** **Critical / High Risk**  
**Release status:** **NOT RELEASE READY** until the runtime chain trust boundary and fail-closed controls are corrected.

## Findings

| Priority | Area | Finding | Required action |
|---|---|---|---|
| 🔴 P0 | Network trust / fail-closed policy | **CE-001. `loadPublicNetworkConfig()` ignores `ChainNetworkConfig.status` and deliberately allows the Explorer to operate when no verified configuration exists.** A missing record, `UNCONFIGURED` record or `PAUSED` record still returns `SWAPPULSE_TESTNET` and the canonical RPC. That means an emergency pause or failed/unperformed Verify & Activate does not stop the public Explorer from presenting data as the verified SwapPulse testnet. | Require a current `ChainNetworkConfig` with `status === 'CONFIGURED'`, matching configured/verified RPC URL, matching configured/verified chain ID and required verified contract fields before serving branded chain data. Return a distinct network-paused/unverified 503 state otherwise. |
| 🔴 P0 | Runtime chain identity | **CE-002. Transaction, block, address and generic resolve requests do not re-check the live RPC chain ID or contract pins before trusting data.** The summary calls `starknet_chainId`, but it merely displays the result and never compares it with `verified_chain_id`. Detail actions do not call `starknet_chainId` at all. If the tunnel/upstream behind the same pinned URL is misrouted or replaced, the Explorer can show another chain under the static “SwapPulse Testnet” badge. | Add a cached runtime trust guard shared by every action: compare live `starknet_chainId` with `verified_chain_id`, validate a small set of canonical contract class hashes/pins, reject stale/paused configuration, and fail closed before returning explorer data. |
| 🟠 P1 | Abuse resistance | **CE-003. The public Base44 `chain-explorer` function has no application-level per-client rate limit or request budget.** A summary request fans out to 3 head calls plus up to 6 block calls. The downstream RPC gateway rate-limits the Base44 egress IP rather than the end user, so one anonymous abusive client can consume a shared upstream allowance and degrade the Explorer for everyone. | Add a public-function rate limiter keyed to trustworthy request/client identity, action-specific cost budgets, short server-side summary caching/coalescing, and 429 responses with Retry-After. Keep the RPC gateway as a second line of defence rather than the only quota. |
| 🟠 P1 | Resolve amplification / timeouts | **CE-004. Generic hexadecimal resolution can serially attempt transaction, block and address resolution with separate 10-second RPC timeouts and no whole-request deadline.** A deliberately nonexistent felt can trigger expensive sequential upstream work plus service-role entity queries. | Add a bounded overall request deadline, action budget, cheap classification hints where safe, request cancellation and a maximum RPC-call count. Do not let one resolve request occupy a worker for multiple full RPC timeout windows. |
| 🟠 P1 | RPC gateway availability | **CE-005. `chain/infra/rpc-gateway/server.mjs` keeps per-IP rate-window entries forever.** The `windows` Map is never pruned, so unique clients accumulate process memory indefinitely. | Expire rate-window entries after their minute/window, cap the map, use an LRU/TTL limiter or move rate limiting to a hardened reverse proxy/service. Add a memory-growth regression test. |
| 🟠 P1 | Trusted proxy boundary | **CE-006. The RPC gateway trusts `cf-connecting-ip` and `x-forwarded-for` without an explicit trusted-proxy allowlist.** Rate-limit correctness therefore depends on the outer tunnel/proxy always stripping or replacing attacker-supplied forwarding headers. | Trust forwarding headers only from known proxy source ranges/socket peers, otherwise use the socket address. Document the Cloudflare/tunnel contract and test forged forwarding headers at the public ingress. |
| 🟠 P1 | Transaction error integrity | **CE-007. Every `RpcError` during transaction or receipt lookup is converted to `TRANSACTION_NOT_FOUND` / HTTP 404.** Timeouts, upstream 429s, 5xx responses, invalid-parameter/version errors and actual missing hashes become indistinguishable. | Preserve RPC error classes. Return 404 only for the Starknet transaction-not-found code; use 429/502/503/504 for capacity/upstream/timeout conditions and a safe compatibility error for invalid method parameters. |
| 🟠 P1 | Block error integrity | **CE-008. Every `RpcError` during block lookup is converted to `BLOCK_NOT_FOUND` / HTTP 404.** Upstream outages and RPC incompatibilities are presented as nonexistent blocks. | Map only the Starknet block-not-found error to 404. Propagate operational failures as retryable service errors with a request correlation ID. |
| 🟠 P1 | Address error integrity | **CE-009. Every `RpcError` during class-hash lookup becomes `ADDRESS_NOT_FOUND` / HTTP 404.** An unhealthy RPC can therefore make deployed contracts appear not to exist. | Distinguish contract-not-found from upstream transport/RPC failures and surface a degraded/unavailable state rather than false nonexistence. |
| 🟠 P1 | Generic resolution correctness | **CE-010. `resolve` catches transaction and block failures indiscriminately, then tries the next object type.** A transport or compatibility failure can be reinterpreted as a block/address lookup and ultimately returned as `LOOKUP_NOT_FOUND`, masking the true fault. | Continue to the next object type only when the previous call returned the exact Starknet not-found condition. Abort immediately on timeout, rate-limit, malformed response, wrong-chain or other infrastructure failures. |
| 🟠 P1 | Pending transaction support | **CE-011. `getTransaction()` requires both the transaction and receipt in a single `Promise.all`.** If a submitted/mempool transaction is visible through `starknet_getTransactionByHash` but the receipt is not yet available, the page fails entirely as “transaction not found”. The gateway already allows `starknet_getTransactionStatus`, but the Explorer does not use it. | Fetch transaction first, then receipt/status independently. Render submitted/pre-confirmed/pending transactions with partial detail and refresh until a receipt/finality is available. |
| 🟠 P1 | Address data correctness | **CE-012. `starknet_getNonce` failures are silently coerced to `0x0`.** A real RPC failure is indistinguishable from a genuine zero nonce, so the Explorer can publish false account state. | Keep nonce unavailable/unknown on read failure, include a degraded-field marker, and retry or surface the operational error. Never substitute a plausible on-chain value for a failed read. |
| 🟠 P1 | Summary integrity | **CE-013. Latest-block RPC failures are silently converted to `null` and filtered out.** The summary can return HTTP 200 with fewer than six “latest blocks” and no degraded flag, making an incomplete view look authoritative. | Return a `partial/degraded` indicator and failed-range metadata, or fail the summary if the minimum completeness threshold is not met. Instrument repeated missing blocks. |
| 🟠 P1 | Frontend request race | **CE-014. `ChainExplorer.jsx` does not cancel or generation-guard asynchronous loads when the route changes.** A slow request for the previous transaction/block can finish after a newer request and overwrite `data`, `errorCode` or `loading`, displaying the wrong object under the current URL. | Add an `AbortController` where supported or a monotonically increasing request token and ignore stale completions. Add rapid-navigation E2E tests. |
| 🟠 P1 | Indexed activity state filtering | **CE-015. Public “SwapPulse-indexed activity” includes any locally stored tx hash regardless of mirror status.** `StakePosition` can be `SUBMITTED`/`FAILED`, `ChainCardToken` can be `SUBMITTED`/`FAILED`, and `BridgeTransfer` can be `SUBMITTED`/`FAILED`, but the public index has no status filter. | Include only independently chain-confirmed states/hashes, or clearly expose pending/failed state after verifying the hash/status from chain. Do not publish a local draft/submission as confirmed activity. |
| 🟠 P1 | Indexed activity verification | **CE-016. Indexed activity hashes are returned from service-role Base44 mirrors without proving that each hash exists on the canonical chain at response time.** This weakens the Explorer’s “public blockchain data” trust model. | Verify/canonicalise activity through a chain index table populated only after reconciliation, or batch-check newly indexed hashes before they become public. Store block number/hash/finality as evidence. |
| 🟠 P1 | Verification freshness | **CE-017. Explorer trust is not bounded by `last_verified_at`.** The live `ChainNetworkConfig` is `CONFIGURED` and has matching configured/verified chain IDs and RPC URLs, but its last successful verification is **1 September 2026 22:38:13Z**, while this audit is **13 September 2026**. The Explorer accepts that verification indefinitely. | Define a maximum verification age, continuously re-check lightweight chain/pin invariants, expose the last verified time, and fail closed or visibly degrade when the trust snapshot becomes stale. |
| 🟠 P1 | Starknet RPC version negotiation | **CE-018. Transaction lookup hardcodes `starknet_getTransactionByHash` parameters as `[txHash, []]`, coupling the Explorer to the response-flags-era RPC shape.** Starknet RPC v0.10.1 introduced the `response_flags` parameter. The project’s separate Madara Stage-A qualification explicitly reported v0.10.0, so routing the Explorer to a v0.10.0-compatible node would break this call. | Read `starknet_specVersion`, enforce a supported version range and build method parameters per negotiated version. Prefer spec-compliant by-name requests where supported. Add v0.10.0/v0.10.1+ compatibility tests. |
| 🟠 P1 | Modern finality semantics | **CE-019. Friendly status mapping does not include `PRE_CONFIRMED`.** Current Starknet RPC schemas include pre-confirmed block/transaction concepts, so modern nodes can fall back to an untranslated raw technical status at the exact point where users need a clear “not final yet” warning. | Add explicit pre-confirmed/pending/reorg-risk semantics and test all finality/execution combinations supported by the configured RPC version. |
| 🟠 P1 | Test coverage | **CE-020. No Chain Explorer-specific backend/unit/integration/security test suite was found.** There is no automated evidence covering wrong-chain fail-closed behaviour, config pause, not-found vs outage errors, pending transactions, generic resolution, abusive request budgets, stale frontend responses, indexed-activity filtering or RPC-version compatibility. | Add unit tests for parsers/error mapping, mocked RPC integration tests, gateway abuse tests and browser E2E for summary/block/tx/address/deep-link/error/rapid-navigation flows. Make them release gates. |
| 🟡 P2 | Release verification | **CE-021. Exact-release build/lint/typecheck could not be executed in the Base44 command sandbox.** `/workspace` is empty and `npm run build`, `npm run lint` and `npm run typecheck` each returned code 254 / ENOENT for `/workspace/package.json`. The required Base44 web-agent README also returned HTTP 403. | Run the final checks from the canonical Git checkout/CI artefact and attach commit SHA, build, lint, typecheck, explorer tests and public-route smoke evidence to the release record. |
| 🟡 P2 | Block transaction scalability | **CE-022. A block page renders the entire transaction hash array at once with no pagination or virtualisation.** Growing blocks can create a very large DOM and poor mobile/screen-reader performance. | Paginate or virtualise block transactions, preserve stable URLs/page state and expose total count. |
| 🟡 P2 | Gateway response ceiling | **CE-023. The RPC gateway rejects upstream responses over 4 MiB.** A sufficiently large `starknet_getBlockWithTxHashes` response can fail the whole block page, with no alternative paging/index path. | Monitor response sizes, raise the limit only with memory safeguards, and preferably back block/tx browsing with an indexed store that can paginate independently of raw RPC response size. |
| 🟡 P2 | Indexed activity pagination | **CE-024. Address activity hard-caps source reads to 20 identities and 100 each of stake/card/bridge records, then slices the merged result to 50 without `has_more` or pagination.** Long-lived accounts silently lose history. | Use a dedicated indexed-activity table keyed by account/block/tx with cursor pagination and a visible completeness boundary. |
| 🟡 P2 | Activity chronology | **CE-025. Indexed activity is sorted by Base44 `created_date`/`updated_date`, not on-chain block number/timestamp.** Reconciliation edits can reorder historical transactions incorrectly. | Store and sort by confirmed block number, transaction index and block timestamp; use local timestamps only as secondary metadata. |
| 🟡 P2 | Activity deduplication | **CE-026. Deduplication keeps only the first semantic action for a transaction hash.** If one transaction is represented by multiple local records/actions, later meanings are silently discarded. | Model one transaction with an array of indexed actions/categories or deduplicate after merging semantic labels. |
| 🟡 P2 | Activity UI | **CE-027. The backend returns `category` and `action`, but the address page discards both and renders only the hash plus “View transaction”.** Useful context paid for by the service-role queries is not visible. | Render a safe, localised action label, finality and block/time evidence beside each hash. |
| 🟡 P2 | Wallet deep link semantics | **CE-028. Every arbitrary address page shows “Open Wallet”, but `/wallet` opens the signed-in viewer’s own wallet rather than the viewed address.** This is misleading when exploring another account/contract. | Show “Open my Wallet” only when appropriate, or replace it with account-specific actions such as “View my wallet” separately from the explored address. |
| 🟡 P2 | Address navigation | **CE-029. Transaction sender/account values are copy-only rather than links to the Explorer address page.** | Link valid sender/contract addresses to `/chain/address/:address` while retaining copy controls. |
| 🟡 P2 | Sequencer navigation | **CE-030. Block sequencer address is copy-only rather than an address link.** | Add an Explorer address link for the sequencer when present. |
| 🟡 P2 | Parent navigation | **CE-031. Parent block hash is copy-only, so block traversal requires copy/paste search.** | Link the parent hash directly to `/chain/block/:hash`; optionally add previous/next block navigation. |
| 🟡 P2 | Deploy-account detail | **CE-032. The main transaction UI derives “Sender” only from transaction `sender_address` or `contract_address` and does not explicitly expose the deployed account address from a deploy-account receipt.** Deploy-account pages can therefore omit the most useful resulting address even when the receipt provides it. | Add type-aware transaction fields, including deployed contract/account address, class hash and constructor/salt where applicable. |
| 🟡 P2 | Fee readability | **CE-033. Actual fee is shown as the raw RPC amount plus unit without human-friendly conversion.** Users must interpret base-unit hexadecimal/large integer values themselves. | Convert to the configured fee token’s display units while retaining the exact raw value in technical details. |
| 🟡 P2 | Transaction time | **CE-034. Transaction detail does not display block timestamp or age.** Users must open the block separately to know when a transaction occurred. | Include confirmed block timestamp/relative age and distinguish submitted/pre-confirmed/confirmed time where available. |
| 🟡 P2 | Transaction position | **CE-035. Transaction detail does not show transaction index/position within the block.** | Record/derive block transaction index in the indexer or resolve it from block data when practical. |
| 🟡 P2 | Event visibility | **CE-036. Receipt events are available only inside raw JSON; there is no structured event/log view.** | Render event emitter, selector/name where decoded, keys/data and links to emitting contracts. |
| 🟡 P2 | Call decoding | **CE-037. Invoke calldata and entrypoint/call intent are not decoded into human-readable contract calls.** | Add verified ABI/class-aware decoding for known SwapPulse contracts, with raw calldata always available as fallback. |
| 🟡 P2 | Asset transfer visibility | **CE-038. SWPX/native-token, NFT/card and bridge transfers are not decoded as first-class transaction activity.** | Decode known token/NFT/bridge events into transfer panels and link asset/account pages. |
| 🟡 P2 | Contract inspection | **CE-039. Address pages show class hash and nonce only; there is no ABI/class metadata or verified SwapPulse contract identity.** | Add safe class/ABI inspection, canonical contract-name badges from verified deployment pins and links to source/contract documentation where verified. |
| 🟡 P2 | Holdings/balances | **CE-040. Address pages do not show native-token balance, card NFT holdings or other public on-chain asset state.** | Add optional read-only holdings for verified SwapPulse contracts, clearly separated from the intentionally incomplete activity index. |
| 🟡 P2 | Trace visibility | **CE-041. The Explorer provides no call trace/internal-call view.** | Add traces only when supported by the node/indexer, with bounded response sizes and clear “advanced” labelling. This is a roadmap feature, not a reason to expose unsafe RPC methods. |
| 🟡 P2 | Freshness / live head | **CE-042. The homepage is a snapshot until manual Refresh; it does not poll or subscribe to new blocks.** | Add a conservative head poll with page-visibility backoff or a safe indexed realtime channel, plus a “last updated” indicator. |
| 🟡 P2 | Pending cache policy | **CE-043. Transaction responses use a fixed `public, max-age=20` cache regardless of finality.** A pending/pre-confirmed transaction can remain visibly stale while its status changes. | Use short/no-store caching for mutable pending states and long immutable caching only after accepted/final states. |
| 🟡 P2 | Immutable cache efficiency | **CE-044. Confirmed block pages cache for only 10 seconds and transactions for 20 seconds even though final chain objects are effectively immutable for this testnet usage.** | Once finality is sufficient, use longer immutable/cache revalidation policies to reduce Base44 and RPC load. |
| 🟡 P2 | Trust transparency | **CE-045. The UI shows a static network badge but not `last_verified_at`, config status, contract-pin verification or current RPC health.** | Add a network-trust panel/badge that exposes verified chain ID, verification age, RPC spec, pin status and degraded/paused state without exposing secrets. |
| 🟡 P2 | Decentralised verification | **CE-046. The repository contains a lite-node multi-peer agreement/pin-verification design, but the Explorer trusts one canonical RPC endpoint and does not expose or consume peer agreement.** This is accurately documented as a development testnet, but it limits independent verification. | When the lite-node architecture is production-ready, route Explorer trust through verified quorum/checkpoints or display independent peer agreement as an optional trust signal. Do not imply decentralised consensus before it exists. |
| 🟡 P2 | Invalid-search stale content | **CE-047. A locally invalid search only sets `errorCode`; it does not clear existing `data`.** Because result sections are rendered independently, a validation error can appear above the previous summary/detail result, which looks like contradictory evidence. | On local validation failure, clear stale data or render error/result states mutually exclusively. |
| 🟢 P3 | Copy feedback | **CE-048. Copy success changes the button’s icon/`aria-label` for 1.5 seconds but does not send a dedicated polite live-region confirmation.** | Add a concise `role="status"`/`aria-live="polite"` copy confirmation without moving focus. |
| 🟢 P3 | Localisation / theme control | **CE-049. Explorer-specific content is well localised, but the shared ThemeToggle accessible label/title remains hard-coded English.** | Localise the ThemeToggle accessible label/title through the same i18n provider. |
| 🟢 P3 | Language selector keyboard pattern | **CE-050. The shared LanguageSwitcher declares listbox/option semantics on ordinary buttons without implementing the full listbox arrow-key/roving-focus pattern; its keydown listener also uses an anonymous callback that is not removed.** | Prefer native/Radix Select or implement the WAI-ARIA listbox keyboard pattern and stable listener cleanup. |
| 🟢 P3 | OpenAPI error contract | **CE-051. `openapi.yaml` documents a 500 Chain Explorer internal error while the implementation primarily returns 503 for unsafe/unavailable network conditions.** | Align OpenAPI response codes and error enums with the implementation, including 429/502/503/504 after error handling is fixed. |
| 🟢 P3 | OpenAPI response kind | **CE-052. OpenAPI includes `kind: resolve`, but the resolve action actually returns `kind: transaction`, `block` or `address`.** | Remove `resolve` from the response-kind enum or document a wrapper shape if one is introduced. |
| 🟢 P3 | Unused bookmark feature | **CE-053. `ExplorerBookmark` exists as a schema but no Chain Explorer UI/runtime usage was found, and the audit-visible entity currently has zero rows.** | Either implement bookmarks end to end with uniqueness/offline-sync tests or remove/deprecate the dead schema after confirming no consumers depend on it. |
| 🟢 P3 | Bookmark network naming | **CE-054. `ExplorerBookmark.chain` defaults to `pulse`, which is stale/confusing next to the explicit `SWAPPULSE_TESTNET` network naming and the project’s deliberate avoidance of PulseChain/PULSE branding.** | Before enabling bookmarks, migrate the field to explicit supported network identifiers and validate the enum instead of free-form legacy values. |

## Executive summary

The Chain Explorer has a **good safety-oriented skeleton**. The browser never receives the raw Devnet endpoint or transaction-relay credential, the Base44 function pins the RPC transport to `https://rpc.swappulse.org/rpc`, the public RPC gateway exposes a restricted read/simulation allowlist and denies transaction-submission/devnet methods, input hex is normalised before RPC use, dynamic values are rendered through React rather than raw HTML, and the UI explicitly says that address history is only “SwapPulse-indexed activity”, not a complete archive.

The release blocker is the gap between **transport pinning** and **chain identity verification**. The Explorer treats the hostname/path as the trust anchor and keeps operating if the admin network configuration is absent, unconfigured or paused. A verified RPC URL is only evidence about where the app intended to connect at the last verification point; it does not prove that the service behind that URL is still the expected chain today. Every public response branded as SwapPulse should therefore pass a lightweight runtime chain/pin guard.

The second major concern is error truthfulness. Several source paths convert any RPC failure into “not found”, generic resolution intentionally swallows infrastructure failures, address nonce failure becomes a valid-looking `0x0`, and the summary silently drops failed block reads. A blockchain explorer must be unusually strict about distinguishing **“the chain says it does not exist”** from **“we could not verify it right now.”**

## Current control-plane state observed during the audit

The live Base44 `ChainNetworkConfig` visible to the audit is:

- network: `SWAPPULSE_TESTNET`
- status: `CONFIGURED`
- configured chain ID: `0x534e5f5345504f4c4941`
- verified chain ID: `0x534e5f5345504f4c4941`
- configured RPC: `https://rpc.swappulse.org/rpc`
- verified RPC: `https://rpc.swappulse.org/rpc`
- explorer URL: `https://swappulse.org/chain/`
- identity verification mode: `V2`
- verified identity verification mode: `V2`
- last verified: `2026-09-01T22:38:13.549Z`

That is a positive sign: the saved control-plane values agree. The problem is that the public Explorer function does not enforce the `CONFIGURED` state, does not bound verification age, and does not compare each live detail request to the expected chain/pins.

Audit-visible chain-mirror state is small: one ChainIdentity is registered with active verification, one staking operation is active, and no BridgeTransfer or ChainCardToken rows were visible. This reduces immediate migration/index-history risk, but it does not remove the status-filtering defect because those schemas explicitly support submitted/failed states.

## Architecture audited

### Browser surface

`src/pages/ChainExplorer.jsx` is a standalone public route outside the normal social-app layout. It provides:

- `/chain/` summary
- `/chain/block/:blockId`
- `/chain/tx/:txHash`
- `/chain/address/:address`
- generic `/chain/:identifier` resolution
- full Explorer URL paste/search
- latest six blocks and up to twelve recent transaction hashes
- block metadata and transaction hash list
- transaction type, sender, nonce, execution/finality, actual fee, revert reason and block link
- address class hash, nonce and SwapPulse-indexed activity
- expandable raw JSON technical details
- direct links from Wallet transaction/address surfaces
- nine-language Explorer dictionary
- theme/accessibility settings integration
- skip link, focus transfer to result heading, `aria-live` loading/result region and semantic tables/definition lists

### Base44 backend

`base44/functions/chain-explorer/entry.ts` is public and read-only. It:

- pins `CANONICAL_RPC` to `https://rpc.swappulse.org/rpc`
- never accepts a caller-provided RPC URL
- normalises 0x values
- reads `ChainNetworkConfig` through service role
- fetches Starknet JSON-RPC with a 10-second per-call timeout
- supports summary, transaction, block, address and resolve actions
- enriches addresses with coarse public tx hashes from private Base44 chain mirrors

### Public RPC gateway

`chain/infra/rpc-gateway/server.mjs` has important protections:

- raw Devnet remains separate/loopback-only by design
- public JSON-RPC batch requests are denied
- only an explicit Starknet read/simulation allowlist is exposed
- transaction-submission and `devnet_*` methods are not exposed
- request body is capped at 64 KiB
- upstream response is capped at 4 MiB
- upstream timeout is 8 seconds
- per-IP request rate limit exists
- responses are `no-store` and use `X-Content-Type-Options: nosniff`

These controls should be preserved while improving rate-limit storage/proxy trust and runtime chain identity checks.

## Verified strengths

1. **No browser-side privileged chain key or relay token.** The Explorer is read-only and does not touch the provisioning relay.
2. **Caller-controlled SSRF is structurally prevented.** The backend uses a constant canonical RPC URL and compares saved config hostname/path/protocol against it.
3. **Raw Devnet administrative RPC is not used by the browser or Base44 Explorer.** This matches the project’s intended security split.
4. **The public gateway has a method allowlist and denies JSON-RPC batches/write methods.** This is the right default for a public read endpoint.
5. **Public/private scope is mostly disciplined.** The public address view returns only chain address/class/nonce plus transaction hashes/coarse local action metadata; it does not leak Base44 user IDs, email, DOB, signer secrets or relay credentials.
6. **Address-history limitations are honestly documented.** README, FAQ and the UI clearly say indexed activity is not a complete archive.
7. **Direct Wallet → Explorer links exist.** Wallet transaction hashes and smart-account addresses link to durable public Explorer URLs.
8. **Revert reason and execution/finality are surfaced.** The UI does not equate transaction existence with success.
9. **Technical raw JSON is available without `dangerouslySetInnerHTML`.** Advanced users can inspect unabridged RPC data.
10. **Accessibility foundations are stronger than average.** The Explorer has a skip link, labelled search, table caption/headers, focus management after results, loading `aria-busy`, alert semantics and keyboard-focus styles.
11. **Explorer-specific localisation is comprehensive.** A dedicated nine-language dictionary covers the main Explorer interface.
12. **Current saved network configuration agrees with itself.** Configured/verified chain IDs and RPC URLs match, and the network is presently marked CONFIGURED.

## P0 release blockers

### CE-001 — fail-open administrative network state

The code comment explicitly permits Explorer operation “Before Verify & Activate” because the transport is pinned. That is insufficient for a blockchain trust surface. Transport pinning prevents caller SSRF, but it does not prove that the chain has been independently verified, that the verified contracts are still present, or that an administrator has not intentionally paused the network.

A `PAUSED` state must mean that all public surfaces which assert the network identity stop making authoritative claims. Likewise, a missing/unconfigured record should produce “Network not verified/configured”, not a normal SwapPulse Testnet Explorer.

### CE-002 — no runtime chain/pin verification

The current summary reads `starknet_chainId`, but does not compare it with the saved `verified_chain_id`. Transaction/block/address actions do not read chain ID at all. The risk scenario does not require DNS compromise: a reverse-proxy/tunnel configuration mistake can point the same canonical hostname/path to the wrong upstream.

Recommended runtime trust cache:

1. Load the current CONFIGURED network record.
2. Require configured/verified RPC URL equality with the canonical transport.
3. Require configured chain ID == verified chain ID.
4. Read `starknet_chainId` from the live endpoint and compare.
5. At a sensible interval, verify key contract class hashes (IdentityRegistry, account class deployment evidence, token/staking/bridge pins as appropriate).
6. Cache the successful trust check for a short bounded interval, not indefinitely.
7. Fail every Explorer action closed if the guard fails.
8. Expose the guard timestamp/status in the UI.

## RPC compatibility review

The Explorer currently calls:

- `starknet_blockNumber`
- `starknet_specVersion`
- `starknet_chainId`
- `starknet_getBlockWithTxHashes`
- `starknet_getTransactionByHash`
- `starknet_getTransactionReceipt`
- `starknet_getClassHashAt`
- `starknet_getNonce`

The method set is appropriate for the current read-only Explorer.

However, the call shape is not version-negotiated. `getTransaction()` sends:

```text
starknet_getTransactionByHash [txHash, []]
```

Official Starknet specification release notes state that `response_flags` was added to `starknet_getTransactionByHash` in RPC **v0.10.1**. The SwapPulse repository separately records a Madara Stage-A full-node test returning RPC **v0.10.0**. The current Devnet line used by the project is newer and supports the response-flags-era API, but the Explorer should not silently assume that every future approved node/gateway does.

The safest design is to negotiate/validate an explicitly supported RPC range during network verification and use a compatibility adapter per version rather than sprinkling version-specific positional arrays through feature code.

The frontend status map also needs modern `PRE_CONFIRMED` handling. Pre-confirmed must be explained as not-final and potentially reorgable, rather than merely displaying a raw unknown status.

## Error-model review

A trustworthy Explorer should have these classes:

- **400** malformed identifier/action
- **404** exact chain object not found
- **409/412** network/config state incompatible, if appropriate
- **429** client/application rate limit
- **502** malformed/bad upstream response
- **503** verified network/RPC temporarily unavailable or paused
- **504** upstream timeout

The current implementation collapses too much into 404. This matters because users commonly use explorers as evidence that a transaction did or did not happen. “Not found” must never mean “our RPC timed out”.

Generic resolution should only advance from transaction → block → address after receiving an exact not-found response for the previous object type. A wrong-chain guard, timeout or rate limit should stop resolution immediately.

## Indexed address activity review

The decision to label this **“SwapPulse-indexed activity”** rather than “transaction history” is correct and should remain.

The current implementation queries private mirrors through service role, then exposes only transaction hash/category/action. That is a reasonable bridge until a full indexer exists, but it needs a stricter publication boundary:

- publish only hashes whose on-chain existence/finality has been reconciled
- never publish a FAILED local operation merely because it retained a tx hash
- include canonical block number/hash/timestamp
- sort by chain order, not record edit time
- paginate
- keep semantic actions as an array when one transaction represents multiple app concepts
- make the source/completeness label visible beside the list

A dedicated public `ChainIndexedActivity` projection populated by the reconciler would be cleaner than live service-role fan-out across four private entities on every address request.

## Abuse and availability review

A summary request can trigger nine upstream RPC calls. Generic resolve can make multiple sequential calls before returning. The Base44 function itself has no visible public-client quota.

The public RPC gateway does have a per-IP quota, but Explorer RPC traffic is server-to-server. The gateway therefore sees Base44 infrastructure addresses, not the original browser identity. That turns the downstream quota into a **shared blast radius**: abusive Explorer traffic can consume capacity used by legitimate users and other Base44 chain reads.

Recommended layered controls:

- cheap public-action rate limit in Base44
- action cost model: summary > direct block/address > resolve
- request coalescing for identical summary/head requests
- server-side short cache for summary/latest blocks
- global concurrency cap toward RPC
- circuit breaker/backoff after RPC degradation
- per-request overall deadline
- gateway TTL/LRU rate-state storage
- ingress-tested client-IP extraction
- metrics for request rate, upstream calls/action, 404 vs 5xx, timeout and cache hit ratio

## Privacy review

No private identity documents, DOB, emails, user IDs, private keys or relay secrets are returned by the Explorer. This is good.

The remaining privacy risk is contextual rather than raw-secret leakage: service-role private mirrors can reveal that a public account hash was associated with a verification revocation, staking action or bridge action before that event has been independently confirmed on chain. Filtering to reconciled public facts resolves most of this problem.

The public RPC gateway also logs method plus derived client IP. If public users call it directly, retention/purpose should match SwapPulse’s privacy documentation and operational logging policy.

## UX and feature completeness

The Explorer is intentionally not Etherscan/Starkscan-complete, and that limitation is well documented. The following should therefore be treated as roadmap improvements rather than P0 blockers:

- structured events
- verified contract names/ABIs
- decoded SwapPulse calls
- token/NFT/bridge transfer panels
- balances/holdings
- traces/internal calls
- transaction position
- block previous/next navigation
- automatic new-block refresh
- complete address history via a dedicated indexer

The next milestone should prioritise **truthfulness and trust** before breadth. A smaller Explorer that never lies about chain identity/not-found state is preferable to a feature-rich Explorer with ambiguous provenance.

## Accessibility/localisation observations

Strong points:

- skip link to `#chain-main`
- semantic main/header/footer
- labelled search and search help
- result loading region with `aria-live`/`aria-busy`
- error `role="alert"`
- focus moves to the result heading after load
- accessible table headers/caption
- definition lists for technical data
- expandable technical details are keyboard reachable
- nine-language Explorer translations

Remaining chain-specific polish is low severity: copy success should have a status announcement, ThemeToggle’s accessible label is still English-only, and LanguageSwitcher should use a complete Select/listbox keyboard implementation.

## API/documentation consistency

`openapi.yaml` is directionally correct about the Explorer being read-only and about address history not being complete. Two contract mismatches should be fixed:

- implementation uses 503 for unavailable/unsafe network, while the OpenAPI path documents a generic 500
- response `kind` includes `resolve`, even though resolve produces a concrete `transaction`, `block` or `address` response

The API reference should also document future 429/502/504 distinctions after the error model is corrected.

## Required release test matrix

### Trust boundary

- missing ChainNetworkConfig → fail closed
- `UNCONFIGURED` → fail closed
- `PAUSED` → fail closed
- configured RPC URL mismatch → fail closed
- verified RPC URL mismatch → fail closed
- configured vs verified chain ID mismatch → fail closed
- live RPC chain ID mismatch → fail closed
- IdentityRegistry/key contract pin mismatch → fail closed
- stale verification beyond policy → degraded/fail closed
- valid current config → all read actions work

### RPC and errors

- transaction exists + receipt exists
- transaction exists + receipt temporarily absent/pending
- transaction hash not found → 404
- block not found → 404
- address/contract not found → 404
- upstream 429 preserved as retry/capacity condition
- upstream 500/502 → Explorer unavailable, never 404
- RPC timeout → timeout/unavailable, never 404
- malformed JSON-RPC payload → upstream compatibility error
- v0.10.0-compatible transaction lookup adapter
- v0.10.1+ response-flags adapter
- PRE_CONFIRMED rendering and refresh to accepted/final state

### Resolver

- decimal block lookup
- transaction-hash lookup
- block-hash lookup
- contract/account address lookup
- exact not-found fallthrough only
- infrastructure fault aborts resolution
- oversized/invalid hex rejected without RPC work
- overall deadline and call-count budget enforced

### Indexed activity

- failed/drafted/submitted local rows not shown as confirmed
- reconciled confirmed stake shown
- registered identity lifecycle hashes shown only when chain-confirmed
- bridge/card activity requires confirmed chain evidence
- one hash with multiple semantic actions retains all labels
- chain-order sorting
- cursor pagination beyond 50
- no private user/DID/email/evidence leakage

### Gateway abuse/security

- write/devnet methods rejected
- JSON-RPC batches rejected
- forged `CF-Connecting-IP`/`X-Forwarded-For` cannot bypass quota outside trusted proxy path
- rate-state entries expire
- request >64 KiB rejected
- response-size ceiling handled without process instability
- Base44 public-function rate limit prevents shared RPC-quota exhaustion
- concurrent identical summaries are coalesced/cached

### Frontend

- rapid navigation cannot display stale prior response
- invalid search cannot leave stale successful data visible
- pending/confirmed/reverted transaction states
- deep links from Wallet
- direct pasted Explorer URL
- previous/parent/address links
- block transaction pagination
- mobile and 400% zoom
- keyboard-only navigation
- screen-reader result focus/status
- all nine locales
- copy announcement
- theme/reduced-motion/high-contrast settings

### Release verification

- canonical commit SHA recorded
- install succeeds
- typecheck succeeds
- lint succeeds
- production build succeeds
- unit/integration tests succeed
- public `/chain/` smoke succeeds
- known block/transaction/address detail smoke succeeds
- public RPC `starknet_chainId` matches configured/verified value
- wrong-chain simulation fails closed
- public RPC write/devnet methods remain denied

## Recommended remediation order

1. **Make network state fail closed:** require CONFIGURED + verified RPC/chain/pins and honour PAUSED.
2. **Add the shared runtime trust guard:** live chain ID + bounded contract-pin verification for every Explorer action.
3. **Correct the RPC error model:** never turn timeout/429/5xx/compatibility faults into “not found”.
4. **Fix transaction lifecycle:** separate transaction, receipt and status reads; support pending/pre-confirmed.
5. **Add Base44-side rate limiting, request cost/deadline and summary coalescing.**
6. **Harden the RPC gateway limiter:** trusted-proxy handling plus TTL/LRU state cleanup.
7. **Fix address nonce degradation and partial-summary signalling.**
8. **Eliminate frontend request races and stale validation results.**
9. **Create a reconciler-backed public indexed-activity projection with chain evidence and pagination.**
10. **Negotiate/enforce supported Starknet RPC versions and add PRE_CONFIRMED semantics.**
11. **Add the full Chain Explorer automated test suite and exact-release smoke gate.**
12. **Then improve navigation, decoded events/calls/assets, contract metadata, holdings and live head updates.**
13. **Finish API/a11y/bookmark cleanup after the core trust path is secure.**

## Release decision

**Do not release the Chain Explorer as an authoritative SwapPulse chain-verification surface in its current form.** The browser/RPC privilege separation is sound and the feature is close to having the right architecture, but transport pinning is being treated as a substitute for current chain identity verification. Fix CE-001 and CE-002 first, then the P1 error/abuse/index-integrity items.

The existing Explorer should be preserved and hardened rather than replaced. No functional application code or user data was changed during this audit; only this audit report was added.

## Current external references checked

- Starknet JSON-RPC specification repository: https://github.com/starkware-libs/starknet-specs
- Starknet specs releases (including v0.10.1 response flags): https://github.com/starkware-libs/starknet-specs/releases
- Starknet Devnet releases: https://github.com/0xspaceshard/starknet-devnet-rs/releases

