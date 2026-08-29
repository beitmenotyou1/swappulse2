import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// mark-dm-read — recipient-only read-receipt mutation for local E2EE DMs.
// DirectMessage rows are otherwise immutable from the browser after creation.
export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const myDid = String((user as any).did || (user as any).data?.did || '').trim();
    if (!myDid) return Response.json({ error: 'Messaging identity not configured' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const conversationId = String((body as any).conversationId || '').trim();
    if (!conversationId) return Response.json({ error: 'conversationId required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const messages = await svc.entities.DirectMessage.filter(
      { conversation_id: conversationId, recipient_did: myDid, read: false },
      '-created_date',
      200,
    ).catch(() => []);

    let updated = 0;
    for (const message of messages || []) {
      await svc.entities.DirectMessage.update(message.id, { read: true });
      updated++;
    }

    return Response.json({ ok: true, updated });
  } catch (error: any) {
    console.error('mark-dm-read error:', error?.message || error);
    return Response.json({ error: 'Could not update read receipts' }, { status: 500 });
  }
}
