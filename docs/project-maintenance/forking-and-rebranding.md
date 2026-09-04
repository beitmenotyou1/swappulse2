---
description: Forking and Rebranding documentation for SwapPulse.
---

# Forking and Rebranding SwapPulse

This guide explains how to create an independent project from the SwapPulse codebase or how to maintain a fork while contributing improvements upstream.

## 1. Licensing first

At the time this guide was written, the repository does **not** contain a root `LICENSE` file.

Source code being visible on GitHub does not automatically grant unrestricted rights to copy, modify and redistribute it.

Before third parties are actively encouraged to publish independent forks, the project owner should select and add an explicit software licence.

This guide therefore describes the technical process. Confirm the legal licence/permission that applies before redistributing a fork.

## 2. Decide what kind of fork you want

### Contribution fork

Use this when you want to improve SwapPulse and submit changes back.

Characteristics:

* keeps SwapPulse branding;
* tracks the upstream repository;
* uses a feature branch;
* does not deploy a competing production instance;
* submits a pull request back upstream.

### Independent community fork

Use this when you want to create a different collector/community project based on the architecture.

Characteristics:

* new name/domain/branding;
* independent Base44 app/environment;
* independent AT Protocol identity/handle namespace;
* independent secrets;
* independent chain deployment/manifest;
* independent operator/admin/verifier keys;
* independent terms/privacy/community policies.

### Non-Pokémon fork

The architecture can be adapted to another collectible/community domain.

In that case remove/replace:

* TCGDex-specific functions;
* Pokémon card/set pages;
* Pokémon branding/disclaimers;
* card-specific schemas/workflows that do not apply;
* market/pricing jobs tied to Pokémon data.

Keep generic pieces such as federation, profiles, feeds, smart accounts or governance only if they still serve the new product.

## 3. Create the Git fork

Once licensing permits:

1. Fork the repository in GitHub.
2. Clone your fork.
3. Add the original repository as `upstream` if you want to receive future improvements.

Example:

```bash
git clone https://github.com/YOUR-ACCOUNT/YOUR-FORK.git
cd YOUR-FORK

git remote add upstream https://github.com/beitmenotyou1/swappulse2.git
git remote -v
```

Use SSH instead of HTTPS if that is your preferred Git authentication method.

## 4. Never copy secrets

A fork must generate its own credentials.

Never copy from SwapPulse:

* relay bearer token;
* Starknet registry-owner key;
* verifier private key;
* user signer private keys;
* Cloudflare tunnel credentials;
* Base44 secrets;
* PDS admin passwords;
* AT Protocol app passwords;
* payment provider secrets;
* SMTP credentials;
* webhook secrets.

If a secret has ever been committed accidentally, rotating it is more important than deleting it from the latest commit.

## 5. Create an independent Base44 app

Do not point an independent fork at the production SwapPulse Base44 app.

Create your own Base44 project and configure:

* app identity;
* entities/RLS;
* backend functions;
* workflows;
* custom domain;
* server-side secrets;
* authentication settings;
* email/push integrations as needed.

Review every environment variable rather than bulk-copying a production `.env` file.

## 6. Rebrand the frontend

Search for SwapPulse branding and replace it intentionally.

Typical areas:

* `src/components/Logo.jsx` and logo assets;
* site title/metadata in `index.html`;
* navigation/footer copy;
* About/Help/Terms/Privacy pages;
* email templates;
* notification copy;
* domain URLs;
* AT Protocol handle/domain references;
* Chain Explorer network name;
* docs/README files.

Do not remove security/privacy disclosures just because they mention SwapPulse. Rewrite them for the new project architecture.

## 7. Pokémon / TCGDex decision

If the fork remains a Pokémon TCG community, keep a clear independent-project trademark disclaimer.

Review TCGDex terms/licensing/API requirements before operating your own production integration.

If the fork is about another collectible:

1. define a new catalogue provider/data model;
2. replace `tcgdex`, card and set synchronisation functions;
3. replace card identifiers throughout collection/trade entities;
4. update search/explore/market components;
5. remove Pokémon-specific text/assets;
6. redesign CardNft metadata semantics if the on-chain layer remains.

## 8. AT Protocol identity for a fork

Do not reuse the SwapPulse PDS/handle namespace for an unrelated independent project.

Define:

* your PDS deployment/provider;
* handle domain/namespace;
* lexicon names;
* record collection identifiers;
* federation behaviour;
* migration/interop strategy.

If you change custom lexicons, version them carefully so old records remain understandable.

### Preserve portable identity

Do not replace AT Protocol DIDs with local database IDs just because it is easier during rebranding. The point of the AT layer is portability/federation.

## 9. Web3 fork options

### Option A: remove Web3

If your fork does not need blockchain features, remove the Wallet/chain flows and related backend infrastructure cleanly.

Do not leave dead privileged relay endpoints deployed.

### Option B: use an independent testnet

Recommended for an experimental fork.

You must create a new:

* chain ID/network identity;
* Starknet environment;
* contract deployment;
* class-hash/address manifest;
* registry owner;
* verifier;
* transaction relay token;
* Base44 ChainNetworkConfig;
* public RPC hostname;
* public relay hostname.

Never point a fork at SwapPulse's deployed contract addresses while presenting them as your own network.

### Option C: redesign the chain layer

If changing identity/staking/token semantics, treat it as a new protocol.

Run the full Cairo/security process and do not inherit the permanent V2 cut-over assumptions blindly.

## 10. Deploy fresh Cairo contracts

For an independent network:

1. install the repository-pinned Cairo toolchain;
2. run the full chain tests;
3. generate independent deployment keys securely;
4. deploy contracts to your network;
5. generate your own canonical manifest;
6. verify addresses/class hashes through your public RPC;
7. import/activate the matching config in your Base44 app;
8. configure your hardened relay with your new pins;
9. verify `/readyz`;
10. exercise a new test identity end-to-end.

Do not edit the SwapPulse production/testnet manifest and assume that creates a new network.

## 11. Token and economics

If you keep SWPX code but create an independent product, decide whether your token should still be called SWPX.

A new community should normally define its own:

* token name/symbol;
* cap/supply policy;
* faucet/testnet policy;
* staking minimums;
* reward rules;
* governance role.

Changing a label in the UI does not change the deployed Cairo token metadata.

## 12. Data migration

Do not copy production user databases into a public fork.

For development, use synthetic/test data or an explicitly authorised export stripped of sensitive fields.

Private user mappings, emails, identity verification material and private messages should never be used as sample seed data.

## 13. Terms, privacy and moderation

An independent deployment is responsible for its own:

* Terms of Service;
* Privacy Policy;
* moderation policy;
* data retention;
* age/access policy;
* payment/refund policy;
* legal compliance;
* trademark/content rights.

Do not leave `swappulse.org` contact/legal references in a rebranded public deployment.

## 14. Localisation

If you keep the nine-language model, update every new permanent string across all supported locales.

If your fork deliberately supports fewer languages, remove unsupported locale selectors/configuration consistently rather than leaving half-translated pages.

## 15. Accessibility

A fork should preserve:

* keyboard navigation;
* focus states;
* skip links;
* semantic landmarks/headings;
* icon button labels;
* responsive/reflow behaviour;
* accessibility preference hooks.

Rebranding is not a reason to regress accessibility.

## 16. Development checks

Frontend:

```bash
npm install
npm run dev
# run the repo's configured lint/build checks before merging
```

Cairo/Web3:

```bash
cd chain
bash scripts/test-chain.sh
```

Relay:

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

## 17. Maintaining an upstream relationship

If your independent fork still wants upstream fixes:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

In a heavily customised fork, prefer reviewing/cherry-picking individual upstream commits instead of blindly merging large architecture changes.

## 18. Contributing a fork improvement back

If you build a generic improvement that benefits SwapPulse:

1. isolate it from fork-specific branding/secrets;
2. add tests;
3. preserve SwapPulse's privacy/security invariants;
4. document localisation/accessibility impact;
5. submit a focused PR.

Examples of good upstream candidates:

* accessibility fixes;
* generic AT Protocol interoperability improvements;
* Cairo security fixes;
* Chain Explorer improvements;
* performance fixes;
* reusable node tooling;
* documentation corrections.

## 19. AI-assisted forks

You may use ChatGPT, Base44 or other AI tools to help adapt the project.

Do not give AI tools live secrets or private user data.

Review AI-generated code as if it came from an unknown contributor: understand it, test it and verify its security assumptions before deploying it.

## 20. Fork release checklist

Before publishing an independent fork:

* [ ] legal licence/permission confirmed;
* [ ] new branding complete;
* [ ] Pokémon/trademark position reviewed;
* [ ] Base44 app is independent;
* [ ] all secrets regenerated;
* [ ] AT/PDS namespace independent;
* [ ] domain/email URLs updated;
* [ ] terms/privacy updated;
* [ ] no production SwapPulse user data copied;
* [ ] no SwapPulse private keys/tokens copied;
* [ ] chain contracts independently deployed if Web3 retained;
* [ ] manifest independently verified;
* [ ] frontend tests/build pass;
* [ ] Cairo/relay tests pass;
* [ ] accessibility/localisation checked;
* [ ] README/docs describe the fork accurately.
