// Wallet & On-Chain pages — smart account identity, card possession
// attestations, on-chain card anchoring, community staking, and cross-chain
// transfers. English source content; translated at runtime via
// TranslationOverride records keyed 'help.<slug>'.

export const walletPages = {
  wallet: {
    title: 'Wallet & Identity',
    subtitle: 'Your self-custodial collector account',
    sections: [
      { icon: 'Wallet', title: 'What is the Wallet?', blocks: [
        { type: 'p', text: 'The Wallet page brings together everything you own on the SwapPulse network: your on-chain identity, your card possession attestations, cards you have anchored on chain, your network stake, and any cross-chain transfers. It is self-custodial, which means <b>your private key never leaves your device</b> and no SwapPulse administrator can move your assets.' },
      ]},
      { title: 'What you will find there', blocks: [
        { type: 'list', items: [
          '<b>Smart Account:</b> Your on-chain identity, its status, and its account address.',
          '<b>Card Possession Attestations:</b> Proof that you physically hold the cards you say you hold.',
          '<b>On-Chain Cards:</b> Verified cards anchored on the network as your own tokens.',
          '<b>Community Staking:</b> Back accountable community operators with testnet stake.',
          '<b>Cross-Chain:</b> Move a token amount or an anchored card to another chain.',
        ]},
      ]},
      { icon: 'Lock', title: 'Who can use it', blocks: [
        { type: 'p', text: 'Wallet and attestation features are reserved for accounts confirmed as 18 or over. Set your age band in Settings first. Every collecting, trading, and social feature works without a wallet, so nothing is gated behind the chain.' },
      ]},
      { icon: 'Heart', title: 'Free and open source', blocks: [
        { type: 'p', text: 'There are no protocol fees for collectors on the current SwapPulse testnet. Staking is being developed as the accountability and incentive layer for community-run network services. Today the testnet still uses a single Starknet Devnet runtime, so staking does not yet provide decentralised consensus validation. SwapPulse itself is free, ad-free, donation-funded, and open source, so you can audit or self-host every part of this.' },
      ]},
      { variant: 'warning', title: 'Alpha limitations', blocks: [
        { type: 'list', items: [
          'The network currently runs as a testnet. Treat anything held there as test data, not as value.',
          'Some features stay disabled until the network reports itself verified and ready.',
        ]},
      ]},
    ],
  },

  'chain-identity': {
    title: 'On-Chain Identity',
    subtitle: 'Create your self-custodial smart account',
    sections: [
      { icon: 'ShieldCheck', title: 'What is an on-chain identity?', blocks: [
        { type: 'p', text: 'Your on-chain identity is a smart account on the SwapPulse network that belongs only to you. It is what signs your attestations, holds your anchored cards, and carries your staking position. It is bound to a signing key created and encrypted inside your own browser, so it cannot be taken over by the platform.' },
      ]},
      { icon: 'Key', title: 'Setting it up', blocks: [
        { type: 'steps', items: [
          'Confirm your age band in Settings, wallet features require 18+.',
          'Open the Wallet page. It checks that the network is verified and ready.',
          'Create your device signer. The private key is generated and encrypted on this device.',
          'Reserve your identity. Only the public key is sent, never the private key.',
          'Secure your identity on chain. This deploys your account and registers it.',
        ]},
      ]},
      { icon: 'Activity', title: 'Understanding the status', blocks: [
        { type: 'list', items: [
          '<b>Pending:</b> Your identity is reserved but not yet confirmed by the network.',
          '<b>Registered:</b> Confirmed on chain. You can now attest, anchor, stake, and bridge.',
          '<b>Recovered:</b> Restored through the recovery process after a lost signer.',
          '<b>Merged:</b> Consolidated with another identity record for the same collector.',
          '<b>Failed:</b> A setup step did not complete. Your reservation is safe, you can retry.',
        ]},
      ]},
      { icon: 'AlertTriangle', title: 'One device, one signer', blocks: [
        { type: 'p', text: 'A reserved identity is bound to the signer that reserved it. If you open the Wallet on a different device, SwapPulse tells you that this device holds a different signer and will not let you overwrite it, because a mismatched signer can never produce a valid signature. Use the recovery process instead of replacing the signer.' },
      ]},
      { variant: 'warning', title: 'Keep your key', blocks: [
        { type: 'list', items: [
          'Clearing your browser storage removes the encrypted signer from that device.',
          'SwapPulse cannot recreate your private key for you, that is what self-custody means.',
        ]},
      ]},
    ],
  },

  'card-attestations': {
    title: 'Card Possession Attestations',
    subtitle: 'Prove you physically hold your cards',
    sections: [
      { icon: 'Camera', title: 'What is an attestation?', blocks: [
        { type: 'p', text: 'An attestation is evidence that you physically hold a card, not just that you typed it into a database. You photograph the card in your hands, and SwapPulse compares your photos against the reference image for that card to judge whether the match is genuine. The result is a trust level that travels with the card wherever it is used.' },
      ]},
      { title: 'The four trust levels', blocks: [
        { type: 'list', items: [
          '<b>Level 0, self-attested:</b> You added the card to your collection yourself.',
          '<b>Level 1, scanned:</b> You submitted photos of the physical card.',
          '<b>Level 2, verified scan:</b> Your photos matched the reference card with high confidence.',
          '<b>Level 3, graded:</b> A grading certificate from PSA, BGS, or CGC was confirmed.',
        ]},
      ]},
      { icon: 'Plus', title: 'Attesting a card', blocks: [
        { type: 'steps', items: [
          'Open the Wallet page and find Card Possession Attestations.',
          'Pick a card from your collection that is not yet verified.',
          'Photograph the physical card, up to four photos, front and back help.',
          'Submit. The photos are compared against the reference card image.',
          'The result shows your confidence score, any anomalies, and your trust level.',
        ]},
      ]},
      { icon: 'Eye', title: 'What the check looks for', blocks: [
        { type: 'p', text: 'The comparison checks that the card in your photos is the card you claim, and looks for signs that a photo is a picture of a screen rather than a physical card. Anomalies are reported back to you so you can retake a photo in better light or at a better angle.' },
      ]},
      { icon: 'Scale', title: 'Why it matters for trading', blocks: [
        { type: 'p', text: 'When every card you offer in a trade listing carries a verified attestation, your listing is marked as possession verified. Other collectors can see at a glance that you actually hold what you are offering, which is the strongest trust signal on the platform.' },
      ]},
      { variant: 'warning', title: 'Limits', blocks: [
        { type: 'list', items: [
          'Assisted verification is rate limited to ten attempts per hour per collector.',
          'A verified session is short lived, so anchor the card on chain soon after verifying.',
          'A failed check is not an accusation, retake the photos with clearer lighting and try again.',
        ]},
      ]},
    ],
  },

  staking: {
    title: 'Community Staking',
    subtitle: 'Back accountable SwapPulse operators',
    sections: [
      { icon: 'ShieldCheck', title: 'What is staking?', blocks: [
        { type: 'p', text: 'SwapPulse staking is the planned economic accountability layer for community-run services. You can either run an operator with your own stake or delegate to an operator you trust. On the current testnet this stake backs operator duties such as availability, indexing and verification services. It does not yet secure decentralised blockchain consensus because the testnet still runs on one Starknet Devnet runtime.' },
      ]},
      { title: 'Two ways to take part', blocks: [
        { type: 'list', items: [
          '<b>Delegate:</b> Back a community operator with your stake. This is the simplest participation path.',
          '<b>Register as an operator:</b> Bond your own stake, publish an operator identity and take responsibility for supported network services.',
        ]},
      ]},
      { icon: 'Plus', title: 'Delegating', blocks: [
        { type: 'steps', items: [
          'Secure your on-chain identity first, staking needs a confirmed account.',
          'Open Community Staking on the Wallet page and choose Delegate.',
          'Enter the operator address and the amount you want to stake.',
          'Confirm. Your position appears in the list once the network accepts it.',
        ]},
      ]},
      { icon: 'Users', title: 'Running a community operator', blocks: [
        { type: 'p', text: 'Registering as an operator bonds your own stake and lets you set a commission, capped so delegators are protected from unreasonable rates. Operators are expected to keep supported services available, monitor them, respond to incidents and follow upgrade/security requirements. You can increase your self-stake later, or exit and unbond if you stop operating.' },
      ]},
      { icon: 'Clock', title: 'Unbonding and withdrawal', blocks: [
        { type: 'p', text: 'Stake is not instantly liquid. When you undelegate, it stops contributing active operator weight immediately but remains locked during the unbonding period. It can only be withdrawn after the delay. This keeps funds accountable during the exit window and prevents operators from escaping a pending penalty by instantly unstaking.' },
      ]},
      { icon: 'Medal', title: 'Proof of Usership', blocks: [
        { type: 'p', text: 'Real collecting activity, completed trades, vouches, journals, and pack openings, is aggregated into a usership score each period. That score scales your own staked weight, so people who genuinely use the platform carry more weight than people who simply hold a large stake. The score is capped so no single collector can dominate.' },
      ]},
      { variant: 'warning', title: 'Alpha limitations', blocks: [
        { type: 'list', items: [
          'Staking runs on the testnet, so amounts are test values, not money.',
          'Current staking secures operator participation and service accountability, not decentralised consensus.',
          'Operator rewards and production token economics are not live until the Phase 2 contracts are deployed and governance parameters are published.',
          'Staking is only available once your identity is confirmed on chain.',
        ]},
      ]},
    ],
  },

  'account-recovery': {
    title: 'Account Recovery',
    subtitle: 'Bind a new device to your smart account',
    sections: [
      { icon: 'ShieldCheck', title: 'When to use recovery', blocks: [
        { type: 'p', text: 'Your signing key lives only on the device that created it, so a lost, wiped, or replaced device means that device can no longer sign for your smart account. Recovery lets you bind a <b>new</b> device key to the same account, without SwapPulse ever holding your key.' },
      ]},
      { icon: 'Key', title: 'How it works', blocks: [
        { type: 'steps', items: [
          'Sign in to SwapPulse as normal, then open Recover your account from the Wallet page.',
          'Verify the code sent to your account email, key changes always need a fresh code.',
          'Start recovery. A new signing key is created on this device and only its public half is sent.',
          'Wait out the on-chain waiting period. Nothing changes on your account until it ends.',
          'Come back and complete the recovery. Your new device key now controls the account.',
        ]},
      ]},
      { icon: 'Clock', title: 'Why the waiting period exists', blocks: [
        { type: 'p', text: 'The delay is your protection. If somebody else ever started a recovery on your account, you would be notified and could cancel it before it takes effect. That is why recovery is deliberately slow rather than instant.' },
      ]},
      { icon: 'AlertTriangle', title: 'Cancelling a recovery', blocks: [
        { type: 'p', text: 'While a recovery is scheduled you can cancel it at any point from the same page. Cancelling leaves your existing key in control and clears the pending change.' },
      ]},
      { variant: 'warning', title: 'Good to know', blocks: [
        { type: 'list', items: [
          'Recovery replaces the key on the device you are using, so run it on the device you intend to keep.',
          'Your anchored cards, attestations, and stake stay with the same account, only the signing key changes.',
          'Recovery runs on the testnet during the alpha, alongside the rest of the wallet features.',
        ]},
      ]},
    ],
  },

  'on-chain-cards': {
    title: 'On-Chain Cards & Cross-Chain',
    subtitle: 'Anchor verified cards and move them',
    sections: [
      { icon: 'Layers', title: 'What are on-chain cards?', blocks: [
        { type: 'p', text: 'Once you have verified that you physically hold a card, you can anchor it on the SwapPulse network as your own token. The trust level from your attestation is carried into the token, so the proof of possession travels with it. Anchored cards are bound to the collector who verified them, they are not a market to be traded away from you.' },
      ]},
      { icon: 'Plus', title: 'Anchoring a card', blocks: [
        { type: 'steps', items: [
          'Attest the card first, an anchor needs a valid verification.',
          'Open On-Chain Cards on the Wallet page.',
          'Pick a verified card from the list of cards ready to anchor.',
          'Confirm. The card appears under your on-chain cards once the network confirms it.',
        ]},
      ]},
      { icon: 'Shield', title: 'Why anchor at all?', blocks: [
        { type: 'p', text: 'An anchored card is a claim nobody can quietly edit, including SwapPulse. It is the difference between a database row that says you own a card and a record you can prove you own. The same verification cannot be reused to anchor the same card twice.' },
      ]},
      { icon: 'ArrowLeftRight', title: 'Cross-chain transfers', blocks: [
        { type: 'p', text: 'Cross-Chain lets you move a token amount or an anchored card from the SwapPulse network to another chain, currently Ethereum, a supported layer 2, or Solana. Choose what you are sending, pick the destination chain, enter the recipient address, and confirm. Recent transfers are listed with their status.' },
      ]},
      { icon: 'Clock', title: 'Transfer status', blocks: [
        { type: 'list', items: [
          '<b>Submitted:</b> Sent from the SwapPulse network.',
          '<b>Pending relay:</b> Waiting to be delivered on the destination chain.',
          '<b>Completed:</b> Delivered, with a transaction on the destination chain.',
          '<b>Refunded or failed:</b> The transfer did not complete and is reported back to you.',
        ]},
      ]},
      { variant: 'warning', title: 'Check the address', blocks: [
        { type: 'list', items: [
          'A destination address cannot be corrected once a transfer is submitted, check it twice.',
          'The SwapPulse network stays the canonical home for an anchored card.',
          'Cross-chain features run on the testnet during the alpha.',
        ]},
      ]},
    ],
  },
};