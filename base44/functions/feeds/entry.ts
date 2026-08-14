// §2.2 Feed Generators - SwapPulse custom AT Protocol feed generator service.
// Computes sorted lists of record URIs via XRPC-style dispatch on `feed`.
// Simulated: queries the Base44 entity store instead of a firehose index, but
// returns the standard AT Protocol feedResponse shape so a real feed generator
// can replace this transparently.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Exclude posts that are escalated or carry a hide-severity moderation label.
function isModerationClean(post) {
  if (post.moderation_status === 'escalated') return false;
  if (Array.isArray(post.moderation_labels)) {
    return !post.moderation_labels.some((l) => l?.severity === 'hide');
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const feed = body.feed;
    const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
    const cursor = body.cursor ? Number(body.cursor) : 0;

    switch (feed) {
      case 'fresh-pulls': {
        const posts = await svc.entities.Post.filter({ post_type: 'pack_opening' }, '-created_date', limit + cursor + 1);
        const clean = posts.filter(isModerationClean);
        const slice = clean.slice(cursor, cursor + limit);
        return Response.json({
          feed: slice.map((p) => ({ post: p.at_uri || `at://did:web:swappulse.org/app.bsky.feed.post/${p.id}`, reason: { $type: 'org.swappulse.feedReason', kind: 'recent' } })),
          cursor: slice.length === limit ? String(cursor + limit) : undefined,
        });
      }
      case 'market-watch': {
        const pricing = await svc.entities.CardPricing.list('-updated_date', 200);
        const movers = pricing
          .map((p) => {
            const now = p.avg7 ?? p.avg;
            const prev = p.avg30 ?? p.avg;
            if (!now || !prev) return null;
            const pct = ((now - prev) / prev) * 100;
            return { p, pct };
          })
          .filter((m) => m && Math.abs(m.pct) >= 10)
          .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
          .slice(cursor, cursor + limit);
        return Response.json({
          feed: movers.map((m) => ({ post: m.p.at_uri || `at://did:web:swappulse.org/org.swappulse.cardPricing/${m.p.id}`, reason: { $type: 'org.swappulse.feedReason', kind: `mover_${m.pct > 0 ? 'up' : 'down'}` }, feedContext: String(m.pct.toFixed(1)) })),
          cursor: movers.length === limit ? String(cursor + limit) : undefined,
        });
      }
      case 'shiny-hunters': {
        const posts = await svc.entities.Post.filter({ post_type: 'pack_opening' }, '-created_date', limit + cursor + 1);
        const slice = posts
          .filter((p) => {
            const r = (p.card_rarity || '').toLowerCase();
            return r.includes('holo') || r.includes('secret') || r.includes('rainbow');
          })
          .filter(isModerationClean)
          .slice(cursor, cursor + limit);
        return Response.json({
          feed: slice.map((p) => ({ post: p.at_uri || `at://did:web:swappulse.org/app.bsky.feed.post/${p.id}`, reason: { $type: 'org.swappulse.feedReason', kind: 'shiny' } })),
          cursor: slice.length === limit ? String(cursor + limit) : undefined,
        });
      }
      case 'smart-bundles': {
        // Find the authenticated user's duplicate cards, then match against
        // every other user's wishlist to surface multi-card bundle trades.
        const [mine, wishlists] = await Promise.all([
          svc.entities.CollectionEntry.filter({ created_by_id: user.id }, '-updated_date', 500),
          svc.entities.Wishlist.list('-updated_date', 500),
        ]);
        const dupes = new Map();
        for (const c of mine) {
          if (!c.card_id) continue;
          dupes.set(c.card_id, (dupes.get(c.card_id) || 0) + 1);
        }
        const dupeIds = [...dupes.entries()].filter(([, n]) => n > 1).map(([id]) => id);
        const bundles: any[] = [];
        for (const w of wishlists) {
          if (!dupeIds.includes(w.card_id)) continue;
          const existing = bundles.find((b) => b.targetUser === w.author_handle);
          if (existing) {
            existing.offerCards.push(w.card_name);
            existing.matchCount++;
          } else {
            bundles.push({ targetUser: w.author_handle, offerCards: [w.card_name], matchCount: 1, totalValue: w.max_price || 0 });
          }
        }
        const ranked = bundles.filter((b) => b.matchCount >= 1).sort((a, b) => b.matchCount - a.matchCount).slice(cursor, cursor + limit);
        return Response.json({ bundles: ranked, cursor: ranked.length === limit ? String(cursor + limit) : undefined });
      }
      case 'card-of-day': {
        const dayKey = DAY_KEYS[new Date().getDay()];
        const pricing = await svc.entities.CardPricing.list('-updated_date', 50);
        const byName = new Map();
        for (const p of pricing) {
          if (!p.card_name) continue;
          const now = p.avg7 ?? p.avg;
          const prev = p.avg30 ?? p.avg;
          if (!now || !prev) continue;
          const pct = Math.abs(((now - prev) / prev) * 100);
          if (!byName.has(p.card_name) || byName.get(p.card_name).pct < pct) byName.set(p.card_name, { p, pct });
        }
        const featured = [...byName.values()].sort((a, b) => b.pct - a.pct)[0];
        return Response.json({
          featured: featured ? { cardId: featured.p.card_id, cardName: featured.p.card_name, dayKey, reason: 'price_movement' } : null,
        });
      }
      case 'spoilers': {
        // No organisational @swappulse.org poster yet; return empty feed.
        return Response.json({ feed: [], cursor: undefined });
      }
      case 'leaderboard': {
        const challengeId = body.challengeId;
        if (!challengeId) return Response.json({ error: 'challengeId required' }, { status: 400 });
        const entries = await svc.entities.ChallengeEntry.filter({ challenge_id: challengeId }, '-created_date', 200);
        const sortBy = body.sortBy || 'progress';
        const ranked = entries
          .map((e) => ({
            rank: 0,
            participantDid: e.participant_did,
            participantName: e.participant_name,
            entryType: e.entry_type,
            score: sortBy === 'value' ? (e.collection_total_value || 0) : (e.set_completion_percent || 0),
          }))
          .sort((a, b) => b.score - a.score);
        ranked.forEach((r, i) => (r.rank = i + 1));
        const slice = ranked.slice(cursor, cursor + limit);
        return Response.json({ entries: slice, cursor: slice.length === limit ? String(cursor + limit) : undefined });
      }
      case 'trade-listings': {
        // Open trade listings, newest first. Expired listings are hidden.
        const now = new Date().toISOString();
        const listings = await svc.entities.TradeListing.filter(
          { status: 'open', visibility: 'public' },
          '-created_date',
          limit + cursor + 1,
        );
        const active = listings.filter((l) => !l.expires_at || l.expires_at > now);
        const slice = active.slice(cursor, cursor + limit);
        return Response.json({
          feed: slice.map((l) => ({
            post: l.at_uri || `at://did:web:swappulse.org/org.swappulse.tradeListing/${l.id}`,
            reason: { $type: 'org.swappulse.feedReason', kind: 'trade_listing' },
          })),
          cursor: slice.length === limit ? String(cursor + limit) : undefined,
        });
      }
      case 'collection-posts': {
        // Showcase + pack-opening posts, prioritising community activity.
        const [showcase, pulls] = await Promise.all([
          svc.entities.Post.filter({ post_type: 'showcase' }, '-created_date', limit + cursor + 1),
          svc.entities.Post.filter({ post_type: 'pack_opening' }, '-created_date', limit + cursor + 1),
        ]);
        const merged = [...showcase, ...pulls]
          .filter(isModerationClean)
          .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
        const slice = merged.slice(cursor, cursor + limit);
        return Response.json({
          feed: slice.map((p) => ({
            post: p.at_uri || `at://did:web:swappulse.org/app.bsky.feed.post/${p.id}`,
            reason: { $type: 'org.swappulse.feedReason', kind: p.post_type === 'showcase' ? 'showcase' : 'pack_pull' },
          })),
          cursor: slice.length === limit ? String(cursor + limit) : undefined,
        });
      }
      case 'card-channel': {
        // All posts in a card's discussion thread (top-level + replies),
        // newest first. Excludes shadow-banned/suspended authors and moderated-out posts.
        const cardId = body.cardId;
        if (!cardId) return Response.json({ error: 'cardId required' }, { status: 400 });
        const [posts, enforced] = await Promise.all([
          svc.entities.Post.filter({ card_id: cardId }, '-created_date', limit + cursor + 1),
          svc.entities.AccountStatus.filter({ status: { $in: ['shadow_banned', 'suspended'] } }, '-updated_date', 200).catch(() => []),
        ]);
        const enforcedDids = new Set((enforced as any[]).map((a) => a.user_did).filter(Boolean));
        const clean = posts
          .filter((p: any) => !enforcedDids.has(p.did))
          .filter(isModerationClean);
        const slice = clean.slice(cursor, cursor + limit);
        return Response.json({
          feed: slice.map((p) => ({
            post: p.at_uri || `at://did:web:swappulse.org/app.bsky.feed.post/${p.id}`,
            reason: { $type: 'org.swappulse.feedReason', kind: 'card_channel' },
          })),
          cursor: slice.length === limit ? String(cursor + limit) : undefined,
        });
      }
      default:
        return Response.json({ error: `Unknown feed: ${feed}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});