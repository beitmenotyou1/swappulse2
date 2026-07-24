import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchTcgdex } from '../../shared/tcgdexClient.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'search';

    let path;
    if (action === 'search') {
      const params = new URLSearchParams();
      if (body.query) params.set('name', body.query);
      if (body.setName) params.set('set.name', body.setName);
      if (body.rarity) params.set('rarity', body.rarity);
      params.set('pagination:page', String(body.page || 1));
      params.set('pagination:itemsPerPage', String(body.perPage || 24));
      path = `/cards${params.toString() ? '?' + params.toString() : ''}`;
    } else if (action === 'getCard') {
      path = `/cards/${encodeURIComponent(body.cardId)}`;
    } else if (action === 'getSets') {
      path = '/sets';
    } else if (action === 'getSet') {
      path = `/sets/${encodeURIComponent(body.setId)}`;
    } else if (action === 'getSeries') {
      path = '/series';
    } else if (action === 'getCategories') {
      path = '/categories';
    } else if (action === 'getRarities') {
      path = '/rarities';
    } else if (action === 'getIllustrators') {
      path = '/illustrators';
    } else if (action === 'getVariants') {
      path = '/variants';
    } else if (action === 'getTypes') {
      path = '/types';
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const data = await fetchTcgdex(path);
    return Response.json({ data }, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});