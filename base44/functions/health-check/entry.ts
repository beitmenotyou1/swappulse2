import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkTcgdex, checkDatabase, checkSmtp, checkVapid, checkBase44, checkAtProtoRelay, checkPodcastRss, checkStripe, checkNowPayments } from '../../shared/healthChecks.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const [tcgdex, database, relay] = await Promise.all([
      checkTcgdex(),
      checkDatabase(base44).catch((e) => ({ status: 'down', error: e?.message || String(e) })),
      checkAtProtoRelay(),
    ]);
    const smtp = checkSmtp();
    const vapid = checkVapid();
    const base44Status = checkBase44();
    const origin = req.headers.get('X-Base44-App-Url') || new URL(req.url).origin;
    const podcastRss = await checkPodcastRss(origin).catch((e) => ({ status: 'down', error: e?.message || String(e) }));

    const services = { base44: base44Status, database, tcgdex, 'atproto-relay': relay, smtp, vapid, 'podcast-rss': podcastRss, stripe: checkStripe(), nowpayments: checkNowPayments() };
    const allUp = Object.values(services).every((s) => s.status === 'up');
    const anyDown = Object.values(services).some((s) => s.status === 'down');

    return Response.json({
      status: allUp ? 'ok' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ status: 'error', error: e?.message || String(e) }, { status: 500 });
  }
}