import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { Account, RpcProvider, hash, transaction } from 'starknet';

const upstream = new URL(process.env.UPSTREAM_RPC || 'http://devnet:5050');
const port = Number(process.env.PORT || 8081);
const relayToken = String(process.env.RELAY_TOKEN || '');
const expectedChainId = normalizeHex(process.env.CHAIN_ID || '', 'CHAIN_ID');
const accountClassHash = normalizeHex(process.env.ACCOUNT_CLASS_HASH || '', 'ACCOUNT_CLASS_HASH');
const identityRegistryClassHash = normalizeHex(process.env.IDENTITY_REGISTRY_CLASS_HASH || '', 'IDENTITY_REGISTRY_CLASS_HASH');
const identityRegistryAddress = normalizeHex(process.env.IDENTITY_REGISTRY_ADDRESS || '', 'IDENTITY_REGISTRY_ADDRESS');
const identityRegistryOwner = normalizeHex(process.env.IDENTITY_REGISTRY_OWNER || '', 'IDENTITY_REGISTRY_OWNER');
const identityVerifierAddress = normalizeHex(process.env.IDENTITY_VERIFIER_ADDRESS || '', 'IDENTITY_VERIFIER_ADDRESS');
const registryAdminAddress = normalizeHex(process.env.REGISTRY_ADMIN_ADDRESS || '', 'REGISTRY_ADMIN_ADDRESS');
const registryAdminPrivateKey = normalizeHex(process.env.REGISTRY_ADMIN_PRIVATE_KEY || '', 'REGISTRY_ADMIN_PRIVATE_KEY');
const identityVerifierPrivateKey = normalizeHex(process.env.IDENTITY_VERIFIER_PRIVATE_KEY || '', 'IDENTITY_VERIFIER_PRIVATE_KEY');
const identityVerificationMode = String(process.env.IDENTITY_VERIFICATION_MODE || 'v1').trim().toLowerCase();
const nativeTokenAddress = normalizeZeroableHex(process.env.NATIVE_TOKEN_ADDRESS || '0x0', 'NATIVE_TOKEN_ADDRESS');
const nativeTokenClassHash = normalizeZeroableHex(process.env.NATIVE_TOKEN_CLASS_HASH || '0x0', 'NATIVE_TOKEN_CLASS_HASH');
const cardNftAddress = normalizeZeroableHex(process.env.CARD_NFT_ADDRESS || '0x0', 'CARD_NFT_ADDRESS');
const cardNftClassHash = normalizeZeroableHex(process.env.CARD_NFT_CLASS_HASH || '0x0', 'CARD_NFT_CLASS_HASH');
const stakingPoolAddress = normalizeZeroableHex(process.env.STAKING_POOL_ADDRESS || '0x0', 'STAKING_POOL_ADDRESS');
const stakingPoolClassHash = normalizeZeroableHex(process.env.STAKING_POOL_CLASS_HASH || '0x0', 'STAKING_POOL_CLASS_HASH');
const usershipAddress = normalizeZeroableHex(process.env.USERSHIP_ADDRESS || '0x0', 'USERSHIP_ADDRESS');
const usershipClassHash = normalizeZeroableHex(process.env.USERSHIP_CLASS_HASH || '0x0', 'USERSHIP_CLASS_HASH');
const bridgeAdapterAddress = normalizeZeroableHex(process.env.BRIDGE_ADAPTER_ADDRESS || '0x0', 'BRIDGE_ADAPTER_ADDRESS');
const bridgeAdapterClassHash = normalizeZeroableHex(process.env.BRIDGE_ADAPTER_CLASS_HASH || '0x0', 'BRIDGE_ADAPTER_CLASS_HASH');
const recoveryController = normalizeZeroableHex(process.env.RECOVERY_CONTROLLER || '0x0', 'RECOVERY_CONTROLLER');
const recoveryDelaySeconds = Number(process.env.RECOVERY_DELAY_SECONDS || 172800);
const deployMintAmount = BigInt(process.env.DEPLOY_MINT_AMOUNT || '500000000000000000');
// Fixed testnet faucet drip. The AMOUNT IS NOT CLIENT-SELECTABLE: the relay always
// transfers exactly this much, so neither Base44 nor a compromised caller can drain
// the faucet treasury with an inflated request.
const faucetDripAmount = BigInt(process.env.FAUCET_DRIP_AMOUNT || '1000000000000000000000');
const maxBodyBytes = 128 * 1024;
const maxUpstreamBytes = 2 * 1024 * 1024;
const timeoutMs = 10_000;
const rateLimitPerMinute = Math.max(5, Math.min(600, Number(process.env.RATE_LIMIT_PER_MINUTE || 60)));

if (relayToken.length < 32) throw new Error('RELAY_TOKEN must be at least 32 characters');
if (!['v1', 'v2'].includes(identityVerificationMode)) {
  throw new Error('IDENTITY_VERIFICATION_MODE must be v1 or v2');
}
if (identityVerificationMode === 'v2') {
  const requiredSupport = [
    ['NATIVE_TOKEN_ADDRESS', nativeTokenAddress],
    ['NATIVE_TOKEN_CLASS_HASH', nativeTokenClassHash],
    ['CARD_NFT_ADDRESS', cardNftAddress],
    ['CARD_NFT_CLASS_HASH', cardNftClassHash],
    ['STAKING_POOL_ADDRESS', stakingPoolAddress],
    ['STAKING_POOL_CLASS_HASH', stakingPoolClassHash],
    ['USERSHIP_ADDRESS', usershipAddress],
    ['USERSHIP_CLASS_HASH', usershipClassHash],
    ['BRIDGE_ADAPTER_ADDRESS', bridgeAdapterAddress],
    ['BRIDGE_ADAPTER_CLASS_HASH', bridgeAdapterClassHash],
  ];
  for (const [name, value] of requiredSupport) {
    if (value === '0x0') throw new Error(`${name} is required in V2 mode`);
  }
}
if (!Number.isInteger(recoveryDelaySeconds) || recoveryDelaySeconds < 0 || recoveryDelaySeconds > 2_592_000) {
  throw new Error('RECOVERY_DELAY_SECONDS must be an integer from 0 to 2592000');
}
if (deployMintAmount <= 0n || deployMintAmount > (1n << 100n)) {
  throw new Error('DEPLOY_MINT_AMOUNT must be a positive amount within the supported range');
}
if (faucetDripAmount <= 0n || faucetDripAmount > (1n << 100n)) {
  throw new Error('FAUCET_DRIP_AMOUNT must be a positive amount within the supported range');
}

if (registryAdminAddress !== identityRegistryOwner) {
  throw new Error('REGISTRY_ADMIN_ADDRESS must equal IDENTITY_REGISTRY_OWNER');
}
if (identityVerifierAddress === identityRegistryOwner) {
  throw new Error('IDENTITY_VERIFIER_ADDRESS must be separate from IDENTITY_REGISTRY_OWNER');
}

const windows = new Map();
// Defence-in-depth for the faucet. Base44 persists the 24h cooldown by canonical
// identity, while the single relay process also remembers recipient attempts so
// concurrent requests from separate Base44 workers cannot double-drip.
const faucetAttemptAt = new Map();
const faucetCooldownMs = 24 * 60 * 60 * 1000;
const provider = new RpcProvider({ nodeUrl: upstream.toString() });
const registryAdmin = new Account({ provider, address: registryAdminAddress, signer: registryAdminPrivateKey });
const identityVerifier = new Account({ provider, address: identityVerifierAddress, signer: identityVerifierPrivateKey });
let registrationBusy = false;
let readinessCache = null;
const readinessTtlMs = 30_000;

function normalizeHex(value, field = 'felt') {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  return `0x${BigInt(raw).toString(16)}`;
}

function normalizeZeroableHex(value, field = 'felt') {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n < 0n) throw new Error(`${field} must not be negative`);
  return `0x${n.toString(16)}`;
}

function normalizeArray(values, field) {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  return values.map((v, i) => normalizeZeroableHex(v, `${field}[${i}]`));
}

function normalizeNumberish(value, field = 'felt') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(raw)) return `0x${BigInt(raw).toString(16)}`;
  if (/^[0-9]+$/.test(raw)) return `0x${BigInt(raw).toString(16)}`;
  throw new Error(`${field} must be a hexadecimal or decimal felt`);
}

function sameFelts(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, i) => normalizeNumberish(value) === normalizeNumberish(b[i]));
}

function clientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function withinRateLimit(ip) {
  const minute = Math.floor(Date.now() / 60_000);
  const current = windows.get(ip);
  if (!current || current.minute !== minute) {
    windows.set(ip, { minute, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= rateLimitPerMinute;
}

function tokenMatches(header) {
  const raw = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(raw);
  const b = Buffer.from(relayToken);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function rpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await response.text();
    if (Buffer.byteLength(text) > maxUpstreamBytes) throw new Error('UPSTREAM_RESPONSE_TOO_LARGE');
    let payload;
    try { payload = JSON.parse(text); } catch { throw new Error('UPSTREAM_INVALID_JSON'); }
    if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function extractTransaction(payload, field) {
  const params = payload?.params;
  if (Array.isArray(params)) return params[0];
  if (params && typeof params === 'object') return params[field];
  return null;
}

function validateCommonV3(tx, expectedType) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('TRANSACTION_REQUIRED');
  if (tx.type && String(tx.type) !== expectedType) throw new Error('WRONG_TRANSACTION_TYPE');
  if (normalizeHex(tx.version, 'version') !== '0x3') throw new Error('ONLY_V3_TRANSACTIONS_ALLOWED');
  const signature = normalizeArray(tx.signature, 'signature');
  if (signature.length !== 2) throw new Error('STARK_SIGNATURE_MUST_HAVE_TWO_FELTS');
  if (tx.paymaster_data && normalizeArray(tx.paymaster_data, 'paymaster_data').length !== 0) {
    throw new Error('PAYMASTER_DATA_NOT_ALLOWED');
  }
  if (tx.proof_facts && normalizeArray(tx.proof_facts, 'proof_facts').length !== 0) throw new Error('PROOF_FACTS_NOT_ALLOWED');
  if (tx.proof) throw new Error('PROOF_NOT_ALLOWED');
  if (BigInt(normalizeZeroableHex(tx.tip ?? '0x0', 'tip')) !== 0n) throw new Error('NONZERO_TIP_NOT_ALLOWED');
}

async function validateDeploy(tx) {
  validateCommonV3(tx, 'DEPLOY_ACCOUNT');
  if (normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce') !== '0x0') throw new Error('DEPLOY_NONCE_MUST_BE_ZERO');
  if (normalizeHex(tx.class_hash, 'class_hash') !== accountClassHash) throw new Error('ACCOUNT_CLASS_NOT_ALLOWED');
  const constructor = normalizeArray(tx.constructor_calldata, 'constructor_calldata');
  if (constructor.length !== 1 || constructor[0] === '0x0') throw new Error('CONSTRUCTOR_MUST_CONTAIN_ONE_PUBLIC_KEY');
  const publicKey = constructor[0];
  if (normalizeHex(tx.contract_address_salt, 'contract_address_salt') !== publicKey) {
    throw new Error('ADDRESS_SALT_MUST_EQUAL_PUBLIC_KEY');
  }
  const accountAddress = normalizeHex(
    hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
    'account address',
  );

  // This privileged Devnet helper is never exposed as a client-selectable faucet.
  // It can mint only a fixed amount to the exact counterfactual account implied by
  // the approved class hash + public-key constructor/salt.
  const minted = await rpc('devnet_mint', {
    address: accountAddress,
    amount: deployMintAmount.toString(),
    unit: 'FRI',
  });
  if (minted?.error) throw new Error(`DEVNET_MINT_FAILED_${minted.error.code ?? 'UNKNOWN'}`);
  return { accountAddress, publicKey };
}

async function validateRecoveryInvoke(tx) {
  validateCommonV3(tx, 'INVOKE');
  const sender = normalizeHex(tx.sender_address, 'sender_address');
  if (tx.account_deployment_data && normalizeArray(tx.account_deployment_data, 'account_deployment_data').length !== 0) {
    throw new Error('ACCOUNT_DEPLOYMENT_DATA_NOT_ALLOWED');
  }

  const classResult = await rpc('starknet_getClassHashAt', ['latest', sender]);
  if (classResult?.error) throw new Error('SENDER_ACCOUNT_NOT_DEPLOYED');
  if (normalizeHex(classResult?.result, 'sender class hash') !== accountClassHash) {
    throw new Error('SENDER_ACCOUNT_CLASS_NOT_ALLOWED');
  }

  const expected = transaction.getExecuteCalldata([
    {
      contractAddress: sender,
      entrypoint: 'set_recovery_controller',
      calldata: [recoveryController],
    },
    {
      contractAddress: sender,
      entrypoint: 'set_recovery_delay',
      calldata: [String(recoveryDelaySeconds)],
    },
  ], '1');
  const actual = normalizeArray(tx.calldata, 'calldata');
  if (sameFelts(actual, expected)) return { sender, kind: 'configure_recovery' };

  // Not the recovery bootstrap — fall back to the collector-action allowlist
  // (staking, bridging, token approvals). Every call is checked individually.
  const calls = decodeExecuteCalls(tx.calldata);
  assertAllowedUserCalls(calls);
  return {
    sender,
    kind: 'collector_action',
    entrypoints: calls.map((call) => call.selector),
  };
}

// Owner-signed CardNft mint. The relay is the CardNft owner, so minting is only
// possible through this endpoint — a collector can never mint themselves a
// verification level they did not earn. Base44 verifies the CardVerificationSession
// before calling, and `attestation_hash` makes the mint idempotent on-chain.
async function mintCard(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('MINT_BODY_REQUIRED');
  if (cardNftAddress === '0x0') throw new Error('CARD_NFT_NOT_CONFIGURED');

  const to = normalizeHex(body.to, 'to');
  const cardId = normalizeHex(body.card_id, 'card_id');
  const attestationHash = normalizeHex(body.attestation_hash, 'attestation_hash');
  const verificationLevel = Number(body.verification_level);
  const soulbound = Number(body.soulbound);
  const metadataUri = String(body.metadata_uri || '');
  if (!Number.isInteger(verificationLevel) || verificationLevel < 0 || verificationLevel > 3) {
    throw new Error('VERIFICATION_LEVEL_NOT_ALLOWED');
  }
  if (soulbound !== 0 && soulbound !== 1) throw new Error('SOULBOUND_FLAG_NOT_ALLOWED');
  if (!/^https:\/\/[^\s]{1,400}$/.test(metadataUri)) throw new Error('METADATA_URI_MUST_BE_HTTPS');

  const accountClassResult = await rpc('starknet_getClassHashAt', ['latest', to]);
  if (accountClassResult?.error || normalizeHex(accountClassResult?.result, 'recipient class hash') !== accountClassHash) {
    throw new Error('MINT_RECIPIENT_CLASS_MISMATCH');
  }

  const uriCalldata = byteArrayCalldata(metadataUri);
  const executed = await registryAdmin.execute({
    contractAddress: cardNftAddress,
    entrypoint: 'mint',
    calldata: [to, cardId, String(verificationLevel), attestationHash, ...uriCalldata, String(soulbound)],
  });
  await provider.waitForTransaction(executed.transaction_hash);
  return {
    transaction_hash: normalizeHex(executed.transaction_hash, 'mint transaction hash'),
    attestation_hash: attestationHash,
  };
}

// Owner-signed Proof-of-Usership score submission. Scores are computed by the
// Base44 aggregation workflow from verified activity; the contract rejects a
// repeated epoch so a replayed submission cannot inflate anyone's weight.
async function submitUsership(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('USERSHIP_BODY_REQUIRED');
  if (usershipAddress === '0x0') throw new Error('USERSHIP_NOT_CONFIGURED');

  const identityId = normalizeHex(body.identity_id, 'identity_id');
  const account = normalizeHex(body.account, 'account');
  const activityRoot = normalizeHex(body.activity_root, 'activity_root');
  const score = Number(body.score);
  const epoch = Number(body.epoch);
  if (!Number.isInteger(score) || score < 0 || score > 1_000_000) throw new Error('SCORE_NOT_ALLOWED');
  if (!Number.isInteger(epoch) || epoch < 1) throw new Error('EPOCH_NOT_ALLOWED');

  const executed = await registryAdmin.execute({
    contractAddress: usershipAddress,
    entrypoint: 'submit_score',
    calldata: [identityId, account, String(score), activityRoot, String(epoch)],
  });
  await provider.waitForTransaction(executed.transaction_hash);
  return { transaction_hash: normalizeHex(executed.transaction_hash, 'usership transaction hash') };
}

// Owner-signed testnet faucet drip. Base44 supplies only the canonical identity
// and its own smart-account address; the relay independently proves that binding
// against IdentityRegistry before spending treasury SWPX. The amount is fixed by
// this host and is never caller-selectable.
async function faucetDrip(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('FAUCET_BODY_REQUIRED');
  if (nativeTokenAddress === '0x0') throw new Error('NATIVE_TOKEN_NOT_CONFIGURED');

  const to = normalizeHex(body.to, 'to');
  const identityId = normalizeHex(body.identity_id, 'identity_id');
  const recipientClass = await rpc('starknet_getClassHashAt', ['latest', to]);
  if (recipientClass?.error || normalizeHex(recipientClass?.result, 'recipient class hash') !== accountClassHash) {
    throw new Error('FAUCET_RECIPIENT_CLASS_MISMATCH');
  }

  const [identityValues, reverseValues] = await Promise.all([
    starknetCall(identityRegistryAddress, 'get_identity', [identityId]),
    starknetCall(identityRegistryAddress, 'get_identity_by_account', [to]),
  ]);
  if (identityValues.length < 5 || reverseValues.length < 1) throw new Error('FAUCET_IDENTITY_READ_INVALID');
  const chainAccount = normalizeZeroableHex(identityValues[0] || '0x0', 'faucet identity account');
  const chainStatus = BigInt(identityValues[1] || '0x0');
  const canonicalId = normalizeZeroableHex(identityValues[2] || '0x0', 'faucet canonical identity');
  const reverseId = normalizeZeroableHex(reverseValues[0] || '0x0', 'faucet reverse identity');
  if (chainStatus !== 1n || canonicalId !== identityId) throw new Error('FAUCET_IDENTITY_NOT_ACTIVE');
  if (chainAccount !== to || reverseId !== identityId) throw new Error('FAUCET_IDENTITY_ACCOUNT_MISMATCH');

  const now = Date.now();
  const previousAttempt = Number(faucetAttemptAt.get(to) || 0);
  if (previousAttempt > 0 && now - previousAttempt < faucetCooldownMs) {
    throw new Error('FAUCET_COOLDOWN_ACTIVE');
  }
  // Set this before the transaction call. If submission succeeds but the relay
  // loses the response while waiting for confirmation, retry remains fail-closed.
  faucetAttemptAt.set(to, now);

  const executed = await registryAdmin.execute({
    contractAddress: nativeTokenAddress,
    entrypoint: 'transfer',
    calldata: [to, `0x${faucetDripAmount.toString(16)}`, '0x0'],
  });
  await provider.waitForTransaction(executed.transaction_hash);
  return {
    identity_id: identityId,
    account_address: to,
    transaction_hash: normalizeHex(executed.transaction_hash, 'faucet transaction hash'),
    amount: faucetDripAmount.toString(),
  };
}

// Recovery-controller actions. The account contract only accepts propose/execute
// from its configured recovery controller, so the relay can act here only while it
// IS that controller — otherwise this fails closed. The on-chain delay is what
// protects the collector: proposing does not rotate the key, and execute_recovery
// reverts until the delay has elapsed.
async function recoveryAction(body, kind) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('RECOVERY_BODY_REQUIRED');
  if (recoveryController === '0x0') throw new Error('RECOVERY_CONTROLLER_NOT_CONFIGURED');
  if (recoveryController !== registryAdminAddress) throw new Error('RELAY_IS_NOT_RECOVERY_CONTROLLER');

  const account = normalizeHex(body.account_address, 'account_address');
  const accountClass = await rpc('starknet_getClassHashAt', ['latest', account]);
  if (accountClass?.error || normalizeHex(accountClass?.result, 'account class hash') !== accountClassHash) {
    throw new Error('RECOVERY_ACCOUNT_CLASS_MISMATCH');
  }

  const controllerValues = await starknetCall(account, 'get_recovery_controller', []);
  if (normalizeZeroableHex(controllerValues?.[0] || '0x0', 'account recovery controller') !== recoveryController) {
    throw new Error('RECOVERY_CONTROLLER_MISMATCH');
  }

  const call = kind === 'propose'
    ? {
      contractAddress: account,
      entrypoint: 'propose_recovery',
      calldata: [normalizeHex(body.new_public_key, 'new_public_key')],
    }
    : { contractAddress: account, entrypoint: kind === 'execute' ? 'execute_recovery' : 'cancel_recovery', calldata: [] };

  const executed = await registryAdmin.execute(call);
  await provider.waitForTransaction(executed.transaction_hash);

  const [pending, nonce] = await Promise.all([
    starknetCall(account, 'get_pending_recovery', []),
    starknetCall(account, 'get_recovery_nonce', []),
  ]);
  return {
    transaction_hash: normalizeHex(executed.transaction_hash, 'recovery transaction hash'),
    pending_public_key: normalizeZeroableHex(pending?.[0] || '0x0', 'pending public key'),
    execute_after: Number(BigInt(pending?.[1] || '0x0')),
    recovery_nonce: Number(BigInt(nonce?.[0] || '0x0')),
  };
}

// Cairo ByteArray serialisation: [pending_word_count, ...full_words,
// pending_word, pending_word_len]. Metadata URIs are short ASCII, so a single
// pending word (< 31 bytes) is uncommon — full 31-byte words are emitted first.
function byteArrayCalldata(value) {
  const bytes = new TextEncoder().encode(value);
  const fullWordCount = Math.floor(bytes.length / 31);
  const words = [];
  for (let i = 0; i < fullWordCount; i += 1) {
    const slice = bytes.slice(i * 31, i * 31 + 31);
    words.push(`0x${Buffer.from(slice).toString('hex')}`);
  }
  const rest = bytes.slice(fullWordCount * 31);
  const pendingWord = rest.length ? `0x${Buffer.from(rest).toString('hex')}` : '0x0';
  return [String(fullWordCount), ...words, pendingWord, String(rest.length)];
}

// Entrypoints a COLLECTOR may invoke with their own signature, per contract.
// Anything not listed here is rejected before the transaction reaches upstream,
// so a compromised client cannot reach privileged entrypoints (mint, slash,
// confirm_relayed, submit_score, release_inbound) through this relay.
const userEntrypoints = new Map([
  [nativeTokenAddress, ['approve']],
  [stakingPoolAddress, [
    'register_validator',
    'increase_self_stake',
    'delegate',
    'request_undelegate',
    'withdraw',
    'exit_validator',
  ]],
  [bridgeAdapterAddress, ['bridge_out_token', 'bridge_out_card']],
  [cardNftAddress, ['transfer', 'burn']],
]);

// Decode a V3 invoke's __execute__ calldata back into its call list so each
// call can be checked against the allowlist. Layout (Cairo v1 encoding):
// [call_count, (to, selector, data_len, ...data) * call_count].
function decodeExecuteCalls(calldata) {
  const felts = normalizeArray(calldata, 'calldata');
  if (felts.length < 1) throw new Error('CALLDATA_EMPTY');
  const callCount = Number(BigInt(felts[0]));
  if (!Number.isInteger(callCount) || callCount < 1 || callCount > 4) throw new Error('CALL_COUNT_NOT_ALLOWED');

  const calls = [];
  let cursor = 1;
  for (let i = 0; i < callCount; i += 1) {
    if (cursor + 2 >= felts.length) throw new Error('CALLDATA_TRUNCATED');
    const to = felts[cursor];
    const selector = felts[cursor + 1];
    const dataLen = Number(BigInt(felts[cursor + 2]));
    if (!Number.isInteger(dataLen) || dataLen < 0 || dataLen > 16) throw new Error('CALL_DATA_LEN_NOT_ALLOWED');
    cursor += 3;
    if (cursor + dataLen > felts.length) throw new Error('CALLDATA_TRUNCATED');
    calls.push({ to, selector, data: felts.slice(cursor, cursor + dataLen) });
    cursor += dataLen;
  }
  if (cursor !== felts.length) throw new Error('CALLDATA_TRAILING_BYTES');
  return calls;
}

function assertAllowedUserCalls(calls) {
  for (const call of calls) {
    const allowed = userEntrypoints.get(call.to);
    if (!allowed || allowed.length === 0) throw new Error('CONTRACT_NOT_ALLOWED');
    const permitted = allowed.some(
      (name) => normalizeHex(hash.getSelectorFromName(name), 'selector') === call.selector,
    );
    if (!permitted) throw new Error('ENTRYPOINT_NOT_ALLOWED');
  }
}

async function starknetCall(contractAddress, entrypoint, calldata = []) {
  const payload = await rpc('starknet_call', [
    {
      contract_address: normalizeHex(contractAddress, 'contract address'),
      entry_point_selector: hash.getSelectorFromName(entrypoint),
      calldata: calldata.map((value, index) => normalizeZeroableHex(value, `${entrypoint} calldata[${index}]`)),
    },
    'latest',
  ]);
  if (payload?.error) throw new Error(`STARKNET_CALL_${entrypoint.toUpperCase()}_FAILED`);
  if (!Array.isArray(payload?.result)) throw new Error(`STARKNET_CALL_${entrypoint.toUpperCase()}_INVALID`);
  return payload.result.map((value, index) => normalizeZeroableHex(value, `${entrypoint} result[${index}]`));
}

async function assertPinnedSupportContract(address, classHash, label) {
  const classResult = await rpc('starknet_getClassHashAt', ['latest', address]);
  if (classResult?.error) throw new Error(`RELAY_${label}_CLASS_UNAVAILABLE`);
  const actualClass = normalizeHex(classResult?.result, `${label} class hash`);
  if (actualClass !== classHash) throw new Error(`RELAY_${label}_CLASS_MISMATCH`);
  const ownerValues = await starknetCall(address, 'owner', []);
  const actualOwner = normalizeHex(ownerValues?.[0], `${label} owner`);
  if (actualOwner !== identityRegistryOwner) throw new Error(`RELAY_${label}_OWNER_MISMATCH`);
  return actualClass;
}

async function assertRelayReady() {
  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) return readinessCache.value;

  const [chainResult, accountClassResult, registryClassResult, ownerValues, verifierValues] = await Promise.all([
    rpc('starknet_chainId', []),
    rpc('starknet_getClass', ['latest', accountClassHash]),
    rpc('starknet_getClassHashAt', ['latest', identityRegistryAddress]),
    starknetCall(identityRegistryAddress, 'owner', []),
    starknetCall(identityRegistryAddress, 'is_verifier', [identityVerifierAddress]),
  ]);
  if (chainResult?.error) throw new Error('RELAY_UPSTREAM_CHAIN_ID_UNAVAILABLE');
  if (accountClassResult?.error || !accountClassResult?.result) throw new Error('RELAY_ACCOUNT_CLASS_UNAVAILABLE');
  if (registryClassResult?.error) throw new Error('RELAY_REGISTRY_CLASS_UNAVAILABLE');

  const actualChainId = normalizeHex(chainResult?.result, 'upstream chain id');
  const actualRegistryClass = normalizeHex(registryClassResult?.result, 'upstream registry class hash');
  const actualOwner = normalizeHex(ownerValues?.[0], 'upstream registry owner');
  if (actualChainId !== expectedChainId) throw new Error('RELAY_CHAIN_ID_MISMATCH');
  if (actualRegistryClass !== identityRegistryClassHash) throw new Error('RELAY_REGISTRY_CLASS_MISMATCH');
  if (actualOwner !== identityRegistryOwner) throw new Error('RELAY_REGISTRY_OWNER_MISMATCH');
  if (BigInt(verifierValues?.[0] || '0x0') !== 1n) throw new Error('RELAY_IDENTITY_VERIFIER_NOT_AUTHORISED');

  let verificationV2Required = false;
  let ecosystemReady = false;
  if (identityVerificationMode === 'v2') {
    const requiredValues = await starknetCall(identityRegistryAddress, 'verification_v2_required', []);
    if (requiredValues.length < 1) throw new Error('RELAY_VERIFICATION_V2_ABI_UNAVAILABLE');
    verificationV2Required = BigInt(requiredValues[0] || '0x0') === 1n;
    // Probe the additive ABI before accepting any V2 registration/attestation.
    await starknetCall(identityRegistryAddress, 'get_assurance', ['0x1']);

    await Promise.all([
      assertPinnedSupportContract(nativeTokenAddress, nativeTokenClassHash, 'NATIVE_TOKEN'),
      assertPinnedSupportContract(cardNftAddress, cardNftClassHash, 'CARD_NFT'),
      assertPinnedSupportContract(stakingPoolAddress, stakingPoolClassHash, 'STAKING_POOL'),
      assertPinnedSupportContract(usershipAddress, usershipClassHash, 'USERSHIP'),
      assertPinnedSupportContract(bridgeAdapterAddress, bridgeAdapterClassHash, 'BRIDGE_ADAPTER'),
    ]);

    const [stakingToken, stakingRegistry, stakingUsership, bridgeToken, bridgeCard, cardBridge, bridgeMinter] = await Promise.all([
      starknetCall(stakingPoolAddress, 'stake_token', []),
      starknetCall(stakingPoolAddress, 'identity_registry', []),
      starknetCall(stakingPoolAddress, 'usership', []),
      starknetCall(bridgeAdapterAddress, 'bridge_token', []),
      starknetCall(bridgeAdapterAddress, 'card_nft', []),
      starknetCall(cardNftAddress, 'bridge', []),
      starknetCall(nativeTokenAddress, 'is_minter', [bridgeAdapterAddress]),
    ]);
    if (normalizeZeroableHex(stakingToken?.[0] || '0x0', 'staking token') !== nativeTokenAddress) throw new Error('RELAY_STAKING_TOKEN_MISMATCH');
    if (normalizeZeroableHex(stakingRegistry?.[0] || '0x0', 'staking registry') !== identityRegistryAddress) throw new Error('RELAY_STAKING_REGISTRY_MISMATCH');
    if (normalizeZeroableHex(stakingUsership?.[0] || '0x0', 'staking usership') !== usershipAddress) throw new Error('RELAY_STAKING_USERSHIP_MISMATCH');
    if (normalizeZeroableHex(bridgeToken?.[0] || '0x0', 'bridge token') !== nativeTokenAddress) throw new Error('RELAY_BRIDGE_TOKEN_MISMATCH');
    if (normalizeZeroableHex(bridgeCard?.[0] || '0x0', 'bridge card') !== cardNftAddress) throw new Error('RELAY_BRIDGE_CARD_MISMATCH');
    if (normalizeZeroableHex(cardBridge?.[0] || '0x0', 'card bridge') !== bridgeAdapterAddress) throw new Error('RELAY_CARD_BRIDGE_MISMATCH');
    if (BigInt(bridgeMinter?.[0] || '0x0') !== 1n) throw new Error('RELAY_BRIDGE_MINTER_NOT_AUTHORISED');
    ecosystemReady = true;
  }

  const value = {
    ok: true,
    purpose: 'swappulse-testnet-provisioning-relay',
    chain_id: actualChainId,
    account_class_hash: accountClassHash,
    identity_registry_class_hash: actualRegistryClass,
    identity_registry_address: identityRegistryAddress,
    identity_registry_owner: actualOwner,
    identity_verifier_address: identityVerifierAddress,
    identity_verification_mode: identityVerificationMode,
    verification_v2_required: verificationV2Required,
    ecosystem_ready: ecosystemReady,
    native_token_address: nativeTokenAddress,
    native_token_class_hash: nativeTokenClassHash,
    card_nft_address: cardNftAddress,
    card_nft_class_hash: cardNftClassHash,
    staking_pool_address: stakingPoolAddress,
    staking_pool_class_hash: stakingPoolClassHash,
    usership_address: usershipAddress,
    usership_class_hash: usershipClassHash,
    bridge_adapter_address: bridgeAdapterAddress,
    bridge_adapter_class_hash: bridgeAdapterClassHash,
    recovery_controller: recoveryController,
    recovery_delay_seconds: recoveryDelaySeconds,
  };
  readinessCache = { value, expiresAt: now + readinessTtlMs };
  return value;
}

function parsePrivateVerification(body) {
  if (body?.verification == null) return null;
  const value = body.verification;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('VERIFICATION_BODY_INVALID');
  const verificationRoot = normalizeHex(value.verification_root, 'verification_root');
  const schemaHash = normalizeHex(value.schema_hash, 'schema_hash');
  const expiresAt = Number(value.expires_at ?? 0);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < 0) throw new Error('VERIFICATION_EXPIRY_INVALID');

  let verificationType = 0;
  let verificationLevel = 0;
  let attestationId = '0x0';
  if (identityVerificationMode === 'v2') {
    verificationType = Number(value.verification_type);
    verificationLevel = Number(value.verification_level);
    if (!Number.isInteger(verificationType) || verificationType < 1 || verificationType > 255) {
      throw new Error('VERIFICATION_TYPE_INVALID');
    }
    if (!Number.isInteger(verificationLevel) || verificationLevel < 1 || verificationLevel > 255) {
      throw new Error('VERIFICATION_LEVEL_INVALID');
    }
    attestationId = normalizeHex(value.attestation_id, 'attestation_id');
  }

  return { verificationRoot, schemaHash, expiresAt, verificationType, verificationLevel, attestationId };
}

function verificationMatches(values, expected, assuranceValues = null) {
  if (!expected || !Array.isArray(values) || values.length < 8) return false;
  const status = Number(BigInt(values[1] || '0x0'));
  const baseMatch = status === 1
    && normalizeZeroableHex(values[0] || '0x0', 'verification root') === expected.verificationRoot
    && normalizeZeroableHex(values[2] || '0x0', 'verification schema') === expected.schemaHash
    && normalizeZeroableHex(values[3] || '0x0', 'verification attester') === identityVerifierAddress
    && Number(BigInt(values[5] || '0x0')) === expected.expiresAt;
  if (!baseMatch || identityVerificationMode !== 'v2') return baseMatch;
  if (!Array.isArray(assuranceValues) || assuranceValues.length < 3) return false;
  return Number(BigInt(assuranceValues[0] || '0x0')) === expected.verificationType
    && Number(BigInt(assuranceValues[1] || '0x0')) === expected.verificationLevel
    && normalizeZeroableHex(assuranceValues[2] || '0x0', 'attestation id') === expected.attestationId;
}

async function readVerificationState(identityId) {
  const values = await starknetCall(identityRegistryAddress, 'get_verification', [identityId]);
  const assurance = identityVerificationMode === 'v2'
    ? await starknetCall(identityRegistryAddress, 'get_assurance', [identityId])
    : null;
  return { values, assurance };
}

async function assertVerification(identityId, expected) {
  if (!expected) return null;
  const state = await readVerificationState(identityId);
  if (!verificationMatches(state.values, expected, state.assurance)) throw new Error('VERIFICATION_FINAL_STATE_MISMATCH');
  return state;
}

async function writeVerification(identityId, verification) {
  const entrypoint = identityVerificationMode === 'v2' ? 'set_verification_v2' : 'set_verification';
  const calldata = identityVerificationMode === 'v2'
    ? [
      identityId,
      verification.verificationRoot,
      verification.schemaHash,
      String(verification.verificationType),
      String(verification.verificationLevel),
      String(verification.expiresAt),
      verification.attestationId,
    ]
    : [identityId, verification.verificationRoot, verification.schemaHash, String(verification.expiresAt)];
  const attested = await identityVerifier.execute({
    contractAddress: identityRegistryAddress,
    entrypoint,
    calldata,
  });
  await provider.waitForTransaction(attested.transaction_hash);
  await assertVerification(identityId, verification);
  return normalizeHex(attested.transaction_hash, 'verification transaction hash');
}

async function registerIdentity(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('REGISTRATION_BODY_REQUIRED');
  const identityId = normalizeHex(body.identity_id, 'identity_id');
  const publicKey = normalizeHex(body.public_key, 'public_key');
  const accountAddress = normalizeHex(body.account_address, 'account_address');
  const verification = parsePrivateVerification(body);
  const derivedAddress = normalizeHex(
    hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
    'derived account address',
  );
  if (derivedAddress !== accountAddress) throw new Error('REGISTRATION_ACCOUNT_DERIVATION_MISMATCH');

  const [accountClassResult, registryClassResult, ownerValues] = await Promise.all([
    rpc('starknet_getClassHashAt', ['latest', accountAddress]),
    rpc('starknet_getClassHashAt', ['latest', identityRegistryAddress]),
    starknetCall(identityRegistryAddress, 'owner', []),
  ]);
  if (accountClassResult?.error || normalizeHex(accountClassResult?.result, 'account class hash') !== accountClassHash) {
    throw new Error('REGISTRATION_ACCOUNT_CLASS_MISMATCH');
  }
  if (registryClassResult?.error || normalizeHex(registryClassResult?.result, 'registry class hash') !== identityRegistryClassHash) {
    throw new Error('REGISTRATION_REGISTRY_CLASS_MISMATCH');
  }
  if (!ownerValues[0] || normalizeHex(ownerValues[0], 'registry owner') !== identityRegistryOwner) {
    throw new Error('REGISTRATION_REGISTRY_OWNER_MISMATCH');
  }

  const identityValues = await starknetCall(identityRegistryAddress, 'get_identity', [identityId]);
  const existingAccount = normalizeZeroableHex(identityValues?.[0] || '0x0', 'existing account');
  const existingStatus = Number(BigInt(identityValues?.[1] || '0x0'));
  let registrationIdempotent = false;
  let verificationIdempotent = verification == null;
  let registrationTransactionHash = '';
  let verificationTransactionHash = '';

  if (existingStatus === 1) {
    if (existingAccount !== accountAddress) throw new Error('REGISTRATION_IDENTITY_ALREADY_BOUND');
    const reverseValues = await starknetCall(identityRegistryAddress, 'get_identity_by_account', [accountAddress]);
    if (normalizeZeroableHex(reverseValues?.[0] || '0x0', 'reverse identity') !== identityId) {
      throw new Error('REGISTRATION_REVERSE_MAPPING_MISMATCH');
    }
    registrationIdempotent = true;

    if (verification) {
      const currentVerification = await readVerificationState(identityId);
      verificationIdempotent = verificationMatches(
        currentVerification.values,
        verification,
        currentVerification.assurance,
      );
      if (!verificationIdempotent) {
        verificationTransactionHash = await writeVerification(identityId, verification);
      }
    }

    return {
      identity_id: identityId,
      account_address: accountAddress,
      transaction_hash: verificationTransactionHash,
      registration_transaction_hash: '',
      verification_transaction_hash: verificationTransactionHash,
      registration_idempotent: true,
      verification_idempotent: verificationIdempotent,
      idempotent: registrationIdempotent && verificationIdempotent,
    };
  }
  if (existingStatus !== 0) throw new Error('REGISTRATION_IDENTITY_NOT_AVAILABLE');

  const reverseValues = await starknetCall(identityRegistryAddress, 'get_identity_by_account', [accountAddress]);
  const reverseIdentity = normalizeZeroableHex(reverseValues?.[0] || '0x0', 'reverse identity');
  if (reverseIdentity !== '0x0') throw new Error('REGISTRATION_ACCOUNT_ALREADY_BOUND');

  const [controllerValues, delayValues] = await Promise.all([
    starknetCall(accountAddress, 'get_recovery_controller', []),
    starknetCall(accountAddress, 'get_recovery_delay', []),
  ]);
  if (normalizeZeroableHex(controllerValues?.[0] || '0x0', 'recovery controller') !== recoveryController) {
    throw new Error('REGISTRATION_RECOVERY_CONTROLLER_MISMATCH');
  }
  if (BigInt(normalizeZeroableHex(delayValues?.[0] || '0x0', 'recovery delay')) !== BigInt(recoveryDelaySeconds)) {
    throw new Error('REGISTRATION_RECOVERY_DELAY_MISMATCH');
  }

  const registered = await registryAdmin.execute({
    contractAddress: identityRegistryAddress,
    entrypoint: 'register_identity',
    calldata: [identityId, accountAddress],
  });
  await provider.waitForTransaction(registered.transaction_hash);
  registrationTransactionHash = normalizeHex(registered.transaction_hash, 'registration transaction hash');

  const [finalIdentity, finalReverse] = await Promise.all([
    starknetCall(identityRegistryAddress, 'get_identity', [identityId]),
    starknetCall(identityRegistryAddress, 'get_identity_by_account', [accountAddress]),
  ]);
  if (normalizeZeroableHex(finalIdentity?.[0] || '0x0', 'final account') !== accountAddress || Number(BigInt(finalIdentity?.[1] || '0x0')) !== 1) {
    throw new Error('REGISTRATION_FINAL_IDENTITY_MISMATCH');
  }
  if (normalizeZeroableHex(finalReverse?.[0] || '0x0', 'final reverse identity') !== identityId) {
    throw new Error('REGISTRATION_FINAL_REVERSE_MISMATCH');
  }
  if (verification) {
    verificationTransactionHash = await writeVerification(identityId, verification);
    verificationIdempotent = false;
  }

  return {
    identity_id: identityId,
    account_address: accountAddress,
    transaction_hash: registrationTransactionHash,
    registration_transaction_hash: registrationTransactionHash,
    verification_transaction_hash: verificationTransactionHash,
    registration_idempotent: false,
    verification_idempotent: verificationIdempotent,
    idempotent: false,
  };
}

async function requireVerificationV2(body) {
  if (identityVerificationMode !== 'v2') throw new Error('V2_CUTOVER_REQUIRES_RELAY_V2_MODE');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('V2_CUTOVER_BODY_REQUIRED');
  if (String(body.confirmation || '') !== 'REQUIRE_V2_FOREVER') throw new Error('V2_CUTOVER_CONFIRMATION_REQUIRED');

  // The switch is global and irreversible. After it has been written once, an
  // expired proof identity must not make a harmless retry fail. The proof below
  // is required only for the first transition from false to true.
  const current = await starknetCall(identityRegistryAddress, 'verification_v2_required', []);
  if (BigInt(current?.[0] || '0x0') === 1n) {
    return {
      transaction_hash: '',
      idempotent: true,
      verification_v2_required: true,
    };
  }

  const identityId = normalizeHex(body.identity_id, 'identity_id');
  const accountAddress = normalizeHex(body.account_address, 'account_address');
  const identityValues = await starknetCall(identityRegistryAddress, 'get_identity', [identityId]);
  if (normalizeZeroableHex(identityValues?.[0] || '0x0', 'identity account') !== accountAddress) throw new Error('V2_CUTOVER_IDENTITY_ACCOUNT_MISMATCH');
  if (Number(BigInt(identityValues?.[1] || '0x0')) !== 1) throw new Error('V2_CUTOVER_IDENTITY_NOT_ACTIVE');

  const verification = await starknetCall(identityRegistryAddress, 'get_verification', [identityId]);
  if (Number(BigInt(verification?.[1] || '0x0')) !== 1) throw new Error('V2_CUTOVER_VERIFICATION_NOT_ACTIVE');
  const assurance = await starknetCall(identityRegistryAddress, 'get_assurance', [identityId]);
  const verificationType = Number(BigInt(assurance?.[0] || '0x0'));
  const verificationLevel = Number(BigInt(assurance?.[1] || '0x0'));
  const attestationId = normalizeZeroableHex(assurance?.[2] || '0x0', 'attestation id');
  if (verificationType !== 1 || verificationLevel < 2 || attestationId === '0x0') {
    throw new Error('V2_CUTOVER_ASSURANCE_INSUFFICIENT');
  }
  const spentValues = await starknetCall(identityRegistryAddress, 'is_attestation_used', [attestationId]);
  if (BigInt(spentValues?.[0] || '0x0') !== 1n) throw new Error('V2_CUTOVER_ATTESTATION_NOT_SPENT');
  const verifiedValues = await starknetCall(identityRegistryAddress, 'is_verified', [identityId]);
  if (BigInt(verifiedValues?.[0] || '0x0') !== 1n) throw new Error('V2_CUTOVER_IDENTITY_NOT_VERIFIED');

  const validator = await starknetCall(stakingPoolAddress, 'get_validator', [accountAddress]);
  if (validator.length < 7) throw new Error('V2_CUTOVER_STAKING_STATE_UNREADABLE');
  if (normalizeZeroableHex(validator[0] || '0x0', 'validator account') !== accountAddress) throw new Error('V2_CUTOVER_STAKING_ACCOUNT_MISMATCH');
  if (normalizeZeroableHex(validator[1] || '0x0', 'validator identity') !== identityId) throw new Error('V2_CUTOVER_STAKING_IDENTITY_MISMATCH');
  const selfStake = BigInt(validator[2] || '0x0');
  const validatorStatus = Number(BigInt(validator[5] || '0x0'));
  const minimumValues = await starknetCall(stakingPoolAddress, 'min_self_stake', []);
  const minimumStake = BigInt(minimumValues?.[0] || '0x0');
  if (validatorStatus !== 1 || selfStake < minimumStake || minimumStake <= 0n) throw new Error('V2_CUTOVER_ACTIVE_STAKE_REQUIRED');

  const poolBalance = await starknetCall(nativeTokenAddress, 'balance_of', [stakingPoolAddress]);
  const poolBalanceU256 = BigInt(poolBalance?.[0] || '0x0') + (BigInt(poolBalance?.[1] || '0x0') << 128n);
  if (poolBalanceU256 < selfStake) throw new Error('V2_CUTOVER_SWPX_ESCROW_MISMATCH');

  const cutover = await registryAdmin.execute({
    contractAddress: identityRegistryAddress,
    entrypoint: 'require_verification_v2',
    calldata: [],
  });
  await provider.waitForTransaction(cutover.transaction_hash);
  readinessCache = null;
  const finalRequired = await starknetCall(identityRegistryAddress, 'verification_v2_required', []);
  if (BigInt(finalRequired?.[0] || '0x0') !== 1n) throw new Error('V2_CUTOVER_FINAL_STATE_MISMATCH');

  return {
    transaction_hash: normalizeHex(cutover.transaction_hash, 'V2 cutover transaction hash'),
    idempotent: false,
    verification_v2_required: true,
    identity_id: identityId,
    account_address: accountAddress,
    verification_type: verificationType,
    verification_level: verificationLevel,
    attestation_id: attestationId,
    self_stake: selfStake.toString(),
    min_self_stake: minimumStake.toString(),
  };
}

async function syncVerification(body, mode) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('VERIFICATION_SYNC_BODY_REQUIRED');
  const identityId = normalizeHex(body.identity_id, 'identity_id');
  const identityValues = await starknetCall(identityRegistryAddress, 'get_identity', [identityId]);
  if (Number(BigInt(identityValues?.[1] || '0x0')) !== 1) throw new Error('VERIFICATION_IDENTITY_NOT_ACTIVE');

  const current = await readVerificationState(identityId);
  const currentStatus = Number(BigInt(current.values?.[1] || '0x0'));

  if (mode === 'revoke') {
    if (currentStatus === 0 || currentStatus === 2) {
      return { identity_id: identityId, transaction_hash: '', idempotent: true, status: currentStatus === 2 ? 'REVOKED' : 'NONE' };
    }
    if (currentStatus !== 1) throw new Error('VERIFICATION_STATUS_INVALID');
    const revoked = await identityVerifier.execute({
      contractAddress: identityRegistryAddress,
      entrypoint: 'revoke_verification',
      calldata: [identityId],
    });
    await provider.waitForTransaction(revoked.transaction_hash);
    const finalState = await starknetCall(identityRegistryAddress, 'get_verification', [identityId]);
    if (Number(BigInt(finalState?.[1] || '0x0')) !== 2) throw new Error('VERIFICATION_REVOKE_FINAL_STATE_MISMATCH');
    return {
      identity_id: identityId,
      transaction_hash: normalizeHex(revoked.transaction_hash, 'verification revoke transaction hash'),
      idempotent: false,
      status: 'REVOKED',
    };
  }

  const verification = parsePrivateVerification(body);
  if (!verification) throw new Error('VERIFICATION_BODY_REQUIRED');
  if (verificationMatches(current.values, verification, current.assurance)) {
    return { identity_id: identityId, transaction_hash: '', idempotent: true, status: 'ACTIVE' };
  }

  const transactionHash = await writeVerification(identityId, verification);
  return {
    identity_id: identityId,
    transaction_hash: transactionHash,
    idempotent: false,
    status: 'ACTIVE',
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, purpose: 'swappulse-testnet-provisioning-relay' });
  }
  if (req.method === 'GET' && req.url === '/readyz') {
    if (!tokenMatches(req.headers.authorization)) return json(res, 401, { error: 'Unauthorized' });
    const ip = clientIp(req);
    if (!withinRateLimit(ip)) return json(res, 429, { error: 'Rate limit exceeded' });
    try {
      return json(res, 200, await assertRelayReady());
    } catch (error) {
      const code = String(error?.message || 'RELAY_NOT_READY').replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
      console.warn(`Provisioning relay readiness failed for ${ip}: ${code}`);
      return json(res, 503, { ok: false, error: 'Provisioning relay is not ready', code });
    }
  }
  if (req.method !== 'POST' || !['/rpc', '/register', '/verification-attest', '/verification-revoke', '/mint-card', '/submit-usership', '/faucet-drip', '/recovery-propose', '/recovery-execute', '/recovery-cancel', '/require-v2'].includes(req.url || '')) {
    return json(res, 404, { error: 'Not found' });
  }
  if (!tokenMatches(req.headers.authorization)) return json(res, 401, { error: 'Unauthorized' });

  const ip = clientIp(req);
  if (!withinRateLimit(ip)) return json(res, 429, { error: 'Rate limit exceeded' });

  try {
    await assertRelayReady();
    const payload = JSON.parse(await readBody(req));

    if (req.url === '/register') {
      if (registrationBusy) return json(res, 409, { error: 'Registration already in progress', code: 'REGISTRATION_BUSY' });
      registrationBusy = true;
      try {
        const result = await registerIdentity(payload);
        console.log(`register_identity accepted ${ip} ${result.identity_id} ${result.account_address} idempotent=${result.idempotent}`);
        return json(res, 200, { ok: true, ...result });
      } finally {
        registrationBusy = false;
      }
    }

    if (req.url === '/require-v2') {
      const result = await requireVerificationV2(payload);
      console.log(`require_verification_v2 accepted ${ip} ${result.identity_id} idempotent=${result.idempotent}`);
      return json(res, 200, { ok: true, ...result });
    }

    if (req.url === '/verification-attest' || req.url === '/verification-revoke') {
      const mode = req.url === '/verification-revoke' ? 'revoke' : 'attest';
      const result = await syncVerification(payload, mode);
      console.log(`verification_${mode} accepted ${ip} ${result.identity_id} idempotent=${result.idempotent}`);
      return json(res, 200, { ok: true, ...result });
    }

    if (req.url === '/mint-card') {
      const result = await mintCard(payload);
      console.log(`mint_card accepted ${ip} ${result.attestation_hash}`);
      return json(res, 200, { ok: true, ...result });
    }

    if (req.url === '/recovery-propose' || req.url === '/recovery-execute' || req.url === '/recovery-cancel') {
      const kind = req.url === '/recovery-propose' ? 'propose' : req.url === '/recovery-execute' ? 'execute' : 'cancel';
      const result = await recoveryAction(payload, kind);
      console.log(`recovery_${kind} accepted ${ip} ${result.transaction_hash}`);
      return json(res, 200, { ok: true, ...result });
    }

    if (req.url === '/faucet-drip') {
      const result = await faucetDrip(payload);
      console.log(`faucet_drip accepted ${ip} ${result.transaction_hash}`);
      return json(res, 200, { ok: true, ...result });
    }

    if (req.url === '/submit-usership') {
      const result = await submitUsership(payload);
      console.log(`submit_usership accepted ${ip}`);
      return json(res, 200, { ok: true, ...result });
    }

    if (Array.isArray(payload)) return json(res, 400, { error: 'JSON-RPC batch requests are disabled' });
    if (!payload || payload.jsonrpc !== '2.0' || typeof payload.method !== 'string') {
      return json(res, 400, { error: 'Invalid JSON-RPC request' });
    }

    let policy = {};
    if (payload.method === 'starknet_addDeployAccountTransaction') {
      const tx = extractTransaction(payload, 'deploy_account_transaction');
      policy = await validateDeploy(tx);
    } else if (payload.method === 'starknet_addInvokeTransaction') {
      const tx = extractTransaction(payload, 'invoke_transaction');
      policy = await validateRecoveryInvoke(tx);
    } else {
      return json(res, 403, {
        jsonrpc: '2.0',
        id: payload.id ?? null,
        error: { code: -32601, message: 'Method not exposed by SwapPulse provisioning relay' },
      });
    }

    const upstreamPayload = await rpc(payload.method, payload.params);
    if (upstreamPayload?.error) {
      return json(res, 200, { ...upstreamPayload, id: payload.id ?? upstreamPayload.id ?? null });
    }
    console.log(`${payload.method} accepted ${ip} ${JSON.stringify(policy)}`);
    return json(res, 200, { ...upstreamPayload, id: payload.id ?? upstreamPayload.id ?? null });
  } catch (error) {
    const code = String(error?.message || 'TX_RELAY_ERROR').replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
    const status = code === 'BODY_TOO_LARGE'
      ? 413
      : code.includes('COOLDOWN')
        ? 409
        : code.includes('NOT_ALLOWED') || code.includes('MUST_') || code.includes('ONLY_') || code.includes('WRONG_') || code.includes('MISMATCH') || code.includes('ALREADY_BOUND') || code.includes('NOT_AVAILABLE')
          ? 403
          : 400;
    console.warn(`Provisioning relay rejected request from ${clientIp(req)}: ${code}`);
    return json(res, status, { error: 'Provisioning request rejected', code });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SwapPulse provisioning transaction relay listening on :${port}`);
  console.log('Allowed write methods: starknet_addDeployAccountTransaction, starknet_addInvokeTransaction');
});