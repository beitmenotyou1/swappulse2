import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function safeIdentity(row: any) {
  if (!row) return null;
  return {
    chain_identity_id: row.chain_identity_id,
    account_address: row.account_address || '',
    network: row.network || 'SWAPPULSE_TESTNET',
    signer_version: row.signer_version || 'STARK_V1',
    status: row.status || 'PENDING',
    canonical_identity_id: row.canonical_identity_id || row.chain_identity_id,
    deployment_tx_hash: row.deployment_tx_hash || '',
    registration_tx_hash: row.registration_tx_hash || '',
    recovery_count: Number(row.recovery_count || 0),
    created_at: row.created_at || row.created_date || '',
    last_reconciled_at: row.last_reconciled_at || '',
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await base44.asServiceRole.entities.ChainIdentity
      .filter({ user_id: me.id }, '-created_date', 20)
      .catch(() => []);

    const preferred = rows.find((row: any) =>
      ['REGISTERED', 'RECOVERED', 'DEPLOYED', 'RECOVERY_PENDING', 'PENDING'].includes(String(row?.status || '')),
    ) || null;

    return Response.json({
      ok: true,
      identity: safeIdentity(preferred),
      blockchain_visible_by_default: false,
    });
  } catch (e: any) {
    console.error('get-my-chain-identity failed', e?.message || e);
    return Response.json({ error: 'Unable to load chain identity' }, { status: 500 });
  }
}
