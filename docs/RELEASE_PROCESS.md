# SwapPulse Release Process

SwapPulse treats significant website, backend, AT Protocol and Web3 changes as versioned releases rather than relying only on individual Git commits.

## Goals

The release process exists to make the project easier to understand, audit, fork and maintain.

Every release should answer:

- What was added?
- What changed?
- What was removed or deprecated?
- Why was the change made?
- Does it affect security, privacy, identity, wallet behaviour or protocol compatibility?
- Does it require migration or operator action?
- Were translations/accessibility affected?
- What checks were run?

## Versioning

SwapPulse uses Semantic Versioning as a project convention.

While the project remains beta, versions remain `0.x.y`.

- `0.MINOR.0`: meaningful new feature groups, significant UX changes, protocol layers or architectural capabilities.
- `0.MINOR.PATCH`: compatible fixes/hardening to the current minor release.
- `1.0.0`: reserved for a deliberately declared stable compatibility baseline.

After 1.0:

- MAJOR: incompatible public/protocol changes.
- MINOR: compatible new functionality.
- PATCH: compatible fixes/hardening.

## Files involved

### `CHANGELOG.md`
Human-readable release history. Keep releases in oldest-to-newest order so readers can follow the project's evolution chronologically.

### `.github/releases/vX.Y.Z.md`
Full GitHub release body for a version.

### `RELEASE_MANIFEST.json`
Machine-readable list of releases in oldest-to-newest order.

Each entry has:

- `version`
- `title`
- `target`
- `notes`
- `prerelease`
- `historical`

### `.github/workflows/publish-releases.yml`
Creates releases that do not yet exist on the official `beitmenotyou1/swappulse2` repository.

It does not modify an existing release. Once a version is published, corrections should normally become a new patch release rather than silently rewriting release history.

## Significant-change rule

A new release is expected when a merged change includes one or more of:

- a new page/product area;
- substantial navigation or site-wide UX change;
- significant Wallet behaviour or user flow;
- new Pokémon TCG collection/trading functionality;
- new AT Protocol/PDS/federation behaviour;
- new Base44 backend/entity/workflow architecture;
- public API/function contract changes;
- Cairo/Starknet contract changes;
- identity/verification changes;
- staking/token/bridge/recovery changes;
- node/network architecture deployment;
- privacy/security model changes;
- meaningful removal/deprecation;
- migration that users/operators/forks need to know about.

A release is usually not required for a typo, purely internal refactor with no behavioural impact, or routine dependency refresh, unless the change has a security or compatibility impact worth documenting.

## Creating a release

1. Choose the next semantic version.
2. Add the version to `CHANGELOG.md`.
3. Create `.github/releases/vX.Y.Z.md`.
4. Add the release to the end of `RELEASE_MANIFEST.json`.
5. Set `target` to the intended immutable checkpoint commit when known. For a release being created by the same merge, `main` may be used so the workflow resolves it to the triggering commit.
6. Run checks for the affected layers.
7. Merge/sync to `main`.
8. GitHub Actions publishes the missing release automatically.

## Release-note template

```markdown
# SwapPulse vX.Y.Z — Release title

## New features
- ...

## Updated
- ...

## Removed/deprecated
- ...

## Why
- ...

## Security/privacy
- ...

## AT Protocol/federation
- ...

## Web3/chain
- ...

## Localisation/accessibility
- ...

## Deployment/migration
- ...

## Verification
- Frontend build/typecheck/lint: ...
- Cairo/Foundry: ...
- Relay regression: ...
- Manual UI regression: ...
```

Sections that genuinely do not apply can say `No change` rather than being omitted for security-sensitive releases.

## Historical releases

The initial backfilled releases begin at v0.1.0 because that is the oldest preserved milestone checkpoint in the current release series that can be tied to an authoritative commit.

Do not invent versions for older development history merely to make the list look longer. Git history remains the source for pre-version work.

## Immutable history

After a release is published:

- do not retag a different commit under the same version;
- do not materially rewrite what the release claimed happened;
- publish a patch/corrective release if something was wrong;
- security-sensitive corrections should explain the affected versions without exposing secrets or exploit-enabling details unnecessarily.

## Forks

The official workflow contains a repository guard so a fork does not accidentally publish releases under SwapPulse's official release process.

Fork maintainers may remove/change that guard and establish their own version history.

When making an independent fork, do not imply that the fork's version, token, network, PDS or contracts are official SwapPulse infrastructure.
