import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, Clock3, Coins, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import useChainAction from '@/hooks/useChainAction';
import { shortHex } from '@/lib/chainIdentityDisplay';

// User-facing language deliberately says "community operator". The current
// SwapPulse testnet is a single Starknet Devnet runtime, so staking currently
// bonds operators to accountable service duties rather than consensus validation.
// Legacy validator names remain only where the Cairo ABI requires them.
const DECIMALS = 18n;

function toBaseUnits(input) {
  const raw = String(input || '').trim();
  if (!/^\d+(\.\d{1,18})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const padded = (fraction + '0'.repeat(18)).slice(0, 18);
  const value = BigInt(whole) * 10n ** DECIMALS + BigInt(padded || '0');
  return value > 0n ? value.toString() : null;
}

function toDisplay(baseUnits) {
  try {
    const value = BigInt(String(baseUnits || '0'));
    const whole = value / 10n ** DECIMALS;
    const fraction = (value % 10n ** DECIMALS).toString().padStart(18, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction.slice(0, 4)}` : String(whole);
  } catch {
    return '0';
  }
}

function commissionToBps(input) {
  const raw = String(input || '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const bps = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return Number.isInteger(bps) && bps >= 0 && bps <= 3000 ? bps : null;
}

function periodLabel(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '';
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(1, Math.ceil(total / 60))}m`;
}

function unlockLabel(iso) {
  const at = Date.parse(String(iso || ''));
  if (!Number.isFinite(at)) return '';
  if (at <= Date.now()) return 'Ready to withdraw';
  return `Unlocks ${new Date(at).toLocaleString()}`;
}

function statusLabel(status) {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'EXITING') return 'Exiting';
  if (status === 'SLASHED') return 'Slashed';
  return status || 'None';
}

export default function StakingPanel({ identitySecured, valueFeaturesReady }) {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('delegate');
  const [validator, setValidator] = useState('');
  const [commissionPct, setCommissionPct] = useState('5');
  const [chainOperator, setChainOperator] = useState(null);
  const [chainDelegations, setChainDelegations] = useState([]);
  const [stakePolicy, setStakePolicy] = useState(null);
  const [chainOperatorKnown, setChainOperatorKnown] = useState(false);
  const [unstakeAmounts, setUnstakeAmounts] = useState({});
  const [confirmExit, setConfirmExit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [positionsResult, operatorResult] = await Promise.allSettled([
        base44.entities.StakePosition.filter({ user_id: user?.id, network: 'SWAPPULSE_TESTNET' }, '-created_date', 40),
        base44.functions.invoke('chain-staking-status', {}),
      ]);

      if (positionsResult.status === 'fulfilled') {
        setPositions((positionsResult.value || []).filter((row) => row.status !== 'DRAFTED'));
      } else {
        setPositions([]);
      }

      if (operatorResult.status === 'fulfilled') {
        const data = operatorResult.value?.data || operatorResult.value || {};
        setChainOperator(data?.operator || null);
        setChainDelegations(Array.isArray(data?.delegations) ? data.delegations : []);
        setStakePolicy(data?.policy || null);
        setChainOperatorKnown(Boolean(data?.chain_authoritative));
      } else {
        setChainOperator(null);
        setChainDelegations([]);
        setStakePolicy(null);
        setChainOperatorKnown(false);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const { busy, step, run } = useChainAction({ userId: user?.id, onDone: load });
  const mirroredActiveOperator = positions.find((position) =>
    position.role === 'validator' && position.status === 'ACTIVE'
  ) || null;
  const mirroredPendingOperator = positions.find((position) =>
    position.role === 'validator' && ['SUBMITTED', 'UNBONDING'].includes(position.status)
  ) || null;
  const pendingExitSubmission = positions.find((position) =>
    position.role === 'validator'
    && position.intent_kind === 'exit_validator'
    && ['SUBMITTED', 'UNBONDING'].includes(position.status)
    && !position.last_synced_at
  ) || null;
  const chainOperatorStatus = Number(chainOperator?.status_code || 0);
  const activeOperator = chainOperatorKnown
    ? chainOperatorStatus === 1 && !pendingExitSubmission
      ? {
          ...(mirroredActiveOperator || {}),
          id: mirroredActiveOperator?.id || 'chain-authoritative-operator',
          role: 'validator',
          status: 'ACTIVE',
          staked_amount: String(chainOperator?.self_stake || '0'),
          commission_bps: Number(chainOperator?.commission_bps || 0),
        }
      : null
    : mirroredActiveOperator;
  const pendingOperator = pendingExitSubmission
    ? pendingExitSubmission
    : chainOperatorKnown
      ? chainOperatorStatus === 2
        ? { id: 'chain-authoritative-exiting', role: 'validator', status: 'UNBONDING' }
        : chainOperatorStatus === 0
          ? mirroredPendingOperator
          : null
      : mirroredPendingOperator;
  const blockedOperator = chainOperatorKnown && chainOperatorStatus === 3;
  const selfWithdrawal = chainOperator?.self_withdrawal || null;
  const increasingOperatorStake = mode === 'validator' && Boolean(activeOperator);
  const minimumSelfStake = String(stakePolicy?.min_self_stake || '0');
  const unbondingPeriod = periodLabel(stakePolicy?.unbonding_period_seconds);

  const submit = async () => {
    const base = toBaseUnits(amount);
    if (!base) return;
    const commissionBps = commissionToBps(commissionPct);
    if (mode === 'validator' && !activeOperator && commissionBps === null) return;
    if (mode === 'validator' && (pendingOperator || blockedOperator) && !activeOperator) return;
    const params = mode === 'validator'
      ? activeOperator
        ? { kind: 'increase_self_stake', amount: base }
        : { kind: 'register_validator', amount: base, commission_bps: commissionBps }
      : { kind: 'delegate', amount: base, validator_address: validator.trim() };

    const result = await run('stake', params, {
      preparing: 'Preparing your stake…',
      signing: 'Confirming on this device…',
      submitting: 'Adding your stake to the network…',
      success: mode === 'validator'
        ? increasingOperatorStake ? 'Operator self-stake submitted' : 'Operator registration submitted'
        : 'Delegation submitted',
      successDescription: 'Your transaction was submitted. The public chain remains the source of truth while the local activity record reconciles.',
      failure: 'Stake not completed',
    });
    if (result) {
      setAmount('');
      setValidator('');
    }
  };

  const requestUndelegate = async (validatorAddress) => {
    const base = toBaseUnits(unstakeAmounts[validatorAddress]);
    if (!base) return;
    const result = await run('stake', {
      kind: 'request_undelegate',
      amount: base,
      validator_address: validatorAddress,
    }, {
      preparing: 'Preparing unstaking…',
      signing: 'Confirming on this device…',
      submitting: 'Starting the on-chain unbonding period…',
      success: 'Unstaking submitted',
      successDescription: 'The requested stake leaves active security weight immediately and remains locked until the on-chain unbonding period ends.',
      failure: 'Unstaking not completed',
    });
    if (result) setUnstakeAmounts((current) => ({ ...current, [validatorAddress]: '' }));
  };

  const withdraw = async (validatorAddress) => {
    await run('stake', {
      kind: 'withdraw',
      validator_address: validatorAddress,
    }, {
      preparing: 'Preparing withdrawal…',
      signing: 'Confirming on this device…',
      submitting: 'Withdrawing unlocked SWPX…',
      success: 'Withdrawal submitted',
      successDescription: 'The unlocked SWPX will return to your smart account once the transaction is confirmed.',
      failure: 'Withdrawal not completed',
    });
  };

  const exitOperator = async () => {
    const result = await run('stake', { kind: 'exit_validator' }, {
      preparing: 'Preparing operator exit…',
      signing: 'Confirming on this device…',
      submitting: 'Starting the operator exit…',
      success: 'Operator exit submitted',
      successDescription: 'Your self-stake begins the on-chain unbonding period. It remains slashable until that period completes.',
      failure: 'Operator exit not completed',
    });
    if (result) setConfirmExit(false);
  };

  const canSubmit = !busy
    && Boolean(toBaseUnits(amount))
    && (mode === 'validator'
      ? activeOperator
        ? true
        : !pendingOperator && !blockedOperator && commissionToBps(commissionPct) !== null
      : validator.trim().length > 3);

  const hasChainStake = Boolean(
    chainOperatorKnown && (
      chainOperatorStatus !== 0
      || BigInt(String(selfWithdrawal?.pending_withdrawal || '0')) > 0n
      || chainDelegations.length > 0
    )
  );

  const renderReadOnlyStake = () => {
    if (loading) {
      return <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading on-chain stake…</div>;
    }
    if (chainOperatorKnown) {
      if (!hasChainStake) return <p className="mt-1 text-xs text-muted-foreground">You have no stake currently recorded on-chain.</p>;
      return (
        <div className="mt-2 space-y-2">
          {chainOperatorStatus !== 0 && (
            <div className="rounded-lg bg-background/70 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-foreground">Community operator · {statusLabel(chainOperator?.status)}</span>
                <span className="font-mono font-semibold text-foreground">{toDisplay(chainOperator?.self_stake)} SWPX</span>
              </div>
              {BigInt(String(selfWithdrawal?.pending_withdrawal || '0')) > 0n && (
                <p className="mt-1 text-muted-foreground">{toDisplay(selfWithdrawal.pending_withdrawal)} SWPX unbonding · {unlockLabel(selfWithdrawal.unlock_at_iso)}</p>
              )}
            </div>
          )}
          {chainDelegations.map((delegation) => (
            <div key={delegation.validator_address} className="rounded-lg bg-background/70 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-foreground">Delegation · {shortHex(delegation.validator_address)}</span>
                <span className="font-mono font-semibold text-foreground">{toDisplay(delegation.amount)} SWPX</span>
              </div>
              {BigInt(String(delegation.pending_withdrawal || '0')) > 0n && (
                <p className="mt-1 text-muted-foreground">{toDisplay(delegation.pending_withdrawal)} SWPX unbonding · {unlockLabel(delegation.unlock_at_iso)}</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (positions.length === 0) return <p className="mt-1 text-xs text-muted-foreground">You have no existing stake.</p>;
    return (
      <ul className="mt-2 space-y-2">
        {positions.slice(0, 8).map((position) => (
          <li key={position.id} className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2 text-xs">
            <span className="min-w-0"><span className="font-semibold capitalize text-foreground">{position.role}</span><span className="ml-2 text-muted-foreground">{position.status.toLowerCase()}</span></span>
            <span className="font-mono font-semibold text-foreground">{toDisplay(position.staked_amount)} SWPX</span>
          </li>
        ))}
      </ul>
    );
  };

  if (!identitySecured) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        <p className="text-sm font-bold text-foreground">Community staking</p>
        <p className="mt-1">Secure your on-chain identity first to stake with a SwapPulse community operator.</p>
      </div>
    );
  }

  if (!valueFeaturesReady) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-bold text-foreground">Community staking locked</p>
            <p className="mt-1">
              New staking actions require a current private verifier assertion plus an ACTIVE Type 1, Level 2 on-chain attestation. Your permanent identity and existing stake remain intact while verification is expired or revoked.
            </p>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-bold text-foreground">Current on-chain stake</p>
          {renderReadOnlyStake()}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary"><ShieldCheck className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Back community operators</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Stake to run an operator, or back one you trust. On this testnet the bond backs accountable network services; it is not a decentralised consensus validator set.
          </p>
          {(minimumSelfStake !== '0' || unbondingPeriod) && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {minimumSelfStake !== '0' ? `Operator minimum: ${toDisplay(minimumSelfStake)} SWPX.` : ''}
              {minimumSelfStake !== '0' && unbondingPeriod ? ' ' : ''}
              {unbondingPeriod ? `Unbonding period: ${unbondingPeriod}.` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setMode('delegate')} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${mode === 'delegate' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
          Back an operator
        </button>
        <button type="button" onClick={() => setMode('validator')} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${mode === 'validator' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
          Run an operator
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {mode === 'delegate' ? (
          <div>
            <label htmlFor="swappulse-validator" className="text-xs font-semibold">Operator address</label>
            <input id="swappulse-validator" value={validator} onChange={(e) => setValidator(e.target.value)} placeholder="0x…" spellCheck={false} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary" />
          </div>
        ) : activeOperator ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <p className="font-semibold text-foreground">You already run a community operator.</p>
            <p className="mt-1 text-muted-foreground">New stake increases your existing self-stake. Your commission remains {Number(activeOperator.commission_bps || 0) / 100}%.</p>
          </div>
        ) : pendingOperator ? (
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
            <p className="font-semibold text-foreground">Operator exit in progress</p>
            <p className="mt-1 text-muted-foreground">A second registration is blocked while the on-chain operator is exiting.</p>
          </div>
        ) : blockedOperator ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <p className="font-semibold text-destructive">Operator registration unavailable</p>
            <p className="mt-1 text-muted-foreground">The staking pool reports this smart account as slashed. The current contract does not allow another operator registration for it.</p>
          </div>
        ) : (
          <div>
            <label htmlFor="swappulse-operator-commission" className="text-xs font-semibold">Operator commission (%)</label>
            <input id="swappulse-operator-commission" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} placeholder="5.00" inputMode="decimal" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            <p className="mt-1 text-[11px] text-muted-foreground">Stored on-chain at registration. Choose 0–30%; the default is 5%.</p>
          </div>
        )}
        <div>
          <label htmlFor="swappulse-stake-amount" className="text-xs font-semibold">{increasingOperatorStake ? 'Additional self-stake' : mode === 'validator' ? 'Self-stake amount' : 'Delegation amount'}</label>
          <input id="swappulse-stake-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
      </div>

      <button type="button" onClick={submit} disabled={!canSubmit} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
        {busy ? 'Working…' : mode === 'validator' ? activeOperator ? 'Increase operator self-stake' : pendingOperator ? 'Operator exit pending' : blockedOperator ? 'Operator unavailable' : 'Stake and run an operator' : 'Stake to this operator'}
      </button>
      {busy && step && <p className="mt-2 text-center text-xs font-medium text-primary" role="status" aria-live="polite">{step}</p>}

      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold">Your on-chain stake</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Balances and lifecycle state below are read from the verified public RPC.</p>
          </div>
          {!chainOperatorKnown && !loading && <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-bold uppercase text-warning">Mirror fallback</span>}
        </div>

        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading staking pool…</div>
        ) : chainOperatorKnown ? (
          <div className="mt-3 space-y-3">
            {chainOperatorStatus !== 0 && (
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">Your community operator</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Status: {statusLabel(chainOperator?.status)} · Commission {Number(chainOperator?.commission_bps || 0) / 100}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold">{toDisplay(chainOperator?.self_stake)} SWPX</p>
                    <p className="text-[10px] text-muted-foreground">self-stake</p>
                  </div>
                </div>
                {BigInt(String(chainOperator?.delegated_stake || '0')) > 0n && (
                  <p className="mt-2 text-xs text-muted-foreground">Delegators currently back this operator with {toDisplay(chainOperator.delegated_stake)} SWPX.</p>
                )}

                {chainOperatorStatus === 1 && !confirmExit && (
                  <button type="button" onClick={() => setConfirmExit(true)} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50">
                    <LogOut className="h-3.5 w-3.5" /> Exit operator
                  </button>
                )}
                {chainOperatorStatus === 1 && confirmExit && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-bold text-destructive">Confirm operator exit</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Your self-stake stops contributing to active security weight and starts the on-chain unbonding period. It remains slashable during that delay.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={exitOperator} disabled={busy} className="rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50">Confirm exit</button>
                      <button type="button" onClick={() => setConfirmExit(false)} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">Keep operator</button>
                    </div>
                  </div>
                )}

                {BigInt(String(selfWithdrawal?.pending_withdrawal || '0')) > 0n && (
                  <div className="mt-3 rounded-lg border border-border bg-background/70 p-3">
                    <div className="flex items-start gap-2">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{toDisplay(selfWithdrawal.pending_withdrawal)} SWPX unbonding</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{unlockLabel(selfWithdrawal.unlock_at_iso)}</p>
                      </div>
                      {selfWithdrawal.can_withdraw && (
                        <button type="button" onClick={() => withdraw(chainOperator.account_address)} disabled={busy} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50">
                          <ArrowDownToLine className="h-3.5 w-3.5" /> Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {chainDelegations.map((delegation) => {
              const activeAmount = BigInt(String(delegation.amount || '0'));
              const pendingAmount = BigInt(String(delegation.pending_withdrawal || '0'));
              const entered = unstakeAmounts[delegation.validator_address] || '';
              const requestedBase = toBaseUnits(entered);
              const localLifecyclePending = positions.some((position) =>
                position.validator_address === delegation.validator_address
                && ['request_undelegate', 'withdraw'].includes(position.intent_kind)
                && ['SUBMITTED', 'UNBONDING'].includes(position.status)
                && !position.last_synced_at
              );
              const canRequest = delegation.can_request_undelegate
                && !localLifecyclePending
                && requestedBase
                && BigInt(requestedBase) <= activeAmount;
              return (
                <div key={delegation.validator_address} className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold">Delegation</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" title={delegation.validator_address}>{shortHex(delegation.validator_address)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold">{toDisplay(delegation.amount)} SWPX</p>
                      <p className="text-[10px] text-muted-foreground">actively delegated</p>
                    </div>
                  </div>

                  {activeAmount > 0n && pendingAmount === 0n && (
                    <div className="mt-3">
                      {localLifecyclePending && <p className="mb-2 text-[11px] text-warning">A staking lifecycle transaction for this operator is waiting for chain confirmation.</p>}
                      <div className="flex gap-2">
                      <input value={entered} onChange={(e) => setUnstakeAmounts((current) => ({ ...current, [delegation.validator_address]: e.target.value }))} placeholder="Amount to unstake" inputMode="decimal" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary" aria-label={`Amount to unstake from ${delegation.validator_address}`} />
                      <button type="button" onClick={() => requestUndelegate(delegation.validator_address)} disabled={busy || !canRequest} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50">Start unstaking</button>
                      </div>
                    </div>
                  )}

                  {pendingAmount > 0n && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-background/70 p-3">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{toDisplay(delegation.pending_withdrawal)} SWPX unbonding</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{unlockLabel(delegation.unlock_at_iso)}</p>
                      </div>
                      {delegation.can_withdraw && (
                        <button type="button" onClick={() => withdraw(delegation.validator_address)} disabled={busy} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50">
                          <ArrowDownToLine className="h-3.5 w-3.5" /> Withdraw
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!hasChainStake && <p className="text-xs text-muted-foreground">You have no stake currently recorded on-chain.</p>}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-xs text-warning">The public staking read is temporarily unavailable. Transaction drafts still perform independent server-side chain checks.</p>
            {renderReadOnlyStake()}
          </div>
        )}
      </div>

      {positions.length > 0 && (
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Recent staking activity</summary>
          <ul className="mt-2 space-y-2">
            {positions.slice(0, 10).map((position) => (
              <li key={position.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                <span className="min-w-0"><span className="font-semibold capitalize">{String(position.intent_kind || position.role || '').replaceAll('_', ' ')}</span><span className="ml-2 text-muted-foreground">{String(position.status || '').toLowerCase()}</span></span>
                {BigInt(String(position.staked_amount || '0')) > 0n && <span className="font-mono font-semibold">{toDisplay(position.staked_amount)} SWPX</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
