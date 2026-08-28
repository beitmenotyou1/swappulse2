import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns only non-secret metadata for the caller's legacy SwapPulse app
// passwords. Hashes/ciphertext never cross into the browser.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.AppPassword
      .filter({ created_by_id: user.id }, '-created_date', 100)
      .catch(() => []);

    return Response.json({
      items: (rows || []).map((row: any) => ({
        id: row.id,
        label: row.label || '',
        scope: row.scope || 'read_only',
        last_used_at: row.last_used_at || '',
        last_used_app: row.last_used_app || '',
        created_date: row.created_date || '',
      })),
    });
  } catch (error: any) {
    console.error('list-app-passwords error:', error?.message || error);
    return Response.json({ error: 'Could not load legacy credentials' }, { status: 500 });
  }
}
