// backfill-follows — admin-triggered one-time pass to bridge existing local
// Follow records to the AT Protocol PDS as real app.bsky.graph.follow records.
//
// Idempotent: skips records where bridged=true. Processes up to 100 per run to
// stay within function time limits. Returns { bridged, skipped, failed, errors }.
// Re-run until failed=0 and bridged stops increasing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const LIMIT = 100;
    const follows = await svc.entities.Follow.list('-created_date', LIMIT);

    let bridged = 0, skipped = 0, failed = 0;
    const errors = [];

    for (const follow of follows) {
      if (follow.bridged === true) {
        skipped++;
        continue;
      }
      if (!follow.subject_did) {
        failed++;
        errors.push({ id: follow.id, error: 'missing subject_did' });
        continue;
      }
      try {
        const res = await base44.functions.invoke('atproto-bridge', {
          collection: 'app.bsky.graph.follow',
          record: {
            subject: follow.subject_did,
            createdAt: follow.created_date || new Date().toISOString(),
          },
        });
        const uri = res?.data?.uri || res?.uri;
        const cid = res?.data?.cid || res?.cid;
        if (uri) {
          await svc.entities.Follow.update(follow.id, {
            at_uri: uri,
            cid: cid || '',
            bridged: true,
          });
          bridged++;
        } else {
          failed++;
          errors.push({ id: follow.id, error: 'no uri returned from bridge' });
        }
      } catch (err) {
        failed++;
        const msg = err?.message || 'bridge failed';
        errors.push({ id: follow.id, error: msg });
        console.error('backfill-follows: failed for', follow.id, msg);
      }
    }

    return Response.json({
      bridged,
      skipped,
      failed,
      total: follows.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error('backfill-follows error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}