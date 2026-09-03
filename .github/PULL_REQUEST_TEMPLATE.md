# Summary

Describe what changed and why.

## Type of change

- [ ] Bug fix / patch maintenance
- [ ] New feature
- [ ] UX / navigation / accessibility / localisation
- [ ] Pokémon TCG / TCGdex integration
- [ ] AT Protocol / PDS / federation
- [ ] Base44 entity / backend / workflow
- [ ] Cairo / Starknet / Wallet / staking / bridge
- [ ] Infrastructure / node / deployment
- [ ] Documentation / governance
- [ ] Security / privacy

## Release impact

Choose one:

- [ ] **No release required** — minor internal/copy-only change with no material user/operator/contributor impact.
- [ ] **PATCH release** — compatible fix, hardening, accessibility/localisation or maintenance update.
- [ ] **MINOR release** — significant feature, product area, architecture, navigation or network capability.
- [ ] **Breaking change** — clearly document migration/compatibility impact and proposed versioning.

If a release is required:

- [ ] `CHANGELOG.md` updated.
- [ ] `.github/releases/vX.Y.Z.md` created from the template.
- [ ] `RELEASE_MANIFEST.json` updated.
- [ ] `package.json` version updated where appropriate.
- [ ] release rationale and known limitations documented.

See `docs/RELEASING.md`.

## Testing performed

Tick only checks that were actually run:

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Cairo/Foundry chain suite
- [ ] relay policy smoke suite
- [ ] backend/function tests
- [ ] live/manual UI regression
- [ ] mobile/narrow viewport check
- [ ] keyboard/screen-reader/accessibility check
- [ ] localisation check across supported languages
- [ ] other: describe below

Evidence/notes:

## Security and privacy impact

Explain any effect on authentication, RLS, secrets, AT Protocol credentials, PDS state, identity assurance, verifier/admin authority, transaction construction/signing, relay policy, staking, bridge/replay, recovery or public RPC.

If none, state why the existing trust boundaries are unchanged.

## Third-party / licensing impact

- [ ] No new third-party dependency, API, dataset or media source.
- [ ] New third-party material introduced and ownership/licence/terms have been checked.
- [ ] Required attribution/NOTICE changes included.
- [ ] Pokémon/TCG-related media or branding implications reviewed.

See `THIRD_PARTY_NOTICES.md` and `docs/LICENSE_OPTIONS.md`.

## Accessibility and localisation

For user-facing changes, describe:

- keyboard/focus behaviour;
- screen-reader labels/landmarks;
- contrast/motion/zoom considerations;
- supported-language coverage;
- whether any text remains intentionally untranslated and why.

## Migration / rollback

Describe schema migrations, contract/network implications, data backfills, operator actions or rollback/checkpoint information.

## Screenshots

Add before/after screenshots for visual changes where useful.

## Checklist

- [ ] I understand the code/change I am submitting, including AI-assisted code.
- [ ] I did not include secrets, private keys, relay tokens, PDS passwords or private identity evidence.
- [ ] I preserved the frozen V2 security/privacy invariants unless this PR explicitly proposes a reviewed migration.
- [ ] I updated relevant user/developer/deployment documentation.
