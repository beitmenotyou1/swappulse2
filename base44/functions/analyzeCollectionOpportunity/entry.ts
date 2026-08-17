import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchTcgdex } from '../../shared/tcgdexClient.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    const svc = base44.asServiceRole;
    const body = await req.json();
    const { card_id, card_name, set_id, market_value, purchase_price, user_id } = body;

    if (!card_id || !user_id) {
      return Response.json({ error: 'card_id and user_id are required' }, { status: 400 });
    }

    // 1. Fetch current TCGDex data for the card
    let tcgdexData = null;
    try {
      tcgdexData = await fetchTcgdex('/cards/' + encodeURIComponent(card_id));
    } catch (e) {
      console.error('analyzeCollectionOpportunity: tcgdex fetch failed:', e?.message || e);
    }

    // 2. Compare stored market value vs current TCGDex pricing
    const tcgPricing = tcgdexData?.pricing || {};
    const tcgplayer = tcgPricing.tcgplayer || {};
    const cardmarket = tcgPricing.cardmarket || {};

    const currentMarketPrice = tcgplayer.normal?.marketPrice || cardmarket.trend || 0;
    const storedMarketValue = market_value || 0;
    const priceDiff = currentMarketPrice - storedMarketValue;
    const priceDiffPercent = storedMarketValue > 0 ? (priceDiff / storedMarketValue) * 100 : 0;

    // 3. Use collection_advisor persona via InvokeLLM to assess trade opportunity
    const prompt =
      'You are the SwapPulse Collection Advisor. A collector has updated their collection. ' +
      'Analyze whether this card represents a high-value trade opportunity right now.\n\n' +
      'Collection entry:\n' +
      '- Card: ' + (card_name || 'Unknown') + '\n' +
      '- Set ID: ' + (set_id || 'Unknown') + '\n' +
      '- Stored market value: ' + storedMarketValue + ' pence\n' +
      '- Purchase price: ' + (purchase_price || 0) + ' pence\n\n' +
      'Current TCGDex pricing:\n' +
      '- TCGPlayer market price: ' + (tcgplayer.normal?.marketPrice || 'N/A') + '\n' +
      '- Cardmarket trend: ' + (cardmarket.trend || 'N/A') + '\n' +
      '- Price difference from stored value: ' + priceDiffPercent.toFixed(1) + '%\n\n' +
      'Determine if this is a high-value trade opportunity — for example, the card has significantly ' +
      'increased in value since acquisition (good time to sell/trade), or there is a notable price ' +
      'discrepancy between stored and current market data.\n\n' +
      'Respond with JSON:\n' +
      '- high_value_opportunity: boolean (true only if genuinely high-value — significant price increase or strong trade signal)\n' +
      '- advice: a concise, specific trade recommendation (1-2 sentences referencing the card name and price)\n' +
      '- confidence: number 0-1';

    const analysis = await svc.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          high_value_opportunity: { type: 'boolean' },
          advice: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    });

    return Response.json({
      high_value_opportunity: analysis.high_value_opportunity || false,
      advice: analysis.advice || '',
      confidence: analysis.confidence || 0,
      card_name: card_name || '',
      user_id: user_id,
      card_id: card_id,
      current_market_price: currentMarketPrice
    });
  } catch (error) {
    console.error('analyzeCollectionOpportunity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}