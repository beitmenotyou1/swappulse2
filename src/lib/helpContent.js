// Structured help-page content for all SwapPulse Help sub-pages.
// Each page's content is defined here as structured data (not JSX) so it can
// be translated by the translate-help-content backend function and rendered
// by HelpContentRenderer. The useHelpContent hook returns the translated
// version from TranslationOverride when available, falling back to the English
// content defined here.
//
// Block types: 'p' (paragraph), 'steps' (ordered list), 'list' (unordered list)
// Inline <b>...</b> tags in text are rendered as bold by HelpContentRenderer.

export const HELP_CONTENT = {
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

  'home-feed': {
    title: 'Home Feed',
    subtitle: 'Your personalised collector feed',
    sections: [
      { icon: 'Home', title: 'What is the Home Feed?', blocks: [
        { type: 'p', text: 'The Home Feed is your personalised stream of collector activity. It blends posts from people you follow, pack openings, trending cards, stories, live voice spaces, and community highlights into one scrollable page.' },
      ]},
      { title: 'What you\'ll see', blocks: [
        { type: 'list', items: [
          '<b>For You feed:</b> Posts from followed accounts, hashtag follows, and recommended content.',
          '<b>Stories bar:</b> Ephemeral 24-hour stories from collectors you follow, at the top.',
          '<b>Trending Cards rail:</b> The most talked-about cards right now, ranked by community activity.',
          '<b>Live spaces:</b> Active voice spaces with a pulsing live ring when someone is broadcasting.',
          '<b>Pack openings:</b> Fresh pull posts from the community.',
          '<b>Card of the Day:</b> A featured card rotated daily.',
        ]},
      ]},
      { icon: 'TrendingUp', title: 'Trending Cards', blocks: [
        { type: 'p', text: 'The Trending Cards rail ranks cards by recent social activity: posts, discussions, and mentions. Tap any card to jump to its social detail page and see what the community is saying.' },
      ]},
      { icon: 'Users', title: 'Who to Follow', blocks: [
        { type: 'p', text: 'The sidebar suggests collectors to follow based on your collection, trades, and interests. Follow collectors to see their posts, pack openings, and stories in your feed.' },
      ]},
      { icon: 'Sparkles', title: 'Making it yours', blocks: [
        { type: 'p', text: 'Your feed improves as you follow more collectors, follow hashtags, and interact with posts. The more you engage, the better SwapPulse gets at surfacing content you\'ll enjoy.' },
      ]},
    ],
  },

  compose: {
    title: 'Composing Posts',
    subtitle: 'Write posts, attach cards, and cross-post',
    sections: [
      { icon: 'PenLine', title: 'What is Compose?', blocks: [
        { type: 'p', text: 'Compose is where you create posts. Write text up to 500 characters, attach a card, add hashtags, set visibility and reply permissions, and optionally cross-post to Bluesky. Every post is mirrored to your AT Protocol PDS so it\'s portable.' },
      ]},
      { title: 'What you can include', blocks: [
        { type: 'list', items: [
          '<b>Text:</b> Up to 500 characters, with @mentions and #hashtags.',
          '<b>Card attach:</b> Attach a card that renders richly on SwapPulse and as a link card on Bluesky.',
          '<b>Hashtags:</b> Up to 10 hashtags, auto-canonicalised for discovery.',
          '<b>Quote post:</b> Layer your commentary over another post.',
          '<b>Post type:</b> Text, pack opening, trade, or showcase.',
        ]},
      ]},
      { icon: 'Image', title: 'Attaching a card', blocks: [
        { type: 'steps', items: [
          'Click the card-attach bar in the composer.',
          'Search for the card by name or set.',
          'Select it. A preview renders in your post.',
          'Optionally add alt text for screen reader accessibility.',
        ]},
        { type: 'p', text: 'The attached card is mirrored to Bluesky as an external embed with the card image, localised name, and a deep link back to the SwapPulse card page.' },
      ]},
      { icon: 'Hash', title: 'Hashtags', blocks: [
        { type: 'p', text: 'Add hashtags with the # symbol. They\'re canonicalised (lowercased, trimmed) for discovery. Follow a hashtag from its page to see matching posts in your For You feed. You can use up to 10 per post.' },
      ]},
      { icon: 'Eye', title: 'Visibility and replies', blocks: [
        { type: 'list', items: [
          '<b>Public:</b> Visible to everyone, federates publicly to Bluesky.',
          '<b>Followers:</b> Only your followers can see it.',
          '<b>Mentioned:</b> Only mentioned accounts can see it.',
          '<b>Reply policy:</b> Choose who can reply: everybody, nobody, mentioned, or followers.',
        ]},
      ]},
      { icon: 'Repeat2', title: 'Cross-posting to Bluesky', blocks: [
        { type: 'p', text: 'Because SwapPulse is built on the AT Protocol, your posts automatically mirror to your PDS and appear on Bluesky. You can optionally configure cross-posting behaviour in Settings. Your AT Protocol identity (DID and handle) is portable, you\'re not locked in.' },
      ]},
    ],
  },

  'post-detail': {
    title: 'Posts & Replies',
    subtitle: 'View, reply, react, and repost',
    sections: [
      { icon: 'MessageSquare', title: 'What is a post detail page?', blocks: [
        { type: 'p', text: 'Every post has a detail page at /post/:postId (or /post/at/:atUri for federated posts). It shows the full post, its attached card if any, the reply thread, reactions, and reposts. It\'s where conversations happen.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Reply:</b> Add your reply to the thread. Replies respect the post\'s reply policy.',
          '<b>React:</b> Add a reaction (emoji) to the post.',
          '<b>Repost:</b> Repost to your followers, with or without your own commentary (quote).',
          '<b>Quote:</b> Layer your own post over this one as a quote.',
          '<b>Share:</b> Copy the link or share inside SwapPulse.',
          '<b>Report:</b> Flag the post for moderator review if it breaks community rules.',
        ]},
      ]},
      { icon: 'Reply', title: 'Replying', blocks: [
        { type: 'steps', items: [
          'Click Reply on any post or in the detail page.',
          'Write your reply (up to 500 characters).',
          'Post. Your reply appears in the thread below.',
        ]},
        { type: 'p', text: 'Replies are threaded. The original post, parent replies, and the full conversation tree are all visible on the detail page.' },
      ]},
      { icon: 'Heart', title: 'Reactions and likes', blocks: [
        { type: 'p', text: 'React to posts with emoji reactions. Likes are tracked and visible on the post. Your likes are private to you unless you choose to surface them.' },
      ]},
      { icon: 'Repeat2', title: 'Reposting and quoting', blocks: [
        { type: 'p', text: 'Repost to share someone\'s post with your followers. Quote to add your own commentary above the original. Both create a new post that references the original, and both federate to Bluesky.' },
      ]},
      { icon: 'Flag', title: 'Reporting a post', blocks: [
        { type: 'p', text: 'If a post is spam, abusive, or breaks the rules, click Report and choose a reason. It goes to the moderation queue for review. AI moderation also scans posts automatically for harmful content.' },
      ]},
    ],
  },

  hashtags: {
    title: 'Hashtags',
    subtitle: 'Follow topics and discover posts',
    sections: [
      { icon: 'Hash', title: 'What are hashtags?', blocks: [
        { type: 'p', text: 'Hashtags let you tag posts with topics so others can discover them. Every hashtag has a page at /hashtag/:tag showing all posts using it. Follow a hashtag to see matching posts in your For You feed alongside posts from accounts you follow.' },
      ]},
      { title: 'Using hashtags', blocks: [
        { type: 'list', items: [
          'Add up to 10 hashtags per post using the # symbol.',
          'Hashtags are canonicalised: lowercased, trimmed, and deduped for discovery.',
          'Canonical tags are stored separately from your original casing.',
          'Click any hashtag in a post to jump to its hashtag page.',
        ]},
      ]},
      { icon: 'Plus', title: 'Following a hashtag', blocks: [
        { type: 'steps', items: [
          'Open any hashtag page (e.g. /hashtag/charizard).',
          'Click Follow.',
          'Posts using that hashtag now appear in your For You feed.',
          'Unfollow anytime from the same page or your settings.',
        ]},
      ]},
      { icon: 'Eye', title: 'Hashtag pages', blocks: [
        { type: 'p', text: 'Each hashtag page shows a chronological feed of posts using that tag, merged from local SwapPulse posts and federated Bluesky posts. It\'s a topic-focused way to discover collectors who share your interests.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Use specific hashtags (e.g. #shinycharizard) to reach the right audience.',
          'Following a few key hashtags is a great way to build a relevant feed before you follow many accounts.',
        ]},
      ]},
    ],
  },

  profiles: {
    title: 'Profiles',
    subtitle: 'Collector profiles and what\'s on them',
    sections: [
      { icon: 'User', title: 'What is a profile?', blocks: [
        { type: 'p', text: 'Every collector has a profile at /profile/:did (or /u/:handle). It\'s your public collector identity: avatar, handle, bio, stats, binders, journals, trade history, podcasts, and activity. SwapPulse profiles work for both local members and external federated Bluesky users.' },
      ]},
      { title: 'What\'s on a profile', blocks: [
        { type: 'list', items: [
          '<b>Header:</b> Avatar, display name, handle, bio, and follow/message buttons.',
          '<b>Stats:</b> Collection count, trades, vouches, followers, and following.',
          '<b>Posts tab:</b> The collector\'s posts and pack openings.',
          '<b>Binders tab:</b> Their public showcase binders.',
          '<b>Journals tab:</b> Long-form journal entries.',
          '<b>Trade history tab:</b> Completed trades and feedback.',
          '<b>Collection tab:</b> Shared collection highlights (if made public).',
          '<b>Podcasts tab:</b> Published podcast episodes and RSS feed link.',
          '<b>Activity tab:</b> Recent community activity.',
        ]},
      ]},
      { icon: 'Edit', title: 'Editing your profile', blocks: [
        { type: 'steps', items: [
          'Go to your profile and click Edit Profile.',
          'Set your display name, avatar, bio, and location.',
          'Choose whether your collection stats are public.',
          'Save. Changes sync to your AT Protocol PDS.',
        ]},
      ]},
      { icon: 'Link2', title: 'Handles and domains', blocks: [
        { type: 'p', text: 'Your handle is your identity (e.g. @collector.swappulse.org). You can verify a custom domain in Settings to get @yourdomain.com with an elevated trust badge. Handles are portable across AT Protocol instances.' },
      ]},
      { icon: 'BarChart3', title: 'External profiles', blocks: [
        { type: 'p', text: 'SwapPulse can display profiles for external Bluesky users who aren\'t SwapPulse members. Their data is fetched from the Bluesky App View and merged with any local activity. Some tabs may be limited for external users.' },
      ]},
    ],
  },

  journals: {
    title: 'Journals',
    subtitle: 'Long-form collector writing',
    sections: [
      { icon: 'BookOpen', title: 'What are Journals?', blocks: [
        { type: 'p', text: 'Journals are long-form articles written by collectors, up to 50,000 characters of markdown. They\'re more than a post: cover images, embedded cards, frozen collection stat snapshots, tags, and full visibility controls. Each journal is mirrored to your AT Protocol PDS and also published as a site.standard.document for interoperable long-form discovery.' },
      ]},
      { title: 'What you can include', blocks: [
        { type: 'list', items: [
          '<b>Title and subtitle:</b> Up to 200 and 300 characters.',
          '<b>Body:</b> Markdown-formatted content up to 50,000 characters.',
          '<b>Cover image:</b> A banner image for the journal.',
          '<b>Embedded cards:</b> Up to 20 card references rendered inline.',
          '<b>Stat snapshot:</b> Frozen collection stats at publication time (value, completion, total cards, rarest card).',
          '<b>Tags:</b> Up to 10 tags for discovery.',
          '<b>Visibility:</b> Public, followers, or private.',
        ]},
      ]},
      { icon: 'PenLine', title: 'Writing a journal', blocks: [
        { type: 'steps', items: [
          'Go to your profile\'s Journals tab and click New Journal.',
          'Write your title, subtitle, and body in the markdown editor.',
          'Add a cover image and embed cards if you like.',
          'Set visibility and tags.',
          'Publish. Your journal gets its own page at /journal/:journalId.',
        ]},
      ]},
      { icon: 'Image', title: 'Embedded cards', blocks: [
        { type: 'p', text: 'Reference up to 20 cards in your journal. They render inline with images and link to the card pages. Great for set reviews, pull stories, or collection milestones.' },
      ]},
      { icon: 'Tag', title: 'Tags and discovery', blocks: [
        { type: 'p', text: 'Tags help readers find your journal. Published journals also get a site.standard.document record, so they\'re discoverable across the ATmosphere and can be recommended and subscribed to independently of your social profile.' },
      ]},
      { icon: 'ThumbsUp', title: 'Recommendations and subscriptions', blocks: [
        { type: 'p', text: 'Readers can recommend your journal (a site.standard.graph.recommend) and subscribe to your writing (site.standard.graph.subscription) separately from following your social profile. This lets collectors follow your long-form output without following your everyday posts.' },
      ]},
    ],
  },

  binders: {
    title: 'Binders',
    subtitle: 'Curate and share showcase binders',
    sections: [
      { icon: 'BookOpen', title: 'What are Binders?', blocks: [
        { type: 'p', text: 'Binders are themed, paginated showcases for your favourite cards. Build a digital binder with up to 10 pages, each with a grid of card slots, drag cards into place, choose a theme, and share it publicly. Binders are mirrored to your AT Protocol PDS so they\'re portable.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Create a binder:</b> Title, description, and a theme.',
          '<b>Add pages:</b> Up to 10 pages per binder.',
          '<b>Fill slots:</b> Each page has a grid of card slots. Add cards from your collection.',
          '<b>Custom captions:</b> Add a short caption to any slot.',
          '<b>Themes:</b> Classic Purple, Holo Foil, Vintage Leather, Midnight, Rainbow, or Custom.',
          '<b>Visibility:</b> Public, followers, or private.',
        ]},
      ]},
      { icon: 'LayoutGrid', title: 'Building a binder', blocks: [
        { type: 'steps', items: [
          'Go to the Binders page and click New Binder.',
          'Give it a title and choose a theme.',
          'Add pages and fill the card slots by picking from your collection.',
          'Drag cards to rearrange them within and across pages.',
          'Add custom captions if you like.',
          'Publish. Your binder gets its own page at /binder/:binderId.',
        ]},
      ]},
      { icon: 'Palette', title: 'Themes', blocks: [
        { type: 'p', text: 'Themes control the visual style of your binder: background, borders, and accents. Classic Purple is the default. Holo Foil adds a shiny look. Vintage Leather feels like a real binder. Midnight is dark. Rainbow cycles colours. Custom lets you define your own.' },
      ]},
      { icon: 'Eye', title: 'Sharing', blocks: [
        { type: 'p', text: 'Public binders are viewable by anyone and appear on your profile\'s Binders tab. Public binders with a description are also published as a site.standard.document for long-form discovery across the ATmosphere. Readers can recommend and like your binder.' },
      ]},
    ],
  },

  circles: {
    title: 'Circles',
    subtitle: 'Themed collector groups',
    sections: [
      { icon: 'Users', title: 'What are Circles?', blocks: [
        { type: 'p', text: 'Circles are themed collector groups: vintage, competitive, shiny, regional, and more. Join a circle to see scoped trade listings, discussions, and meetups. You can be in multiple circles at once. Circles help you find collectors who share your specific interests.' },
      ]},
      { title: 'What circles offer', blocks: [
        { type: 'list', items: [
          '<b>Scoped trades:</b> Trade listings can be limited to circle members only.',
          '<b>Scoped discussions:</b> Posts and discussions within the circle\'s context.',
          '<b>Scoped meetups:</b> Meetups organised for circle members.',
          '<b>Community:</b> A focused group of like-minded collectors.',
        ]},
      ]},
      { icon: 'Plus', title: 'Joining a circle', blocks: [
        { type: 'steps', items: [
          'Go to the Circles page to browse available circles.',
          'Open a circle to see its description, members, and activity.',
          'Click Join. You\'re now a member.',
          'Circle-scoped content appears in your relevant feeds.',
        ]},
      ]},
      { icon: 'MessageSquare', title: 'Participating', blocks: [
        { type: 'p', text: 'Once you\'re in a circle, you can see and create circle-scoped trade listings, join circle discussions, and attend circle meetups. Some circles may have entry requirements set by the organiser.' },
      ]},
      { icon: 'Eye', title: 'Creating a circle', blocks: [
        { type: 'p', text: 'If you want to start a new themed group, you can create a circle. Define the theme, description, and whether it\'s open or requires approval to join.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Join circles that match your collecting focus for the most relevant trades and discussions.',
          'You can leave a circle anytime from its page or your settings.',
        ]},
      ]},
    ],
  },

  meetups: {
    title: 'Meetups',
    subtitle: 'Organise and attend in-person events',
    sections: [
      { icon: 'CalendarDays', title: 'What are Meetups?', blocks: [
        { type: 'p', text: 'Meetups are in-person events for collectors: swaps, live pulls, trade nights, and community gatherings. Organise one near you or attend one in your area. SwapPulse handles the listings, RSVPs, and map, you handle the fun.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Browse meetups:</b> See upcoming meetups on a map and in a list.',
          '<b>RSVP:</b> Mark yourself as attending so the organiser knows.',
          '<b>Organise:</b> Create a meetup with date, time, location, and description.',
          '<b>Manage RSVPs:</b> See who\'s attending as the organiser.',
        ]},
      ]},
      { icon: 'MapPin', title: 'Finding meetups near you', blocks: [
        { type: 'p', text: 'The Meetups page shows events on a map. Pan and zoom to your area to see what\'s nearby. Each marker shows the event details and a link to RSVP.' },
      ]},
      { icon: 'Users', title: 'Organising a meetup', blocks: [
        { type: 'steps', items: [
          'Go to the Meetups page and click Create Meetup.',
          'Set the title, date, time, and location (with map coordinates).',
          'Add a description so collectors know what to expect.',
          'Publish. Your meetup appears on the map and list.',
          'Track RSVPs from your meetup\'s detail page.',
        ]},
      ]},
      { icon: 'CheckCircle', title: 'RSVPing', blocks: [
        { type: 'p', text: 'Click Attend on any meetup to RSVP. The organiser sees your attendance. You can change your RSVP if plans change.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Scope a meetup to a circle for a more focused group.',
          'Be clear about what to bring (cards for trading, cash, etc.) in the description.',
        ]},
      ]},
    ],
  },

  'pack-openings': {
    title: 'Pack Openings',
    subtitle: 'Share your pulls and see others\'',
    sections: [
      { icon: 'Package', title: 'What are Pack Openings?', blocks: [
        { type: 'p', text: 'Pack Openings is a feed of pull posts from the community. When you open a pack and get a great card, share it as a pack-opening post with the card attached. Follow collectors to see their fresh pulls in your feed, and discover trending pulls from across SwapPulse.' },
      ]},
      { title: 'Sharing a pull', blocks: [
        { type: 'steps', items: [
          'Open Compose and set the post type to Pack Opening.',
          'Attach the card you pulled.',
          'Write about the pull, the set, how it felt.',
          'Post. It appears in the Pack Openings feed and on the card\'s page.',
        ]},
      ]},
      { icon: 'Camera', title: 'What makes a good pull post', blocks: [
        { type: 'list', items: [
          'Attach the actual card so it renders richly and links to the card page.',
          'Mention the set and whether it was a pack, tin, or ETB.',
          'Add hashtags like #pull or the set name for discovery.',
        ]},
      ]},
      { icon: 'Sparkles', title: 'Discovering pulls', blocks: [
        { type: 'p', text: 'The Pack Openings page shows the latest pull posts from the community. Filter by set or rarity to find specific pulls. Each pull links to the card\'s social page where you can see more posts and trades for that card.' },
      ]},
      { icon: 'Users', title: 'Following collectors', blocks: [
        { type: 'p', text: 'Follow collectors whose pulls you enjoy. Their pack-opening posts appear in your home feed so you never miss a great pull.' },
      ]},
    ],
  },

  'pack-parties': {
    title: 'Pack Parties',
    subtitle: 'Synchronised pack-opening events',
    sections: [
      { icon: 'PartyPopper', title: 'What are Pack Parties?', blocks: [
        { type: 'p', text: 'A pack party is a synchronised pack-opening event. The host picks a set and a time, participants join and open packs of that set at the same time, sharing reactions live. It\'s a virtual pack-opening night with friends.' },
      ]},
      { title: 'How it works', blocks: [
        { type: 'list', items: [
          '<b>Host creates a party:</b> Chooses a set, date, and time.',
          '<b>Participants join:</b> RSVP to the party before it starts.',
          '<b>Everyone opens packs:</b> At the scheduled time, open packs of the chosen set.',
          '<b>Share reactions:</b> Post your pulls and react to others\' in real time.',
        ]},
      ]},
      { icon: 'Calendar', title: 'Joining a party', blocks: [
        { type: 'steps', items: [
          'Go to the Pack Parties page to see upcoming events.',
          'Open a party to see the set, time, and who\'s joining.',
          'Click Join to RSVP.',
          'When the party starts, open your packs and share your pulls.',
        ]},
      ]},
      { icon: 'Users', title: 'Hosting a party', blocks: [
        { type: 'p', text: 'Create a party, pick a set and time, and invite your circles or the whole community. As host, you can manage the event and see who\'s joining.' },
      ]},
      { icon: 'Sparkles', title: 'During the party', blocks: [
        { type: 'p', text: 'Post your pulls as pack-opening posts. They appear in the party feed so everyone can react in real time. It\'s the closest thing to opening packs together in person.' },
      ]},
    ],
  },

  'pull-of-the-week': {
    title: 'Pull of the Week',
    subtitle: 'Nominate and vote on the best pulls',
    sections: [
      { icon: 'Trophy', title: 'What is Pull of the Week?', blocks: [
        { type: 'p', text: 'Each week, collectors nominate their best card pull. The community votes on the nominations, and the winner gets bragging rights. It\'s a fun, weekly celebration of the community\'s best pulls.' },
      ]},
      { title: 'How it works', blocks: [
        { type: 'list', items: [
          '<b>Nominate:</b> Submit your best pull of the week with the card attached.',
          '<b>Vote:</b> Browse the week\'s nominations and vote for your favourites.',
          '<b>Winner:</b> The pull with the most votes wins Pull of the Week.',
        ]},
      ]},
      { icon: 'Star', title: 'Nominating your pull', blocks: [
        { type: 'steps', items: [
          'Go to the Pull of the Week page.',
          'Click Nominate and select the card you pulled this week.',
          'Add a short description of the pull.',
          'Submit. Your nomination appears in the week\'s voting list.',
        ]},
      ]},
      { icon: 'Vote', title: 'Voting', blocks: [
        { type: 'p', text: 'Browse the week\'s nominations and vote for the pulls you think are best. You can vote on multiple nominations. Voting closes at the end of the week and the winner is announced.' },
      ]},
      { icon: 'Crown', title: 'Winning', blocks: [
        { type: 'p', text: 'The winning pull is highlighted on the page and the winner earns community bragging rights. Past winners are archived so you can browse the hall of fame.' },
      ]},
    ],
  },

  predictions: {
    title: 'Predictions & Polls',
    subtitle: 'Community sentiment polls',
    sections: [
      { icon: 'Vote', title: 'What are Predictions?', blocks: [
        { type: 'p', text: 'Predictions are community sentiment polls about cards, the meta, and the market. Create a poll, let the community vote, and see the results in real time. It\'s a lightweight way to gauge community opinion on any TCG topic.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Create a poll:</b> Ask a question with multiple options.',
          '<b>Vote:</b> Cast your vote on any open poll.',
          '<b>View results:</b> See live results as the community votes.',
          '<b>Close a poll:</b> The creator can close voting when ready.',
        ]},
      ]},
      { icon: 'Plus', title: 'Creating a poll', blocks: [
        { type: 'steps', items: [
          'Go to the Predictions page and click Create Poll.',
          'Write your question and add 2 or more answer options.',
          'Optionally set a closing time.',
          'Publish. Your poll appears on the Predictions page.',
        ]},
      ]},
      { icon: 'BarChart3', title: 'Results', blocks: [
        { type: 'p', text: 'Results update live as votes come in. You can see the percentage for each option and the total vote count. After a poll closes, the final results are archived.' },
      ]},
      { icon: 'Clock', title: 'Closing and resolution', blocks: [
        { type: 'p', text: 'Polls can close automatically at a set time or manually by the creator. The Sentiment Assistant can also help analyse community sentiment trends across polls over time.' },
      ]},
    ],
  },

  notifications: {
    title: 'Notifications',
    subtitle: 'All your activity in one feed',
    sections: [
      { icon: 'Bell', title: 'What is the Notifications page?', blocks: [
        { type: 'p', text: 'The Notifications page is your unified feed of activity: likes, replies, mentions, trade matches, price alerts, follows, and more. Filter by type, mark as read, and stay on top of everything happening across your SwapPulse account.' },
      ]},
      { title: 'What you\'ll see', blocks: [
        { type: 'list', items: [
          '<b>Interactions:</b> Likes, reactions, replies, reposts, and quotes on your posts.',
          '<b>Mentions:</b> Posts that @mention you.',
          '<b>Follows:</b> New followers.',
          '<b>Trade matches:</b> When a new listing matches your wishlist.',
          '<b>Price alerts:</b> When a tracked card crosses your alert threshold.',
          '<b>Achievements:</b> When you earn a new badge.',
          '<b>System events:</b> Platform-wide announcements.',
        ]},
      ]},
      { icon: 'Filter', title: 'Filtering', blocks: [
        { type: 'p', text: 'Use the filter tabs to show only the notification types you care about: All, Mentions, Trades, Alerts, or Follows. This helps you focus when your feed is busy.' },
      ]},
      { icon: 'CheckCheck', title: 'Marking as read', blocks: [
        { type: 'p', text: 'Notifications are marked as opened when you view them or click through. The unread badge in the navigation shows your unread count.' },
      ]},
      { icon: 'Settings', title: 'Notification preferences', blocks: [
        { type: 'p', text: 'Control what you get notified about in Settings, including push notifications, quiet hours, and per-event-type toggles. You can enable web push (no app install required) and set quiet hours to pause non-critical alerts.' },
      ]},
    ],
  },

  messages: {
    title: 'Direct Messages',
    subtitle: 'End-to-end encrypted private chat',
    sections: [
      { icon: 'Mail', title: 'What are Direct Messages?', blocks: [
        { type: 'p', text: 'Direct messages (DMs) are private 1:1 chats with other collectors. They are end-to-end encrypted (E2EE), meaning only you and your recipient can read them. SwapPulse cannot read your messages, ever.' },
      ]},
      { icon: 'Lock', title: 'How encryption works', blocks: [
        { type: 'p', text: 'When you first use DMs, your browser generates an encryption key pair. Your private key lives in your browser\'s IndexedDB and never leaves your device. Messages are encrypted before sending; only your recipient\'s private key can decrypt them. This means SwapPulse\'s servers only ever see encrypted ciphertext.' },
      ]},
      { title: 'Starting a conversation', blocks: [
        { type: 'steps', items: [
          'Go to a collector\'s profile and click Message.',
          'Or open the Messages page and start a new conversation.',
          'Type your message and send. It\'s encrypted on your device before it leaves.',
          'Your conversation appears in your Messages list.',
        ]},
      ]},
      { icon: 'Key', title: 'Your keys', blocks: [
        { type: 'p', text: 'Your private key is generated and stored locally in your browser. It never gets sent to SwapPulse. This is what makes your messages truly private, but it also means there\'s no recovery if you lose it.' },
      ]},
      { icon: 'AlertTriangle', variant: 'warning', title: 'Important: losing your key', blocks: [
        { type: 'list', items: [
          'If you clear your browser data, switch browsers, or use a new device, you won\'t be able to read existing encrypted messages there.',
          'New conversations will work fine, your browser generates a fresh key pair.',
          'There is no recovery for lost keys by design. SwapPulse cannot decrypt your messages for you.',
        ]},
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Don\'t clear your browser storage if you want to keep access to old messages.',
          'DMs are for 1:1 conversations. For trade negotiations, use trade threads.',
        ]},
      ]},
    ],
  },

  'who-to-follow': {
    title: 'Who to Follow',
    subtitle: 'Discover collectors to follow',
    sections: [
      { icon: 'UserPlus', title: 'What is Who to Follow?', blocks: [
        { type: 'p', text: 'The Who to Follow page suggests collectors you might enjoy following, based on your collection, trades, circles, and interests. It\'s a great way to build a relevant feed when you\'re new to SwapPulse.' },
      ]},
      { title: 'How recommendations work', blocks: [
        { type: 'list', items: [
          '<b>Collection overlap:</b> Collectors who own similar cards or work on the same sets.',
          '<b>Trade partners:</b> Collectors you\'ve traded with or who trade in your circles.',
          '<b>Circle members:</b> Collectors in your circles you don\'t yet follow.',
          '<b>Interest match:</b> Collectors posting about cards and topics you engage with.',
        ]},
      ]},
      { icon: 'Sparkles', title: 'Improving your suggestions', blocks: [
        { type: 'p', text: 'The more you use SwapPulse, adding cards to your collection, joining circles, and interacting with posts, the better your recommendations become. If suggestions aren\'t relevant yet, add more cards and follow a few hashtags first.' },
      ]},
      { icon: 'UserCheck', title: 'Following from the page', blocks: [
        { type: 'p', text: 'Follow collectors directly from the Who to Follow page with one click. The sidebar on the home feed also shows a few suggestions at a time.' },
      ]},
    ],
  },

  share: {
    title: 'Share',
    subtitle: 'Share cards, posts, and links',
    sections: [
      { icon: 'Share2', title: 'What is Share?', blocks: [
        { type: 'p', text: 'The Share page lets you share SwapPulse content, cards, posts, and profile links, inside the platform and to external apps. Generate a clean link to any page and send it to friends or post it on social media.' },
      ]},
      { title: 'What you can share', blocks: [
        { type: 'list', items: [
          '<b>Cards:</b> A link to any card detail page.',
          '<b>Posts:</b> A link to any post, which renders richly on Bluesky too.',
          '<b>Profiles:</b> A link to any collector\'s profile.',
          '<b>Binders & Journals:</b> Links to your showcase content.',
        ]},
      ]},
      { icon: 'Link2', title: 'Generating a share link', blocks: [
        { type: 'steps', items: [
          'Open the page you want to share (card, post, profile).',
          'Click the Share button or go to the Share page.',
          'Copy the link to your clipboard.',
          'Paste it anywhere: chat, social media, email.',
        ]},
      ]},
      { icon: 'Copy', title: 'External link confirmation', blocks: [
        { type: 'p', text: 'When you click an external link on SwapPulse, a confirmation dialog shows you where you\'re going before you leave the site. This protects you from misleading links.' },
      ]},
      { icon: 'Send', title: 'Sharing to Bluesky', blocks: [
        { type: 'p', text: 'Because SwapPulse is built on the AT Protocol, posts with attached cards render as rich link cards on Bluesky. Sharing a SwapPulse card link on Bluesky shows a preview with the card image and name.' },
      ]},
    ],
  },

  'voice-spaces': {
    title: 'Voice Spaces',
    subtitle: 'Go live and host audio stages',
    sections: [
      { icon: 'Radio', title: 'What are Voice Spaces?', blocks: [
        { type: 'p', text: 'Voice Spaces are live audio sessions. There are two modes: external (paste a stream URL from Twitch, YouTube, Kick, etc. to go live) and in-platform (a true audio stage where participants hear each other via a WebRTC peer mesh). Hosts can record in-platform spaces and publish them as podcast episodes.' },
      ]},
      { title: 'Two modes', blocks: [
        { type: 'list', items: [
          '<b>External:</b> Paste a stream URL (Twitch, YouTube, Kick, Facebook Gaming, Rumble, custom RTMP). Your profile shows a red live ring and followers get notified. No WebRTC needed, listeners just open the stream.',
          '<b>In-platform:</b> Host a true audio stage where participants hear each other via a WebRTC peer mesh. No external stream needed. Hosts can promote speakers, mute, and record.',
        ]},
      ]},
      { icon: 'Video', title: 'Going live (external)', blocks: [
        { type: 'steps', items: [
          'Go to Voice Spaces and click Go Live.',
          'Choose External mode.',
          'Paste your stream URL. The platform is auto-detected.',
          'Set a title, description, and planned duration (15 to 480 minutes).',
          'Go live. Your profile shows a live ring and followers are notified.',
        ]},
      ]},
      { icon: 'Mic', title: 'Hosting an in-platform space', blocks: [
        { type: 'steps', items: [
          'Go to Voice Spaces and click Go Live.',
          'Choose In-platform mode.',
          'Set a title, description, and planned duration.',
          'Go live. Participants join and hear each other via WebRTC.',
          'Promote listeners to speakers, mute as needed, and optionally record.',
        ]},
      ]},
      { icon: 'Users', title: 'Participating', blocks: [
        { type: 'p', text: 'Join a live space from the Voice Spaces page or a profile with a live ring. In external mode, you\'re taken to the stream. In in-platform mode, you join the audio stage as a listener. Raise your hand or ask the host to promote you to speak.' },
      ]},
      { icon: 'Circle', title: 'Live ring and auto-end', blocks: [
        { type: 'p', text: 'While live, your avatar shows a pulsing red ring across the site. Spaces auto-end at the planned duration, or the host can end manually. The live ring disappears when the space ends.' },
      ]},
      { variant: 'warning', title: 'Known limitations', blocks: [
        { type: 'list', items: [
          'In-platform spaces use a WebRTC peer mesh. Some networks (corporate Wi-Fi, symmetric NATs) block WebRTC. Try a different network if you can\'t connect.',
          'External streams are not re-hosted by SwapPulse, listeners go to your stream URL directly.',
        ]},
      ]},
    ],
  },

  podcasts: {
    title: 'Podcasts',
    subtitle: 'Publish recorded spaces as episodes',
    sections: [
      { icon: 'Mic', title: 'What are Podcasts?', blocks: [
        { type: 'p', text: 'When you record an in-platform voice space, you can save it as a podcast episode with a title, description, chapters, and show notes. Each host gets a public RSS feed URL that can be submitted to Apple Podcasts, Spotify, or any podcast app. Find your feed link on your profile\'s Podcasts tab.' },
      ]},
      { title: 'From recording to episode', blocks: [
        { type: 'steps', items: [
          'Host an in-platform voice space and enable recording.',
          'When the space ends, open Save as Podcast.',
          'Edit the title, description, cover image, and show notes.',
          'Add chapter marks to jump to key moments.',
          'Optionally trim the start and end of the recording.',
          'Publish. The episode appears on your profile and in your RSS feed.',
        ]},
      ]},
      { icon: 'Scissors', title: 'Trimming', blocks: [
        { type: 'p', text: 'Set start and end trim points to cut dead air or off-topic intro/outro. The trimmed audio re-encodes and replaces the published audio. The original is retained so you can re-trim or restore later.' },
      ]},
      { icon: 'Rss', title: 'Your RSS feed', blocks: [
        { type: 'p', text: 'Your podcast RSS feed is at /api/functions/podcast-rss-feed?did=<yourDID>. Copy it from your profile\'s Podcasts tab. Submit it to Apple Podcasts, Spotify, or any podcast app. The feed returns 404 until you have at least one published episode. Podcast apps may take a few hours to index a newly submitted feed.' },
      ]},
      { icon: 'Edit', title: 'Editing episodes', blocks: [
        { type: 'p', text: 'Edit an episode\'s metadata (title, description, cover, tags, chapters, show notes) anytime. Play count tracks listens on SwapPulse. Episodes are mirrored to your AT Protocol PDS as portable records.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Add chapter marks for cards discussed so listeners can jump to specific topics.',
          'Use show notes to link to cards, profiles, and resources mentioned in the episode.',
        ]},
      ]},
    ],
  },

  challenges: {
    title: 'Challenges & Leaderboards',
    subtitle: 'Community goals and competitions',
    sections: [
      { icon: 'Target', title: 'What are Challenges?', blocks: [
        { type: 'p', text: 'Challenges are community goals and competitions: set sprints, budget decks, pull contests, and collective targets. Join a challenge, submit entries to contribute, and climb the leaderboard. Some challenges are individual, others are collective community goals.' },
      ]},
      { title: 'Types of challenges', blocks: [
        { type: 'list', items: [
          '<b>Set sprints:</b> Complete a set within a time limit.',
          '<b>Budget decks:</b> Build a deck under a price cap.',
          '<b>Pull contests:</b> Best pull of a specific set or rarity.',
          '<b>Community goals:</b> Collective targets the whole community works toward.',
        ]},
      ]},
      { icon: 'Plus', title: 'Joining a challenge', blocks: [
        { type: 'steps', items: [
          'Go to the Challenges page to browse active challenges.',
          'Open a challenge to see the rules, prize, and current entries.',
          'Click Join to opt in.',
          'Submit entries as instructed by the challenge type.',
        ]},
      ]},
      { icon: 'Medal', title: 'Submitting entries', blocks: [
        { type: 'p', text: 'Depending on the challenge, you submit entries like a completed set, a deck list, or a pull post. Entries are validated against the challenge rules. Some challenges require manual opt-in before you can submit.' },
      ]},
      { icon: 'Trophy', title: 'Leaderboards', blocks: [
        { type: 'p', text: 'Each challenge with a leaderboard shows rankings at /challenges/:challengeId/leaderboard. Climb the board by submitting qualifying entries. Top performers earn community recognition and sometimes badges.' },
      ]},
    ],
  },

  achievements: {
    title: 'Achievements',
    subtitle: 'Earn badges for your collecting',
    sections: [
      { icon: 'Medal', title: 'What are Achievements?', blocks: [
        { type: 'p', text: 'Achievements are badges earned for collection milestones, trading, scanner accuracy, and community contributions. Each achievement is backed by an immutable SHA-256 proof snapshot so it\'s verifiable. Show off your collecting accomplishments with gold medallions and rarity-based glows.' },
      ]},
      { title: 'How you earn achievements', blocks: [
        { type: 'list', items: [
          '<b>Collection milestones:</b> Reach card count thresholds, complete sets, or own rare cards.',
          '<b>Trading:</b> Complete a number of trades, maintain positive feedback, or earn Trusted Trader status.',
          '<b>Scanner accuracy:</b> Submit correct scanner corrections that help the model learn.',
          '<b>Community:</b> Contribute vouches, feedback, journals, or helpful posts.',
        ]},
      ]},
      { icon: 'Shield', title: 'Verifiable proofs', blocks: [
        { type: 'p', text: 'Each achievement is backed by an immutable SHA-256 snapshot of the qualifying data at the time it was earned. This makes achievements verifiable: anyone can check the proof to confirm the achievement was legitimately earned. You can export and share your proofs.' },
      ]},
      { icon: 'Camera', title: 'Scanner corrections', blocks: [
        { type: 'p', text: 'When you scan a card and correct a wrong match, your correction is recorded. Accumulate correct corrections to earn scanner accuracy achievements. Corrections also improve the model for everyone.' },
      ]},
      { icon: 'TrendingUp', title: 'Viewing your achievements', blocks: [
        { type: 'p', text: 'Go to the Achievements page to see all badges you\'ve earned and those you\'re working toward. Each medallion shows its rarity with a themed glow. Some achievements have progress indicators so you know how close you are.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Set completion badges require 100% unique card URIs from TCGDex.',
          'Achievements are recalculated periodically, so newly-qualified badges may take a short time to appear.',
        ]},
      ]},
    ],
  },

  'trade-assistant': {
    title: 'Trade Assistant',
    subtitle: 'AI-powered trade suggestions',
    sections: [
      { icon: 'Sparkles', title: 'What is the Trade Assistant?', blocks: [
        { type: 'p', text: 'The Trade Assistant is an AI agent that analyses your collection and active trade listings to suggest fair trades, flag high-value opportunities, and help you negotiate. It uses live TCGDex pricing and your collection data to generate personalised, actionable suggestions.' },
      ]},
      { title: 'What it can help with', blocks: [
        { type: 'list', items: [
          '<b>Trade suggestions:</b> Cards you could offer or seek based on your collection and wishlist.',
          '<b>Fairness analysis:</b> Whether a proposed trade is balanced based on market values.',
          '<b>Opportunity flags:</b> High-value trade opportunities in your collection.',
          '<b>Negotiation tips:</b> Suggested talking points for a trade thread.',
        ]},
      ]},
      { icon: 'Scale', title: 'How it works', blocks: [
        { type: 'p', text: 'The assistant reads your collection entries, active listings, and TCGDex pricing, then asks an LLM to generate suggestions. It\'s conversational, so you can ask follow-up questions and refine its advice.' },
      ]},
      { icon: 'TrendingUp', title: 'Using the suggestions', blocks: [
        { type: 'p', text: 'The assistant\'s output is advisory, not professional advice. Always use your own judgement for trading decisions. Use it as a second opinion and a way to spot opportunities you might have missed.' },
      ]},
      { icon: 'AlertTriangle', variant: 'warning', title: 'Important', blocks: [
        { type: 'list', items: [
          'AI suggestions are advisory only, not financial or professional advice.',
          'Market values fluctuate, always double-check current prices before agreeing to a trade.',
        ]},
      ]},
    ],
  },

  'market-watch-assistant': {
    title: 'Market Watch Assistant',
    subtitle: 'AI analysis of price trends',
    sections: [
      { icon: 'Sparkles', title: 'What is the Market Watch Assistant?', blocks: [
        { type: 'p', text: 'The Market Watch Assistant is an AI agent that analyses price trends and market opportunities for your tracked cards and collection. It helps you spot rising cards, potential buys, and cards that might be overvalued.' },
      ]},
      { title: 'What it can help with', blocks: [
        { type: 'list', items: [
          '<b>Trend analysis:</b> Which tracked cards are trending up or down.',
          '<b>Opportunity spotting:</b> Cards that may be undervalued or heating up.',
          '<b>Alert suggestions:</b> Where to set price alerts based on recent movement.',
          '<b>Portfolio insights:</b> Which parts of your collection are gaining or losing value.',
        ]},
      ]},
      { icon: 'TrendingUp', title: 'How it works', blocks: [
        { type: 'p', text: 'The assistant reads your tracked cards, collection value, and TCGDex pricing history, then generates insights. It\'s conversational, so you can ask about specific cards or market segments.' },
      ]},
      { icon: 'AlertTriangle', variant: 'warning', title: 'Important', blocks: [
        { type: 'list', items: [
          'AI market analysis is advisory only, not financial advice.',
          'Card prices are volatile and depend on many factors beyond historical data.',
          'Never make financial decisions based solely on AI suggestions.',
        ]},
      ]},
    ],
  },

  'collection-advisor': {
    title: 'Collection Advisor',
    subtitle: 'AI advice on your collection',
    sections: [
      { icon: 'Sparkles', title: 'What is the Collection Advisor?', blocks: [
        { type: 'p', text: 'The Collection Advisor is an AI agent that analyses your collection to identify gaps, duplicates, and high-value trade opportunities. It helps you decide what to keep, what to trade, and what to pursue next.' },
      ]},
      { title: 'What it can help with', blocks: [
        { type: 'list', items: [
          '<b>Gap analysis:</b> Which cards you need to complete sets you\'re close on.',
          '<b>Duplicate strategy:</b> Which duplicates are worth trading and for what.',
          '<b>Value opportunities:</b> Cards in your collection that have gained value and might be worth trading.',
          '<b>Collection goals:</b> Suggestions for what to focus on next based on your activity.',
        ]},
      ]},
      { icon: 'Layers', title: 'How it works', blocks: [
        { type: 'p', text: 'The advisor reads your collection entries, set completion data, and TCGDex pricing, then generates tailored advice. It\'s conversational, so you can ask about specific sets, cards, or strategies.' },
      ]},
      { icon: 'AlertTriangle', variant: 'warning', title: 'Important', blocks: [
        { type: 'list', items: [
          'AI advice is advisory only, not professional financial advice.',
          'Always use your own judgement when deciding what to trade or keep.',
        ]},
      ]},
    ],
  },

  'sentiment-assistant': {
    title: 'Sentiment Assistant',
    subtitle: 'AI for community sentiment',
    sections: [
      { icon: 'Sparkles', title: 'What is the Sentiment Assistant?', blocks: [
        { type: 'p', text: 'The Sentiment Assistant is a conversational AI that analyses community sentiment polls and market mood. It helps you understand how the community feels about cards, sets, and the meta, and surfaces trends across predictions and discussions.' },
      ]},
      { title: 'What it can help with', blocks: [
        { type: 'list', items: [
          '<b>Sentiment trends:</b> How community opinion on a card or set is shifting over time.',
          '<b>Poll analysis:</b> Summaries of active and past prediction polls.',
          '<b>Mood insights:</b> Whether the community is bullish or bearish on specific cards.',
          '<b>Discussion summaries:</b> Key themes from posts and discussions about a topic.',
        ]},
      ]},
      { icon: 'MessageCircle', title: 'How it works', blocks: [
        { type: 'p', text: 'The assistant reads sentiment polls, votes, and related posts, then generates conversational insights. Ask it about a specific card, set, or topic to get a sentiment read.' },
      ]},
      { icon: 'TrendingUp', title: 'Using the insights', blocks: [
        { type: 'p', text: 'Sentiment analysis is a tool for understanding community mood, not a prediction of future prices. Use it alongside market data and your own judgement.' },
      ]},
    ],
  },

  'achievement-goal-tracker': {
    title: 'Achievement Goal Tracker',
    subtitle: 'AI help with collection goals',
    sections: [
      { icon: 'Sparkles', title: 'What is the Achievement Goal Tracker?', blocks: [
        { type: 'p', text: 'The Achievement Goal Tracker is an AI agent that helps you set and track realistic collection and achievement goals. It looks at your current collection, your progress toward achievements, and suggests achievable next steps.' },
      ]},
      { title: 'What it can help with', blocks: [
        { type: 'list', items: [
          '<b>Goal setting:</b> Realistic milestones based on your current collection size and activity.',
          '<b>Progress tracking:</b> How close you are to specific achievements and what\'s needed.',
          '<b>Next steps:</b> The most efficient path to your next badge or set completion.',
          '<b>Timeline estimates:</b> Rough timeframes based on your activity rate.',
        ]},
      ]},
      { icon: 'Target', title: 'How it works', blocks: [
        { type: 'p', text: 'The tracker reads your collection, achievements, and activity, then generates a personalised plan. It\'s conversational, so you can ask about specific achievements or adjust your goals.' },
      ]},
      { icon: 'TrendingUp', title: 'Using the plan', blocks: [
        { type: 'p', text: 'The tracker\'s suggestions are motivational guides, not guarantees. Collect at your own pace and enjoy the hobby. Timelines are estimates based on past activity and can change.' },
      ]},
    ],
  },

  'networking-concierge': {
    title: 'Networking Concierge',
    subtitle: 'AI introductions to collectors',
    sections: [
      { icon: 'Sparkles', title: 'What is the Networking Concierge?', blocks: [
        { type: 'p', text: 'The Networking Concierge is an AI agent that introduces you to collectors with shared interests and complementary collections. It analyses your collection, trades, and circles to suggest people worth connecting with.' },
      ]},
      { title: 'What it can help with', blocks: [
        { type: 'list', items: [
          '<b>Match suggestions:</b> Collectors with overlapping collection focus or set goals.',
          '<b>Complementary traders:</b> Collectors who have cards you want and want cards you have.',
          '<b>Circle recommendations:</b> Circles you might enjoy based on your activity.',
          '<b>Icebreakers:</b> Suggested conversation starters based on shared interests.',
        ]},
      ]},
      { icon: 'Users', title: 'How it works', blocks: [
        { type: 'p', text: 'The concierge reads your collection, wishlist, trade history, and circle memberships, then finds collectors with complementary profiles. It\'s conversational, so you can ask for introductions by set, rarity, or region.' },
      ]},
      { icon: 'Handshake', title: 'Making connections', blocks: [
        { type: 'p', text: 'Use the concierge\'s suggestions to follow collectors, start trade threads, or join the same circles. Building a network of trusted collectors makes trading and the hobby more enjoyable.' },
      ]},
    ],
  },

  settings: {
    title: 'Settings',
    subtitle: 'Manage your account and preferences',
    sections: [
      { icon: 'Settings', title: 'What is in Settings?', blocks: [
        { type: 'p', text: 'Settings is your control centre for language, privacy, notifications, accessibility, AT Protocol, and account preferences. Everything you need to tailor SwapPulse to your needs is here.' },
      ]},
      { icon: 'Globe', title: 'Language', blocks: [
        { type: 'p', text: 'Switch the entire interface and card catalogue between 9+ languages: English, Français, Deutsch, Español, Italiano, Português, 日本語, 中文, 한국어. Your choice is saved to your account and persists across sessions. Card names, set names, and flavour text all switch instantly.' },
      ]},
      { icon: 'Bell', title: 'Notifications', blocks: [
        { type: 'list', items: [
          '<b>Push notifications:</b> Enable web push (no app install required) via VAPID.',
          '<b>Quiet hours:</b> Pause non-critical alerts during set hours.',
          '<b>Per-event toggles:</b> Choose which event types notify you (trade matches, price alerts, mentions, etc.).',
        ]},
      ]},
      { icon: 'Shield', title: 'Privacy', blocks: [
        { type: 'list', items: [
          '<b>Who can reach you:</b> Control who can message you or reply to your posts.',
          '<b>Default visibility:</b> Set your default post visibility (public, followers, mentioned).',
          '<b>Collection visibility:</b> Choose whether your collection stats are public.',
        ]},
      ]},
      { icon: 'Eye', title: 'Accessibility', blocks: [
        { type: 'p', text: 'Enable reduced motion, high contrast, and other accessibility options. SwapPulse follows WCAG 2.1 AA standards for keyboard navigation, screen reader support, and colour contrast.' },
      ]},
      { icon: 'Key', title: 'AT Protocol & account', blocks: [
        { type: 'list', items: [
          '<b>AT Protocol:</b> View your DID, manage your handle, and verify a custom domain.',
          '<b>Two-factor authentication:</b> Enable 2FA for extra security.',
          '<b>Cross-posting:</b> Configure how your posts mirror to Bluesky.',
          '<b>Data privacy:</b> Export your data or submit a data subject request.',
          '<b>Delete account:</b> Permanently delete your account and data.',
        ]},
      ]},
    ],
  },

  'your-profile': {
    title: 'Your Profile',
    subtitle: 'Set up your collector identity',
    sections: [
      { icon: 'User', title: 'What is Your Profile?', blocks: [
        { type: 'p', text: 'Your profile is your public collector identity on SwapPulse. Set your avatar, display name, handle, bio, and location, and choose what\'s visible. Your profile is the first thing other collectors see, so make it yours.' },
      ]},
      { icon: 'Edit', title: 'Editing your profile', blocks: [
        { type: 'steps', items: [
          'Go to your profile page (Profile in the navigation).',
          'Click Edit Profile.',
          'Set your display name, avatar, bio, and location.',
          'Choose whether your collection stats are public.',
          'Save. Changes sync to your AT Protocol PDS.',
        ]},
      ]},
      { icon: 'Camera', title: 'Avatar', blocks: [
        { type: 'p', text: 'Upload an avatar image. It appears across the site: in posts, trade listings, spaces, and your profile header. Keep it friendly and recognisable.' },
      ]},
      { icon: 'Link2', title: 'Handle and domain', blocks: [
        { type: 'p', text: 'Your handle is your identity (e.g. @collector.swappulse.org). You can verify a custom domain in Settings to get @yourdomain.com with an elevated trust badge. Handles are portable across AT Protocol instances, you\'re not locked in.' },
      ]},
      { icon: 'BarChart3', title: 'Profile tabs', blocks: [
        { type: 'p', text: 'Your profile has tabs for Posts, Binders, Journals, Trade History, Collection (if public), Podcasts, and Activity. Each shows a different side of your collecting life. You control what\'s public.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'A clear bio helps other collectors find you and start trades.',
          'Verify a custom domain for an elevated trust badge and a memorable handle.',
        ]},
      ]},
    ],
  },

  account: {
    title: 'Account & Login',
    subtitle: 'Passwordless login and account security',
    sections: [
      { icon: 'LogIn', title: 'How login works', blocks: [
        { type: 'p', text: 'SwapPulse uses passwordless login. Enter your email and we send a one-time login code. Enter the code to sign in, no password to remember or lose. You can also sign in with Google.' },
      ]},
      { icon: 'Mail', title: 'Logging in', blocks: [
        { type: 'steps', items: [
          'Go to the login page and enter your email.',
          'Click Send Code. We email you a one-time code.',
          'Enter the code on the next screen.',
          'You\'re signed in. The session persists until you log out.',
        ]},
      ]},
      { title: 'Registering', blocks: [
        { type: 'steps', items: [
          'Go to the register page and enter your email.',
          'We send a verification code (OTP) to your email.',
          'Enter the code to verify your email.',
          'Set up your profile and you\'re ready to go.',
        ]},
        { type: 'p', text: 'New users may need an invite code during the alpha phase. If you have one, enter it during registration.' },
      ]},
      { icon: 'KeyRound', title: 'Two-factor authentication', blocks: [
        { type: 'p', text: 'For extra security, enable 2FA in Settings. With 2FA on, you\'ll need a second factor (a code from your authenticator app) in addition to your login code. Rate limiting protects against brute-force attempts.' },
      ]},
      { icon: 'ShieldCheck', title: 'Account security', blocks: [
        { type: 'list', items: [
          'Use a current email you can access, it\'s your only way in.',
          'Enable 2FA if your account contains valuable collection data.',
          'Log out from shared devices when you\'re done.',
        ]},
      ]},
      { icon: 'Clock', title: 'Activation and expiry', blocks: [
        { type: 'p', text: 'Activation links expire after 48 hours. If yours expired, request a new one from the login page. Unverified accounts are managed for 90 days before being removed.' },
      ]},
    ],
  },

  status: {
    title: 'System Status',
    subtitle: 'Check service health',
    sections: [
      { icon: 'Activity', title: 'What is the System Status page?', blocks: [
        { type: 'p', text: 'The System Status page shows the real-time health of every SwapPulse service: the database, TCGDex catalogue sync, AT Protocol bridge, firehose ingestion, payments, and more. Check it when something seems broken to see if it\'s a known issue.' },
      ]},
      { title: 'What you can see', blocks: [
        { type: 'list', items: [
          '<b>Global status:</b> An at-a-glance indicator of overall platform health.',
          '<b>Service list:</b> Each monitored service with its current status (operational, degraded, outage, maintenance).',
          '<b>Uptime bars:</b> Recent uptime history for each service.',
          '<b>Active incidents:</b> Current incidents with updates and severity.',
          '<b>Maintenance windows:</b> Scheduled maintenance that may affect availability.',
          '<b>Incident history:</b> Past incidents and how they were resolved.',
        ]},
      ]},
      { icon: 'Bell', title: 'Subscribing to updates', blocks: [
        { type: 'p', text: 'Subscribe to status updates by email so you\'re notified when incidents occur or resolve. You can unsubscribe anytime.' },
      ]},
      { icon: 'AlertTriangle', title: 'When something is down', blocks: [
        { type: 'p', text: 'If a service shows degraded or outage, the team is already working on it. Check the active incidents section for details and estimated resolution times. You don\'t need to report it, but you can send feedback if you\'re experiencing something not shown.' },
      ]},
      { icon: 'Wrench', title: 'Maintenance windows', blocks: [
        { type: 'p', text: 'Scheduled maintenance windows are posted in advance so you know when to expect brief downtime. Services may be intermittently unavailable during a window.' },
      ]},
    ],
  },

  admin: {
    title: 'Admin',
    subtitle: 'Admin dashboard and tools',
    sections: [
      { icon: 'Gavel', title: 'What is the Admin page?', blocks: [
        { type: 'p', text: 'The Admin page is the administration dashboard for SwapPulse admins. It provides centralised access to system health, operational metrics, service management, incident handling, and federation diagnostics. Access is restricted to admin-role users.' },
      ]},
      { title: 'What admins can do', blocks: [
        { type: 'list', items: [
          '<b>Health monitoring:</b> View live service health and trigger health checks.',
          '<b>Metrics:</b> Platform-wide metrics for users, posts, trades, and activity.',
          '<b>Service management:</b> Update service status, criticality, and check intervals.',
          '<b>Incident management:</b> Create, update, and resolve incidents.',
          '<b>Maintenance windows:</b> Schedule and manage maintenance.',
          '<b>Federation diagnostics:</b> Check AT Protocol federation health and PDS sync.',
          '<b>Invite codes:</b> Generate and manage invite codes for the alpha.',
          '<b>Email testing:</b> Send test emails to verify SMTP configuration.',
        ]},
      ]},
      { icon: 'Activity', title: 'Health and diagnostics', blocks: [
        { type: 'p', text: 'The health section shows real-time service status and lets admins trigger manual health checks. Federation diagnostics help troubleshoot AT Protocol connectivity, PDS sync, and firehose ingestion issues.' },
      ]},
      { icon: 'Users', title: 'User management', blocks: [
        { type: 'p', text: 'Admins can invite users, manage roles, and handle data subject requests. User records are created via invitation, not direct creation.' },
      ]},
      { icon: 'Wrench', title: 'Operations', blocks: [
        { type: 'p', text: 'The admin dashboard surfaces operational tasks like SEO audits, bot protection logs, and backfill operations so the team can keep the platform healthy and secure.' },
      ]},
    ],
  },

  moderation: {
    title: 'Moderation',
    subtitle: 'Keeping the community safe',
    sections: [
      { icon: 'ShieldAlert', title: 'What is Moderation?', blocks: [
        { type: 'p', text: 'The Moderation page is the toolkit for SwapPulse moderators. It surfaces flagged posts, bot protection logs, trade disputes, and enforcement actions. Moderators review reports, apply labels, and take action to keep the community safe and welcoming.' },
      ]},
      { title: 'What moderators handle', blocks: [
        { type: 'list', items: [
          '<b>Flagged posts:</b> Posts reported by users or flagged by AI moderation, queued for review.',
          '<b>Bot protection:</b> Logs of bot detection attempts and risk states.',
          '<b>Trade disputes:</b> Disputes opened by trade participants that need mediation.',
          '<b>Enforcement:</b> Suspensions, shadow bans, and forced deletions for rule breakers.',
          '<b>Bulk actions:</b> Tools to handle multiple items efficiently.',
        ]},
      ]},
      { icon: 'Flag', title: 'How reporting works', blocks: [
        { type: 'p', text: 'When a user reports a post, it enters the moderation queue with the reporter\'s reason. AI moderation also scans posts automatically and applies labels (inform, warn, escalate) based on content. Moderators review and decide: dismiss, warn, hide, or escalate.' },
      ]},
      { icon: 'Bot', title: 'AI moderation', blocks: [
        { type: 'p', text: 'SwapPulse uses an AI moderation agent that scans posts and trade listings for harmful content. It applies labels with confidence scores and recommended actions. Moderators review AI-flagged content and confirm or override the AI\'s decision, and their feedback trains the model.' },
      ]},
      { icon: 'Gavel', title: 'Enforcement', blocks: [
        { type: 'p', text: 'Moderators can suspend accounts, shadow-ban repeat offenders, or force-delete content. Enforcement actions are logged for accountability. Severe cases may involve account deletion.' },
      ]},
      { variant: 'primary', title: 'Tips', blocks: [
        { type: 'list', items: [
          'Report harmful content rather than engaging with it, moderators will handle it.',
          'Honest feedback on AI moderation helps improve the system for everyone.',
        ]},
      ]},
    ],
  },
};