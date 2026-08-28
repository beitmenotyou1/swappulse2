// Frontend bridge helpers for Phase 1 federated record types (Vouch, Wishlist,
// Circle). Stamps each record with AT Protocol metadata locally, then asks the
// atproto-bridge backend function to create the real record on the PDS. On
// success, the entity's at_uri + cid are updated with the real PDS values,
// marking the record as bridged.
//
// Pattern follows src/lib/atprotoRecords.js (CollectionEntry/TradeListing bridges).

import { base44 } from '@/api/base44Client';
import { NSID, ensureUserDid, stampRecord } from '@/lib/atproto';

// --- Vouch: entity row → AT Protocol record ---

export function buildVouchRecord(vouch, voucherDid = '', voucherName = '', voucherHandle = '') {
  return {
    $type: NSID.VOUCH,
    vouchedDid: vouch.vouched_did || '',
    vouchedName: vouch.vouched_name || '',
    vouchedHandle: vouch.vouched_handle || '',
    voucherDid: voucherDid || '',
    voucherName: voucherName || '',
    voucherHandle: voucherHandle || '',
    relationship: vouch.relationship || 'community_member',
    context: vouch.context || '',
    tradeRefs: vouch.trade_refs || [],
    revocable: vouch.revocable ?? true,
    revokedAt: vouch.revoked_at || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Wishlist: entity row → AT Protocol record ---

export function buildWishlistRecord(wishlist, ownerDid = '', ownerName = '', ownerHandle = '') {
  return {
    $type: NSID.WISHLIST,
    cardUri: wishlist.card_id || '',
    cardName: wishlist.card_name || '',
    setName: wishlist.set_name || '',
    setCode: wishlist.set_id || '',
    rarity: wishlist.rarity || '',
    imageUrl: wishlist.card_image || '',
    maxPrice: wishlist.max_price ?? null,
    ownerDid: ownerDid || '',
    ownerName: ownerName || '',
    ownerHandle: ownerHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Circle: entity row → AT Protocol record ---

export function buildCircleRecord(circle, curatorDid = '', curatorName = '', curatorHandle = '') {
  return {
    $type: NSID.CIRCLE,
    name: circle.name || '',
    description: circle.description || '',
    memberDids: circle.member_dids || [],
    memberCount: circle.member_count || 1,
    visibility: circle.visibility || 'public',
    theme: circle.theme || 'general',
    region: circle.region || '',
    curatorDid: curatorDid || '',
    curatorName: curatorName || '',
    curatorHandle: curatorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Bridge helpers ---

async function bridgeRecord(record, nsid) {
  const { did, signingKey } = await ensureUserDid();
  const stamped = await stampRecord(record, nsid, did, signingKey);
  try {
    const res = await base44.functions.invoke('atproto-bridge', {
      collection: nsid,
      record: { ...record, createdAt: record.createdAt },
    });
    if (res?.data?.uri && res?.data?.cid) {
      stamped.at_uri = res.data.uri;
      stamped.cid = res.data.cid;
      stamped.bridged = true;
    }
  } catch (err) {
    console.error(`federatedBridge: bridge ${nsid} failed`, err);
  }
  return stamped;
}

export async function bridgeVouch(vouch) {
  const { did } = await ensureUserDid();
  let voucherName = '', voucherHandle = '';
  try {
    const me = await base44.auth.me();
    voucherName = me?.full_name || '';
    voucherHandle = me?.custom_handle || (me?.custom_handle || me?.username || me?.bsky_handle || '');
  } catch {}
  const record = buildVouchRecord(vouch, did, voucherName, voucherHandle);
  const stamped = await bridgeRecord(record, NSID.VOUCH);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeWishlist(wishlist) {
  const { did } = await ensureUserDid();
  let ownerName = '', ownerHandle = '';
  try {
    const me = await base44.auth.me();
    ownerName = me?.full_name || '';
    ownerHandle = me?.custom_handle || (me?.custom_handle || me?.username || me?.bsky_handle || '');
  } catch {}
  const record = buildWishlistRecord(wishlist, did, ownerName, ownerHandle);
  const stamped = await bridgeRecord(record, NSID.WISHLIST);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeCircle(circle) {
  const { did } = await ensureUserDid();
  let curatorName = '', curatorHandle = '';
  try {
    const me = await base44.auth.me();
    curatorName = me?.full_name || '';
    curatorHandle = me?.custom_handle || (me?.custom_handle || me?.username || me?.bsky_handle || '');
  } catch {}
  const record = buildCircleRecord(circle, did, curatorName, curatorHandle);
  const stamped = await bridgeRecord(record, NSID.CIRCLE);
  return {
    did: stamped.did,
    at_uri: stamped.at_uri,
    cid: stamped.cid,
    record_type: stamped.record_type,
    sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

// --- Meetup: entity row → AT Protocol record ---

export function buildMeetupRecord(meetup, organiserDid = '', organiserName = '', organiserHandle = '') {
  return {
    $type: NSID.MEETUP,
    title: meetup.title || '',
    description: meetup.description || '',
    scheduledAt: meetup.scheduled_at || '',
    estimatedDuration: meetup.estimated_duration ?? null,
    locationName: meetup.location_name || '',
    region: meetup.region || '',
    lat: meetup.lat ?? null,
    lng: meetup.lng ?? null,
    capacity: meetup.capacity ?? null,
    requiredVouches: meetup.required_vouches ?? 0,
    status: meetup.status || 'scheduled',
    organiserDid: organiserDid || '',
    organiserName: organiserName || '',
    organiserHandle: organiserHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- MeetupRSVP: entity row → AT Protocol record ---

export function buildMeetupRsvpRecord(rsvp, attendeeDid = '', attendeeName = '', attendeeHandle = '') {
  return {
    $type: NSID.MEETUP_RSVP,
    meetupRef: rsvp.meetup_ref || '',
    attending: rsvp.attending || 'yes',
    bringingTradeBinder: rsvp.bringing_trade_binder ?? false,
    lookingForCards: rsvp.looking_for_cards || [],
    attendeeDid: attendeeDid || '',
    attendeeName: attendeeName || '',
    attendeeHandle: attendeeHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Challenge: entity row → AT Protocol record ---

export function buildChallengeRecord(challenge, publisherDid = '', publisherName = '') {
  return {
    $type: NSID.CHALLENGE,
    challengeType: challenge.challenge_type || 'community_goal',
    mode: challenge.mode || 'collective',
    category: challenge.category || '',
    title: challenge.title || '',
    description: challenge.description || '',
    rules: challenge.rules || '',
    scope: challenge.scope || 'global',
    circleRef: challenge.circle_ref || '',
    goal: challenge.goal || {},
    reward: challenge.reward || {},
    leaderboardConfig: challenge.leaderboard_config || {},
    targetSetCode: challenge.target_set_code || '',
    budgetLimit: challenge.budget_limit ?? null,
    rewardBadge: challenge.reward_badge || '',
    startsAt: challenge.starts_at || '',
    endsAt: challenge.ends_at || '',
    votingEndsAt: challenge.voting_ends_at || '',
    status: challenge.status || 'upcoming',
    tags: challenge.tags || [],
    imageUrl: challenge.image_url || '',
    publisherDid: publisherDid || '',
    publisherName: publisherName || '',
    createdAt: new Date().toISOString(),
  };
}

// --- ChallengeEntry: entity row → AT Protocol record ---

export function buildChallengeEntryRecord(entry, participantDid = '', participantName = '') {
  return {
    $type: NSID.CHALLENGE_ENTRY,
    challengeRef: entry.challenge_ref || '',
    challengeId: entry.challenge_id || '',
    entryType: entry.entry_type || 'card_pull',
    category: entry.category || '',
    contributionCount: entry.contribution_count ?? 1,
    contributionUris: entry.contribution_uris || [],
    verificationHash: entry.verification_hash || '',
    notes: entry.notes || '',
    status: entry.status || 'pending',
    participantDid: participantDid || '',
    participantName: participantName || '',
    submittedAt: entry.submitted_at || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

// --- Story: entity row → AT Protocol record ---

export function buildStoryRecord(story, authorDid = '', authorName = '', authorHandle = '') {
  return {
    $type: NSID.STORY,
    segments: story.segments || [],
    audience: story.audience || 'friends',
    storyGroup: story.story_group || '',
    expiresAt: story.expires_at || '',
    authorDid: authorDid || '',
    authorName: authorName || '',
    authorHandle: authorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Reaction: entity row → AT Protocol record ---

export function buildReactionRecord(reaction, reactorDid = '', reactorName = '', reactorHandle = '') {
  return {
    $type: NSID.REACTION,
    subject: reaction.subject || '',
    reactionType: reaction.reaction_type || 'wow',
    targetCardUri: reaction.target_card_uri || '',
    reactorDid: reactorDid || '',
    reactorName: reactorName || '',
    reactorHandle: reactorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Bridge helpers for Phase 2 record types ---

async function getMe() {
  try {
    const me = await base44.auth.me();
    return {
      name: me?.full_name || '',
      handle: me?.custom_handle || (me?.custom_handle || me?.username || me?.bsky_handle || ''),
    };
  } catch {
    return { name: '', handle: '' };
  }
}

export async function bridgeMeetup(meetup) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildMeetupRecord(meetup, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.MEETUP);
  return {
    did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid,
    record_type: stamped.record_type, sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeMeetupRsvp(rsvp) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildMeetupRsvpRecord(rsvp, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.MEETUP_RSVP);
  return {
    did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid,
    record_type: stamped.record_type, sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeChallenge(challenge) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildChallengeRecord(challenge, did, me.name);
  const stamped = await bridgeRecord(record, NSID.CHALLENGE);
  return {
    did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid,
    record_type: stamped.record_type, sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeChallengeEntry(entry) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildChallengeEntryRecord(entry, did, me.name);
  const stamped = await bridgeRecord(record, NSID.CHALLENGE_ENTRY);
  return {
    did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid,
    record_type: stamped.record_type, sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeStory(story) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildStoryRecord(story, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.STORY);
  return {
    did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid,
    record_type: stamped.record_type, sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

export async function bridgeReaction(reaction) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildReactionRecord(reaction, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.REACTION);
  return {
    did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid,
    record_type: stamped.record_type, sig: stamped.sig,
    bridged: stamped.bridged ?? false,
  };
}

// --- Journal: entity row → AT Protocol record ---

export function buildJournalRecord(journal, authorDid = '', authorName = '', authorHandle = '') {
  return {
    $type: NSID.JOURNAL,
    title: journal.title || '',
    subtitle: journal.subtitle || '',
    body: journal.body || '',
    coverImageUri: journal.cover_image_uri || '',
    embeddedCardUris: journal.embedded_card_uris || [],
    embeddedStats: journal.embedded_stats || {},
    tags: journal.tags || [],
    visibility: journal.visibility || 'public',
    publishedAt: journal.published_at || new Date().toISOString(),
    authorDid: authorDid || '',
    authorName: authorName || '',
    authorHandle: authorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- CardReview: entity row → AT Protocol record ---

export function buildCardReviewRecord(review, authorDid = '', authorName = '', authorHandle = '') {
  return {
    $type: NSID.CARD_REVIEW,
    cardUri: review.card_id || '',
    cardName: review.card_name || '',
    artwork: review.artwork ?? 3,
    playability: review.playability ?? 3,
    collectibility: review.collectibility ?? 3,
    investment: review.investment ?? 3,
    reviewText: review.review_text || '',
    variant: review.variant || 'normal',
    reviewerDid: authorDid || '',
    reviewerName: authorName || '',
    reviewerHandle: authorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Binder: entity row → AT Protocol record ---

export function buildBinderRecord(binder, authorDid = '', authorName = '', authorHandle = '') {
  return {
    $type: NSID.BINDER,
    title: binder.title || '',
    description: binder.description || '',
    coverImageUri: binder.cover_image_uri || '',
    theme: binder.theme || 'classic_purple',
    pages: binder.pages || [],
    visibility: binder.visibility || 'public',
    authorDid: authorDid || '',
    authorName: authorName || '',
    authorHandle: authorHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- TradeChain: entity row → AT Protocol record ---

export function buildTradeChainRecord(chain, organiserDid = '', organiserName = '') {
  return {
    $type: NSID.TRADE_CHAIN,
    participantDids: chain.participant_dids || [],
    participantNames: chain.participant_names || [],
    shipstoDids: chain.shipsto_dids || [],
    tradeListingUris: chain.trade_listing_uris || [],
    shippingConfirmed: chain.shipping_confirmed || [],
    receiptConfirmed: chain.receipt_confirmed || [],
    chainOrder: chain.chain_order || 'clockwise',
    status: chain.status || 'proposed',
    totalValue: chain.total_value ?? 0,
    completedAt: chain.completed_at || '',
    organiserDid: organiserDid || '',
    organiserName: organiserName || '',
    createdAt: new Date().toISOString(),
  };
}

// --- TradeDispute: entity row → AT Protocol record ---

export function buildTradeDisputeRecord(dispute, filerDid = '', filerName = '', filerHandle = '') {
  return {
    $type: NSID.TRADE_DISPUTE,
    tradeRef: dispute.trade_ref || '',
    tradeId: dispute.trade_id || '',
    reason: dispute.reason || 'other',
    description: dispute.description || '',
    photoUrls: dispute.photo_urls || [],
    status: dispute.status || 'pending',
    filedByDid: filerDid || '',
    filedByName: filerName || '',
    filedByHandle: filerHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- VoiceSpace: entity row → AT Protocol record ---

export function buildVoiceSpaceRecord(space, hostDid = '', hostName = '', hostHandle = '') {
  return {
    $type: NSID.VOICE_SPACE,
    title: space.title || '',
    description: space.description || '',
    status: space.status || 'live',
    streamUrl: space.stream_url || '',
    platform: space.platform || 'other',
    plannedDurationMinutes: space.planned_duration_minutes ?? 60,
    autoEndAt: space.auto_end_at || '',
    startedAt: space.started_at || new Date().toISOString(),
    endedAt: space.ended_at || '',
    coHostDids: space.co_host_dids || [],
    topicTags: space.topic_tags || [],
    cardUrisDiscussed: space.card_uris_discussed || [],
    recordingAvailable: space.recording_available ?? false,
    hostDid: hostDid || '',
    hostName: hostName || '',
    hostHandle: hostHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- PodcastEpisode: entity row → AT Protocol record ---

export function buildPodcastEpisodeRecord(episode, hostDid = '', hostName = '', hostHandle = '') {
  return {
    $type: NSID.PODCAST_EPISODE,
    title: episode.title || '',
    description: episode.description || '',
    audioUrl: episode.audio_url || '',
    durationSeconds: episode.duration_seconds ?? 0,
    episodeNumber: episode.episode_number ?? 1,
    seasonNumber: episode.season_number ?? 1,
    coverImageUrl: episode.cover_image_url || '',
    sourceSpaceId: episode.source_space_id || '',
    chapterMarks: episode.chapter_marks || [],
    showNotes: episode.show_notes || '',
    tags: episode.tags || [],
    publishedAt: episode.published_at || new Date().toISOString(),
    hostDid: hostDid || '',
    hostName: hostName || '',
    hostHandle: hostHandle || '',
    createdAt: new Date().toISOString(),
  };
}

// --- Bridge helpers for Phase 3 record types ---

export async function bridgeJournal(journal) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildJournalRecord(journal, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.JOURNAL);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

export async function bridgeCardReview(review) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildCardReviewRecord(review, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.CARD_REVIEW);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

export async function bridgeBinder(binder) {
  // AT Protocol repositories are public-readable. Only explicitly public
  // binders are eligible for federation; followers/private remain Base44-only.
  if (binder?.visibility !== 'public') {
    return { bridged: false };
  }
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildBinderRecord(binder, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.BINDER);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

export async function bridgeTradeChain(chain) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildTradeChainRecord(chain, did, me.name);
  const stamped = await bridgeRecord(record, NSID.TRADE_CHAIN);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

export async function bridgeTradeDispute(dispute) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildTradeDisputeRecord(dispute, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.TRADE_DISPUTE);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

export async function bridgeVoiceSpace(space) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildVoiceSpaceRecord(space, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.VOICE_SPACE);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

export async function bridgePodcastEpisode(episode) {
  const { did } = await ensureUserDid();
  const me = await getMe();
  const record = buildPodcastEpisodeRecord(episode, did, me.name, me.handle);
  const stamped = await bridgeRecord(record, NSID.PODCAST_EPISODE);
  return { did: stamped.did, at_uri: stamped.at_uri, cid: stamped.cid, record_type: stamped.record_type, sig: stamped.sig, bridged: stamped.bridged ?? false };
}

// Delete a bridged record from the PDS. Call before deleting the local entity.
export async function unbridgeFederatedRecord(entity) {
  if (!entity?.at_uri || !entity?.bridged) return false;
  try {
    await base44.functions.invoke('atproto-bridge', { action: 'delete', uri: entity.at_uri });
    return true;
  } catch (err) {
    console.error('federatedBridge: unbridge failed', err);
    return false;
  }
}