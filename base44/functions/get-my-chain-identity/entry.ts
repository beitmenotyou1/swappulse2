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

    // Prefer the most-established identity by status, not merely the newest row —
    // a newer PENDING reservation must never shadow an already REGISTERED identity.
    // MERGED and FAILED must be ranked too: any status missing from this list
    // scores -1 and is skipped entirely, so a user whose only row is MERGED (a
    // real on-chain identity resolved to a canonical target) or FAILED would be
    // reported as having no identity at all — and prompted to create a second one.
    const STATUS_PRIORITY = ['REGISTERED', 'RECOVERED', 'MERGED', 'DEPLOYED', 'RECOVERY_PENDING', 'PENDING', 'FAILED'];
    let preferred: any = null;
    let bestRank = STATUS_PRIORITY.length;
    for (const row of rows) {
      const rank = STATUS_PRIORITY.indexOf(String(row?.status || ''));
      if (rank !== -1 && rank < bestRank) {
        bestRank = rank;
        preferred = row;
      }
    }

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