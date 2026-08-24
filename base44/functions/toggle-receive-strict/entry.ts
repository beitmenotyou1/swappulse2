// toggle-receive-strict — toggles the receive_strict_mode flag on the user's
// WalletBalance. When enabled, incoming crypto transfers from non-allowlisted
// senders are blocked at the platform's watch layer.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const did = user.data?.did || user.did;

    const body = await req.json().catch(() => ({}));
    const { enabled } = body;

    const balances = await base44.entities.WalletBalance
      .filter({ did }, '-created_date', 1).catch(() => []);
    if (!balances.length) return Response.json({ error: 'No wallet balance found' }, { status: 400 });

    await base44.entities.WalletBalance.update(balances[0].id, {
      receive_strict_mode: !!enabled,
    });

    return Response.json({ success: true, receive_strict_mode: !!enabled });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}