# Contributing to SwapPulse

Thanks for helping improve SwapPulse. The project aims to be open, community-driven and understandable to people who did not build the original system.

## Before you start

Read:

- `README.md`
- `docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md`
- `docs/CHANGE_PROTOCOL.md`
- `SECURITY_AUDIT.md`

For chain work also read:

- `chain/README.md`
- `chain/OPERATOR_GUIDE.md`

## Development principles

Contributions must preserve these defaults unless an explicitly reviewed protocol migration says otherwise:

- no private personal data on-chain;
- no privileged private keys or trusted signing logic in browser code;
- public RPC remains read-only;
- transaction relay remains authenticated and allowlisted;
- V2 verification failures/expiry/revocation fail closed for value-bearing actions;
- users retain self-custody and explicit signing for user-approved blockchain actions;
- Base44 entities use least-privilege row-level security;
- new UI copy is localised for all supported languages;
- accessibility is part of acceptance criteria, not an optional polish pass.

## Fork and branch workflow

1. Fork `beitmenotyou1/swappulse2` on GitHub.
2. Clone your fork.
3. Create a focused branch, for example:

```bash
git checkout -b feat/explorer-address-history
```

4. Make the smallest coherent change that solves the problem.
5. Run the relevant checks.
6. Commit with a clear message.
7. Push your branch to your fork.
8. Open a pull request against `main`.

## Frontend checks

Install dependencies:

```bash
npm install
```

Run the frontend locally:

```bash
npm run dev
```

Run the build/lint/test commands provided by `package.json` where relevant.

For UI changes, check:

- desktop and mobile layouts;
- keyboard-only use;
- focus visibility;
- screen-reader labels/landmarks;
- zoom and narrow viewports;
- reduced-motion/high-contrast/accessibility preferences;
- every supported interface language;
- no duplicate or unreachable navigation actions.

## Cairo/Starknet checks

Use the pinned chain toolchain and run:

```bash
cd chain
bash scripts/test-chain.sh
```

For relay policy changes also run:

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

Contract changes should include tests for the relevant negative path, not only the successful path. Depending on the feature, that may include unauthorised calls, duplicate/replay attempts, invalid state transitions, zero addresses, expiry, revocation, role changes, malicious callers and fuzz coverage.

## Security-sensitive changes

Call out security impact explicitly in the pull request when changing:

- authentication or permissions;
- Base44 RLS;
- blockchain transaction construction/signing;
- relay policy;
- verifier/admin authority;
- identity assurance;
- staking/slashing/rewards;
- bridge/replay handling;
- recovery;
- secrets/environment variables;
- public RPC behaviour.

Never include real secret values in an issue, commit, pull request, screenshot or test fixture.

## Data and privacy

Do not add names, email addresses, dates of birth, document images/numbers or other private identity evidence to Cairo storage or public events.

If a new feature needs sensitive information, keep it off-chain and document:

- why the data is needed;
- where it is stored;
- who can read it;
- how long it is retained;
- what public commitment/proof, if any, is written on-chain.

## Documentation expectations

Update docs in the same pull request when behaviour changes.

At minimum, consider whether the change affects:

- `README.md`
- `docs/USER_GUIDE.md`
- `docs/SWAPPULSE_V2_LIVE_ARCHITECTURE.md`
- `docs/CHANGE_PROTOCOL.md`
- `DEPLOYMENT.md`
- `SECURITY_AUDIT.md`

## Pull request checklist

Include:

- what changed;
- why it changed;
- screenshots for UI changes where useful;
- tests/checks run;
- security/privacy impact;
- migration/rollback notes if state or schemas changed;
- translation/accessibility notes for user-facing changes.

## AI-assisted contributions

AI tools are welcome. SwapPulse itself has been developed extensively with ChatGPT and Base44 under human direction.

AI-generated changes receive the same review standard as hand-written changes. Contributors remain responsible for understanding the code they submit, checking licences/attribution where applicable, running tests and avoiding invented APIs or insecure shortcuts.
