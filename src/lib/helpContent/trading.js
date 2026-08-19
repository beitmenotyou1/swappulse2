// Trading help pages: trade-board, trade-status-board, trade-threads, trade-dashboard, trust

export const tradingPages = {
  'trade-board': {
    title: 'Trade Board',
    subtitle: 'List cards and negotiate trades',
    sections: [
      { icon: 'ArrowLeftRight', title: 'What is the Trade Board?', blocks: [
        { type: 'p', text: 'The Trade Board is the open marketplace where collectors list cards they have and cards they want. Browse listings, filter by set or rarity, and open a trade thread with anyone whose listing interests you. Every trade is backed by fairness scoring and reputation.' },
      ]},
      { icon: 'Plus', title: 'Creating a trade listing', blocks: [
        { type: 'steps', items: [
          'Go to the Trade Board and click New Listing.',
          'Select the card you have from your collection or by search.',
          'Describe what you want in return (a specific card, or a general want like "any Charizard").',
          'Optionally scope the listing to one of your circles.',
          'Publish. Your listing appears on the board and on the relevant card pages.',
        ]},
      ]},
      { title: 'Browsing and filtering', blocks: [
        { type: 'list', items: [
          '<b>By card:</b> Filter to listings offering or seeking a specific card.',
          '<b>By circle:</b> Show only listings from collectors in your circles.',
          '<b>By set:</b> Narrow to a specific expansion.',
          '<b>By status:</b> Active listings only, or include pending trades.',
        ]},
      ]},
      { icon: 'MessageSquare', title: 'Starting a trade', blocks: [
        { type: 'p', text: 'When you find a listing you\'re interested in, click Start Trade to open a private trade thread with the lister. You\'ll negotiate the details there, see the next article on Trade Threads.' },
      ]},
      { icon: 'Scale', title: 'Fairness scoring', blocks: [
        { type: 'p', text: 'Each trade thread includes a fairness calculator that compares the market values of the cards on both sides. It\'s a guide, not a rule, but it helps both collectors agree on a balanced swap.' },
      ]},
      { variant: 'warning', title: 'Known limitations', blocks: [
        { type: 'list', items: [
          'Listings expire after 90 days by default. Renew if still active.',
          'Circle-scoped listings are only visible to members of that circle.',
          'SwapPulse facilitates the connection, it does not handle shipping or escrow.',
        ]},
      ]},
    ],
  },

  'trade-status-board': {
    title: 'Trade Status Board',
    subtitle: 'A community-wide view of active trades',
    sections: [
      { icon: 'LayoutDashboard', title: 'What is the Trade Status Board?', blocks: [
        { type: 'p', text: 'The Trade Status Board is a community-wide dashboard showing active and recent trades across SwapPulse. It gives you a live sense of what\'s being traded, shipping progress, and recently completed swaps, without exposing private negotiation details.' },
      ]},
      { title: 'What you can see', blocks: [
        { type: 'list', items: [
          '<b>Active trades:</b> Trades currently being negotiated or awaiting shipment.',
          '<b>Shipping status:</b> Whether cards have been sent, received, or are in transit.',
          '<b>Recently completed:</b> Finished trades, useful for seeing what the community is swapping.',
          '<b>Trade counts:</b> Aggregate activity metrics for the community.',
        ]},
      ]},
      { icon: 'Truck', title: 'Shipping status', blocks: [
        { type: 'p', text: 'Trade participants update shipping status as cards move: prepared, sent, received. The Status Board reflects these updates so the community can see trade progress at a glance. Only the two trading parties see the full private thread and addresses.' },
      ]},
      { icon: 'Eye', title: 'Privacy', blocks: [
        { type: 'p', text: 'The Status Board shows trade summaries (cards involved, status, participants) but never private negotiation messages, addresses, or tracking numbers. Those stay in your private trade thread.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Use the Status Board to find active traders before posting your own listing.',
          'Completed trades contribute to both parties\' reputation and trust scores.',
        ]},
      ]},
    ],
  },

  'trade-threads': {
    title: 'Trade Threads',
    subtitle: 'Negotiate trades in private chats',
    sections: [
      { icon: 'MessageSquare', title: 'What is a trade thread?', blocks: [
        { type: 'p', text: 'A trade thread is a private, end-to-end encrypted chat between two collectors negotiating a trade. You discuss the cards, agree on terms, use the fairness calculator, optionally build a multi-party trade chain, and track shipping, all in one place.' },
      ]},
      { title: 'Starting a thread', blocks: [
        { type: 'steps', items: [
          'Find a listing on the Trade Board or a card page that interests you.',
          'Click Start Trade. A private thread opens with the lister.',
          'Discuss what cards are on each side and any conditions.',
          'Use the fairness calculator to check the balance.',
          'When both sides agree, mark the trade as accepted and proceed to shipping.',
        ]},
      ]},
      { icon: 'Scale', title: 'Fairness calculator', blocks: [
        { type: 'p', text: 'The fairness calculator compares the total market value of cards on each side and shows a balance indicator. It pulls live TCGDex prices. It\'s advisory, both collectors decide what\'s fair, but it helps avoid lopsided trades.' },
      ]},
      { icon: 'Link2', title: 'Trade chains', blocks: [
        { type: 'p', text: 'For circular trades involving 3 to 5 collectors (A wants B\'s card, B wants C\'s, C wants A\'s), SwapPulse supports trade chains. Each link ships to the next, and the chain coordinator tracks the whole sequence. This unlocks trades that wouldn\'t work as a simple two-way swap.' },
      ]},
      { icon: 'Truck', title: 'Shipping', blocks: [
        { type: 'p', text: 'Once accepted, update the shipping status in the thread: prepared, sent, received. Both parties can see the status. Addresses and tracking details are shared only within the private thread.' },
      ]},
      { icon: 'Flag', title: 'Disputes and feedback', blocks: [
        { type: 'p', text: 'If something goes wrong, you can open a dispute from the trade thread. After completion, leave trading feedback to build the other collector\'s reputation. Honest feedback keeps the community trustworthy.' },
      ]},
      { variant: 'warning', title: 'Known limitations', blocks: [
        { type: 'list', items: [
          'Trade messages are end-to-end encrypted, clearing your browser data may lose access to the thread on that device.',
          'SwapPulse does not handle escrow or payment, trades are card-for-card or card-for-cash arranged privately.',
        ]},
      ]},
    ],
  },

  'trade-dashboard': {
    title: 'Trade Dashboard',
    subtitle: 'Manage all your trades in one place',
    sections: [
      { icon: 'LayoutDashboard', title: 'What is the Trade Dashboard?', blocks: [
        { type: 'p', text: 'The Trade Dashboard is your personal command centre for trading. See every trade you\'re involved in, active and historical, track shipping status, manage listings, and review your trade stats, all from one screen.' },
      ]},
      { icon: 'ListChecks', title: 'Active trades', blocks: [
        { type: 'p', text: 'The active trades panel shows every trade thread you\'re currently part of, with its current status: negotiating, accepted, shipping, or awaiting feedback. Jump straight into any thread to continue the conversation.' },
      ]},
      { icon: 'Truck', title: 'Shipping tracking', blocks: [
        { type: 'p', text: 'For accepted trades, the dashboard shows shipping status at a glance: which trades are prepared, in transit, or received. Update your own shipping status from here or from within the trade thread.' },
      ]},
      { icon: 'History', title: 'Trade history', blocks: [
        { type: 'p', text: 'Your completed trades are listed with final outcomes and feedback. Use this to review past swaps, see which collectors you\'ve traded with, and track your trading activity over time.' },
      ]},
      { title: 'What you can manage', blocks: [
        { type: 'list', items: [
          '<b>Your listings:</b> Edit, renew, or cancel your active trade listings.',
          '<b>Active trades:</b> Open, update, or dispute any ongoing trade thread.',
          '<b>Feedback:</b> Leave feedback for completed trades and view feedback received.',
          '<b>Stats:</b> Total trades, completion rate, and reputation summary.',
        ]},
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Leave feedback promptly after receiving cards, it helps the other collector\'s reputation and yours.',
          'Update shipping status as soon as you send or receive so your partner stays informed.',
        ]},
      ]},
    ],
  },

  trust: {
    title: 'Trust & Reputation',
    subtitle: 'How trust works on SwapPulse',
    sections: [
      { icon: 'ShieldCheck', title: 'What is Trust?', blocks: [
        { type: 'p', text: 'Trust is SwapPulse\'s reputation system. It helps you decide who to trade with by surfacing vouches, trading feedback, and a trusted-trader score for every collector. Trust is earned through honest participation, not bought.' },
      ]},
      { title: 'How trust is built', blocks: [
        { type: 'list', items: [
          '<b>Trading feedback:</b> After each completed trade, both parties leave feedback (positive, neutral, or negative). This is the core signal.',
          '<b>Vouches:</b> Experienced collectors can vouch for others they\'ve traded with successfully. Vouches carry weight based on the voucher\'s own reputation.',
          '<b>Trade history:</b> The number and consistency of completed trades contributes to your score.',
          '<b>Trusted Trader badge:</b> Collectors who meet the threshold get a visible badge on their profile and listings.',
        ]},
      ]},
      { icon: 'ThumbsUp', title: 'Leaving feedback', blocks: [
        { type: 'steps', items: [
          'After a trade completes, go to your Trade Dashboard or the trade thread.',
          'Click Leave Feedback.',
          'Choose positive, neutral, or negative and write a short comment.',
          'Submit. Your feedback appears on the other collector\'s trust profile.',
        ]},
      ]},
      { icon: 'Award', title: 'Vouching for someone', blocks: [
        { type: 'p', text: 'If you\'ve had a positive trade with a collector, you can vouch for them on their Trust page. Your vouch adds to their trust score based on your own standing. Vouches from highly-trusted collectors carry more weight.' },
      ]},
      { icon: 'AlertTriangle', title: 'Disputes', blocks: [
        { type: 'p', text: 'If a trade goes wrong, open a dispute from the trade thread. Disputes are visible to moderators who can help mediate. Repeated disputes against a collector affect their trust score and can lead to enforcement action.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Check a collector\'s trust score and feedback before starting a trade.',
          'Always leave honest feedback, it protects the whole community.',
          'New collectors start with a neutral score, everyone gets a fair start.',
        ]},
      ]},
    ],
  },
};