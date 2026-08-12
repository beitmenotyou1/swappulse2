import { checkTcgdex } from '../../shared/healthChecks.ts';

export default async function (req) {
  try {
    const tcgdex = await checkTcgdex();
    const status = tcgdex.status === 'up' ? 'ok' : 'degraded';
    return Response.json({ status, tcgdex, timestamp: new Date().toISOString() });
  } catch (e) {
    return Response.json({ status: 'error', error: e?.message || String(e) }, { status: 500 });
  }
}