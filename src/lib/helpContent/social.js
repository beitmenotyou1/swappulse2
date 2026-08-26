// Social help pages: home-feed, compose, post-detail, hashtags, profiles, journals, binders, circles, meetups

export const socialPages = {
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
          '<b>Weekly Digest:</b> Every Monday, an automated roundup of the week\'s community highlights.',
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

  'weekly-digest': {
    title: 'Weekly Digest',
    subtitle: 'Automated weekly community highlights',
    sections: [
      { icon: 'CalendarDays', title: 'What is the Weekly Digest?', blocks: [
        { type: 'p', text: 'Every Monday, SwapPulse automatically posts a weekly digest to the feed summarising the past week\'s community activity. It highlights new members, pack openings, posts, trade listings, achievements, circles, and meetups in one place.' },
      ]},
      { title: 'What you\'ll see', blocks: [
        { type: 'list', items: [
          '<b>New members:</b> How many collectors joined this week.',
          '<b>Pack openings:</b> Fresh pulls shared by the community.',
          '<b>Posts:</b> Total posts published in the feed.',
          '<b>Trade listings:</b> New cards listed for trade.',
          '<b>Achievements:</b> Badges earned by collectors.',
          '<b>Circles & meetups:</b> New community groups and events.',
        ]},
      ]},
      { icon: 'Sparkles', title: 'How it works', blocks: [
        { type: 'p', text: 'The digest is posted automatically every Monday at 9am by the SwapPulse official account. It only posts when there is new activity — if the platform was quiet for the week, no digest is published. This keeps the feed clean and relevant.' },
      ]},
      { icon: 'Bell', title: 'Finding it in your feed', blocks: [
        { type: 'p', text: 'The weekly digest appears in your Home Feed like any other post, tagged with #WeeklyDigest and #PokemonTCG. Look for the SwapPulse author name to spot it quickly. You can like, reply, and share it just like any other post.' },
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

  feeds: {
    title: 'Custom Feeds',
    subtitle: 'Community-built and platform feeds',
    sections: [
      { icon: 'Rss', title: 'What are Custom Feeds?', blocks: [
        { type: 'p', text: 'Custom Feeds are curated content streams built by the community or by SwapPulse. Each feed applies its own ranking algorithm or filter, so you can browse posts by niche, rarity, trade activity, or any theme the feed author defines. Feeds are powered by the SwapPulse feed generator and are portable via the AT Protocol.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Browse:</b> Open the Feeds page to see all available custom feeds.',
          '<b>Pin:</b> Pin feeds to your sidebar for quick access.',
          '<b>Preview:</b> See a sample of each feed before subscribing.',
          '<b>Subscribe:</b> Subscribe to feeds you want in your Home Feed rotation.',
        ]},
      ]},
      { icon: 'Sparkles', title: 'How feeds work', blocks: [
        { type: 'p', text: 'Each feed is defined by a feed generator that filters and ranks posts. SwapPulse hosts its own feed generator, and community members can create feeds too. Feeds are mirrored to the AT Protocol so they work across instances.' },
      ]},
    ],
  },

  'bookmark-boards': {
    title: 'Bookmark Boards',
    subtitle: 'Organise saved content into collections',
    sections: [
      { icon: 'Bookmark', title: 'What are Bookmark Boards?', blocks: [
        { type: 'p', text: 'Bookmark Boards let you save and organise posts, cards, trade listings, and journals into themed collections. Think of them as Pinterest-style boards for Pokémon TCG content. Boards are mirrored to the AT Protocol and can be public or private.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>Create boards:</b> Make themed boards like "Charizard Collection", "Trade Targets", or "Grail Cards".',
          '<b>Save content:</b> Use the bookmark button on any post, card, or trade listing to save it to a board.',
          '<b>Share boards:</b> Public boards are visible on your profile and can be featured in starter packs.',
          '<b>Reorder:</b> Drag and drop items within a board to prioritise your favourites.',
        ]},
      ]},
      { icon: 'Package', title: 'Featuring in starter packs', blocks: [
        { type: 'p', text: 'You can feature a bookmark board in a starter pack to help newcomers discover curated content. The board appears on the pack detail page for anyone viewing the pack.' },
      ]},
    ],
  },

  search: {
    title: 'Search',
    subtitle: 'Find anything on SwapPulse',
    sections: [
      { icon: 'Search', title: 'What can I search for?', blocks: [
        { type: 'p', text: 'The Search page lets you find cards, collectors, posts, trade listings, and journals across SwapPulse in one place. Search is federated, meaning it also includes content from connected AT Protocol instances.' },
      ]},
      { title: 'Search types', blocks: [
        { type: 'list', items: [
          '<b>Cards:</b> Search by card name, set, or TCGDex ID.',
          '<b>Collectors:</b> Find collectors by handle, display name, or DID.',
          '<b>Posts:</b> Full-text search across posts in the firehose.',
          '<b>Trade listings:</b> Find cards offered or wanted in active trades.',
          '<b>Journals:</b> Search long-form journal entries.',
        ]},
      ]},
      { icon: 'Hash', title: 'Hashtag search', blocks: [
        { type: 'p', text: 'You can also search by hashtag. Type a hashtag in the search bar or click any hashtag on a post to see all posts with that tag. Follow hashtags to surface relevant content in your For You feed.' },
      ]},
      { icon: 'Bookmark', title: 'Saved searches', blocks: [
        { type: 'p', text: 'Save frequent searches for quick re-access. Saved searches appear in your sidebar and can be scoped to specific content types.' },
      ]},
    ],
  },

  'online-now': {
    title: 'Online Now',
    subtitle: 'See who is active right now',
    sections: [
      { icon: 'UserCheck', title: 'What is Online Now?', blocks: [
        { type: 'p', text: 'The Online Now page shows collectors who are currently active on SwapPulse. Presence is tracked in real time via a live presence system. Use it to find someone to trade with, chat with, or join a voice space.' },
      ]},
      { title: 'What you can do', blocks: [
        { type: 'list', items: [
          '<b>See active collectors:</b> Browse a list of online collectors with their avatars and handles.',
          '<b>Start a chat:</b> Click Message to open a direct message thread with an online collector.',
          '<b>Start a trade:</b> Click Trade to open a trade thread directly.',
          '<b>Join a space:</b> If a collector is hosting a live voice space, you can join from their card.',
        ]},
      ]},
      { icon: 'ShieldCheck', title: 'Privacy', blocks: [
        { type: 'p', text: 'Your presence is only visible when you are actively using SwapPulse. You can disable presence tracking in Settings if you prefer to browse privately. When disabled, you will not appear in the Online Now list.' },
      ]},
    ],
  },
};