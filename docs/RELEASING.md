# Releasing SwapPulse

SwapPulse uses a versioned GitHub release for each significant project update. Releases are not only for blockchain changes: collector features, AT Protocol/federation changes, major Wallet/Explorer UX work, security hardening, infrastructure changes and substantial documentation changes can all justify a release.

The goals are transparency, reproducibility and a history that users and fork maintainers can understand without reconstructing the project from raw commits.

## Source of truth

The release system has three coordinated files:

- `CHANGELOG.md` — human-readable history, oldest to newest.
- `RELEASE_MANIFEST.json` — ordered machine-readable list of official releases.
- `.github/releases/vX.Y.Z.md` — full release notes for each version.

The GitHub workflow `.github/workflows/publish-releases.yml` reads the manifest in order and publishes any missing release when the release files reach `main`.

## Versioning

SwapPulse uses Semantic Versioning as a project convention while the project remains in beta.

### PATCH: `v0.x.Y`
Use for compatible fixes and maintenance such as:

- bug fixes;
- accessibility fixes;
- localisation corrections;
- security hardening that does not introduce a new product capability;
- performance work;
- dependency maintenance;
- documentation corrections that do not substantially change the project handbook.

### MINOR: `v0.X.0`
Use for significant user-facing or architectural additions such as:

- a new collector feature;
- substantial Wallet or Chain Explorer functionality;
- new AT Protocol/federation functionality;
- new Web3 product functionality;
- a new smart contract or protocol capability;
- a new node role or decentralisation phase;
- a major navigation/information-architecture redesign;
- a substantial project/deployment documentation milestone.

### MAJOR
Before `1.0.0`, incompatible changes still normally increment the minor version and must be clearly identified as breaking in the release notes.

After `1.0.0`, incompatible public API, protocol, data-format or network changes increment the major version.

## What counts as a significant update?

Create a release when the update materially changes what a user, contributor, operator or fork maintainer can do or rely upon.

Examples:

- new Collection, Binder, Trade, social or market functionality;
- material AT Protocol/PDS/federation changes;
- Wallet, staking, bridge, recovery or identity functionality;
- Chain Explorer capabilities;
- security/privacy architecture changes;
- public API or entity changes;
- node/network architecture changes;
- major site navigation/UX refreshes;
- deployment/runtime changes;
- major documentation or contribution-model changes.

Do not create a new release for every typo, copy tweak or invisible refactor. Group compatible maintenance changes into a patch release where appropriate.

## Required release note structure

Every significant release should explain:

1. **What was added** — new features, routes, APIs, contracts, workflows or docs.
2. **What changed** — updated components and behaviour.
3. **What was removed/deprecated** — anything no longer available or no longer canonical.
4. **Why** — the reason for the change.
5. **Security/privacy impact** — particularly for auth, identity, RLS, relay, Web3 and AT Protocol changes.
6. **Compatibility/migration impact** — whether users, operators or forks must do anything.
7. **Accessibility/localisation impact** — for user-facing work.
8. **Testing/verification** — checks that were actually run.
9. **Known limitations** — what the release does not yet provide.

## Creating a release

### 1. Decide the next version

Read `CHANGELOG.md` and `RELEASE_MANIFEST.json` and choose the next semantic version.

### 2. Create the release-note file

Copy `.github/releases/TEMPLATE.md` to, for example:

```text
.github/releases/v0.7.0.md
```

Complete every relevant section and delete placeholder instructions.

### 3. Update `CHANGELOG.md`

Append the new release after the previous release so the file remains oldest to newest.

### 4. Update `RELEASE_MANIFEST.json`

Append an entry:

```json
{
  "version": "v0.7.0",
  "title": "Short release title",
  "target": "main",
  "notes": ".github/releases/v0.7.0.md",
  "prerelease": true,
  "historical": false
}
```

For a normal new release, use `target: "main"`. Historical entries should only use a fixed commit SHA when the release is being backfilled from a trustworthy preserved checkpoint.

### 5. Run checks appropriate to the changed layers

Frontend:

```bash
npm run typecheck
npm run lint
npm run build
```

Cairo/Starknet:

```bash
cd chain
bash scripts/test-chain.sh
```

Relay policy:

```bash
cd chain/infra/tx-relay
node smoke-policy.mjs
```

Only claim checks in the release notes if they were actually run.

### 6. Merge/sync to `main`

The release publisher runs when release-system files change on `main`.

It processes the manifest from oldest to newest and skips a release that already exists. It refuses to rewrite an existing historical tag if it points to an unexpected commit.

### 7. Verify GitHub

After the workflow completes, verify:

- the tag exists;
- the release title is correct;
- the notes render correctly;
- the release is marked prerelease while SwapPulse remains beta;
- historical tags point to the preserved checkpoint commit;
- the newest release points to the intended `main` commit.

## Historical release policy

Do not invent release numbers for old periods simply to make the history look fuller.

A historical release may be backfilled when there is a trustworthy preserved commit/checkpoint that represents a known project state. This is why the initial SwapPulse release history begins with the frozen V2 baseline rather than attempting to label every earlier development experiment.

## Security-sensitive releases

Any release touching the following needs explicit security notes:

- authentication;
- RLS/entity permissions;
- AT Protocol credentials/app passwords;
- private verifier handling;
- ChainIdentity or assurance logic;
- transaction construction/signing;
- tx relay allowlists/authentication;
- staking/slashing/rewards;
- bridge/replay handling;
- account recovery;
- secrets;
- public RPC behaviour;
- node/validator software.

For irreversible protocol operations, create a Base44 checkpoint and preserve deployment evidence before performing the operation.

## Releases and forks

Fork maintainers can keep SwapPulse version numbers if they remain close to upstream, or adopt their own namespace/version line for a substantially independent project.

Do not imply that an independent fork is an official SwapPulse release unless the SwapPulse maintainers published it.

## Release ownership

AI-assisted release drafting is allowed. The human maintainer remains responsible for confirming that the release notes match what actually shipped, that third-party/licence claims are accurate and that stated tests were genuinely completed.
