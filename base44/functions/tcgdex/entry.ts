// Public TCGDex catalog gateway — catalog data is public, no auth required.
import { fetchTcgdex } from '../../shared/tcgdexClient.ts';

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'search';
    const lang = body.lang || 'en';

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
    } else if (action === 'getCardBySet') {
      path = `/sets/${encodeURIComponent(body.setId)}/${encodeURIComponent(body.localId)}`;
    } else if (action === 'getSets') {
      path = '/sets';
    } else if (action === 'getSet') {
      path = `/sets/${encodeURIComponent(body.setId)}`;
    } else if (action === 'getSeries') {
      path = '/series';
    } else if (action === 'getSerie') {
      path = `/series/${encodeURIComponent(body.serieId)}`;
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
    } else if (action === 'getHps') {
      path = '/hps';
    } else if (action === 'getRetreats') {
      path = '/retreats';
    } else if (action === 'getStages') {
      path = '/stages';
    } else if (action === 'getDexIds') {
      path = '/dexids';
    } else if (action === 'getEnergyTypes') {
      path = '/energytypes';
    } else if (action === 'getRegulationMarks') {
      path = '/regulationmarks';
    } else if (action === 'getSuffixes') {
      path = '/suffixes';
    } else if (action === 'getTrainerTypes') {
      path = '/trainertypes';
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const data = await fetchTcgdex(path, lang);
    return Response.json({ data }, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});