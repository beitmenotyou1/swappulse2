// Voice & Podcasts, Challenges & Achievements, AI Assistants, Account & Settings, Platform pages

export const voicePages = {
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
};

export const challengesPages = {
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
};

export const aiPages = {
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
};

export const accountPages = {
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
          '<b>Auto-accept starter packs:</b> Skip the request step and automatically join any pack a collector adds you to.',
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

};

export const platformPages = {
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

  donations: {
    title: 'Donations',
    subtitle: 'How to support SwapPulse',
    sections: [
      { icon: 'Heart', title: 'Why donate?', blocks: [
        { type: 'p', text: 'SwapPulse is free and open-source. Donations cover hosting, the TCGDex catalogue, and AT Protocol infrastructure. Every contribution keeps the platform running for the whole community.' },
      ]},
      { icon: 'CreditCard', title: 'Donate by card (fiat)', blocks: [
        { type: 'steps', items: [
          'Go to the donate page and choose "Card (Fiat)".',
          'Enter an amount in GBP (£5, £10, £25, £50, £100, or custom) and your email.',
          'Click Donate. You\'ll be redirected to Stripe\'s secure checkout.',
          'Enter your card details and complete the payment.',
          'You\'ll be redirected back to SwapPulse and receive a receipt by email.',
        ]},
      ]},
      { title: 'Fees', blocks: [
        { type: 'list', items: [
          '<b>Card (Stripe):</b> 2.9% + £0.20 per transaction (UK domestic cards). No monthly fees.',
        ]},
      ]},
      { variant: 'warning', title: 'Known limitations', blocks: [
        { type: 'list', items: [
          'Minimum donation is £0.50.',
          'Donations are not tax-deductible.',
        ]},
      ]},
    ],
  },

  labelers: {
    title: 'Community Labelers',
    subtitle: 'Curated content labels and moderation',
    sections: [
      { icon: 'Tags', title: 'What are Community Labelers?', blocks: [
        { type: 'p', text: 'Community Labelers are accounts that apply labels to content across the AT Protocol. Labels can flag content as sensitive, categorise it by topic, or signal trustworthiness. SwapPulse subscribes to labelers and applies their labels to posts, profiles, and media you see in your feed.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Browse labelers:</b> See all available community labelers on the Labelers page.',
          '<b>Subscribe:</b> Subscribe to labelers whose labels you want applied to your feed.',
          '<b>Label content:</b> If you run a labeler, apply labels to posts and profiles from the label button.',
          '<b>Filter:</b> Labels from subscribed labelers automatically filter or warn about content in your feed.',
        ]},
      ]},
      { icon: 'ShieldCheck', title: 'How labels work', blocks: [
        { type: 'p', text: 'Labels are AT Protocol records published by labeler accounts. When you subscribe to a labeler, SwapPulse fetches their labels and uses them to filter, warn, or categorise content. Labels are transparent, you can see which labeler applied a label and why.' },
      ]},
      { icon: 'Users', title: 'Running a labeler', blocks: [
        { type: 'p', text: 'Any collector can run a community labeler. Set up a labeler in Settings, define your labeling policies, and start applying labels. Other collectors can subscribe to your labeler to benefit from your curation.' },
      ]},
    ],
  },
};