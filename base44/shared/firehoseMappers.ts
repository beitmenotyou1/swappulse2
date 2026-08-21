// Shared field mappers between firehose-ingest (inbound PDS→local) and
// import-repo (archive→local). Maps AT Protocol record values (camelCase) to
// local entity rows (snake_case), keyed by collection NSID. Also exposes a
// generic entity→record serializer (outbound-reconcile) and the collection→
// entity map used by both firehose-ingest and outbound-reconcile.

export const COLLECTIONS: Record<string, string> = {
  // Standard AT Protocol records — bidirectional sync of posts, reposts,
  // likes, and follows with the wider Bluesky network.
  'app.bsky.feed.post': 'Post',
  'app.bsky.feed.repost': 'Repost',
  'app.bsky.feed.like': 'Like',
  'app.bsky.graph.follow': 'Follow',
  // SwapPulse custom lexicon records
  'org.swappulse.vouch': 'Vouch',
  'org.swappulse.wishlist': 'Wishlist',
  'org.swappulse.circle': 'Circle',
  'org.swappulse.packParty': 'PackParty',
  'org.swappulse.pullNomination': 'PullNomination',
  'org.swappulse.tradingFeedback': 'Reputation',
  'org.swappulse.meetup': 'Meetup',
  'org.swappulse.meetupRsvp': 'MeetupRsvp',
  'org.swappulse.challenge': 'Challenge',
  'org.swappulse.challengeEntry': 'ChallengeEntry',
  'org.swappulse.story': 'Story',
  'org.swappulse.reaction': 'Reaction',
  'org.swappulse.journal': 'Journal',
  'org.swappulse.cardReview': 'CardReview',
  'org.swappulse.binder': 'Binder',
  'org.swappulse.tradeChain': 'TradeChain',
  'org.swappulse.tradeDispute': 'TradeDispute',
  'org.swappulse.voiceSpace': 'VoiceSpace',
  'org.swappulse.podcastEpisode': 'PodcastEpisode',
  'org.swappulse.conversation': 'Conversation',
  'org.swappulse.directMessage': 'DirectMessage',
  'org.swappulse.collectionEntry': 'CollectionEntry',
  'org.swappulse.tradeListing': 'TradeListing',
  // Standard.site community lexicon records
  'site.standard.graph.recommend': 'StandardRecommend',
  'site.standard.graph.subscription': 'StandardSubscription',
};

// Standard AT Protocol record mappers (app.bsky.*). These map remote
// Bluesky records into local entities so interactions from other instances
// surface in SwapPulse feeds and profiles.
// Build a displayable CDN URL for a Bluesky blob reference. The public
// cdn.bsky.app CDN serves blobs from any PDS the AppView has crawled.
function blobUrl(did: string, blob: any): string {
  const cid = blob?.ref?.$link || blob?.cid || '';
  if (!cid) return '';
  return `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}`;
}

function mapPostFields(val: any, atUri: string, did: string, profile?: any) {
  // Extract media from embeds. Bluesky supports:
  //   app.bsky.embed.images          — up to 4 images (with optional alt text)
  //   app.bsky.embed.external        — link card with thumbnail
  //   app.bsky.embed.record          — quote post
  //   app.bsky.embed.recordWithMedia — quote + images/external
  // Images are stored as { url, alt } objects so alt text round-trips.
  let embedImages: any[] = [];
  let embedExternal: any = null;
  let quoteRef = '';

  const embed = val.embed;
  if (embed) {
    if (embed.$type === 'app.bsky.embed.images' && Array.isArray(embed.images)) {
      embedImages = embed.images.map((img: any) => ({
        url: blobUrl(did, img?.image),
        alt: img?.alt || '',
      })).filter((im: any) => im.url);
    } else if (embed.$type === 'app.bsky.embed.external' && embed.external) {
      const ext = embed.external;
      embedExternal = {
        uri: ext.uri || '',
        title: ext.title || '',
        description: ext.description || '',
        thumb: ext.thumb ? blobUrl(did, ext.thumb) : '',
        site_name: '',
      };
    } else if (embed.$type === 'app.bsky.embed.record' && embed.record) {
      quoteRef = embed.record.uri || '';
    } else if (embed.$type === 'app.bsky.embed.recordWithMedia') {
      if (embed.record?.record) quoteRef = embed.record.record.uri || '';
      const media = embed.media;
      if (media?.$type === 'app.bsky.embed.images' && Array.isArray(media.images)) {
        embedImages = media.images.map((img: any) => ({
          url: blobUrl(did, img?.image),
          alt: img?.alt || '',
        })).filter((im: any) => im.url);
      } else if (media?.$type === 'app.bsky.embed.external' && media.external) {
        const ext = media.external;
        embedExternal = {
          uri: ext.uri || '',
          title: ext.title || '',
          description: ext.description || '',
          thumb: ext.thumb ? blobUrl(did, ext.thumb) : '',
          site_name: '',
        };
      }
    }
  }

  // Extract hashtags from facets (Bluesky stores tags as richtext facets,
  // not inline — but the text still contains the #tag literal).
  let hashtags: string[] = [];
  if (Array.isArray(val.facets)) {
    for (const facet of val.facets) {
      if (Array.isArray(facet.features)) {
        for (const feature of facet.features) {
          if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
            hashtags.push(feature.tag);
          }
        }
      }
    }
  }
  hashtags = hashtags.slice(0, 10);

  return {
    content: val.text || '',
    post_type: 'text',
    hashtags,
    canonical_tags: hashtags.map((h: string) => h.toLowerCase().trim()),
    embed_images: embedImages,
    embed_external: embedExternal || undefined,
    quote_ref: quoteRef,
    // embed_video is not set from Bluesky ingest (external video links become
    // embed_external cards). It is only populated by local compose.
    author_name: profile?.displayName || '',
    author_handle: profile?.handle || '',
    author_avatar: profile?.avatar || '',
    parent_uri: val.reply?.parent?.uri || '',
    parent_cid: val.reply?.parent?.cid || '',
    root_uri: val.reply?.root?.uri || '',
    root_cid: val.reply?.root?.cid || '',
    did, at_uri: atUri, cid: '', record_type: 'app.bsky.feed.post', bridged: true,
  };
}
function mapRepostFields(val: any, atUri: string, did: string) {
  return {
    post_id: '', post_uri: val.subject?.uri || '', post_cid: val.subject?.cid || '',
    did, at_uri: atUri, cid: '', record_type: 'app.bsky.feed.repost', bridged: true,
  };
}
function mapLikeFields(val: any, atUri: string, did: string) {
  return {
    post_id: '', post_uri: val.subject?.uri || '', post_cid: val.subject?.cid || '',
    did, at_uri: atUri, cid: '', record_type: 'app.bsky.feed.like', bridged: true,
  };
}
function mapFollowFields(val: any, atUri: string, did: string) {
  return {
    subject_did: val.subject || '', did, at_uri: atUri, cid: '',
    record_type: 'app.bsky.graph.follow', bridged: true,
  };
}
function mapVouchFields(val: any, atUri: string, did: string) {
  return {
    vouched_did: val.vouchedDid || '', vouched_name: val.vouchedName || '', vouched_handle: val.vouchedHandle || '',
    voucher_name: val.voucherName || '', voucher_handle: val.voucherHandle || '',
    relationship: val.relationship || 'community_member', context: val.context || '',
    trade_refs: val.tradeRefs || [], revocable: val.revocable ?? true, revoked_at: val.revokedAt || '',
    did: val.voucherDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.vouch', bridged: true,
  };
}
function mapWishlistFields(val: any, atUri: string, did: string) {
  return {
    card_id: val.cardUri || '', card_name: val.cardName || '', card_image: val.imageUrl || '',
    set_id: val.setCode || '', set_name: val.setName || '', rarity: val.rarity || '',
    max_price: val.maxPrice ?? null, did: val.ownerDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.wishlist', bridged: true,
  };
}
function mapCircleFields(val: any, atUri: string, did: string) {
  return {
    name: val.name || '', description: val.description || '', member_dids: val.memberDids || [],
    member_count: val.memberCount || 1, visibility: val.visibility || 'public', theme: val.theme || 'general',
    region: val.region || '', author_name: val.curatorName || '', author_handle: val.curatorHandle || '',
    did: val.curatorDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.circle', bridged: true,
  };
}
function mapMeetupFields(val: any, atUri: string, did: string) {
  return {
    title: val.title || '', description: val.description || '', scheduled_at: val.scheduledAt || '',
    estimated_duration: val.estimatedDuration ?? null, location_name: val.locationName || '',
    region: val.region || '', lat: val.lat ?? null, lng: val.lng ?? null, capacity: val.capacity ?? null,
    required_vouches: val.requiredVouches ?? 0, status: val.status || 'scheduled', creator_did: val.organiserDid || did,
    rsvp_count: 0, author_name: val.organiserName || '', author_handle: val.organiserHandle || '',
    did: val.organiserDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.meetup', bridged: true,
  };
}
function mapMeetupRsvpFields(val: any, atUri: string, did: string) {
  return {
    meetup_ref: val.meetupRef || '', meetup_id: '', attending: val.attending || 'yes',
    bringing_trade_binder: val.bringingTradeBinder ?? false, looking_for_cards: val.lookingForCards || [],
    attendee_name: val.attendeeName || '', attendee_handle: val.attendeeHandle || '',
    did: val.attendeeDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.meetupRsvp', bridged: true,
  };
}
function mapChallengeFields(val: any, atUri: string, did: string) {
  return {
    challenge_type: val.challengeType || 'community_goal', mode: val.mode || 'collective', category: val.category || '',
    title: val.title || '', description: val.description || '', rules: val.rules || '', scope: val.scope || 'global',
    circle_ref: val.circleRef || '', goal: val.goal || {}, reward: val.reward || {},
    leaderboard_config: val.leaderboardConfig || {}, target_set_code: val.targetSetCode || '',
    budget_limit: val.budgetLimit ?? null, reward_badge: val.rewardBadge || '', starts_at: val.startsAt || '',
    ends_at: val.endsAt || '', voting_ends_at: val.votingEndsAt || '', status: val.status || 'upcoming',
    tags: val.tags || [], image_url: val.imageUrl || '', author_name: val.publisherName || '',
    creator_did: val.publisherDid || did, did: val.publisherDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.challenge', bridged: true,
  };
}
function mapChallengeEntryFields(val: any, atUri: string, did: string) {
  return {
    challenge_ref: val.challengeRef || '', challenge_id: val.challengeId || '',
    participant_did: val.participantDid || did, participant_name: val.participantName || '',
    entry_type: val.entryType || 'card_pull', category: val.category || '',
    contribution_count: val.contributionCount ?? 1, contribution_uris: val.contributionUris || [],
    verification_hash: val.verificationHash || '', notes: val.notes || '', status: val.status || 'pending',
    submitted_at: val.submittedAt || '', did: val.participantDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.challengeEntry', bridged: true,
  };
}
function mapStoryFields(val: any, atUri: string, did: string) {
  return {
    segments: val.segments || [], audience: val.audience || 'friends', story_group: val.storyGroup || '',
    expires_at: val.expiresAt || '', author_name: val.authorName || '', author_handle: val.authorHandle || '',
    did: val.authorDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.story', bridged: true,
  };
}
function mapReactionFields(val: any, atUri: string, did: string) {
  return {
    subject: val.subject || '', post_id: '', reaction_type: val.reactionType || 'wow',
    target_card_uri: val.targetCardUri || '', reactor_name: val.reactorName || '',
    reactor_handle: val.reactorHandle || '', did: val.reactorDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.reaction', bridged: true,
  };
}
function mapJournalFields(val: any, atUri: string, did: string) {
  return {
    title: val.title || '', subtitle: val.subtitle || '', body: val.body || '',
    cover_image_uri: val.coverImageUri || '', embedded_card_uris: val.embeddedCardUris || [],
    embedded_stats: val.embeddedStats || {}, tags: val.tags || [], visibility: val.visibility || 'public',
    published_at: val.publishedAt || '', author_name: val.authorName || '', author_handle: val.authorHandle || '',
    did: val.authorDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.journal', bridged: true,
  };
}
function mapCardReviewFields(val: any, atUri: string, did: string) {
  return {
    card_id: val.cardUri || '', card_name: val.cardName || '', artwork: val.artwork ?? 3,
    playability: val.playability ?? 3, collectibility: val.collectibility ?? 3, investment: val.investment ?? 3,
    review_text: val.reviewText || '', variant: val.variant || 'normal', author_name: val.reviewerName || '',
    author_handle: val.reviewerHandle || '', did: val.reviewerDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.cardReview', bridged: true,
  };
}
function mapBinderFields(val: any, atUri: string, did: string) {
  return {
    title: val.title || '', description: val.description || '', cover_image_uri: val.coverImageUri || '',
    theme: val.theme || 'classic_purple', pages: val.pages || [], visibility: val.visibility || 'public',
    author_name: val.authorName || '', author_handle: val.authorHandle || '', did: val.authorDid || did,
    at_uri: atUri, cid: '', record_type: 'org.swappulse.binder', bridged: true,
  };
}
function mapTradeChainFields(val: any, atUri: string, did: string) {
  return {
    participant_dids: val.participantDids || [], participant_names: val.participantNames || [],
    shipsto_dids: val.shipstoDids || [], trade_listing_uris: val.tradeListingUris || [],
    shipping_confirmed: val.shippingConfirmed || [], receipt_confirmed: val.receiptConfirmed || [],
    chain_order: val.chainOrder || 'clockwise', status: val.status || 'proposed', total_value: val.totalValue ?? 0,
    completed_at: val.completedAt || '', author_name: val.organiserName || '', did: val.organiserDid || did,
    at_uri: atUri, cid: '', record_type: 'org.swappulse.tradeChain', bridged: true,
  };
}
function mapTradeDisputeFields(val: any, atUri: string, did: string) {
  return {
    trade_id: val.tradeId || '', trade_ref: val.tradeRef || '', reason: val.reason || 'other',
    description: val.description || '', photo_urls: val.photoUrls || [], status: val.status || 'pending',
    filed_by_name: val.filedByName || '', filed_by_handle: val.filedByHandle || '', did: val.filedByDid || did,
    at_uri: atUri, cid: '', record_type: 'org.swappulse.tradeDispute', bridged: true,
  };
}
function mapVoiceSpaceFields(val: any, atUri: string, did: string) {
  return {
    title: val.title || '', description: val.description || '', status: val.status || 'live',
    stream_url: val.streamUrl || '', platform: val.platform || 'other',
    planned_duration_minutes: val.plannedDurationMinutes ?? 60, auto_end_at: val.autoEndAt || '',
    started_at: val.startedAt || '', ended_at: val.endedAt || '', co_host_dids: val.coHostDids || [],
    topic_tags: val.topicTags || [], card_uris_discussed: val.cardUrisDiscussed || [],
    recording_available: val.recordingAvailable ?? false, podcast_episode_uri: val.podcastEpisodeUri || '',
    host_name: val.hostName || '', host_handle: val.hostHandle || '', did: val.hostDid || did, at_uri: atUri,
    cid: '', record_type: 'org.swappulse.voiceSpace', bridged: true,
  };
}
function mapPodcastEpisodeFields(val: any, atUri: string, did: string) {
  return {
    title: val.title || '', description: val.description || '', audio_url: val.audioUrl || '',
    duration_seconds: val.durationSeconds ?? 0, episode_number: val.episodeNumber ?? 1,
    season_number: val.seasonNumber ?? 1, cover_image_url: val.coverImageUrl || '',
    source_space_id: val.sourceSpaceId || '', chapter_marks: val.chapterMarks || [], show_notes: val.showNotes || '',
    tags: val.tags || [], play_count: 0, published_at: val.publishedAt || '', host_name: val.hostName || '',
    host_handle: val.hostHandle || '', did: val.hostDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.podcastEpisode', bridged: true,
  };
}
function mapConversationFields(val: any, atUri: string, did: string) {
  return {
    recipient_did: val.recipientDid || '', participant_dids: val.participantDids || [],
    recipient_name: val.recipientName || '', recipient_handle: val.recipientHandle || '',
    recipient_avatar: val.recipientAvatar || '', last_message_at: val.lastMessageAt || '',
    last_message_preview: val.lastMessagePreview || '', last_message_did: val.lastMessageDid || '',
    did, at_uri: atUri, cid: '', record_type: 'org.swappulse.conversation', bridged: true,
  };
}
function mapDirectMessageFields(val: any, atUri: string, did: string) {
  return {
    conversation_id: '', conversation_ref: val.conversationRef || '',
    did, recipient_did: val.recipientDid || '', body: val.body || '',
    author_name: val.authorName || '', author_handle: val.authorHandle || '',
    author_avatar: val.authorAvatar || '', read: false,
    at_uri: atUri, cid: '', record_type: 'org.swappulse.directMessage', bridged: true,
  };
}
function mapPackPartyFields(val: any, atUri: string, did: string) {
  return {
    title: val.title || '', description: val.description || '', set_id: val.setId || '',
    set_name: val.setName || '', set_image: val.setImage || '', scheduled_at: val.scheduledAt || '',
    status: val.status || 'scheduled', host_name: val.hostName || '', host_handle: val.hostHandle || '',
    host_avatar: val.hostAvatar || '', participant_count: val.participantCount ?? 0,
    max_participants: val.maxParticipants ?? 50, did: val.hostDid || did, at_uri: atUri, cid: '',
    record_type: 'org.swappulse.packParty', bridged: true,
  };
}
function mapPullNominationFields(val: any, atUri: string, did: string) {
  return {
    week_key: val.weekKey || '', card_id: val.cardUri || '', card_name: val.cardName || '',
    card_image: val.cardImage || '', card_rarity: val.cardRarity || '', set_name: val.setName || '',
    nominator_name: val.nominatorName || '', nominator_handle: val.nominatorHandle || '',
    nominator_avatar: val.nominatorAvatar || '', post_uri: val.postUri || '', vote_count: val.voteCount ?? 0,
    did: val.nominatorDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.pullNomination', bridged: true,
  };
}
function mapTradingFeedbackFields(val: any, atUri: string, did: string) {
  return {
    trade_uri: val.tradeUri || '', trade_id: val.tradeId || '', rated_user_did: val.ratedUserDid || '',
    rater_did: val.raterDid || did, rater_name: val.raterName || '', rater_handle: val.raterHandle || '',
    rater_avatar: val.raterAvatar || '', rating: val.rating ?? 5, comment: val.comment || '',
    did: val.raterDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.tradingFeedback',
  };
}
function mapCollectionEntryFields(val: any, atUri: string, did: string) {
  return {
    card_id: val.cardUri || '', card_name: val.cardName || '', card_image: val.imageUrl || '',
    set_id: val.setCode || '', set_name: val.setName || '', local_id: val.cardNumber || '',
    rarity: val.rarity || '', category: val.category || '', condition: val.condition || 'near_mint',
    variant: val.variant || 'normal', acquisition_date: val.acquisitionDate || '',
    purchase_price: val.purchasePrice ?? null, market_value: val.marketValue ?? null,
    notes: val.notes || '', showcased: val.showcased ?? false, binder_index: val.binderIndex ?? 0,
    did: val.authorDid || did, at_uri: atUri, cid: '', record_type: 'org.swappulse.collectionEntry', bridged: true,
  };
}
function mapTradeListingFields(val: any, atUri: string, did: string) {
  return {
    offer_card_ids: val.offerCardUris || [], offer_card_names: val.offerCardNames || [],
    offer_card_images: val.offerCardImages || [], wanted_card_ids: val.wantedCardUris || [],
    wanted_card_names: val.wantedCardNames || [], status: val.status || 'open',
    visibility: val.visibility || 'public', circle_ref: val.circleRef || '',
    shipping_regions: val.shippingRegions || [], preferred_currency: val.preferredCurrency || 'GBP',
    notes: val.notes || '', expires_at: val.expiresAt || '', did: val.authorDid || did,
    at_uri: atUri, cid: '', record_type: 'org.swappulse.tradeListing', bridged: true,
  };
}
function mapStandardRecommendFields(val: any, atUri: string, did: string) {
  return {
    did, document_uri: val.document || '', entity_type: '', entity_id: '',
    author_did: '', at_uri: atUri, bridged: true,
  };
}
function mapStandardSubscriptionFields(val: any, atUri: string, did: string) {
  return {
    did, publication_uri: val.publication || '', author_did: '',
    at_uri: atUri, bridged: true,
  };
}

export const FIELD_MAPPERS: Record<string, (val: any, atUri: string, did: string, profile?: any) => any> = {
  'app.bsky.feed.post': mapPostFields,
  'app.bsky.feed.repost': mapRepostFields,
  'app.bsky.feed.like': mapLikeFields,
  'app.bsky.graph.follow': mapFollowFields,
  'org.swappulse.vouch': mapVouchFields,
  'org.swappulse.wishlist': mapWishlistFields,
  'org.swappulse.circle': mapCircleFields,
  'org.swappulse.meetup': mapMeetupFields,
  'org.swappulse.meetupRsvp': mapMeetupRsvpFields,
  'org.swappulse.challenge': mapChallengeFields,
  'org.swappulse.challengeEntry': mapChallengeEntryFields,
  'org.swappulse.story': mapStoryFields,
  'org.swappulse.reaction': mapReactionFields,
  'org.swappulse.journal': mapJournalFields,
  'org.swappulse.cardReview': mapCardReviewFields,
  'org.swappulse.binder': mapBinderFields,
  'org.swappulse.tradeChain': mapTradeChainFields,
  'org.swappulse.tradeDispute': mapTradeDisputeFields,
  'org.swappulse.voiceSpace': mapVoiceSpaceFields,
  'org.swappulse.podcastEpisode': mapPodcastEpisodeFields,
  'org.swappulse.conversation': mapConversationFields,
  'org.swappulse.directMessage': mapDirectMessageFields,
  'org.swappulse.packParty': mapPackPartyFields,
  'org.swappulse.pullNomination': mapPullNominationFields,
  'org.swappulse.tradingFeedback': mapTradingFeedbackFields,
  'org.swappulse.collectionEntry': mapCollectionEntryFields,
  'org.swappulse.tradeListing': mapTradeListingFields,
  'site.standard.graph.recommend': mapStandardRecommendFields,
  'site.standard.graph.subscription': mapStandardSubscriptionFields,
};

// Generic entity → AT Protocol record serializer (camelCase + $type). Used by
// outbound-reconcile to re-push drifted org.swappulse.* records. Internal/meta
// fields are stripped. Only safe for custom (unregistered) collections — bsky.*
// records have strict lexicons and are bridged at create/update time instead.
const META_FIELDS = new Set([
  'id', 'created_date', 'updated_date', 'created_by_id', 'at_uri', 'cid', 'bridged',
  'record_type', 'sig', 'like_count', 'view_count', 'play_count', 'rsvp_count',
]);

function camelCase(k: string): string {
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function entityToRecord(entity: any, collection: string): any {
  const rec: any = { $type: collection };
  for (const [k, v] of Object.entries(entity)) {
    if (META_FIELDS.has(k)) continue;
    if (v === null || v === undefined) continue;
    rec[camelCase(k)] = v;
  }
  rec.createdAt = entity.created_date || new Date().toISOString();
  return rec;
}

// ─── Outbound record builders (entity → lexicon-valid record) ─────────────
// Per-collection serializers that emit exactly the fields each lexicon
// requires, with correct camelCase names and types. Required fields are always
// present (defaulted to '' if missing); optional fields are included only when
// non-empty. Used by outbound-reconcile so every createRecord/putRecord
// produces a record the PDS validates against the registered lexicon.

type FieldPair = [string, string]; // [recordField, entityField]

const BUILDER_CONFIG: Record<string, { required: FieldPair[]; optional: FieldPair[] }> = {
  'org.swappulse.collectionEntry': {
    required: [['cardUri', 'card_id'], ['cardName', 'card_name']],
    optional: [['setName', 'set_name'], ['setCode', 'set_id'], ['cardNumber', 'local_id'], ['rarity', 'rarity'], ['category', 'category'], ['imageUrl', 'card_image'], ['condition', 'condition'], ['variant', 'variant'], ['acquisitionDate', 'acquisition_date'], ['purchasePrice', 'purchase_price'], ['marketValue', 'market_value'], ['notes', 'notes'], ['showcased', 'showcased'], ['binderIndex', 'binder_index'], ['authorDid', 'did'], ['authorName', 'author_name'], ['authorHandle', 'author_handle'], ['authorAvatar', 'author_avatar']],
  },
  'org.swappulse.tradeListing': {
    required: [['offerCardNames', 'offer_card_names'], ['wantedCardNames', 'wanted_card_names'], ['status', 'status'], ['visibility', 'visibility']],
    optional: [['offerCardUris', 'offer_card_ids'], ['offerCardImages', 'offer_card_images'], ['wantedCardUris', 'wanted_card_ids'], ['circleRef', 'circle_ref'], ['shippingRegions', 'shipping_regions'], ['preferredCurrency', 'preferred_currency'], ['notes', 'notes'], ['expiresAt', 'expires_at'], ['authorDid', 'did'], ['authorName', 'author_name'], ['authorHandle', 'author_handle'], ['authorAvatar', 'author_avatar']],
  },
  'org.swappulse.vouch': {
    required: [['vouchedDid', 'vouched_did'], ['relationship', 'relationship'], ['context', 'context']],
    optional: [['vouchedName', 'vouched_name'], ['vouchedHandle', 'vouched_handle'], ['voucherName', 'voucher_name'], ['voucherHandle', 'voucher_handle'], ['voucherDid', 'did'], ['tradeRefs', 'trade_refs'], ['revocable', 'revocable'], ['revokedAt', 'revoked_at']],
  },
  'org.swappulse.wishlist': {
    required: [['cardUri', 'card_id'], ['cardName', 'card_name']],
    optional: [['imageUrl', 'card_image'], ['setCode', 'set_id'], ['setName', 'set_name'], ['rarity', 'rarity'], ['maxPrice', 'max_price'], ['ownerDid', 'did']],
  },
  'org.swappulse.circle': {
    required: [['name', 'name'], ['visibility', 'visibility']],
    optional: [['description', 'description'], ['memberDids', 'member_dids'], ['memberProfiles', 'member_profiles'], ['memberCount', 'member_count'], ['theme', 'theme'], ['region', 'region'], ['curatorDid', 'did'], ['curatorName', 'author_name'], ['curatorHandle', 'author_handle']],
  },
  'org.swappulse.packParty': {
    required: [['title', 'title'], ['setId', 'set_id'], ['scheduledAt', 'scheduled_at']],
    optional: [['description', 'description'], ['setName', 'set_name'], ['setImage', 'set_image'], ['status', 'status'], ['hostDid', 'did'], ['hostName', 'host_name'], ['hostHandle', 'host_handle'], ['hostAvatar', 'host_avatar'], ['participantCount', 'participant_count'], ['maxParticipants', 'max_participants']],
  },
  'org.swappulse.pullNomination': {
    required: [['weekKey', 'week_key'], ['cardUri', 'card_id'], ['cardName', 'card_name']],
    optional: [['cardImage', 'card_image'], ['cardRarity', 'card_rarity'], ['setName', 'set_name'], ['nominatorDid', 'did'], ['nominatorName', 'nominator_name'], ['nominatorHandle', 'nominator_handle'], ['nominatorAvatar', 'nominator_avatar'], ['postUri', 'post_uri'], ['voteCount', 'vote_count']],
  },
  'org.swappulse.tradingFeedback': {
    required: [['tradeUri', 'trade_uri'], ['ratedUserDid', 'rated_user_did'], ['rating', 'rating']],
    optional: [['tradeId', 'trade_id'], ['raterDid', 'rater_did'], ['raterName', 'rater_name'], ['raterHandle', 'rater_handle'], ['raterAvatar', 'rater_avatar'], ['comment', 'comment']],
  },
  'org.swappulse.meetup': {
    required: [['title', 'title'], ['description', 'description'], ['scheduledAt', 'scheduled_at'], ['locationName', 'location_name'], ['status', 'status']],
    optional: [['estimatedDuration', 'estimated_duration'], ['region', 'region'], ['lat', 'lat'], ['lng', 'lng'], ['capacity', 'capacity'], ['requiredVouches', 'required_vouches'], ['creatorDid', 'creator_did'], ['rsvpCount', 'rsvp_count'], ['organiserName', 'author_name'], ['organiserHandle', 'author_handle']],
  },
  'org.swappulse.meetupRsvp': {
    required: [['meetupRef', 'meetup_ref'], ['meetupId', 'meetup_id'], ['attending', 'attending']],
    optional: [['bringingTradeBinder', 'bringing_trade_binder'], ['lookingForCards', 'looking_for_cards'], ['attendeeDid', 'did'], ['attendeeName', 'attendee_name'], ['attendeeHandle', 'attendee_handle'], ['attendeeAvatar', 'attendee_avatar']],
  },
  'org.swappulse.challenge': {
    required: [['challengeType', 'challenge_type'], ['title', 'title'], ['status', 'status']],
    optional: [['mode', 'mode'], ['category', 'category'], ['description', 'description'], ['rules', 'rules'], ['scope', 'scope'], ['circleRef', 'circle_ref'], ['goal', 'goal'], ['reward', 'reward'], ['leaderboardConfig', 'leaderboard_config'], ['targetSetCode', 'target_set_code'], ['budgetLimit', 'budget_limit'], ['rewardBadge', 'reward_badge'], ['startsAt', 'starts_at'], ['endsAt', 'ends_at'], ['votingEndsAt', 'voting_ends_at'], ['winnerDids', 'winner_dids'], ['creatorDid', 'creator_did'], ['guildApproved', 'guild_approved'], ['tags', 'tags'], ['imageUrl', 'image_url'], ['publisherName', 'author_name']],
  },
  'org.swappulse.challengeEntry': {
    required: [['challengeId', 'challenge_id'], ['entryType', 'entry_type'], ['submittedAt', 'submitted_at']],
    optional: [['challengeRef', 'challenge_ref'], ['participantDid', 'participant_did'], ['participantName', 'participant_name'], ['category', 'category'], ['contributionCount', 'contribution_count'], ['contributionUris', 'contribution_uris'], ['verificationHash', 'verification_hash'], ['moderatorLabels', 'moderator_labels'], ['notes', 'notes'], ['overrideProfileVisibility', 'override_profile_visibility'], ['status', 'status'], ['rejectionReason', 'rejection_reason'], ['setCompletionPercent', 'set_completion_percent'], ['pullPostUri', 'pull_post_uri'], ['collectionTotalValue', 'collection_total_value'], ['deckList', 'deck_list']],
  },
  'org.swappulse.story': {
    required: [['expiresAt', 'expires_at'], ['audience', 'audience']],
    optional: [['segments', 'segments'], ['storyGroup', 'story_group'], ['content', 'content'], ['imageUri', 'image_uri'], ['bgGradient', 'bg_gradient'], ['viewedBy', 'viewed_by'], ['authorDid', 'did'], ['authorName', 'author_name'], ['authorHandle', 'author_handle']],
  },
  'org.swappulse.reaction': {
    required: [['subject', 'subject'], ['reactionType', 'reaction_type']],
    optional: [['postId', 'post_id'], ['targetCardUri', 'target_card_uri'], ['reactorDid', 'did'], ['reactorName', 'reactor_name'], ['reactorHandle', 'reactor_handle'], ['reactorAvatar', 'reactor_avatar']],
  },
  'org.swappulse.journal': {
    required: [['title', 'title'], ['body', 'body'], ['visibility', 'visibility']],
    optional: [['subtitle', 'subtitle'], ['coverImageUri', 'cover_image_uri'], ['embeddedCardUris', 'embedded_card_uris'], ['embeddedStats', 'embedded_stats'], ['tags', 'tags'], ['publishedAt', 'published_at'], ['likeCount', 'like_count'], ['authorDid', 'did'], ['authorName', 'author_name'], ['authorHandle', 'author_handle'], ['authorAvatar', 'author_avatar']],
  },
  'org.swappulse.cardReview': {
    required: [['cardUri', 'card_id'], ['artwork', 'artwork'], ['playability', 'playability'], ['collectibility', 'collectibility'], ['investment', 'investment']],
    optional: [['cardName', 'card_name'], ['cardImage', 'card_image'], ['reviewText', 'review_text'], ['variant', 'variant'], ['reviewerDid', 'did'], ['reviewerName', 'author_name'], ['reviewerHandle', 'author_handle']],
  },
  'org.swappulse.binder': {
    required: [['title', 'title'], ['visibility', 'visibility']],
    optional: [['description', 'description'], ['coverImageUri', 'cover_image_uri'], ['theme', 'theme'], ['pages', 'pages'], ['likeCount', 'like_count'], ['viewCount', 'view_count'], ['authorDid', 'did'], ['authorName', 'author_name'], ['authorHandle', 'author_handle'], ['authorAvatar', 'author_avatar']],
  },
  'org.swappulse.tradeChain': {
    required: [['participantDids', 'participant_dids'], ['chainOrder', 'chain_order'], ['status', 'status'], ['totalValue', 'total_value']],
    optional: [['participantNames', 'participant_names'], ['shipstoDids', 'shipsto_dids'], ['tradeListingUris', 'trade_listing_uris'], ['shippingConfirmed', 'shipping_confirmed'], ['receiptConfirmed', 'receipt_confirmed'], ['completedAt', 'completed_at'], ['organiserDid', 'did'], ['organiserName', 'author_name']],
  },
  'org.swappulse.tradeDispute': {
    required: [['tradeId', 'trade_id'], ['reason', 'reason'], ['description', 'description']],
    optional: [['tradeRef', 'trade_ref'], ['photoUrls', 'photo_urls'], ['status', 'status'], ['resolutionNotes', 'resolution_notes'], ['resolvedBy', 'resolved_by'], ['resolvedAt', 'resolved_at'], ['filedByDid', 'did'], ['filedByName', 'filed_by_name'], ['filedByHandle', 'filed_by_handle'], ['filedByAvatar', 'filed_by_avatar']],
  },
  'org.swappulse.voiceSpace': {
    required: [['title', 'title'], ['status', 'status']],
    optional: [['description', 'description'], ['streamUrl', 'stream_url'], ['platform', 'platform'], ['plannedDurationMinutes', 'planned_duration_minutes'], ['autoEndAt', 'auto_end_at'], ['startedAt', 'started_at'], ['endedAt', 'ended_at'], ['viewerCountEstimate', 'viewer_count_estimate'], ['coHostDids', 'co_host_dids'], ['topicTags', 'topic_tags'], ['cardUrisDiscussed', 'card_uris_discussed'], ['recordingAvailable', 'recording_available'], ['podcastEpisodeUri', 'podcast_episode_uri'], ['hostDid', 'did'], ['hostName', 'host_name'], ['hostHandle', 'host_handle'], ['hostAvatar', 'host_avatar']],
  },
  'org.swappulse.podcastEpisode': {
    required: [['title', 'title'], ['audioUrl', 'audio_url'], ['durationSeconds', 'duration_seconds'], ['publishedAt', 'published_at']],
    optional: [['description', 'description'], ['episodeNumber', 'episode_number'], ['seasonNumber', 'season_number'], ['coverImageUrl', 'cover_image_url'], ['sourceSpaceId', 'source_space_id'], ['chapterMarks', 'chapter_marks'], ['showNotes', 'show_notes'], ['tags', 'tags'], ['playCount', 'play_count'], ['hostDid', 'did'], ['hostName', 'host_name'], ['hostHandle', 'host_handle'], ['hostAvatar', 'host_avatar']],
  },
  'org.swappulse.conversation': {
    required: [['recipientDid', 'recipient_did'], ['participantDids', 'participant_dids']],
    optional: [['recipientName', 'recipient_name'], ['recipientHandle', 'recipient_handle'], ['recipientAvatar', 'recipient_avatar'], ['lastMessageAt', 'last_message_at'], ['lastMessagePreview', 'last_message_preview'], ['lastMessageDid', 'last_message_did'], ['authorDid', 'did']],
  },
  'org.swappulse.directMessage': {
    required: [['recipientDid', 'recipient_did'], ['body', 'body']],
    optional: [['conversationId', 'conversation_id'], ['conversationRef', 'conversation_ref'], ['authorDid', 'did'], ['authorName', 'author_name'], ['authorHandle', 'author_handle'], ['authorAvatar', 'author_avatar'], ['read', 'read']],
  },
};

// Build a lexicon-valid AT Protocol record from a local entity for the given
// collection. Falls back to the generic entityToRecord for app.bsky.* and any
// collection without an explicit builder config.
export function buildRecord(entity: any, collection: string): any {
  const config = BUILDER_CONFIG[collection];
  if (!config) return entityToRecord(entity, collection);
  const rec: any = { $type: collection };
  for (const [recField, entityField] of config.required) {
    const v = entity[entityField];
    rec[recField] = v ?? (typeof v === 'number' ? 0 : '');
  }
  for (const [recField, entityField] of config.optional) {
    const v = entity[entityField];
    if (v !== null && v !== undefined && v !== '') rec[recField] = v;
  }
  rec.createdAt = entity.created_date || new Date().toISOString();
  return rec;
}