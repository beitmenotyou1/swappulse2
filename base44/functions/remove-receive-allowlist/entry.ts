// remove-receive-allowlist — removes an address from the user's ReceiveAllowlist.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const did = user.data?.did || user.did;

    const body = await req.json().catch(() => ({}));
    const { address } = body;
    if (!address) return Response.json({ error: 'Address required' }, { status: 400 });

    const lowerAddr = address.toLowerCase().trim();
    const entries = await base44.entities.ReceiveAllowlist
      .filter({ did, address: lowerAddr }).catch(() => []);

    for (const entry of entries) {
      await base44.entities.ReceiveAllowlist.delete(entry.id);
    }

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}