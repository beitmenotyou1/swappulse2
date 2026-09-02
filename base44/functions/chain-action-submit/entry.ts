import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { Point, Signature, verify as verifyStarkSignature } from 'npm:@scure/starknet@2.4.0';
import {
  ageEligible,
  buildAddSignerCalls,
  buildBridgeCalls,
  buildStakeCalls,
  canonicalV3Invoke,
  executeCalldata,
  feltArray,
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  relayRpc,
  sameFelts,
  validateInvokeShape,
  valueFeatureEligible,
  verifiedContractConfigured,
} from '../../shared/chainRelay.ts';
import { signingHashForTransaction, verifyChainDraftToken, type ChainDraftAction } from '../../shared/chainTxDraft.ts';

// Starknet accounts store only the public key's x-coordinate, so both possible
// curve points are rebuilt and the signature must verify against one of them.
function verifyDeviceSignature(signature: string[], signingHash: string, publicKey: string): boolean {
  if (signature.length !== 2) return false;
  const sig = new Signature(BigInt(signature[0]), BigInt(signature[1]));
  const x = normalizeHex(publicKey, 'signer public key').slice(2).padStart(64, '0');
  for (const prefix of ['02', '03']) {
    try {
      const fullPublicKey = Point.fromHex(`${prefix}${x}`).toBytes(false);
      if (verifyStarkSignature(sig, signingHash, fullPublicKey)) return true;
    } catch {
      // Wrong parity or invalid signature — try the other candidate point.
    }
  }
  return false;
}

async function activeIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
  const authoritative = ['REGISTERED', 'MERGED', 'RECOVERED'];
  return (rows || []).find((row: any) => authoritative.includes(String(row.status || ''))) || null;
}

export default async function (req: Request): Promise<Response> {
  let diagnosticStage = 'START';
  let diagnosticAction = '';
  let diagnosticRecordId = '';
  let diagnosticSvc: any = null;
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;
    diagnosticSvc = svc;
    if (!(await ageEligible(svc, me.id))) {
      return jsonError('Adult testnet eligibility is required', 403, 'AGE_ELIGIBILITY_REQUIRED');
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const recordId = String(body.record_id || '').trim();
    diagnosticAction = action;
    diagnosticRecordId = recordId;
    const draftToken = String(body.draft_token || '').trim();
    if (!['stake', 'bridge_out', 'add_signer'].includes(action)) return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');
    if (!draftToken) return jsonError('A current server-issued transaction draft is required', 400, 'DRAFT_TOKEN_REQUIRED');

    const identity = await activeIdentity(svc, me.id);
    if (!identity?.account_address || !identity?.signer_public_key) {
      return jsonError('A secured on-chain identity is required first', 409, 'IDENTITY_NOT_SECURED');
    }

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');

    const accountAddress = normalizeHex(identity.account_address, 'account address');
    const accountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
    const publicKey = normalizeHex(identity.signer_public_key, 'signer public key');
    if ((action === 'stake' || action === 'bridge_out') && !(await valueFeatureEligible(svc, me.id, identity, config))) {
      return jsonError(
        'A current private verifier assertion and ACTIVE on-chain attestation are required for value-bearing features',
        403,
        'VERIFIED_ELIGIBILITY_REQUIRED',
      );
    }

    diagnosticStage = 'TRANSACTION_SHAPE';
    const tx = body.transaction;
    validateInvokeShape(tx);
    if (normalizeHex(tx.sender_address, 'sender_address') !== accountAddress) {
      return jsonError('Transaction sender does not match your account', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    // Rebuild the expected calldata from what the SERVER stored at draft time.
    // The client's calldata is only accepted when it matches this exactly, so no
    // extra call can ride along inside a signed transaction.
    let expectedCalls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }> = [];
    let stakeRecord: any = null;
    let bridgeRecord: any = null;

    if (action === 'stake') {
      if (
        !verifiedContractConfigured(config, 'native_token')
        || !verifiedContractConfigured(config, 'staking_pool')
        || !verifiedContractConfigured(config, 'usership')
      ) {
        return jsonError('The staking contracts are not independently verified yet', 409, 'STAKING_ECOSYSTEM_NOT_VERIFIED');
      }
      const rows = await svc.entities.StakePosition.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      stakeRecord = rows?.[0];
      if (!stakeRecord || String(stakeRecord.user_id || '') !== String(me.id)) return jsonError('Stake draft not found', 404, 'STAKE_DRAFT_NOT_FOUND');
      if (stakeRecord.status !== 'DRAFTED') return jsonError('This staking draft has already been used', 409, 'DRAFT_ALREADY_USED');
      expectedCalls = buildStakeCalls(
        {
          kind: String(stakeRecord.intent_kind) as any,
          amount: String(stakeRecord.staked_amount || '0'),
          validatorAddress: stakeRecord.validator_address,
          chainIdentityId: stakeRecord.chain_identity_id,
          commissionBps: Number(stakeRecord.commission_bps || 0),
        },
        config,
      );
    } else if (action === 'bridge_out') {
      if (!verifiedContractConfigured(config, 'bridge_adapter') || !verifiedContractConfigured(config, 'native_token')) {
        return jsonError('The bridge contracts are not independently verified yet', 409, 'BRIDGE_ECOSYSTEM_NOT_VERIFIED');
      }
      const rows = await svc.entities.BridgeTransfer.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      bridgeRecord = rows?.[0];
      if (!bridgeRecord || String(bridgeRecord.user_id || '') !== String(me.id)) return jsonError('Bridge draft not found', 404, 'BRIDGE_DRAFT_NOT_FOUND');
      if (bridgeRecord.status !== 'DRAFTED') return jsonError('This bridge draft has already been used', 409, 'DRAFT_ALREADY_USED');
      if (String(bridgeRecord.asset_kind) === 'card' && !verifiedContractConfigured(config, 'card_nft')) {
        return jsonError('The card NFT contract is not independently verified yet', 409, 'CARD_NFT_NOT_VERIFIED');
      }
      expectedCalls = buildBridgeCalls(
        {
          assetKind: String(bridgeRecord.asset_kind) as any,
          externalChain: String(bridgeRecord.external_chain),
          amount: String(bridgeRecord.amount || '0'),
          cardTokenId: String(bridgeRecord.card_token_id || ''),
          recipientHash: String(bridgeRecord.recipient_hash),
        },
        config,
      );
    } else {
      if (recordId !== identity.id) return jsonError('Signer change does not match your identity', 409, 'IDENTITY_MISMATCH');
      expectedCalls = buildAddSignerCalls(accountAddress, String(body.signer_public_key || ''));
    }

    diagnosticStage = 'CALLDATA';
    const expectedCalldata = executeCalldata(expectedCalls);
    const actualCalldata = feltArray(tx.calldata, 'calldata');
    if (!sameFelts(actualCalldata, expectedCalldata)) {
      return jsonError('Only the drafted calls are allowed', 403, 'CALLDATA_MISMATCH');
    }

    diagnosticStage = 'SIGNING_HASH';
    const canonical = canonicalV3Invoke(tx, accountAddress, expectedCalldata);
    const signingHash = signingHashForTransaction(
      action as ChainDraftAction,
      canonical,
      String(config.chain_id),
      accountAddress,
      accountClassHash,
    );
    diagnosticStage = 'DRAFT_TOKEN';
    if (!(await verifyChainDraftToken(draftToken, me.id, recordId, action as ChainDraftAction, signingHash))) {
      return jsonError('Transaction draft is expired or does not match the signed transaction', 409, 'DRAFT_TOKEN_MISMATCH');
    }
    diagnosticStage = 'SIGNATURE';
    if (!verifyDeviceSignature(feltArray(tx.signature, 'signature'), signingHash, publicKey)) {
      return jsonError('Transaction signature does not match your device signer', 403, 'INVALID_STARK_SIGNATURE');
    }

    diagnosticStage = 'RELAY';
    const result = await relayRpc('starknet_addInvokeTransaction', { invoke_transaction: canonical });
    if (!result?.transaction_hash) return jsonError('Relay response did not include a transaction hash', 502, 'RELAY_TX_HASH_MISSING');
    const txHash = normalizeHex(result.transaction_hash, 'transaction hash');

    if (action === 'stake') {
      const unbonding = ['request_undelegate', 'exit_validator'].includes(String(stakeRecord.intent_kind));
      await svc.entities.StakePosition.update(recordId, {
        status: unbonding ? 'UNBONDING' : 'SUBMITTED',
        tx_hash: txHash,
        last_error: '',
      });
    } else if (action === 'bridge_out') {
      await svc.entities.BridgeTransfer.update(recordId, {
        status: 'PENDING_RELAY',
        source_tx_hash: txHash,
        last_error: '',
      });
      if (bridgeRecord.card_token_record_id) {
        await svc.entities.ChainCardToken.update(bridgeRecord.card_token_record_id, { status: 'BRIDGED_OUT' });
      }
    }

    return Response.json({ ok: true, action, record_id: recordId, transaction_hash: txHash });
  } catch (error: any) {
    const rawCode = String(error?.message || 'CHAIN_ACTION_SUBMIT_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 90);
    const code = `CHAIN_SUBMIT_${diagnosticStage}_${rawCode}`.slice(0, 120);
    console.error('chain-action-submit failed:', code);
    if (diagnosticAction === 'stake' && diagnosticRecordId && diagnosticSvc) {
      await diagnosticSvc.entities.StakePosition.update(diagnosticRecordId, {
        last_error: code,
      }).catch(() => undefined);
    }
    if (rawCode === 'INSUFFICIENT_FEE_BALANCE') {
      return jsonError(
        'Your smart account does not have enough STRK to cover the transaction fee ceiling',
        409,
        code,
      );
    }
    const clientError = rawCode.includes('NOT_CONFIGURED') || rawCode.includes('MUST_') || rawCode.includes('NOT_ALLOWED') || rawCode.includes('MISMATCH') || rawCode.includes('REQUIRED');
    return jsonError(clientError ? rawCode.replaceAll('_', ' ') : 'Signed transaction submission failed', clientError ? 409 : 502, code);
  }
}