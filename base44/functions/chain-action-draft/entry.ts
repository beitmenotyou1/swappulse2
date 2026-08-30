import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  ageEligible,
  buildAddSignerCalls,
  buildBridgeCalls,
  buildStakeCalls,
  CHAIN_CODES,
  executeCalldata,
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  publicRpc,
  recipientCommitment,
  valueFeatureEligible,
} from '../../shared/chainRelay.ts';
import { issueChainDraftToken, signingHashForTransaction, type ChainDraftAction } from '../../shared/chainTxDraft.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';

// The SwapPulse appchain charges collectors nothing: the sequencer fee policy
// sets a zero price for user transactions. These are fixed protective ceilings
// rather than RPC-derived estimates, so a hostile or misconfigured RPC cannot
// inflate what a collector's account is willing to pay.
const MAX_L1_GAS = 0x2000;
const MAX_L2_GAS = 0x4000000;
const MAX_L1_DATA_GAS = 0x2000;
const MAX_PRICE_PER_UNIT = 0x100000000;

function fixedResourceBounds() {
  return {
    l1_gas: { max_amount: `0x${MAX_L1_GAS.toString(16)}`, max_price_per_unit: `0x${MAX_PRICE_PER_UNIT.toString(16)}` },
    l2_gas: { max_amount: `0x${MAX_L2_GAS.toString(16)}`, max_price_per_unit: `0x${MAX_PRICE_PER_UNIT.toString(16)}` },
    l1_data_gas: { max_amount: `0x${MAX_L1_DATA_GAS.toString(16)}`, max_price_per_unit: `0x${MAX_PRICE_PER_UNIT.toString(16)}` },
  };
}

async function activeIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
  const authoritative = ['REGISTERED', 'MERGED', 'RECOVERED'];
  return (rows || []).find((row: any) => authoritative.includes(String(row.status || ''))) || null;
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;
    if (!(await ageEligible(svc, me.id))) {
      return jsonError('Adult testnet eligibility is required', 403, 'AGE_ELIGIBILITY_REQUIRED');
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    if (!['stake', 'bridge_out', 'add_signer'].includes(action)) {
      return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
    }

    const identity = await activeIdentity(svc, me.id);
    if (!identity?.account_address) {
      return jsonError('A secured on-chain identity is required first', 409, 'IDENTITY_NOT_SECURED');
    }

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');

    const accountAddress = normalizeHex(identity.account_address, 'account address');
    const accountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
    if ((action === 'stake' || action === 'bridge_out') && !(await valueFeatureEligible(svc, me.id, identity, config))) {
      return jsonError(
        'A current private verifier assertion and ACTIVE on-chain attestation are required for value-bearing features',
        403,
        'VERIFIED_ELIGIBILITY_REQUIRED',
      );
    }

    let calls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }> = [];
    let recordId = '';

    if (action === 'stake') {
      const kind = String(body.kind || '').trim();
      const allowed = ['register_validator', 'increase_self_stake', 'delegate', 'request_undelegate', 'withdraw', 'exit_validator'];
      if (!allowed.includes(kind)) return jsonError('Unsupported staking action', 400, 'UNSUPPORTED_STAKE_KIND');

      const isValidatorAction = ['register_validator', 'increase_self_stake', 'exit_validator'].includes(kind);
      const validatorAddress = isValidatorAction ? accountAddress : String(body.validator_address || '');
      const intent = {
        kind: kind as any,
        amount: body.amount === undefined ? undefined : String(body.amount),
        validatorAddress,
        chainIdentityId: identity.chain_identity_id,
        commissionBps: body.commission_bps === undefined ? 0 : Number(body.commission_bps),
      };
      calls = buildStakeCalls(intent, config);

      const created = await svc.entities.StakePosition.create({
        did: String(me.did || ''),
        network: 'SWAPPULSE_TESTNET',
        role: isValidatorAction ? 'validator' : 'delegator',
        account_address: accountAddress,
        validator_address: normalizeHex(validatorAddress, 'validator address'),
        chain_identity_id: String(identity.chain_identity_id || ''),
        staked_amount: intent.amount ? String(intent.amount) : '0',
        commission_bps: Number(intent.commissionBps || 0),
        // The intent is persisted so submit rebuilds calldata server-side.
        intent_kind: kind,
        status: 'DRAFTED',
      });
      recordId = created.id;
    } else if (action === 'bridge_out') {
      const assetKind = String(body.asset_kind || '').trim();
      const externalChain = String(body.external_chain || '').trim();
      const recipient = String(body.recipient_address || '').trim();
      if (!['token', 'card'].includes(assetKind)) return jsonError('Unsupported asset kind', 400, 'UNSUPPORTED_ASSET_KIND');
      if (!CHAIN_CODES[externalChain]) return jsonError('Unsupported destination chain', 400, 'UNSUPPORTED_CHAIN');
      if (recipient.length < 8 || recipient.length > 120) return jsonError('A destination recipient address is required', 400, 'RECIPIENT_REQUIRED');

      let cardTokenId = '';
      let cardRecordId = '';
      if (assetKind === 'card') {
        const tokenRows = await svc.entities.ChainCardToken.filter({ id: String(body.card_token_record_id || '') }, '-created_date', 1).catch(() => []);
        const token = tokenRows?.[0];
        if (!token || String(token.created_by_id) !== String(me.id)) return jsonError('Card token not found', 404, 'CARD_TOKEN_NOT_FOUND');
        if (token.status !== 'MINTED') return jsonError('Only a confirmed minted card can be bridged', 409, 'CARD_NOT_MINTED');
        cardTokenId = String(token.token_id || '');
        cardRecordId = token.id;
      }

      const recipientHash = await recipientCommitment(externalChain, recipient);
      calls = buildBridgeCalls(
        {
          assetKind: assetKind as any,
          externalChain,
          amount: body.amount === undefined ? undefined : String(body.amount),
          cardTokenId,
          recipientHash,
        },
        config,
      );

      const created = await svc.entities.BridgeTransfer.create({
        did: String(me.did || ''),
        network: 'SWAPPULSE_TESTNET',
        direction: 'outbound',
        asset_kind: assetKind,
        external_chain: externalChain,
        chain_code: CHAIN_CODES[externalChain],
        sender_address: accountAddress,
        recipient_address: recipient,
        recipient_hash: recipientHash,
        amount: assetKind === 'token' ? String(body.amount || '0') : '0',
        card_token_id: cardTokenId,
        card_token_record_id: cardRecordId,
        status: 'DRAFTED',
      });
      recordId = created.id;
    } else {
      // Adding a seed-phrase-derived signer is a key-management change, so it
      // requires a fresh MFA step-up token in addition to the session.
      const stepUpToken = String(body.step_up_token || '').trim();
      if (!stepUpToken) return jsonError('Security verification is required to add a signer', 403, 'STEP_UP_REQUIRED');
      const stepUp = await verifyActionToken(stepUpToken, 'swappulse-security-stepup', me.id).catch(() => ({ valid: false }));
      if (!stepUp?.valid) return jsonError('Security verification expired — verify again', 403, 'STEP_UP_INVALID');

      calls = buildAddSignerCalls(accountAddress, String(body.signer_public_key || ''));
      recordId = identity.id;
    }

    const nonce = await publicRpc(String(config.rpc_url), 'starknet_getNonce', ['latest', accountAddress]);
    const calldata = executeCalldata(calls);
    const draftTx = {
      type: 'INVOKE',
      version: '0x3',
      nonce: String(nonce || '0x0'),
      sender_address: accountAddress,
      calldata,
      account_deployment_data: [] as string[],
      resource_bounds: fixedResourceBounds(),
      tip: '0x0',
      paymaster_data: [] as string[],
      nonce_data_availability_mode: 'L1',
      fee_data_availability_mode: 'L1',
    };

    const signingHash = signingHashForTransaction(
      action as ChainDraftAction,
      draftTx,
      String(config.chain_id),
      accountAddress,
      accountClassHash,
    );
    const draftToken = await issueChainDraftToken(me.id, recordId, action as ChainDraftAction, signingHash);

    return Response.json({
      ok: true,
      action,
      record_id: recordId,
      account_address: accountAddress,
      transaction: draftTx,
      signing_hash: signingHash,
      draft_token: draftToken,
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_ACTION_DRAFT_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-action-draft failed:', code);
    const clientError = code.includes('REQUIRED') || code.includes('NOT_ALLOWED') || code.includes('NOT_SUPPORTED') || code.includes('MISMATCH');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Could not prepare the transaction', clientError ? 409 : 502, code);
  }
}