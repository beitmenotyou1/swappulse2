# Getting Started with SwapPulse

SwapPulse is a Pokémon TCG collecting, trading and community platform with AT Protocol federation and an optional Cairo/Starknet Web3 layer.

If you are a normal collector, you can use the social and TCG features without understanding blockchain technology.

For the complete end-user guide, see `docs/USER_GUIDE.md`.

## Quick start

### 1. Create or sign in to your account

Open SwapPulse and create an account or sign in using the authentication methods currently offered by the site.

After signing in:

- complete your collector profile;
- choose your language;
- review privacy/security settings;
- set up stronger account security where available.

### 2. Explore Pokémon TCG content

Use **Explore** to discover cards, sets, posts and collectors.

SwapPulse uses TCGDex-backed card/set catalogue data and builds collection/trading/community features around it.

### 3. Build your collection

Open **Collection** and add the cards you own.

Collection data can feed into:

- binders;
- trade matching;
- portfolio/market views;
- card verification;
- on-chain card workflows where enabled.

### 4. Organise cards with Binders

Use **Binders** to create more focused views of your collection, such as trade binders, favourite sets or showcase groups.

### 5. Use the Trade Board

Open **Trade Board** to browse or create collector-to-collector trade listings.

Keep physical-card safety in mind:

- verify condition/details;
- use clear communication;
- keep evidence of agreements/shipping where appropriate;
- use community/trust signals as context, not as an absolute guarantee.

### 6. Join the community

SwapPulse includes features such as:

- profiles and follows;
- posts/comments/reactions;
- Circles;
- Meetups;
- live/community spaces;
- notifications;
- private messages;
- starter packs;
- feeds and discovery tools.

## AT Protocol in plain English

SwapPulse uses the AT Protocol so your social identity/data can become more portable and federated than in a conventional closed social network.

You may see concepts such as:

- DID;
- handle;
- PDS (Personal Data Server);
- app password;
- federation.

You do not need to manage these manually for ordinary browsing. The site and backend handle the relevant provisioning/synchronisation flows.

For architecture details, see `docs/PROJECT_ARCHITECTURE.md`.

## SwapPulse Wallet

The **SwapPulse Wallet** is the optional self-custodial/Web3 area.

The overview can show:

- SWPX testnet balance;
- smart-account address;
- Receive/copy;
- Get testnet SWPX;
- Stake;
- Send/bridge controls;
- direct Chain Explorer link.

The detailed sections show:

- V2 identity assurance;
- expiry/revocation state;
- recovery protection;
- card possession attestations;
- on-chain cards;
- community staking;
- cross-chain tools.

### Important privacy point

The Cairo identity registry does **not** store names, emails, dates of birth or identity documents. It stores opaque commitments and public assurance metadata only.

### Verification expiry

If V2 verification expires or is revoked:

- your identity does not disappear;
- existing on-chain stake/history remains visible;
- new value-bearing actions such as staking/bridging lock until eligibility is restored.

## SWPX testnet token

SWPX is used for current testnet staking and Web3 flows.

The Wallet faucet can issue testnet SWPX according to eligibility and cooldown rules.

Testnet SWPX should not be treated as guaranteed financial value.

## Community staking

The current staking UI supports:

- registering an operator;
- increasing operator self-stake;
- delegating;
- undelegating;
- withdrawing after the unlock period;
- operator exit.

If you already run an operator, SwapPulse should offer **Increase operator self-stake** rather than trying to register a duplicate operator.

The current staking pool is not yet decentralised multi-validator block consensus. See `docs/NODE_ARCHITECTURE.md` for the node/validator roadmap.

## Chain Explorer

Open **Chain Explorer** from the footer.

The explorer can show:

- latest blocks;
- latest transaction hashes;
- block details;
- transaction/receipt details;
- smart-account/contract addresses;
- SwapPulse-indexed public smart-account activity.

Wallet transaction hashes link directly to their explorer pages.

## Language and accessibility

SwapPulse offers nine main UI languages and is being developed with keyboard, screen-reader, focus, contrast, reduced-motion and responsive/reflow considerations.

If a new permanent feature appears only in English, that should be treated as incomplete localisation rather than normal behaviour.

## Help and troubleshooting

Use:

- `/help` for in-app guides;
- `/status` for service health;
- `/chain/` for public chain state;
- `docs/USER_GUIDE.md` for detailed product usage.

For developers:

- `README.md`;
- `docs/developer-onboarding.md`;
- `CONTRIBUTING.md`;
- `docs/PROJECT_ARCHITECTURE.md`.
