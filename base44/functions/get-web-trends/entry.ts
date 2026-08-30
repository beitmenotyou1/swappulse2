// Returns internet-sourced trending Pokémon TCG topics for the sidebar.
// The AI web-search call runs server-side with the service role and is cached
// for 6 hours, so integration credits are spent at most a few times a day
// rather than on every page view. The prompt is fixed — no caller input.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const CACHE_KEY = 'sidebar_trends';
const TTL_MS = 6 * 60 * 60 * 1000;
const EMPTY = { cards: [], hashtags: [], keywords: [] };

const PROMPT = `You are a Pokémon TCG trend analyst. Based on current internet trends, news, and community discussions, identify what's trending right now in the Pokémon TCG world. Return three lists:
1. "cards": up to 5 Pokémon cards that are trending online (new pulls, competitive play, price spikes, set reveals). For each, provide "name" (the card name) and "card_id" (the TCGDex-style card id if you can infer it, otherwise leave empty).
2. "hashtags": up to 5 trending Pokémon TCG hashtags (without the # symbol, lowercase).
3. "keywords": up to 5 trending keywords or topics (single words or short phrases, lowercase, no hashtags).
Focus on what collectors and players are actively discussing online this week.`;

const SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, card_id: { type: 'string' } },
      },
    },
    hashtags: { type: 'array', items: { type: 'string' } },
    keywords: { type: 'array', items: { type: 'string' } },
  },
};

function shape(data: any) {
  return {
    cards: (data?.cards || []).slice(0, 5)
      .map((c: any) => ({ card_id: c?.card_id || '', card_name: c?.name || '', count: 0, source: 'web' }))
      .filter((c: any) => c.card_name),
    hashtags: (data?.hashtags || []).slice(0, 5)
      .map((t: any) => ({ tag: String(t || '').toLowerCase().replace(/^#/, ''), count: 0, source: 'web' }))
      .filter((h: any) => h.tag),
    keywords: (data?.keywords || []).slice(0, 5)
      .map((k: any) => ({ key: String(k || '').toLowerCase(), count: 0, source: 'web' }))
      .filter((k: any) => k.key),
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const rows = await svc.entities.WebTrendCache.filter({ cache_key: CACHE_KEY }, '-refreshed_at', 1);
    const cached = rows?.[0] || null;
    const fresh = cached?.refreshed_at && (Date.now() - new Date(cached.refreshed_at).getTime()) < TTL_MS;
    if (fresh) {
      return Response.json({ trends: cached.payload || EMPTY, cached: true });
    }

    let trends = EMPTY;
    try {
      const res: any = await svc.integrations.Core.InvokeLLM({
        prompt: PROMPT,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: SCHEMA,
      });
      trends = shape(res);
    } catch (err) {
      console.error('[get-web-trends] llm failed', err);
      // Serve the stale cache rather than burning another call on retry.
      return Response.json({ trends: cached?.payload || EMPTY, cached: true, stale: true });
    }

    const record = { cache_key: CACHE_KEY, payload: trends, refreshed_at: new Date().toISOString() };
    if (cached) await svc.entities.WebTrendCache.update(cached.id, record);
    else await svc.entities.WebTrendCache.create(record);

    return Response.json({ trends, cached: false });
  } catch (error: any) {
    console.error('[get-web-trends] error', error);
    return Response.json({ trends: EMPTY, error: error.message }, { status: 200 });
  }
}