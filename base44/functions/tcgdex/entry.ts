import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'search';

    let url;
    if (action === 'search') {
      const params = new URLSearchParams();
      if (body.query) params.set('name', body.query);
      if (body.setName) params.set('set.name', body.setName);
      if (body.rarity) params.set('rarity', body.rarity);
      params.set('pagination:page', String(body.page || 1));
      params.set('pagination:itemsPerPage', String(body.perPage || 24));
      url = `${TCGDEX_BASE}/cards${params.toString() ? '?' + params.toString() : ''}`;
    } else if (action === 'getCard') {
      url = `${TCGDEX_BASE}/cards/${encodeURIComponent(body.cardId)}`;
    } else if (action === 'getSets') {
      url = `${TCGDEX_BASE}/sets`;
    } else if (action === 'getSet') {
      url = `${TCGDEX_BASE}/sets/${encodeURIComponent(body.setId)}`;
    } else if (action === 'getSeries') {
      url = `${TCGDEX_BASE}/series`;
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return Response.json({ error: 'TCGDex error', status: upstream.status, detail: text }, { status: upstream.status });
    }

    const data = await upstream.json();
    return Response.json({ data }, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});