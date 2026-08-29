import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ACTIVE_STATUSES = new Set(['PENDING', 'DEPLOYED', 'REGISTERED', 'RECOVERY_PENDING', 'RECOVERED']);

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

function findForbiddenResultKey(value: unknown, path = 'result'): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenResultKey(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  const forbidden = /(private[_-]?key|mnemonic|seed[_-]?phrase|password|secret|credential|bearer|api[_-]?key)/i;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key)) return `${path}.${key}`;
    const found = findForbiddenResultKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function randomIdentityId(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  const n = BigInt(`0x${hex}`);
  return `0x${(n === 0n ? 1n : n).toString(16)}`;
}

async function uniqueIdentityId(svc: any): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomIdentityId();
    const existing = await svc.entities.ChainIdentity
      .filter({ chain_identity_id: candidate }, '-created_date', 1)
      .catch(() => []);
    if (!existing?.length) return candidate;
  }
  throw new Error('Could not allocate unique chain identity id');
}

async function getAgeEligibility(svc: any, userId: string) {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0] || null;
  if (!row || !isAgeBand(row.age_band)) {
    return { declared: false, age_band: '', method: '', eligible: false };
  }
  const ageBand = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  const eligibility = deriveAgeEligibility(ageBand, method);
  return {
    declared: true,
    age_band: ageBand,
    method,
    eligible: eligibility.testnet_identity_eligible,
    testnet_wallet_eligible: eligibility.testnet_wallet_eligible,
    value_features_eligible: eligibility.value_features_eligible,
  };
}

async function getNetwork(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig
    .filter({ network: 'SWAPPULSE_TESTNET' }, '-updated_date', 1)
    .catch(() => []);
  const row = rows?.[0] || null;
  const chainId = String(row?.chain_id || '').trim();
  const accountClassHash = String(row?.account_class_hash || '').trim();
  const registryClassHash = String(row?.identity_registry_class_hash || '').trim();
  const registryAddress = String(row?.identity_registry_address || '').trim();
  const registryOwner = String(row?.identity_registry_owner || '').trim();
  const rpcUrl = String(row?.rpc_url || '').trim();
  const status = String(row?.status || 'UNCONFIGURED');
  const ready = status === 'CONFIGURED'
    && Boolean(chainId && accountClassHash && registryClassHash && registryAddress && registryOwner && rpcUrl)
    && String(row?.verified_chain_id || '').trim() === chainId
    && String(row?.verified_identity_registry_class_hash || '').trim() === registryClassHash
    && String(row?.verified_identity_registry_owner || '').trim() === registryOwner
    && String(row?.verified_account_class_hash || '').trim() === accountClassHash
    && String(row?.verified_rpc_url || '').trim() === rpcUrl;
  return {
    ready,
    status,
    chain_id: chainId,
    account_class_hash: accountClassHash,
    identity_registry_class_hash: registryClassHash,
    identity_registry_address: registryAddress,
    identity_registry_owner: registryOwner,
    recovery_controller: String(row?.recovery_controller || '').trim(),
    recovery_delay_seconds: Number(row?.recovery_delay_seconds ?? 172800),
  };
}

function safeIdentity(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    chain_identity_id: row.chain_identity_id,
    account_address: row.account_address || '',
    network: row.network || 'SWAPPULSE_TESTNET',
    signer_public_key: row.signer_public_key || '',
    signer_version: row.signer_version || 'STARK_V1',
    status: row.status || 'PENDING',
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
    const me = await base44.auth.me().catch(() => null);
    if (!me) return jsonError('Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');
    const svc = base44.asServiceRole;
    const [age, network, identities] = await Promise.all([
      getAgeEligibility(svc, me.id),
      getNetwork(svc),
      svc.entities.ChainIdentity.filter({ user_id: me.id }, '-created_date', 20).catch(() => []),
    ]);
    const current = identities.find((row: any) => ACTIVE_STATUSES.has(String(row?.status || ''))) || null;

    if (action === 'status') {
      return Response.json({
        ok: true,
        age,
        network: {
          ready: network.ready,
          status: network.status,
          chain_id: network.ready ? network.chain_id : '',
        },
        identity: safeIdentity(current),
        can_prepare: Boolean(age.eligible && network.ready && !current),
        private_key_required_by_base44: false,
      });
    }

    if (action !== 'prepare') return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
    if (!age.eligible) {
      return jsonError('You must have an eligible 18+ AgeStatus before preparing a SwapPulse Testnet identity', 403, 'AGE_ELIGIBILITY_REQUIRED');
    }
    if (!network.ready) {
      return jsonError('SwapPulse Testnet is not independently verified and ready yet', 409, 'CHAIN_NOT_CONFIGURED');
    }

    let publicKey: string;
    try {
      publicKey = normalizeHex(body.public_key, 'public_key');
    } catch (e: any) {
      return jsonError(e?.message || 'Invalid public key', 400, 'INVALID_PUBLIC_KEY');
    }

    if (current) {
      if (String(current.status || '') === 'PENDING') {
        const existingKey = String(current.signer_public_key || '').trim();
        if (existingKey && normalizeHex(existingKey, 'reserved signer_public_key') !== publicKey) {
          return jsonError('Your pending identity is already bound to a different public key', 409, 'SIGNER_PUBLIC_KEY_MISMATCH');
        }
        if (!existingKey) await svc.entities.ChainIdentity.update(current.id, { signer_public_key: publicKey, failure_code: '' });
        const refreshed = await svc.entities.ChainIdentity.filter({ id: current.id }, '-created_date', 1).catch(() => []);
        return Response.json({ ok: true, existing: true, identity: safeIdentity(refreshed?.[0] || { ...current, signer_public_key: publicKey }) });
      }
      return Response.json({ ok: true, existing: true, identity: safeIdentity(current) });
    }

    const identityId = await uniqueIdentityId(svc);
    const now = new Date().toISOString();
    const record = await svc.entities.ChainIdentity.create({
      user_id: me.id,
      chain_identity_id: identityId,
      network: 'SWAPPULSE_TESTNET',
      account_class_hash: network.account_class_hash,
      identity_registry_address: network.identity_registry_address,
      signer_public_key: publicKey,
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
      identity: safeIdentity(record),
      provisioning: {
        network: 'SWAPPULSE_TESTNET',
        chain_id: network.chain_id,
        account_class_hash: network.account_class_hash,
        identity_registry_address: network.identity_registry_address,
        public_key: publicKey,
        recovery_controller: network.recovery_controller || '0x0',
        recovery_delay_seconds: network.recovery_delay_seconds,
      },
      note: 'Identity reserved. Base44 received only the public Stark key. Deployment/signing remains outside Base44.',
    });
  } catch (e: any) {
    console.error('chain-identity-user failed', e?.message || e);
    return Response.json({ error: 'Unable to prepare chain identity' }, { status: 500 });
  }
}
