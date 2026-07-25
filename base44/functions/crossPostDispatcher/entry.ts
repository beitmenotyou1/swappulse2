// §7 Automated Cross-Posting — Cross-Post Dispatcher
// org.swappulse.crossPostConfig + org.swappulse.externalActivity
// When SwapPulse content is created, the dispatcher checks the author's
// crossPostConfig records for matching contentTypes, formats a cross-post
// using the template (or a default), posts to the external platform, and
// logs each delivery as an externalActivity record (activityType: "post",
// platform set to the destination).
//
// Discord webhook + Telegram bot post for real (user-supplied webhook URL /
// bot token). Bluesky, Mastodon, Nostr, and Twitter require OAuth/connector
// wiring not yet available, so those are simulated (delivery logged but not
// actually sent) — wire real credentials/connectors to enable them.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TEMPLATES = {
  pack_opening: "🃏 Just pulled a {cardName} ({rarity}) from {setCode}! See it on SwapPulse: {url}",
  journal: "📝 New journal entry: '{title}' - {subtitle}. Read on SwapPulse: {url}",
  binder: "📖 Published a new binder: '{title}'. Browse my collection on SwapPulse: {url}",
  podcast_episode: "🎧 New podcast episode: '{title}' ({duration}). Listen on SwapPulse: {url}",
  voice_space_live: "🎙️ I'm now live on SwapPulse Voice Spaces: '{title}'. Join the conversation: {url}",
  trade_listing: "🔄 New trade listing on SwapPulse: Offering {offerCards}. See details: {url}",
  card_review: "🔎 New card review on SwapPulse: {title}. Read: {url}",
};

function fmt(tpl, vars) {
  return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

function mapPlatform(p) {
  if (p === 'discord_webhook') return 'discord';
  if (p === 'telegram_bot') return 'telegram';
  return p;
}

async function postToPlatform(platform, credential, extra, message) {
  if (!credential) return { ok: false, simulated: false, error: 'No credential configured' };
  if (platform === 'discord_webhook') {
    try {
      const r = await fetch(credential, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      return { ok: r.ok, simulated: false, status: r.status };
    } catch (e) { return { ok: false, simulated: false, error: e.message }; }
  }
  if (platform === 'telegram_bot') {
    try {
      const r = await fetch(`https://api.telegram.org/bot${credential}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: extra, text: message }),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: !!j.ok, simulated: false, error: j.description || undefined };
    } catch (e) { return { ok: false, simulated: false, error: e.message }; }
  }
  // bluesky, mastodon, nostr, twitter — OAuth/connector wiring not yet available → simulated
  return { ok: true, simulated: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const origin = req.headers.get('Origin') || 'https://swappulse.org';
    const body = await req.json().catch(() => ({}));
    const { contentType, contentId, test, configId, url, authorName, authorHandle } = body;

    let did = body.did;
    if (!did) {
      try { const me = await base44.auth.me(); did = me?.did; } catch { /* */ }
    }

    let configs = [];
    if (test && configId) {
      const c = await svc.entities.CrossPostConfig.get(configId).catch(() => null);
      if (c) configs = [c];
    } else if (did && contentType) {
      const all = await svc.entities.CrossPostConfig.filter({ did }, '-created_at', 50).catch(() => []);
      configs = all.filter((c) => c.enabled && Array.isArray(c.contentTypes) && c.contentTypes.includes(contentType));
    }

    // Resolve content metadata for message variables.
    let vars = { url: url || origin };
    if (!test && contentId && contentType) {
      try {
        if (contentType === 'pack_opening') {
          const p = await svc.entities.Post.get(contentId);
          vars = { cardName: p.card_name || '', rarity: p.card_rarity || '', setCode: p.set_name || '', url: url || origin };
        } else if (contentType === 'journal') {
          const j = await svc.entities.Journal.get(contentId);
          vars = { title: j.title || '', subtitle: j.subtitle || '', url: url || origin };
        } else if (contentType === 'binder') {
          const b = await svc.entities.Binder.get(contentId);
          vars = { title: b.title || '', url: url || origin };
        } else if (contentType === 'podcast_episode') {
          const e = await svc.entities.PodcastEpisode.get(contentId);
          vars = { title: e.title || '', duration: `${Math.max(1, Math.round((e.duration_seconds || 0) / 60))} min`, url: url || origin };
        } else if (contentType === 'trade_listing') {
          const t = await svc.entities.TradeListing.get(contentId);
          vars = { offerCards: (t.offer_card_names || []).join(', '), url: url || origin };
        } else if (contentType === 'voice_space_live') {
          const s = await svc.entities.VoiceSpace.get(contentId);
          vars = { title: s.title || '', url: url || origin };
        } else if (contentType === 'card_review') {
          const r = await svc.entities.CardReview.get(contentId);
          vars = { title: r.title || r.card_name || '', url: url || origin };
        }
      } catch (e) { console.error('crossPost resolve content error', e?.message || e); }
    }

    const results = [];
    for (const cfg of configs) {
      const message = test
        ? 'Testing SwapPulse cross-posting integration. 🧪'
        : fmt(cfg.template || TEMPLATES[contentType] || TEMPLATES.journal, vars);
      const res = await postToPlatform(cfg.platform, cfg.credential, cfg.extra_credential, message);
      try {
        await svc.entities.ExternalActivity.create({
          platform: mapPlatform(cfg.platform),
          activity_type: 'post',
          title: message.slice(0, 200),
          source_url: url || origin,
          is_live: false,
          started_at: new Date().toISOString(),
          author_name: authorName || cfg.handle || '',
          author_handle: authorHandle || '',
          did: cfg.did || did || '',
          record_type: 'org.swappulse.externalActivity',
        });
      } catch (e) { console.error('crossPost log error', e?.message || e); }
      results.push({ platform: cfg.platform, ok: res.ok, simulated: res.simulated, error: res.error });
    }
    return Response.json({ dispatched: results.length, results });
  } catch (error) {
    console.error('crossPostDispatcher error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});