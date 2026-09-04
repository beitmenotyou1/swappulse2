---
description: Change Protocol documentation for SwapPulse.
---

# SwapPulse Change Protocol

This document defines how future changes should be proposed, implemented, tested and documented so SwapPulse can evolve without casually breaking privacy, federation or the frozen V2 chain baseline.

## 1. Why this exists

SwapPulse spans several trust domains at once:

* Pokémon TCG catalogue/application data;
* social/community features;
* AT Protocol/PDS/federation;
* Base44 authentication, entities and workflows;
* Cairo/Starknet smart contracts;
* transaction relay/RPC infrastructure;
* user-controlled smart accounts.

A visual change and an irreversible chain-policy change must not be treated as the same level of risk.

## 2. Change classes

### Class A: visual/content only

Examples:

* spacing;
* colours;
* non-functional layout;
* documentation;
* translated wording.

Requirements:

* accessibility check;
* responsive check;
* translation coverage when user-facing text changes;
* no unexpected routing changes.

### Class B: normal application behaviour

Examples:

* collection UX;
* trade workflow;
* feeds;
* notifications;
* new Base44 entities that are not security-sensitive.

Requirements:

* relevant functional tests;
* RLS review for new/changed entities;
* migration/backwards-compatibility review;
* workflow/retry behaviour review.

### Class C: identity, auth, privacy or federation

Examples:

* login/security factors;
* PDS credentials;
* DID mappings;
* AT Protocol record schemas;
* moderation/private-message handling;
* age/identity verification.

Requirements:

* explicit privacy review;
* secret-handling review;
* RLS review;
* replay/idempotency review;
* federation compatibility review;
* failure-mode testing;
* documentation update.

### Class D: Web3 value-bearing or infrastructure

Examples:

* staking;
* SWPX mint/burn policy;
* bridge logic;
* chain-action drafting/submission;
* relay allowlist;
* deployment pins;
* recovery controls.

Requirements:

* Cairo/backend tests as relevant;
* unauthorised caller tests;
* invalid-state tests;
* replay/duplicate tests;
* chain-authoritative reconciliation tests;
* relay policy regression;
* live read-only verification before restart/deployment;
* checkpoint before and after.

### Class E: irreversible protocol/network change

Examples:

* one-way verification mode changes;
* contract upgrade authority changes;
* consensus/settlement changes;
* irreversible governance changes;
* token-cap/economic rules that cannot be safely undone.

Requirements:

* written design proposal;
* threat model;
* explicit migration plan;
* testnet proof;
* rollback plan for everything that is still reversible;
* clear identification of the exact irreversible step;
* independent confirmation of deployed class hashes/addresses;
* explicit human approval immediately before the irreversible write.

## 3. Frozen V2 invariants

New work must preserve the known-good V2 baseline unless a future approved protocol proposal explicitly replaces it.

Non-negotiable current invariants:

* V2 verification remains permanently required;
* no code attempts to re-enable legacy V1 verification;
* private PII stays off-chain;
* browser code contains no privileged signing keys;
* public RPC remains read-only;
* raw Devnet RPC remains host-local;
* relay writes remain allowlisted;
* expiry/revocation fail closed for new value-bearing actions;
* existing identity/history/stake are not silently destroyed when assurance expires;
* duplicate registration and replay attempts remain blocked;
* Base44 mirrors never override authoritative chain state for confirmed Web3 balances/status.

## 4. Standard feature workflow

For each substantial feature group:

1. **Checkpoint the current known-good state.**
2. Inspect existing implementation before adding new paths.
3. Define the smallest data/API/UI change that meets the requirement.
4. Identify trust boundaries and private/public data.
5. Implement backend/read-model changes before exposing unsafe UI actions.
6. Add/adjust tests.
7. Run static consistency/security checks.
8. Test the user-visible flow.
9. Reconcile against authoritative external/chain state where applicable.
10. Update docs.
11. Create a post-feature checkpoint.

Do not bundle unrelated infrastructure surgery into a UI feature simply because both are being worked on in the same week.

## 5. Checkpoint policy

Create checkpoints:

* before a substantial feature group;
* after a known-good feature group;
* before irreversible network actions;
* after verified deployment/cut-over;
* before broad schema migrations.

Checkpoint names should describe the state, not just say `update` or `fix`.

## 6. Data/privacy review

Before adding a field, ask:

1. Does this need to exist at all?
2. Does it need to be public?
3. Does it need to be on-chain?
4. Can it be represented by a hash/commitment instead?
5. What happens if it becomes public forever?
6. What RLS rule controls it in Base44?
7. Does it contain a DID/public address, or a private local mapping?

Never write the following to the public chain:

* name;
* email;
* date of birth;
* identity documents;
* private verifier evidence;
* password/app password;
* private message content;
* Base44 private user ID;
* private key/seed phrase.

## 7. Entity/RLS protocol

For every new or modified Base44 entity:

* inspect the current schema first;
* define owner/admin access explicitly;
* avoid public read unless the record is genuinely public product data;
* never rely on frontend hiding for security;
* verify create/update/delete rules;
* check whether `created_by_id` or a custom `data.user_id` is the correct owner mapping.

Temporary/noop schemas must not be publicly readable.

## 8. Secret-handling protocol

Secrets belong in approved server-side secret/environment storage.

Never commit or display:

* relay bearer token;
* registry owner private key;
* identity verifier private key;
* PDS admin/app passwords;
* payment provider secrets;
* webhook signing secrets;
* 2FA/private recovery material.

Logs should use machine-readable failure codes rather than dumping secret-bearing request bodies.

## 9. AT Protocol/federation changes

When changing federation:

* preserve DID identity semantics;
* document lexicon changes;
* make publishing idempotent where possible;
* consider remote clients that may not upgrade simultaneously;
* test PDS sync and firehose ingestion;
* do not silently replace portable AT identity with a Base44-only identifier;
* avoid treating eventual consistency as corruption without reconciliation evidence.

Breaking lexicon/record changes need a version/migration strategy.

## 10. TCG catalogue changes

When changing TCGDex/card data integration:

* separate catalogue metadata from user-owned collection state;
* do not overwrite user-entered condition/collection data during catalogue sync;
* handle third-party API failure gracefully;
* document cache/staleness behaviour;
* do not claim a market price is a guaranteed transaction price.

## 11. Wallet/Web3 UI changes

Wallet actions should follow a familiar structure, but the UI must never imply stronger guarantees than the backend/chain provides.

Examples:

* an address is public, not a secret;
* an on-chain card record is a proof of a workflow, not perpetual proof of physical possession;
* `ACTIVE` should be derived from current expiry/revocation state, not just an old mirror string;
* action buttons must not bypass backend eligibility checks;
* chain explorer links should use public transaction hashes only.

## 12. Cairo contract changes

Use OpenZeppelin Cairo components for security-sensitive primitives where appropriate.

Minimum test areas for relevant contracts:

* unauthorised writes;
* duplicate registration;
* invalid state changes;
* replay attempts;
* revoked identity;
* expired verification;
* invalid/zero address;
* ownership/admin changes;
* verifier permissions;
* malicious/unexpected caller;
* fuzz/property tests where useful.

Run:

```bash
cd chain
bash scripts/test-chain.sh
```

A change that reduces the known-good test baseline needs an explicit explanation and approval.

## 13. Relay changes

Relay changes are high risk because they control the allowed write surface.

Requirements:

* no arbitrary RPC method forwarding;
* no arbitrary contract invoke;
* class/contract/method pins remain explicit;
* auth remains mandatory;
* idempotent operations remain idempotent;
* run `node smoke-policy.mjs`;
* verify `/readyz` after controlled restart;
* do not restart Devnet/RPC unnecessarily when replacing only the relay.

## 14. Deployment changes

Use a canonical deployment manifest and independently verify it against the approved public RPC before Base44 activation.

Do not populate ChainNetworkConfig from guesses or pre-deployment placeholders.

For a new independent network/fork:

* deploy new classes/contracts;
* generate a new manifest;
* verify public RPC results;
* configure a new relay with new keys/tokens;
* activate the matching Base44 network config.

Never reuse SwapPulse privileged secrets in a fork.

## 15. Localisation protocol

Permanent user-facing strings must go through the translation system.

The currently offered locales are:

* en-GB;
* es-ES;
* fr-FR;
* de-DE;
* it-IT;
* pt-BR;
* ja-JP;
* zh-CN;
* ko-KR.

For large feature-specific vocabularies, a dedicated translation bundle is preferred over scattering hard-coded strings through components.

## 16. Accessibility protocol

Every new/changed major UI surface should consider:

* keyboard-only use;
* focus order;
* visible focus states;
* semantic labels/headings;
* accessible names for icon-only buttons;
* screen-reader status updates;
* reduced motion;
* contrast;
* zoom/reflow;
* scrollable menus/dialogs on small screens.

A dedicated application surface such as Chain Explorer must reapply global accessibility preferences even if it is routed outside the normal site layout.

## 17. Documentation protocol

Update the relevant docs in the same feature group.

Use:

* [documentation home](https://swappulse.gitbook.io/swappulse-docs/) for project-level truth/navigation;
* [user guide](https://swappulse.gitbook.io/swappulse-docs/start-here/user-guide) for end users;
* [project architecture](https://swappulse.gitbook.io/swappulse-docs/developers/project-architecture) for whole-system architecture;
* [V2 live architecture](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/v2-live-architecture) for live chain specifics;
* [deployment guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/deployment) for deployment/ops;
* [contributor guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/contributing) for contribution expectations;
* [forking and rebranding guide](https://swappulse.gitbook.io/swappulse-docs/project-maintenance/forking-and-rebranding) for independent forks;
* [node architecture roadmap](https://swappulse.gitbook.io/swappulse-docs/network-and-web3/node-architecture) for decentralisation/node roadmap.

Delete or clearly mark stale architecture claims instead of leaving contradictory docs side by side.

## 18. AI-assisted changes

AI tools such as ChatGPT/Base44 may be used throughout development.

Required disclosure principle:

* AI assistance is acceptable;
* maintainers remain responsible for what is merged/deployed;
* generated code gets the same review/testing as any other code;
* never paste live secrets into prompts/issues/docs;
* do not use AI confidence as evidence that an irreversible chain action is safe.

## 19. Pull request expectations

A strong PR should state:

* problem;
* solution;
* affected layers;
* screenshots for UI changes;
* security/privacy implications;
* migration implications;
* tests run;
* localisation/accessibility impact;
* rollback strategy if relevant.

## 20. Experimental network claims

Do not advertise Raspberry Pi/full-node/validator support until it has been benchmarked under the exact node role being claimed.

Do not call a single Starknet Devnet instance a decentralised validator network.

Do not advertise SWPX rewards for consensus work until the consensus/reward mechanism actually exists and has been tested.

The node roadmap may state targets and experiments clearly as future work.
