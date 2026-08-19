// Community help pages: pack-openings, pack-parties, pull-of-the-week, predictions, notifications, messages, who-to-follow, share

export const communityPages = {
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
};