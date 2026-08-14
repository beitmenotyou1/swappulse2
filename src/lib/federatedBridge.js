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
    voucherHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
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
    ownerHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
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
    curatorHandle = me?.custom_handle || (me?.email?.split('@')[0] || '');
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
      handle: me?.custom_handle || (me?.email?.split('@')[0] || ''),
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