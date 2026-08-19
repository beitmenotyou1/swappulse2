// Collection & Catalogue help pages: explore, card-detail, sets, collection, grading, market-watch

export const collectionPages = {
  explore: {
    title: 'Explore',
    subtitle: 'Browse the full Pokémon TCG catalogue',
    sections: [
      { icon: 'Compass', title: 'What is Explore?', blocks: [
        { type: 'p', text: 'Explore is your gateway to the entire Pokémon TCG catalogue, powered by the open TCGDex database. Search for any card by name, browse by set, filter by rarity or illustrator, and discover collectors who share your interests.' },
      ]},
      { icon: 'Search', title: 'Searching for cards', blocks: [
        { type: 'steps', items: [
          'Type a card name, set code, or collector number into the search bar at the top of the page.',
          'Results appear instantly as you type, merged across all nine supported languages.',
          'If your search doesn\'t match in English, SwapPulse automatically tries French, German, Italian, Spanish, Portuguese, Japanese, Chinese, and Korean before giving up.',
          'Tap any result to open the card\'s detail page.',
        ]},
      ]},
      { icon: 'Filter', title: 'Filtering and browsing', blocks: [
        { type: 'list', items: [
          '<b>By set:</b> Open the Sets page to browse every expansion, then drill into a set to see all its cards.',
          '<b>By rarity:</b> Use the rarity filter to narrow results to Common, Uncommon, Rare, Holo, or Secret Rare.',
          '<b>By people:</b> Switch to the People tab to search for collectors by handle or name.',
          '<b>By community:</b> Switch to the Posts tab to see recent community activity matching your search.',
        ]},
      ]},
      { icon: 'Heart', title: 'Wishlist from search', blocks: [
        { type: 'p', text: 'When browsing card results, you can select multiple cards and add them to your wishlist in one action. A selection toolbar appears at the bottom of the grid when you have cards selected.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Card names switch to your selected language automatically, so you can search in your native tongue.',
          'If a search returns nothing, try the set name instead of the set code, official codes don\'t always match TCGDex IDs.',
          'The Trending Cards rail on the home feed shows what the community is talking about right now.',
        ]},
      ]},
    ],
  },

  'card-detail': {
    title: 'Card Detail Pages',
    subtitle: 'Every card is a social hub',
    sections: [
      { icon: 'CreditCard', title: 'What is a card detail page?', blocks: [
        { type: 'p', text: 'Every card in the TCGDex catalogue has its own page at /card/:cardId. It\'s not just a static stats page, it\'s a social hub that surfaces everything the community is saying, trading, and pulling about that specific card, merged from local SwapPulse posts and federated Bluesky posts.' },
      ]},
      { title: 'What you\'ll find', blocks: [
        { type: 'list', items: [
          '<b>Card image and stats:</b> Full art, set name, collector number, rarity, and variant pricing.',
          '<b>Price history chart:</b> Market price trends over time pulled from TCGDex pricing data.',
          '<b>Variant pricing:</b> Normal, holo, and reverse holo market prices side by side.',
          '<b>Evolution chain:</b> The card\'s pre-evolutions and evolutions, linked for easy browsing.',
          '<b>Posts tab:</b> Community posts and discussions that reference this card.',
          '<b>Trades tab:</b> Active trade listings offering or seeking this card.',
          '<b>Pack Openings tab:</b> Recent pack-opening posts featuring this card.',
          '<b>Reviews:</b> Multi-axis collector reviews (artwork, playability, collectibility, investment).',
        ]},
      ]},
      { icon: 'Star', title: 'Reviewing a card', blocks: [
        { type: 'steps', items: [
          'Scroll to the Reviews section on the card page.',
          'Rate the card 1 to 5 on artwork, playability, collectibility, and investment.',
          'Write an optional review (up to 2,000 characters).',
          'Submit. Your review is mirrored to your AT Protocol PDS as a portable record.',
        ]},
      ]},
      { icon: 'MessageSquare', title: 'Posting about a card', blocks: [
        { type: 'p', text: 'From the card page you can compose a post that attaches this card. The post renders richly on both SwapPulse and Bluesky with a deep link back to the card page.' },
      ]},
      { icon: 'ArrowLeftRight', title: 'Trading this card', blocks: [
        { type: 'p', text: 'The Trades tab shows every active listing offering or seeking this card. Tap a listing to open the seller\'s profile or start a trade thread.' },
      ]},
      { icon: 'Package', title: 'Adding to your collection', blocks: [
        { type: 'p', text: 'Use the Add to Collection button to add the card to your collection with condition, variant, and quantity. Use the wishlist heart to save it for later.' },
      ]},
    ],
  },

  sets: {
    title: 'Sets & Checklists',
    subtitle: 'Browse sets, track completion, and download checklists',
    sections: [
      { icon: 'Library', title: 'What is the Sets page?', blocks: [
        { type: 'p', text: 'The Sets page lists every Pokémon TCG expansion in the TCGDex catalogue. Browse by series, open a set to see all its cards, track your completion percentage, download printable checklists, and find set buddies, other collectors working on the same set.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Browse sets:</b> Filter by series (Scarlet & Violet, Sword & Shield, Sun & Moon, etc.) and release date.',
          '<b>View all cards:</b> Open a set to see every card in collector-number order with images and rarities.',
          '<b>Track completion:</b> Your completion percentage updates live as you add cards to your collection.',
          '<b>Find set buddies:</b> See other collectors working on the same set and connect with them.',
          '<b>Download checklists:</b> Export a printable PDF checklist for any set.',
        ]},
      ]},
      { icon: 'CheckCircle', title: 'Tracking set completion', blocks: [
        { type: 'steps', items: [
          'Open the set you want to track.',
          'The completion bar shows how many cards you own out of the set total.',
          'Add cards to your collection from the set page or from individual card pages.',
          'Missing cards are listed at the bottom so you can see exactly what you still need.',
        ]},
      ]},
      { icon: 'Users', title: 'Set buddies', blocks: [
        { type: 'p', text: 'Set buddies are other collectors actively working on the same set. SwapPulse matches you based on shared set activity so you can trade duplicates, share progress, and celebrate completions together.' },
      ]},
      { icon: 'Download', title: 'Downloading checklists', blocks: [
        { type: 'p', text: 'Every set has a downloadable PDF checklist. Use it to track your collection offline, take it to a trade night, or share with friends. The checklist reflects your owned cards with checkmarks.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Official set codes (like PAL or MEW) don\'t always match TCGDex set IDs, so browse by name if a code search fails.',
          'Set completion counts unique card URIs, so a holo and a reverse holo of the same card count separately.',
        ]},
      ]},
    ],
  },

  collection: {
    title: 'Collection',
    subtitle: 'Track every card you own',
    sections: [
      { icon: 'Layers', title: 'What is the Collection page?', blocks: [
        { type: 'p', text: 'Your collection is the heart of SwapPulse. Track every card you own with condition, variant, and quantity. See your total portfolio value, set completion percentages, duplicates, and export everything for insurance or backup.' },
      ]},
      { icon: 'Plus', title: 'Adding cards', blocks: [
        { type: 'steps', items: [
          'Search for a card from Explore or open any card detail page.',
          'Click Add to Collection.',
          'Choose the condition (mint, near mint, excellent, good, damaged), variant (normal, holo, reverse holo), and quantity.',
          'Save. The card appears in your collection and updates your portfolio value and set completion.',
        ]},
        { type: 'p', text: 'You can also bulk import via CSV from the Bulk Import/Export panel on the Collection page.' },
      ]},
      { title: 'What you can see', blocks: [
        { type: 'list', items: [
          '<b>Portfolio value:</b> Total estimated value of your collection based on TCGDex market prices.',
          '<b>Set completion:</b> Percentage complete for each set you own cards from.',
          '<b>Duplicates tab:</b> Cards you own multiple copies of, flagged for potential trades.',
          '<b>Analytics:</b> Breakdowns by rarity, set, condition, and value distribution.',
          '<b>Collection analytics dashboard:</b> Charts showing your collection growth and value over time.',
        ]},
      ]},
      { icon: 'Copy', title: 'Managing duplicates', blocks: [
        { type: 'p', text: 'The Duplicates tab shows cards you own more than one of. These are prime candidates for trading. From there you can jump straight to creating a trade listing for any duplicate.' },
      ]},
      { icon: 'FileDown', title: 'Exporting your collection', blocks: [
        { type: 'list', items: [
          '<b>CSV export:</b> Download your full collection as a spreadsheet for backup or import elsewhere.',
          '<b>Insurance export:</b> Generate a formatted PDF with card details and values for insurance purposes.',
          '<b>Bulk import:</b> Import a CSV to add many cards at once.',
        ]},
      ]},
      { icon: 'TrendingUp', title: 'Collection value', blocks: [
        { type: 'p', text: 'Portfolio value is estimated from TCGDex pricing data and updates when prices sync. It\'s an estimate, not a guarantee of resale value. Condition and variant affect real-world value significantly.' },
      ]},
      { variant: 'warning', title: 'Known limitations', blocks: [
        { type: 'list', items: [
          'Portfolio value depends on TCGDex pricing availability, some cards may not have price data.',
          'Bulk import requires a specific CSV format, see the import panel for the template.',
        ]},
      ]},
    ],
  },

  grading: {
    title: 'Grading',
    subtitle: 'Prepare grading submissions and track condition reports',
    sections: [
      { icon: 'Award', title: 'What is the Grading page?', blocks: [
        { type: 'p', text: 'The Grading page helps you prepare cards for professional grading submission (PSA, Beckett, CGC, etc.). Track which cards you\'re submitting, record their pre-grade condition, and keep a history of your grading results.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Create a submission:</b> Group cards you\'re sending to a grading company into a single submission batch.',
          '<b>Record condition:</b> Note the pre-submission condition of each card (centering, corners, edges, surface).',
          '<b>Track status:</b> Mark submissions as sent, in review, returned, and record the final grade.',
          '<b>View history:</b> See all your past grading submissions and their results.',
        ]},
      ]},
      { icon: 'FileText', title: 'Creating a grading submission', blocks: [
        { type: 'steps', items: [
          'Open the Grading page from your navigation.',
          'Click New Submission and select a grading company (PSA, BGS, CGC, or other).',
          'Add cards from your collection to the submission batch.',
          'Record the condition details for each card.',
          'Save the submission. You can update its status as it progresses.',
        ]},
      ]},
      { icon: 'Send', title: 'Tracking status', blocks: [
        { type: 'p', text: 'Update the submission status as it moves through the grading process: prepared, sent, in review, returned. When the card comes back, record the final grade so it\'s linked to your collection entry.' },
      ]},
      { icon: 'Clock', title: 'Why track grades?', blocks: [
        { type: 'p', text: 'Graded cards carry a verified condition and grade that affects their value. Keeping a record lets you compare pre-grade condition assessments with actual results over time, and provides provenance when trading or selling.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Only add cards that are actually in your collection to a submission, so grading records stay linked.',
          'Record honest condition assessments, they help you learn which flaws graders flag.',
        ]},
      ]},
    ],
  },

  'market-watch': {
    title: 'Market Watch',
    subtitle: 'Track card prices and set alerts',
    sections: [
      { icon: 'BarChart3', title: 'What is Market Watch?', blocks: [
        { type: 'p', text: 'Market Watch is your Pokémon TCG price dashboard. Track cards you\'re interested in, watch price trends over time, set alerts for price drops or spikes, and see your portfolio\'s total value at a glance. Prices are sourced from the TCGDex open catalogue.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Track cards:</b> Add any card to your watchlist to follow its price.',
          '<b>Price charts:</b> View price history charts for normal, holo, and reverse holo variants.',
          '<b>Set alerts:</b> Get notified when a card\'s price crosses your target threshold.',
          '<b>Market movers:</b> See the biggest gainers and losers across the community.',
          '<b>Portfolio value:</b> Your collection\'s total estimated market value, updated with prices.',
        ]},
      ]},
      { icon: 'Bell', title: 'Setting a price alert', blocks: [
        { type: 'steps', items: [
          'Open Market Watch and find a tracked card, or add a new one.',
          'Click Set Alert.',
          'Choose whether you want to be notified when the price rises above or falls below a threshold.',
          'Enter your target price.',
          'Save. You\'ll get a notification when the condition is met.',
        ]},
      ]},
      { icon: 'TrendingUp', title: 'Market movers', blocks: [
        { type: 'p', text: 'The movers section shows cards with the biggest price changes over the selected period. Use it to spot trends, find buying opportunities, or identify cards that are heating up in the community.' },
      ]},
      { icon: 'Wallet', title: 'Portfolio value', blocks: [
        { type: 'p', text: 'Your portfolio value is the sum of your collection\'s current market prices. It updates when pricing data syncs. Remember, this is an estimate based on TCGDex data, actual resale value depends on condition, variant, and market demand.' },
      ]},
      { variant: 'warning', title: 'Known limitations', blocks: [
        { type: 'list', items: [
          'Price data depends on TCGDex availability, some older or obscure cards may lack pricing.',
          'Alerts check on a sync cycle, not in real time, so there may be a short delay.',
        ]},
      ]},
    ],
  },
};