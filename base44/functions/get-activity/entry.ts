// get-activity — returns a merged, reverse-chronological activity stream for
// a collector's DID, drawn from the public SwapPulse record types. Public
// endpoint (no auth required) so visitor profiles work for guests too.
//
// CollectionEntry is RLS-private (read: created_by_id == user.id), so it is
// only included when the caller is the owner viewing their own profile.
// All other sources are public-read and included for everyone.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const did = String(body.did || '').trim();
    if (!did) return Response.json({ error: 'did required' }, { status: 400 });
    const limit = Math.min(Number(body.limit) || 50, 100);

    const svc = base44.asServiceRole;

    // Include private CollectionEntry only when the caller is the owner.
    let callerDid = '';
    try {
      const me = await base44.auth.me();
      if (me?.did) callerDid = me.did;
    } catch { /* guest, no private data */ }

    const [posts, trades, vouches, achievements, entries, journals, binders, rsvps, stories, collection] = await Promise.all([
      svc.entities.Post.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.TradeListing.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.Vouch.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.Achievement.filter({ did, status: 'granted' }, '-unlocked_at', 50).catch(() => []),
      svc.entities.ChallengeEntry.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.Journal.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.Binder.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.MeetupRsvp.filter({ did }, '-created_date', 50).catch(() => []),
      svc.entities.Story.filter({ did }, '-created_date', 50).catch(() => []),
      callerDid === did ? svc.entities.CollectionEntry.filter({ did }, '-created_date', 50).catch(() => []) : Promise.resolve([]),
    ]);

    const items: any[] = [];

    for (const r of (posts || [])) {
      items.push({ id: r.id, type: 'post', verb: 'posted', target: (r.text || r.content || '').slice(0, 80) || 'a new post', target_path: '', created_date: r.created_date });
    }
    for (const r of (trades || [])) {
      const card = (r.offer_card_names && r.offer_card_names[0]) || 'a card';
      items.push({ id: r.id, type: 'trade', verb: 'listed a trade', target: card, target_path: `/trade/${r.id}`, created_date: r.created_date });
    }
    for (const r of (vouches || [])) {
      items.push({ id: r.id, type: 'vouch', verb: 'vouched for', target: r.vouched_name || 'a collector', target_path: '', created_date: r.created_date });
    }
    for (const r of (achievements || [])) {
      items.push({ id: r.id, type: 'achievement', verb: 'earned achievement', target: (r.achievement_type || '').replace(/_/g, ' '), target_path: '/achievements', created_date: r.unlocked_at || r.created_date });
    }
    for (const r of (entries || [])) {
      items.push({ id: r.id, type: 'challenge_entry', verb: 'entered a challenge', target: r.notes || 'a challenge', target_path: r.challenge_id ? `/challenges/${r.challenge_id}` : '', created_date: r.submitted_at || r.created_date });
    }
    for (const r of (journals || [])) {
      items.push({ id: r.id, type: 'journal', verb: 'published a journal', target: r.title || 'a journal', target_path: '', created_date: r.published_at || r.created_date });
    }
    for (const r of (binders || [])) {
      items.push({ id: r.id, type: 'binder', verb: 'created a binder', target: r.title || 'a binder', target_path: `/binder/${r.id}`, created_date: r.created_date });
    }
    for (const r of (rsvps || [])) {
      items.push({ id: r.id, type: 'meetup_rsvp', verb: 'RSVP’d to a meetup', target: 'a meetup', target_path: r.meetup_id ? `/meetups/${r.meetup_id}` : '', created_date: r.created_date });
    }
    for (const r of (stories || [])) {
      items.push({ id: r.id, type: 'story', verb: 'shared a story', target: 'a story', target_path: '', created_date: r.created_date });
    }
    for (const r of (collection || [])) {
      items.push({ id: r.id, type: 'collection', verb: 'added to collection', target: r.card_name || 'a card', target_path: r.card_id ? `/card/${r.card_id}` : '', created_date: r.created_date });
    }

    items.sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());

    return Response.json({ items: items.slice(0, limit) });
  } catch (error: any) {
    console.error('get-activity error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}