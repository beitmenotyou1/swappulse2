// Lexicon registry — the deployable copy of every org.swappulse.* lexicon
// definition, used by the register-lexicons backend function to publish them
// to the network via com.atproto.lexicon.schema. The JSON files in
// base44/lexicons/ are the canonical source of truth; this module mirrors
// them because the edge bundler can't import JSON from outside the function.
// Keep this in sync with base44/lexicons/ after any edit.

export const LEXICONS: any[] = [
  {
    lexicon: 1, id: 'org.swappulse.collectionEntry', revision: 1,
    description: "A Pokémon TCG card held in a collector's digital binder. Mirrored from the SwapPulse CollectionEntry entity so collection state is portable across PDSs.",
    defs: { main: { type: 'record', key: 'tid', description: 'A single card entry in a collector\'s collection.', record: { type: 'object', required: ['cardUri', 'cardName', 'createdAt'], properties: {
      cardUri: { type: 'string', description: 'TCGDex card id (canonical reference to the catalogue record)' },
      cardName: { type: 'string' }, setName: { type: 'string' }, setCode: { type: 'string', description: 'Canonical TCGDex set id (e.g. sv04.5)' },
      cardNumber: { type: 'string', description: 'Card number within the set' }, rarity: { type: 'string' }, category: { type: 'string' },
      imageUrl: { type: 'string', format: 'uri' }, condition: { type: 'string', knownValues: ['mint', 'near_mint', 'excellent', 'good', 'damaged'] },
      variant: { type: 'string', knownValues: ['normal', 'holo', 'reverse_holo'] }, acquisitionDate: { type: 'string', format: 'date' },
      purchasePrice: { type: 'number' }, marketValue: { type: 'number' }, notes: { type: 'string', maxLength: 500 },
      showcased: { type: 'boolean' }, binderIndex: { type: 'integer' }, createdAt: { type: 'string', format: 'datetime' },
      authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' }, authorHandle: { type: 'string' }, authorAvatar: { type: 'string', format: 'uri' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.tradeListing', revision: 1,
    description: 'A peer-to-peer card trade listing published by a collector. Offer/wanted card sets reference TCGDex catalogue records; status tracks the trade lifecycle.',
    defs: { main: { type: 'record', key: 'tid', description: 'A trade listing offering cards in exchange for wanted cards.', record: { type: 'object', required: ['offerCardNames', 'wantedCardNames', 'status', 'visibility', 'createdAt'], properties: {
      offerCardUris: { type: 'array', items: { type: 'string' }, maxLength: 50 }, offerCardNames: { type: 'array', items: { type: 'string' } },
      offerCardImages: { type: 'array', items: { type: 'string', format: 'uri' } }, wantedCardUris: { type: 'array', items: { type: 'string' }, maxLength: 50 },
      wantedCardNames: { type: 'array', items: { type: 'string' } }, status: { type: 'string', knownValues: ['open', 'negotiating', 'pending_ship', 'completed', 'cancelled'] },
      visibility: { type: 'string', knownValues: ['public', 'wishlist_only', 'circle_scoped'] }, circleRef: { type: 'string', format: 'at-uri' },
      shippingRegions: { type: 'array', items: { type: 'string' } }, preferredCurrency: { type: 'string', knownValues: ['GBP', 'EUR', 'USD'] },
      notes: { type: 'string', maxLength: 500 }, expiresAt: { type: 'string', format: 'datetime' }, createdAt: { type: 'string', format: 'datetime' },
      authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' }, authorHandle: { type: 'string' }, authorAvatar: { type: 'string', format: 'uri' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.vouch', revision: 1,
    description: "A collector's vouch for another collector's trustworthiness, mirrored to AT Protocol so the trust graph is portable and verifiable across PDSs and SwapPulse instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A vouch endorsing another collector.', record: { type: 'object', required: ['vouchedDid', 'relationship', 'context', 'createdAt'], properties: {
      vouchedDid: { type: 'string', format: 'did' }, vouchedName: { type: 'string' }, vouchedHandle: { type: 'string' },
      voucherName: { type: 'string' }, voucherHandle: { type: 'string' }, voucherDid: { type: 'string', format: 'did' },
      relationship: { type: 'string', knownValues: ['trade_partner', 'community_member', 'personal_acquaintance', 'repeat_trader'] },
      context: { type: 'string', maxLength: 280 }, tradeRefs: { type: 'array', items: { type: 'string', format: 'at-uri' }, maxLength: 5 },
      revocable: { type: 'boolean' }, revokedAt: { type: 'string', format: 'datetime' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.wishlist', revision: 1,
    description: 'A card a collector wants to acquire, mirrored to AT Protocol as a real org.swappulse.wishlist record. Enables cross-instance trade matching.',
    defs: { main: { type: 'record', key: 'tid', description: 'A wishlist entry for a wanted card.', record: { type: 'object', required: ['cardUri', 'cardName', 'createdAt'], properties: {
      cardUri: { type: 'string' }, cardName: { type: 'string' }, imageUrl: { type: 'string', format: 'uri' },
      setCode: { type: 'string' }, setName: { type: 'string' }, rarity: { type: 'string' }, maxPrice: { type: 'number' },
      ownerDid: { type: 'string', format: 'did' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.circle', revision: 1,
    description: 'A collector circle (themed community group), mirrored to AT Protocol so circles are portable community objects across PDSs and SwapPulse instances.',
    defs: { main: { type: 'record', key: 'tid', description: 'A collector circle.', record: { type: 'object', required: ['name', 'visibility', 'createdAt'], properties: {
      name: { type: 'string', maxLength: 60 }, description: { type: 'string', maxLength: 200 },
      memberDids: { type: 'array', items: { type: 'string', format: 'did' }, maxLength: 100 },
      memberProfiles: { type: 'array', maxLength: 100, items: { type: 'object', properties: { did: { type: 'string', format: 'did' }, name: { type: 'string' }, handle: { type: 'string' }, avatar: { type: 'string', format: 'uri' } } } },
      memberCount: { type: 'integer' }, visibility: { type: 'string', knownValues: ['private', 'members_visible', 'public'] },
      theme: { type: 'string', knownValues: ['vintage', 'competitive', 'shiny', 'investment', 'local_region', 'artist', 'general'] },
      region: { type: 'string' }, curatorDid: { type: 'string', format: 'did' }, curatorName: { type: 'string' }, curatorHandle: { type: 'string' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.packParty', revision: 1,
    description: 'A synchronized pack-opening event where collectors open packs of the same set at the same time and share reactions in real time. Mirrored to AT Protocol so parties are discoverable across instances.',
    defs: { main: { type: 'record', key: 'tid', description: 'A pack-opening party event.', record: { type: 'object', required: ['title', 'setId', 'scheduledAt', 'createdAt'], properties: {
      title: { type: 'string', maxLength: 100 }, description: { type: 'string', maxLength: 500 }, setId: { type: 'string' },
      setName: { type: 'string' }, setImage: { type: 'string', format: 'uri' }, scheduledAt: { type: 'string', format: 'datetime' },
      status: { type: 'string', knownValues: ['scheduled', 'live', 'completed'] }, hostDid: { type: 'string', format: 'did' },
      hostName: { type: 'string' }, hostHandle: { type: 'string' }, hostAvatar: { type: 'string', format: 'uri' },
      participantCount: { type: 'integer' }, maxParticipants: { type: 'integer' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.pullNomination', revision: 1,
    description: "A collector's nomination of their best card pull for a given week's 'Pull of the Week' community vote. Mirrored to AT Protocol so nominations are federated across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A Pull of the Week nomination.', record: { type: 'object', required: ['weekKey', 'cardUri', 'cardName', 'createdAt'], properties: {
      weekKey: { type: 'string' }, cardUri: { type: 'string' }, cardName: { type: 'string' }, cardImage: { type: 'string', format: 'uri' },
      cardRarity: { type: 'string' }, setName: { type: 'string' }, nominatorDid: { type: 'string', format: 'did' },
      nominatorName: { type: 'string' }, nominatorHandle: { type: 'string' }, nominatorAvatar: { type: 'string', format: 'uri' },
      postUri: { type: 'string', format: 'at-uri' }, voteCount: { type: 'integer' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.tradingFeedback', revision: 1,
    description: 'Feedback left by a trader after a completed trade, mirrored to AT Protocol so trading reputation is portable and verifiable across instances.',
    defs: { main: { type: 'record', key: 'tid', description: 'Trading feedback for a completed trade.', record: { type: 'object', required: ['tradeUri', 'ratedUserDid', 'rating', 'createdAt'], properties: {
      tradeUri: { type: 'string', format: 'at-uri' }, tradeId: { type: 'string' }, ratedUserDid: { type: 'string', format: 'did' },
      raterDid: { type: 'string', format: 'did' }, raterName: { type: 'string' }, raterHandle: { type: 'string' }, raterAvatar: { type: 'string', format: 'uri' },
      rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string', maxLength: 500 }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.meetup', revision: 1,
    description: 'A local in-person collector meetup, mirrored to AT Protocol so meetups are discoverable across instances. RSVPs are separate org.swappulse.meetupRsvp records referencing this meetup via strongRef.',
    defs: { main: { type: 'record', key: 'tid', description: 'A collector meetup event.', record: { type: 'object', required: ['title', 'description', 'scheduledAt', 'locationName', 'status', 'createdAt'], properties: {
      title: { type: 'string', maxLength: 100 }, description: { type: 'string', maxLength: 1000 }, scheduledAt: { type: 'string', format: 'datetime' },
      estimatedDuration: { type: 'integer' }, locationName: { type: 'string', maxLength: 200 }, region: { type: 'string' },
      lat: { type: 'number' }, lng: { type: 'number' }, capacity: { type: 'integer', minimum: 2, maximum: 50 },
      requiredVouches: { type: 'integer', minimum: 0 }, status: { type: 'string', knownValues: ['scheduled', 'ongoing', 'completed', 'cancelled'] },
      creatorDid: { type: 'string', format: 'did' }, rsvpCount: { type: 'integer' }, organiserName: { type: 'string' }, organiserHandle: { type: 'string' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.meetupRsvp', revision: 1,
    description: "An attendee's RSVP for a meetup, mirrored to AT Protocol as a real org.swappulse.meetupRsvp record. References the meetup via strongRef so RSVPs are portable and verifiable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A meetup RSVP.', record: { type: 'object', required: ['meetupRef', 'meetupId', 'attending', 'createdAt'], properties: {
      meetupRef: { type: 'string', format: 'at-uri' }, meetupId: { type: 'string' }, attending: { type: 'string', knownValues: ['yes', 'maybe', 'no'] },
      bringingTradeBinder: { type: 'boolean' }, lookingForCards: { type: 'array', items: { type: 'string' }, maxLength: 10 },
      attendeeDid: { type: 'string', format: 'did' }, attendeeName: { type: 'string' }, attendeeHandle: { type: 'string' }, attendeeAvatar: { type: 'string', format: 'uri' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.challenge', revision: 1,
    description: 'A community challenge definition, mirrored to AT Protocol so challenges are discoverable across instances. Participation model is set by mode: collective, competitive, or guild.',
    defs: { main: { type: 'record', key: 'tid', description: 'A community challenge.', record: { type: 'object', required: ['challengeType', 'title', 'status', 'createdAt'], properties: {
      challengeType: { type: 'string', knownValues: ['set_sprint', 'budget_deck', 'pull_of_week', 'community_goal'] },
      mode: { type: 'string', knownValues: ['collective', 'guild', 'competitive'] },
      category: { type: 'string', knownValues: ['helpful-trader', 'accuracy-champion', 'community-builder', 'set-completer', 'shiny-hunter', 'journal-writer', 'meetup-organiser'] },
      title: { type: 'string', maxLength: 100 }, description: { type: 'string', maxLength: 2000 }, rules: { type: 'string', maxLength: 2000 },
      scope: { type: 'string', knownValues: ['global', 'circle'] }, circleRef: { type: 'string', format: 'at-uri' },
      goal: { type: 'object', properties: { metric: { type: 'string' }, target: { type: 'integer' }, filters: { type: 'object' } } },
      reward: { type: 'object', properties: { type: { type: 'string' }, badgeId: { type: 'string' }, themeId: { type: 'string' }, shared: { type: 'boolean' } } },
      leaderboardConfig: { type: 'object' }, targetSetCode: { type: 'string' }, budgetLimit: { type: 'number' }, rewardBadge: { type: 'string', maxLength: 50 },
      startsAt: { type: 'string', format: 'datetime' }, endsAt: { type: 'string', format: 'datetime' }, votingEndsAt: { type: 'string', format: 'datetime' },
      status: { type: 'string', knownValues: ['upcoming', 'active', 'voting', 'completed', 'cancelled'] },
      winnerDids: { type: 'array', items: { type: 'string', format: 'did' } }, creatorDid: { type: 'string', format: 'did' },
      guildApproved: { type: 'boolean' }, tags: { type: 'array', items: { type: 'string' }, maxLength: 10 }, imageUrl: { type: 'string', format: 'uri' },
      publisherName: { type: 'string' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.challengeEntry', revision: 1,
    description: "A user's contribution to a challenge, mirrored to AT Protocol as a real org.swappulse.challengeEntry record. References the challenge via strongRef so entries are portable and verifiable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A challenge entry contribution.', record: { type: 'object', required: ['challengeId', 'entryType', 'submittedAt', 'createdAt'], properties: {
      challengeRef: { type: 'string', format: 'at-uri' }, challengeId: { type: 'string' }, participantDid: { type: 'string', format: 'did' },
      participantName: { type: 'string' }, entryType: { type: 'string', knownValues: ['set_progress', 'deck_list', 'card_pull', 'collection_value'] },
      category: { type: 'string' }, contributionCount: { type: 'integer' }, contributionUris: { type: 'array', items: { type: 'string', format: 'at-uri' }, maxLength: 1000 },
      verificationHash: { type: 'string' }, moderatorLabels: { type: 'array', items: { type: 'string' } }, notes: { type: 'string', maxLength: 500 },
      overrideProfileVisibility: { type: 'object' }, status: { type: 'string', knownValues: ['pending', 'approved', 'rejected', 'expired'] },
      rejectionReason: { type: 'string', maxLength: 200 }, setCompletionPercent: { type: 'number' }, pullPostUri: { type: 'string', format: 'at-uri' },
      collectionTotalValue: { type: 'number' }, deckList: { type: 'array', items: { type: 'object' } }, submittedAt: { type: 'string', format: 'datetime' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.story', revision: 1,
    description: 'An ephemeral 24-hour story, mirrored to AT Protocol as a real org.swappulse.story record. Stories expire client-side after 24 hours; the PDS record remains for audit but the AppView filters expired stories from feeds.',
    defs: { main: { type: 'record', key: 'tid', description: 'An ephemeral story with one or more media segments.', record: { type: 'object', required: ['expiresAt', 'audience', 'createdAt'], properties: {
      segments: { type: 'array', minLength: 1, maxLength: 20, items: { type: 'object', properties: {
        order: { type: 'integer', minimum: 0 }, mediaBlob: { type: 'string', format: 'uri' }, mediaType: { type: 'string', knownValues: ['image', 'video', 'text', 'card'] },
        textOverlay: { type: 'string', maxLength: 200 }, textPosition: { type: 'string', knownValues: ['top', 'center', 'bottom'] },
        backgroundColor: { type: 'string' }, cardEmbedUri: { type: 'string' }, cardName: { type: 'string' }, cardImage: { type: 'string', format: 'uri' },
        duration: { type: 'integer', minimum: 3, maximum: 15 }
      } } },
      audience: { type: 'string', knownValues: ['friends', 'public'] }, storyGroup: { type: 'string' }, content: { type: 'string', maxLength: 280 },
      imageUri: { type: 'string', format: 'uri' }, bgGradient: { type: 'string', knownValues: ['purple', 'sunset', 'ocean'] },
      expiresAt: { type: 'string', format: 'datetime' }, viewedBy: { type: 'array', items: { type: 'string', format: 'did' } },
      authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' }, authorHandle: { type: 'string' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.reaction', revision: 1,
    description: "A collector's reaction to a post (insane_pull, jealous, congrats, trade_interest, etc.), mirrored to AT Protocol as a real org.swappulse.reaction record. References the post via strongRef so reactions are portable and verifiable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A reaction to a post.', record: { type: 'object', required: ['subject', 'reactionType', 'createdAt'], properties: {
      subject: { type: 'string', format: 'at-uri' }, postId: { type: 'string' },
      reactionType: { type: 'string', knownValues: ['insane_pull', 'jealous', 'congrats', 'trade_interest', 'gratz_set', 'better_luck', 'wow'] },
      targetCardUri: { type: 'string' }, reactorDid: { type: 'string', format: 'did' }, reactorName: { type: 'string' }, reactorHandle: { type: 'string' },
      reactorAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.journal', revision: 1,
    description: "A collector's published journal entry, mirrored to AT Protocol as a real org.swappulse.journal record so journals are portable and discoverable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A published collector journal entry.', record: { type: 'object', required: ['title', 'body', 'visibility', 'createdAt'], properties: {
      title: { type: 'string', maxLength: 200 }, subtitle: { type: 'string', maxLength: 300 }, body: { type: 'string', maxLength: 50000 },
      coverImageUri: { type: 'string', format: 'uri' }, embeddedCardUris: { type: 'array', items: { type: 'string', format: 'at-uri' }, maxLength: 20 },
      embeddedStats: { type: 'object', properties: { totalCollectionValue: { type: 'number' }, setCompletionPercent: { type: 'number' }, totalCards: { type: 'integer' }, rarestCardUri: { type: 'string' } } },
      tags: { type: 'array', items: { type: 'string', maxLength: 30 }, maxLength: 10 }, visibility: { type: 'string', knownValues: ['public', 'followers', 'private'] },
      publishedAt: { type: 'string', format: 'datetime' }, likeCount: { type: 'integer' }, authorDid: { type: 'string', format: 'did' },
      authorName: { type: 'string' }, authorHandle: { type: 'string' }, authorAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.cardReview', revision: 1,
    description: "A collector's multi-axis review of a specific card (artwork, playability, collectibility, investment), mirrored to AT Protocol so reviews are portable and discoverable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A multi-axis card review.', record: { type: 'object', required: ['cardUri', 'artwork', 'playability', 'collectibility', 'investment', 'createdAt'], properties: {
      cardUri: { type: 'string' }, cardName: { type: 'string' }, cardImage: { type: 'string', format: 'uri' },
      artwork: { type: 'integer', minimum: 1, maximum: 5 }, playability: { type: 'integer', minimum: 1, maximum: 5 },
      collectibility: { type: 'integer', minimum: 1, maximum: 5 }, investment: { type: 'integer', minimum: 1, maximum: 5 },
      reviewText: { type: 'string', maxLength: 2000 }, variant: { type: 'string', knownValues: ['normal', 'holo', 'reverse_holo'] },
      reviewerDid: { type: 'string', format: 'did' }, reviewerName: { type: 'string' }, reviewerHandle: { type: 'string' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.binder', revision: 1,
    description: "A collector's digital binder (themed card display), mirrored to AT Protocol as a real org.swappulse.binder record so binders are portable and viewable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A digital binder.', record: { type: 'object', required: ['title', 'visibility', 'createdAt'], properties: {
      title: { type: 'string', maxLength: 100 }, description: { type: 'string', maxLength: 500 }, coverImageUri: { type: 'string', format: 'uri' },
      theme: { type: 'string', knownValues: ['classic_purple', 'holo_foil', 'vintage_leather', 'midnight', 'rainbow', 'custom'] },
      pages: { type: 'array', minLength: 1, maxLength: 10, items: { type: 'object', properties: {
        pageNumber: { type: 'integer', minimum: 1, maximum: 10 }, slots: { type: 'array', minLength: 6, maxLength: 6, items: { type: 'object', properties: {
          slotIndex: { type: 'integer', minimum: 1, maximum: 6 }, collectionEntryUri: { type: 'string', format: 'at-uri' }, customCaption: { type: 'string', maxLength: 100 }
        } } }
      } } },
      visibility: { type: 'string', knownValues: ['public', 'followers', 'private'] }, likeCount: { type: 'integer' }, viewCount: { type: 'integer' },
      authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' }, authorHandle: { type: 'string' }, authorAvatar: { type: 'string', format: 'uri' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.tradeChain', revision: 1,
    description: 'A multi-party trade chain (3-5 participants shipping cards in sequence), mirrored to AT Protocol as a real org.swappulse.tradeChain record so chains are portable and verifiable across instances.',
    defs: { main: { type: 'record', key: 'tid', description: 'A multi-party trade chain.', record: { type: 'object', required: ['participantDids', 'chainOrder', 'status', 'totalValue', 'createdAt'], properties: {
      participantDids: { type: 'array', items: { type: 'string', format: 'did' } }, participantNames: { type: 'array', items: { type: 'string' } },
      shipstoDids: { type: 'array', items: { type: 'string', format: 'did' } }, tradeListingUris: { type: 'array', items: { type: 'string', format: 'at-uri' } },
      shippingConfirmed: { type: 'array', items: { type: 'boolean' } }, receiptConfirmed: { type: 'array', items: { type: 'boolean' } },
      chainOrder: { type: 'string', knownValues: ['clockwise', 'anticlockwise'] }, status: { type: 'string', knownValues: ['proposed', 'accepted', 'in_transit', 'completed', 'cancelled'] },
      totalValue: { type: 'number' }, completedAt: { type: 'string', format: 'datetime' }, organiserDid: { type: 'string', format: 'did' }, organiserName: { type: 'string' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.tradeDispute', revision: 1,
    description: 'A user-submitted dispute flag against a trade listing, mirrored to AT Protocol as a real org.swappulse.tradeDispute record. Filed when a collector has an issue with cards received. Moderators review and resolve.',
    defs: { main: { type: 'record', key: 'tid', description: 'A trade dispute flag.', record: { type: 'object', required: ['tradeId', 'reason', 'description', 'createdAt'], properties: {
      tradeId: { type: 'string' }, tradeRef: { type: 'string', format: 'at-uri' }, reason: { type: 'string', knownValues: ['misgraded', 'wrong_card', 'damaged', 'not_received', 'scam', 'other'] },
      description: { type: 'string', maxLength: 2000 }, photoUrls: { type: 'array', items: { type: 'string', format: 'uri' } },
      status: { type: 'string', knownValues: ['pending', 'reviewed', 'resolved', 'dismissed'] }, resolutionNotes: { type: 'string', maxLength: 2000 },
      resolvedBy: { type: 'string' }, resolvedAt: { type: 'string', format: 'datetime' }, filedByDid: { type: 'string', format: 'did' },
      filedByName: { type: 'string' }, filedByHandle: { type: 'string' }, filedByAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.voiceSpace', revision: 1,
    description: 'Manual live stream declaration, mirrored to AT Protocol as a real org.swappulse.voiceSpace record so live streams are discoverable across instances. A collector goes live by pasting an external stream URL.',
    defs: { main: { type: 'record', key: 'tid', description: 'A live stream declaration.', record: { type: 'object', required: ['title', 'status', 'createdAt'], properties: {
      title: { type: 'string', maxLength: 120 }, description: { type: 'string', maxLength: 1000 }, status: { type: 'string', knownValues: ['scheduled', 'live', 'ended', 'cancelled'] },
      streamUrl: { type: 'string', format: 'uri' }, platform: { type: 'string', knownValues: ['twitch', 'youtube', 'kick', 'facebook_gaming', 'rumble', 'custom', 'other'] },
      plannedDurationMinutes: { type: 'integer', minimum: 15, maximum: 480 }, autoEndAt: { type: 'string', format: 'datetime' },
      startedAt: { type: 'string', format: 'datetime' }, endedAt: { type: 'string', format: 'datetime' }, viewerCountEstimate: { type: 'integer' },
      coHostDids: { type: 'array', items: { type: 'string', format: 'did' }, maxLength: 3 }, topicTags: { type: 'array', items: { type: 'string', maxLength: 30 }, maxLength: 5 },
      cardUrisDiscussed: { type: 'array', items: { type: 'string' }, maxLength: 20 }, recordingAvailable: { type: 'boolean' },
      podcastEpisodeUri: { type: 'string', format: 'at-uri' }, hostDid: { type: 'string', format: 'did' }, hostName: { type: 'string' }, hostHandle: { type: 'string' },
      hostAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.podcastEpisode', revision: 1,
    description: 'A podcast episode (often derived from a voice space recording), mirrored to AT Protocol as a real org.swappulse.podcastEpisode record so episodes are portable and playable across instances.',
    defs: { main: { type: 'record', key: 'tid', description: 'A podcast episode.', record: { type: 'object', required: ['title', 'audioUrl', 'durationSeconds', 'publishedAt', 'createdAt'], properties: {
      title: { type: 'string', maxLength: 200 }, description: { type: 'string', maxLength: 2000 }, audioUrl: { type: 'string', format: 'uri' },
      durationSeconds: { type: 'integer', minimum: 1 }, episodeNumber: { type: 'integer', minimum: 1 }, seasonNumber: { type: 'integer', minimum: 1 },
      coverImageUrl: { type: 'string', format: 'uri' }, sourceSpaceId: { type: 'string' },
      chapterMarks: { type: 'array', items: { type: 'object', properties: { timestampSeconds: { type: 'integer' }, title: { type: 'string', maxLength: 100 }, cardUri: { type: 'string' } } } },
      showNotes: { type: 'string', maxLength: 5000 }, tags: { type: 'array', items: { type: 'string', maxLength: 30 }, maxLength: 10 },
      playCount: { type: 'integer' }, publishedAt: { type: 'string', format: 'datetime' }, hostDid: { type: 'string', format: 'did' },
      hostName: { type: 'string' }, hostHandle: { type: 'string' }, hostAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.conversation', revision: 1,
    description: 'A 1:1 direct-message conversation between two collectors, mirrored to AT Protocol as a real org.swappulse.conversation record. The creator is tracked by authorDid; the other participant by recipientDid so both can read.',
    defs: { main: { type: 'record', key: 'tid', description: 'A 1:1 DM conversation.', record: { type: 'object', required: ['recipientDid', 'participantDids', 'createdAt'], properties: {
      recipientDid: { type: 'string', format: 'did' }, participantDids: { type: 'array', minLength: 2, maxLength: 2, items: { type: 'string', format: 'did' } },
      recipientName: { type: 'string' }, recipientHandle: { type: 'string' }, recipientAvatar: { type: 'string', format: 'uri' },
      lastMessageAt: { type: 'string', format: 'datetime' }, lastMessagePreview: { type: 'string', maxLength: 200 }, lastMessageDid: { type: 'string', format: 'did' },
      authorDid: { type: 'string', format: 'did' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.directMessage', revision: 1,
    description: 'A single message in a 1:1 conversation, mirrored to AT Protocol as a real org.swappulse.directMessage record. The sender is tracked by authorDid; the recipient by recipientDid so both can read.',
    defs: { main: { type: 'record', key: 'tid', description: 'A direct message in a conversation.', record: { type: 'object', required: ['recipientDid', 'body', 'createdAt'], properties: {
      conversationId: { type: 'string' }, conversationRef: { type: 'string', format: 'at-uri' }, recipientDid: { type: 'string', format: 'did' },
      body: { type: 'string', maxLength: 2000 }, authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' }, authorHandle: { type: 'string' },
      authorAvatar: { type: 'string', format: 'uri' }, read: { type: 'boolean' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.starterPack', revision: 1,
    description: "A collector-authored onboarding bundle of member collectors, recommended Circles, pinned custom feeds, and a featured binder/journal, mirrored to AT Protocol so packs are portable and discoverable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A starter pack for onboarding newcomers.', record: { type: 'object', required: ['name', 'category', 'createdAt'], properties: {
      name: { type: 'string', maxLength: 64 }, description: { type: 'string', maxLength: 300 },
      category: { type: 'string', knownValues: ['vintage', 'modern', 'competitive', 'investment', 'sealed', 'japanese', 'trading', 'general'] },
      memberDids: { type: 'array', maxLength: 50, items: { type: 'string', format: 'did' } },
      circleIds: { type: 'array', maxLength: 10, items: { type: 'string' } },
      feedUris: { type: 'array', maxLength: 10, items: { type: 'string', format: 'at-uri' } },
      featuredBinderId: { type: 'string' }, featuredJournalId: { type: 'string' }, coverImageUrl: { type: 'string', format: 'uri' },
      subscriberCount: { type: 'integer' }, authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' },
      authorHandle: { type: 'string' }, authorAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.bookmarkBoard', revision: 1,
    description: "A named, optionally-shareable curation board of saved posts, cards, and trade listings, mirrored to AT Protocol so boards are portable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A bookmark curation board.', record: { type: 'object', required: ['name', 'visibility', 'createdAt'], properties: {
      name: { type: 'string', maxLength: 60 }, description: { type: 'string', maxLength: 300 },
      visibility: { type: 'string', knownValues: ['public', 'private'] },
      items: { type: 'array', maxLength: 500, items: { type: 'object', properties: { itemType: { type: 'string', knownValues: ['post', 'card', 'trade_listing'] }, itemId: { type: 'string' }, itemUri: { type: 'string', format: 'at-uri' }, thumbnail: { type: 'string', format: 'uri' }, title: { type: 'string' }, addedAt: { type: 'string', format: 'datetime' } } } },
      coverImageUrl: { type: 'string', format: 'uri' }, authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' },
      authorHandle: { type: 'string' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.communityLabeler', revision: 1,
    description: "A community-run labeling service definition, mirrored to AT Protocol so labelers are portable and discoverable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A community labeler service.', record: { type: 'object', required: ['name', 'category', 'approvalStatus', 'createdAt'], properties: {
      name: { type: 'string', maxLength: 64 }, description: { type: 'string', maxLength: 500 },
      category: { type: 'string', knownValues: ['authenticity', 'safety', 'grading', 'expertise', 'quality', 'other'] },
      labelValues: { type: 'array', maxLength: 20, items: { type: 'string' } },
      approvalStatus: { type: 'string', knownValues: ['pending', 'approved', 'rejected', 'revoked'] },
      reviewedBy: { type: 'string' }, reviewedAt: { type: 'string', format: 'datetime' },
      subscriberCount: { type: 'integer' }, labelCount: { type: 'integer' },
      authorDid: { type: 'string', format: 'did' }, authorName: { type: 'string' }, authorHandle: { type: 'string' },
      authorAvatar: { type: 'string', format: 'uri' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.feedSubscription', revision: 1,
    description: "A collector's subscription/pin to a custom community feed, mirrored to AT Protocol so feed subscriptions are portable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A feed subscription.', record: { type: 'object', required: ['feedUri', 'createdAt'], properties: {
      feedUri: { type: 'string', format: 'at-uri' }, feedName: { type: 'string' }, pinned: { type: 'boolean' },
      authorDid: { type: 'string', format: 'did' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'org.swappulse.labelerSubscription', revision: 1,
    description: "A collector's subscription to a community labeler, mirrored to AT Protocol so labeler subscriptions are portable across instances.",
    defs: { main: { type: 'record', key: 'tid', description: 'A labeler subscription.', record: { type: 'object', required: ['labelerId', 'createdAt'], properties: {
      labelerId: { type: 'string' }, labelerRef: { type: 'string', format: 'at-uri' },
      authorDid: { type: 'string', format: 'did' }, createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  // ─── Standard.site community lexicons (site.standard.*) ───────────────────
  // Interoperable long-form publishing lexicons so SwapPulse journals, card
  // reviews, and binder descriptions are portable across the ATmosphere and
  // render as branded enhanced link cards on Bluesky. Published IN ADDITION to
  // the org.swappulse.* records — the org.swappulse.* record remains canonical
  // while the site.standard.document is the interoperable metadata wrapper.
  {
    lexicon: 1, id: 'site.standard.publication', revision: 1,
    description: 'A publication (collection of documents) on the Standard.site network. SwapPulse creates one per collector (lazily, on first long-form publish) and one for the SwapPulse site itself.',
    defs: { main: { type: 'record', key: 'tid', description: 'A Standard.site publication.', record: { type: 'object', required: ['name', 'url'], properties: {
      name: { type: 'string', maxLength: 100 }, url: { type: 'string', format: 'uri' }, description: { type: 'string', maxLength: 500 },
      icon: { type: 'blob', accept: ['image/*'] }, basicTheme: { type: 'ref', ref: 'site.standard.theme.basic' },
      preferences: { type: 'object', properties: { showInDiscover: { type: 'boolean' } } }
    } } } }
  },
  {
    lexicon: 1, id: 'site.standard.document', revision: 1,
    description: 'A long-form document published under a Standard.site publication. SwapPulse publishes journals, card reviews, and binder descriptions as documents so they are portable and discoverable.',
    defs: { main: { type: 'record', key: 'tid', description: 'A Standard.site document.', record: { type: 'object', required: ['site', 'title', 'path'], properties: {
      site: { type: 'string', format: 'at-uri', description: 'at:// URI of the publication this document belongs to' },
      title: { type: 'string', maxLength: 200 }, path: { type: 'string', description: 'URL path on the publication site' },
      description: { type: 'string', maxLength: 300 }, coverImage: { type: 'blob', accept: ['image/*'] },
      tags: { type: 'array', items: { type: 'string', maxLength: 30 }, maxLength: 10 },
      content: { type: 'array', items: { type: 'union', refs: ['site.standard.content.text'] } },
      contributors: { type: 'array', items: { type: 'string', format: 'did' } },
      publishedAt: { type: 'string', format: 'datetime' }, bskyPostRef: { type: 'string', format: 'at-uri' },
      links: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, uri: { type: 'string', format: 'at-uri' } } } }
    } } } }
  },
  {
    lexicon: 1, id: 'site.standard.graph.subscription', revision: 1,
    description: 'A subscription to a Standard.site publication. Lets a collector follow another collector\'s long-form writing independently of their social follow.',
    defs: { main: { type: 'record', key: 'tid', description: 'A subscription to a publication.', record: { type: 'object', required: ['publication'], properties: {
      publication: { type: 'string', format: 'at-uri', description: 'at:// URI of the publication being subscribed to' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'site.standard.graph.recommend', revision: 1,
    description: 'A recommendation of a Standard.site document. A lightweight social signal distinct from a like, more appropriate for long-form content.',
    defs: { main: { type: 'record', key: 'tid', description: 'A recommendation of a document.', record: { type: 'object', required: ['document'], properties: {
      document: { type: 'string', format: 'at-uri', description: 'at:// URI of the document being recommended' },
      createdAt: { type: 'string', format: 'datetime' }
    } } } }
  },
  {
    lexicon: 1, id: 'site.standard.theme.basic', revision: 1,
    description: 'Basic RGB theme for a Standard.site publication (background, foreground, accent, accentForeground). SwapPulse maps its Midnight Vault palette to these values.',
    defs: { main: { type: 'object', required: ['background', 'foreground', 'accent', 'accentForeground'], properties: {
      background: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 255 }, minLength: 3, maxLength: 3 },
      foreground: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 255 }, minLength: 3, maxLength: 3 },
      accent: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 255 }, minLength: 3, maxLength: 3 },
      accentForeground: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 255 }, minLength: 3, maxLength: 3 }
    } } }
  },
  {
    lexicon: 1, id: 'site.standard.content.text', revision: 1,
    description: 'Text content block for a Standard.site document.',
    defs: { main: { type: 'object', required: ['text'], properties: {
      text: { type: 'object', required: ['text'], properties: { text: { type: 'string', maxLength: 100000 } } }
    } } }
  },
];