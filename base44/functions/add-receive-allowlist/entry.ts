// add-receive-allowlist — adds an address to the user's ReceiveAllowlist so
// they can send to and receive from that address.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { address, label, chain } = body;
    if (!address) return Response.json({ error: 'Address required' }, { status: 400 });

    const lowerAddr = address.toLowerCase().trim();

    // Check for duplicate
    const existing = await base44.entities.ReceiveAllowlist
      .filter({ did, address: lowerAddr }).catch(() => []);
    if (existing.length) return Response.json({ error: 'Address already allowlisted' }, { status: 400 });

    await base44.entities.ReceiveAllowlist.create({
      did,
      address: lowerAddr,
      label: (label || '').trim(),
      chain: chain || '',
      added_at: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}