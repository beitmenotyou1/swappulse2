// Upsert helper for the ContractRegistry entity. Called by every deploy-*
// backend function after a successful on-chain deployment so the admin
// dashboard can display deployed contracts across page refreshes without
// prompting for redeployment. Each contract_key has at most one record;
// re-deploying overwrites the previous address in place.

export interface ContractRegistryEntry {
  chain: string;
  contract_key: string;
  contract_name: string;
  address: string;
  tx_hash?: string;
  explorer_url?: string;
  deployed_by?: string;
}

export async function upsertContract(
  base44: any,
  entry: ContractRegistryEntry,
): Promise<void> {
  const record = {
    chain: entry.chain,
    contract_key: entry.contract_key,
    contract_name: entry.contract_name,
    address: entry.address,
    tx_hash: entry.tx_hash || '',
    explorer_url: entry.explorer_url || '',
    deployed_by: entry.deployed_by || '',
    deployed_at: new Date().toISOString(),
  };
  const existing = await base44.asServiceRole.entities.ContractRegistry
    .filter({ contract_key: entry.contract_key }, undefined, 1)
    .catch(() => []);
  if (existing.length > 0) {
    await base44.asServiceRole.entities.ContractRegistry.update(existing[0].id, record);
  } else {
    await base44.asServiceRole.entities.ContractRegistry.create(record);
  }
}

// Resolve a deployed contract address from the ContractRegistry by contract_key.
// Returns null if not found. Used by shared modules to avoid depending on
// per-contract secrets — the registry is the source of truth after deployment.
// `svc` is the service-role client (base44.asServiceRole).
export async function resolveDeployedAddress(
  svc: any,
  contractKey: string,
): Promise<string | null> {
  if (!svc) return null;
  const rec = (await svc.entities.ContractRegistry
    .filter({ contract_key: contractKey }, undefined, 1)
    .catch(() => []))[0];
  return rec?.address || null;
}