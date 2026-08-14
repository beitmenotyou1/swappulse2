// Shared field mappers between firehose-ingest (inbound PDS→local) and
// import-repo (archive→local). Maps AT Protocol record values (camelCase) to
// local entity rows (snake_case), keyed by collection NSID. Also exposes a
// generic entity→record serializer (outbound-reconcile) and the collection→
// entity map used by both firehose-ingest and outbound-reconcile.

export const COLLECTIONS: Record<string, string> = {
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
};

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

export const FIELD_MAPPERS: Record<string, (val: any, atUri: string, did: string) => any> = {
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