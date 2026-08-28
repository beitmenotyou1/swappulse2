import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ACTIVE_STATUSES = new Set([
  'PENDING',
  'DEPLOYED',
  'REGISTERED',
  'RECOVERY_PENDING',
  'RECOVERED',
]);

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function normalizeHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n <= 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

function normalizeAddress(value: unknown, field: string): string {
  return normalizeHex(value, field);
}

function randomIdentityId(): string {
  // 31 random bytes = 248 bits, safely below the Starknet felt252 field prime.
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  const n = BigInt(`0x${hex}`);
  return `0x${(n === 0n ? 1n : n).toString(16)}`;
}

function networkConfig() {
  const accountClassHash = String(Deno.env.get('SWAPPULSE_ACCOUNT_CLASS_HASH') || '').trim();
  const identityRegistryAddress = String(Deno.env.get('SWAPPULSE_IDENTITY_REGISTRY_ADDRESS') || '').trim();
  const recoveryController = String(Deno.env.get('SWAPPULSE_RECOVERY_CONTROLLER') || '').trim();
  const parsedDelay = Number(Deno.env.get('SWAPPULSE_RECOVERY_DELAY_SECONDS') || '172800');
  const recoveryDelaySeconds = Number.isFinite(parsedDelay) && parsedDelay >= 0
    ? Math.floor(parsedDelay)
    : 172800;

  return {
    network: 'SWAPPULSE_TESTNET',
    accountClassHash,
    identityRegistryAddress,
    recoveryController,
    recoveryDelaySeconds,
    ready: Boolean(accountClassHash && identityRegistryAddress),
  };
}

function safeIdentity(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    chain_identity_id: row.chain_identity_id,
    account_address: row.account_address || '',
    network: row.network,
    account_class_hash: row.account_class_hash || '',
    identity_registry_address: row.identity_registry_address || '',
    deployment_tx_hash: row.deployment_tx_hash || '',
    registration_tx_hash: row.registration_tx_hash || '',
    signer_version: row.signer_version,
    status: row.status,
    canonical_identity_id: row.canonical_identity_id || row.chain_identity_id,
    recovery_count: Number(row.recovery_count || 0),
    created_at: row.created_at || row.created_date || '',
    last_reconciled_at: row.last_reconciled_at || '',
    failure_code: row.failure_code || '',
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return jsonError('Unauthorized', 401);
    if (caller.role !== 'admin') return jsonError('Admin only', 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'config');
    const svc = base44.asServiceRole;
    const config = networkConfig();

    if (action === 'config') {
      return Response.json({
        ok: true,
        config: {
          network: config.network,
          ready: config.ready,
          account_class_hash: config.accountClassHash,
          identity_registry_address: config.identityRegistryAddress,
          recovery_controller_configured: Boolean(config.recoveryController),
          recovery_delay_seconds: config.recoveryDelaySeconds,
        },
        notes: [
          'This endpoint never returns a private key or passkey secret.',
          'Ordinary-user provisioning remains disabled until AgeStatus enforcement is implemented.',
        ],
      });
    }

    if (action === 'prepare') {
      const targetUserId = String(body.target_user_id || '').trim();
      if (!targetUserId) return jsonError('target_user_id is required', 400);

      let publicKey: string;
      try {
        publicKey = normalizeHex(body.public_key, 'public_key');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid public key', 400, 'INVALID_PUBLIC_KEY');
      }

      const users = await svc.entities.User.filter({ id: targetUserId }, '-created_date', 1).catch(() => []);
      if (!users?.[0]) return jsonError('Target user not found', 404);

      const existing = await svc.entities.ChainIdentity
        .filter({ user_id: targetUserId }, '-created_date', 20)
        .catch(() => []);
      const current = existing.find((row: any) => ACTIVE_STATUSES.has(String(row?.status || '')));
      if (current) {
        return Response.json({
          ok: true,
          existing: true,
          identity: safeIdentity(current),
        });
      }

      const identityId = randomIdentityId();
      const now = new Date().toISOString();
      const record = await svc.entities.ChainIdentity.create({
        user_id: targetUserId,
        chain_identity_id: identityId,
        network: config.network,
        account_class_hash: config.accountClassHash,
        identity_registry_address: config.identityRegistryAddress,
        signer_version: 'STARK_V1',
        status: 'PENDING',
        canonical_identity_id: identityId,
        recovery_count: 0,
        created_at: now,
        last_reconciled_at: '',
        failure_code: '',
      });

      return Response.json({
        ok: true,
        existing: false,
        chain_ready: config.ready,
        identity: safeIdentity(record),
        deployment: {
          account_class_hash: config.accountClassHash,
          constructor: {
            public_key: publicKey,
            recovery_controller: config.recoveryController || '0x0',
            recovery_delay_seconds: config.recoveryDelaySeconds,
          },
          identity_registry_address: config.identityRegistryAddress,
          register_identity_calldata: {
            identity_id: identityId,
            account_address: '<fill after account deployment>',
          },
        },
        warnings: config.ready ? [] : [
          'SwapPulse Testnet contract addresses are not configured yet. The identity reservation is PENDING and cannot be deployed until the contracts are declared/deployed.',
        ],
      });
    }

    if (action === 'record_deployment') {
      const recordId = String(body.record_id || '').trim();
      if (!recordId) return jsonError('record_id is required', 400);

      let accountAddress: string;
      try {
        accountAddress = normalizeAddress(body.account_address, 'account_address');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid account address', 400, 'INVALID_ACCOUNT_ADDRESS');
      }

      const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      const record = rows?.[0];
      if (!record) return jsonError('ChainIdentity not found', 404);
      if (!['PENDING', 'FAILED'].includes(String(record.status || ''))) {
        return jsonError('Identity is not awaiting deployment', 409, 'INVALID_STATE');
      }

      const deploymentTxHash = body.deployment_tx_hash
        ? normalizeHex(body.deployment_tx_hash, 'deployment_tx_hash')
        : '';
      const registrationTxHash = body.registration_tx_hash
        ? normalizeHex(body.registration_tx_hash, 'registration_tx_hash')
        : '';

      await svc.entities.ChainIdentity.update(record.id, {
        account_address: accountAddress,
        deployment_tx_hash: deploymentTxHash,
        registration_tx_hash: registrationTxHash,
        status: 'DEPLOYED',
        failure_code: '',
      });

      const updatedRows = await svc.entities.ChainIdentity.filter({ id: record.id }, '-created_date', 1).catch(() => []);
      return Response.json({
        ok: true,
        identity: safeIdentity(updatedRows?.[0] || { ...record, account_address: accountAddress, status: 'DEPLOYED' }),
        chain_authority_required: true,
        note: 'DEPLOYED means transaction details were recorded. REGISTERED is reserved for a later chain read-back/reconciliation check.',
      });
    }

    if (action === 'mark_failed') {
      const recordId = String(body.record_id || '').trim();
      const failureCode = String(body.failure_code || 'ADMIN_ABORTED').trim().slice(0, 120);
      if (!recordId) return jsonError('record_id is required', 400);
      const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      const record = rows?.[0];
      if (!record) return jsonError('ChainIdentity not found', 404);
      if (record.status === 'REGISTERED' || record.status === 'MERGED') {
        return jsonError('Registered/merged identities cannot be marked failed from Base44', 409, 'CHAIN_STATE_PROTECTED');
      }
      await svc.entities.ChainIdentity.update(record.id, { status: 'FAILED', failure_code: failureCode });
      return Response.json({ ok: true, status: 'FAILED', record_id: record.id });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (e: any) {
    console.error('chain-identity-admin failed', e?.message || e);
    return Response.json({ error: 'Chain identity operation failed' }, { status: 500 });
  }
}
