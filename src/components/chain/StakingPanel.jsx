import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, Clock3, Coins, Loader2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import useChainAction from '@/hooks/useChainAction';

// User-facing language deliberately says "community operator". The current
// SwapPulse testnet is a single Starknet Devnet runtime, so staking currently
// bonds operators to accountable service duties rather than consensus validation.
// The legacy `validator` variable/action names are kept only for ABI compatibility.
// Raw amounts stay in base units server-side; collectors enter whole tokens.
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

function shortHex(value) {
  const raw = String(value || '');
  if (raw.length < 20) return raw || '—';
  return `${raw.slice(0, 10)}…${raw.slice(-8)}`;
}

function remainingFromUnix(unixSeconds, nowMs) {
  const at = Number(unixSeconds || 0) * 1000;
  if (!Number.isFinite(at) || at <= 0) return '';
  const ms = at - nowMs;
  if (ms <= 0) return 'Ready now';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
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
  const [poolPolicy, setPoolPolicy] = useState(null);
  const [chainOperatorKnown, setChainOperatorKnown] = useState(false);
  const [unstakeAmounts, setUnstakeAmounts] = useState({});
  const [confirmExit, setConfirmExit] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [positionsResult, operatorResult] = await Promise.allSettled([
        base44.entities.StakePosition.filter({ user_id: user?.id, network: 'SWAPPULSE_TESTNET' }, '-created_date', 50),
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
        setPoolPolicy(data?.policy || null);
        setChainOperatorKnown(Boolean(data?.chain_authoritative));
      } else {
        setChainOperator(null);
        setChainDelegations([]);
        setPoolPolicy(null);
        setChainOperatorKnown(false);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const { busy, step, run } = useChainAction({ userId: user?.id, onDone: load });
  const mirroredActiveOperator = positions.find((position) =>
    position.role === 'validator' && position.status === 'ACTIVE'
  ) || null;
  const mirroredPendingOperator = positions.find((position) =>
    position.role === 'validator' && ['SUBMITTED', 'UNBONDING'].includes(position.status)
  ) || null;
  const chainOperatorStatus = Number(chainOperator?.status_code || 0);
  const activeOperator = chainOperatorKnown
    ? chainOperatorStatus === 1
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
  const pendingOperator = chainOperatorKnown
    ? chainOperatorStatus === 2
      ? { id: 'chain-authoritative-exiting', role: 'validator', status: 'UNBONDING' }
      : chainOperatorStatus === 0
        ? mirroredPendingOperator
        : null
    : mirroredPendingOperator;
  const blockedOperator = chainOperatorKnown && chainOperatorStatus === 3;
  const increasingOperatorStake = mode === 'validator' && Boolean(activeOperator);

  const chainStakeTotal = useMemo(() => {
    try {
      let total = BigInt(chainOperator?.self_stake || '0');
      for (const delegation of chainDelegations) total += BigInt(delegation.amount || '0');
      return total.toString();
    } catch {
      return '0';
    }
  }, [chainOperator, chainDelegations]);

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

    const ok = await run('stake', params, {
      preparing: 'Preparing your stake…',
      signing: 'Confirming on this device…',
      submitting: 'Adding your stake to the network…',
      success: mode === 'validator'
        ? increasingOperatorStake ? 'Operator self-stake submitted' : 'Operator registration submitted'
        : 'Delegation submitted',
      successDescription: 'Your stake backs accountable community services on the SwapPulse testnet.',
      failure: 'Stake not completed',
    });
    if (ok) {
      setAmount('');
      setValidator('');
    }
  };

  const requestUndelegate = async (delegation) => {
    const input = unstakeAmounts[delegation.validator_address] || '';
    const base = toBaseUnits(input);
    if (!base) return;
    try {
      if (BigInt(base) > BigInt(delegation.amount || '0')) return;
    } catch { return; }
    const ok = await run('stake', {
      kind: 'request_undelegate',
      amount: base,
      validator_address: delegation.validator_address,
    }, {
      preparing: 'Preparing undelegation…',
      signing: 'Confirming on this device…',
      submitting: 'Starting the unbonding period…',
      success: 'Unbonding started',
      successDescription: 'This stake stops contributing to security weight now and becomes withdrawable after the on-chain delay.',
      failure: 'Could not start unbonding',
    });
    if (ok) setUnstakeAmounts((prev) => ({ ...prev, [delegation.validator_address]: '' }));
  };

  const withdraw = async (validatorAddress, operatorSelf = false) => {
    await run('stake', {
      kind: 'withdraw',
      validator_address: validatorAddress,
    }, {
      preparing: 'Preparing withdrawal…',
      signing: 'Confirming on this device…',
      submitting: 'Returning unlocked SWPX to your smart account…',
      success: operatorSelf ? 'Operator self-stake withdrawal submitted' : 'Withdrawal submitted',
      successDescription: 'The unlocked balance is being returned to your smart account.',
      failure: 'Withdrawal not completed',
    });
  };

  const exitOperator = async () => {
    const ok = await run('stake', { kind: 'exit_validator' }, {
      preparing: 'Preparing operator exit…',
      signing: 'Confirming on this device…',
      submitting: 'Starting operator exit and self-stake unbonding…',
      success: 'Operator exit submitted',
      successDescription: 'Your operator stops contributing security weight immediately. Self-stake remains locked and slashable during the unbonding period.',
      failure: 'Operator exit not completed',
    });
    if (ok) setConfirmExit(false);
  };

  const canSubmit = !busy
    && Boolean(toBaseUnits(amount))
    && (mode === 'validator'
      ? activeOperator
        ? true
        : !pendingOperator && !blockedOperator && commissionToBps(commissionPct) !== null
      : validator.trim().length > 3);

  const authoritativeSummary = chainOperatorKnown && (
    Number(chainOperator?.self_stake || 0) > 0
    || chainOperatorStatus !== 0
    || chainDelegations.length > 0
  );

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
              New staking actions require a current private verifier assertion plus an ACTIVE Type 1, Level 2 on-chain attestation. Your permanent identity and existing on-chain stake remain intact while verification is expired or revoked.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-foreground">Existing stake</p>
            {!loading && chainOperatorKnown && <span className="text-[10px] font-semibold uppercase text-success">Read from chain</span>}
          </div>
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : authoritativeSummary ? (
            <div className="mt-2 space-y-2">
              {chainOperatorStatus !== 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2 text-xs">
                  <span><span className="font-semibold text-foreground">Operator</span><span className="ml-2 text-muted-foreground">{String(chainOperator?.status || '').toLowerCase()}</span></span>
                  <span className="font-mono font-semibold text-foreground">{toDisplay(chainOperator?.self_stake)} SWPX</span>
                </div>
              )}
              {chainDelegations.map((delegation) => (
                <div key={delegation.validator_address} className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2 text-xs">
                  <span className="min-w-0"><span className="font-semibold text-foreground">Delegation</span><span className="ml-2 font-mono text-muted-foreground">{shortHex(delegation.validator_address)}</span></span>
                  <span className="font-mono font-semibold text-foreground">{toDisplay(delegation.amount)} SWPX</span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">Existing balances remain visible, but lifecycle actions stay locked until verification is current again.</p>
            </div>
          ) : positions.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">You have no existing stake.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {positions.slice(0, 6).map((position) => (
                <li key={position.id} className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="font-semibold capitalize text-foreground">{position.role}</span>
                    <span className="ml-2 text-muted-foreground">{position.status.toLowerCase()}</span>
                  </span>
                  <span className="font-mono font-semibold text-foreground">{toDisplay(position.staked_amount)} SWPX</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Back community operators</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Stake to run an operator, or back one you trust. On the current testnet this bonds operators to accountable network services; it does not yet represent decentralised consensus validation. Your collecting activity can scale stake weight, but never replaces stake.
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading || busy} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50" aria-label="Refresh staking state">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {chainOperatorKnown && (
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
            <span className="rounded-full bg-success/10 px-2 py-1 text-success">Chain-authoritative</span>
            {poolPolicy?.min_self_stake && <span className="rounded-full bg-secondary px-2 py-1">Operator minimum {toDisplay(poolPolicy.min_self_stake)} SWPX</span>}
            {Number(poolPolicy?.unbonding_period_seconds || 0) > 0 && <span className="rounded-full bg-secondary px-2 py-1">Unbonding {Math.round(Number(poolPolicy.unbonding_period_seconds) / 3600)}h</span>}
            {BigInt(chainStakeTotal || '0') > 0n && <span className="rounded-full bg-secondary px-2 py-1">Active stake {toDisplay(chainStakeTotal)} SWPX</span>}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('delegate')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${mode === 'delegate' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
          >
            Back an operator
          </button>
          <button
            type="button"
            onClick={() => setMode('validator')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${mode === 'validator' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
          >
            Run an operator
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {mode === 'delegate' ? (
            <div>
              <label htmlFor="swappulse-validator" className="text-xs font-semibold">Operator address</label>
              <input
                id="swappulse-validator"
                value={validator}
                onChange={(e) => setValidator(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </div>
          ) : activeOperator ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
              <p className="font-semibold text-foreground">You already run a community operator.</p>
              <p className="mt-1 text-muted-foreground">
                New stake will increase your existing operator self-stake. Your current commission remains {Number(activeOperator.commission_bps || 0) / 100}%.
              </p>
            </div>
          ) : pendingOperator ? (
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
              <p className="font-semibold text-foreground">Operator exit pending</p>
              <p className="mt-1 text-muted-foreground">The staking pool reports this operator as exiting. A second registration is blocked while that on-chain state remains.</p>
            </div>
          ) : blockedOperator ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <p className="font-semibold text-destructive">Operator registration unavailable</p>
              <p className="mt-1 text-muted-foreground">The staking pool reports this operator as slashed. The current contract does not allow a second operator registration for the same smart account.</p>
            </div>
          ) : (
            <div>
              <label htmlFor="swappulse-operator-commission" className="text-xs font-semibold">Operator commission (%)</label>
              <input
                id="swappulse-operator-commission"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
                placeholder="5.00"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Stored on-chain when this operator is registered. Choose 0–30%; the default is 5%.</p>
            </div>
          )}
          <div>
            <label htmlFor="swappulse-stake-amount" className="text-xs font-semibold">Amount</label>
            <input
              id="swappulse-stake-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
          {busy
            ? 'Working…'
            : mode === 'validator'
              ? activeOperator
                ? 'Increase operator self-stake'
                : pendingOperator
                  ? 'Operator exit pending'
                  : blockedOperator
                    ? 'Operator unavailable'
                    : 'Stake and run an operator'
              : 'Stake to this operator'}
        </button>
        {busy && step && <p className="mt-2 text-center text-xs font-medium text-primary" role="status" aria-live="polite">{step}</p>}
      </div>

      {chainOperatorKnown && chainOperatorStatus !== 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Your community operator</p>
              <p className="mt-0.5 text-xs text-muted-foreground">State read directly from the verified public RPC.</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${chainOperatorStatus === 1 ? 'bg-success/10 text-success' : chainOperatorStatus === 2 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
              {chainOperator?.status || 'Unknown'}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-secondary/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Self-stake</p><p className="mt-1 font-mono text-sm font-semibold">{toDisplay(chainOperator?.self_stake)} SWPX</p></div>
            <div className="rounded-lg bg-secondary/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Delegated to you</p><p className="mt-1 font-mono text-sm font-semibold">{toDisplay(chainOperator?.delegated_stake)} SWPX</p></div>
            <div className="rounded-lg bg-secondary/40 p-3"><p className="text-[10px] uppercase text-muted-foreground">Commission</p><p className="mt-1 font-mono text-sm font-semibold">{Number(chainOperator?.commission_bps || 0) / 100}%</p></div>
          </div>

          {chainOperatorStatus === 1 && (
            <div className="mt-4 border-t border-border pt-3">
              {confirmExit ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-xs text-muted-foreground">Exiting removes your operator and its delegations from active security weight immediately. Your self-stake then remains locked and slashable until the unbonding period finishes.</p></div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={exitOperator} disabled={busy} className="flex-1 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50">Confirm operator exit</button>
                    <button type="button" onClick={() => setConfirmExit(false)} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmExit(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/5 disabled:opacity-50"><LogOut className="h-3.5 w-3.5" /> Exit operator</button>
              )}
            </div>
          )}

          {[2, 3].includes(chainOperatorStatus) && BigInt(chainOperator?.self_withdrawal?.pending_withdrawal || '0') > 0n && (
            <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-3">
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">Self-stake unbonding</p>
                  <p className="mt-1 text-xs text-muted-foreground">{toDisplay(chainOperator.self_withdrawal.pending_withdrawal)} SWPX pending · {remainingFromUnix(chainOperator.self_withdrawal.unlock_at, now)}</p>
                </div>
              </div>
              {chainOperator.self_withdrawal.can_withdraw && (
                <button type="button" onClick={() => withdraw(chainOperator.account_address, true)} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"><ArrowDownToLine className="h-3.5 w-3.5" /> Withdraw self-stake</button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Your delegations</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Active and unbonding balances are read directly from the staking contract.</p>
          </div>
          {chainOperatorKnown && <span className="text-[10px] font-semibold uppercase text-success">Chain state</span>}
        </div>

        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
        ) : chainDelegations.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">You have no active or unbonding delegations.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {chainDelegations.map((delegation) => {
              const active = BigInt(delegation.amount || '0');
              const pending = BigInt(delegation.pending_withdrawal || '0');
              const input = unstakeAmounts[delegation.validator_address] || '';
              const base = toBaseUnits(input);
              const canRequest = delegation.can_request_undelegate && base && BigInt(base) <= active;
              return (
                <div key={delegation.validator_address} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0"><p className="text-xs font-bold">Operator</p><p className="font-mono text-[11px] text-muted-foreground" title={delegation.validator_address}>{shortHex(delegation.validator_address)}</p></div>
                    <div className="text-right"><p className="text-[10px] uppercase text-muted-foreground">Active</p><p className="font-mono text-xs font-semibold">{toDisplay(active.toString())} SWPX</p></div>
                  </div>

                  {pending > 0n ? (
                    <div className="mt-3 rounded-lg bg-warning/5 p-3">
                      <div className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-warning" /><p className="text-xs font-semibold">{toDisplay(pending.toString())} SWPX unbonding</p></div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{remainingFromUnix(delegation.unlock_at, now)}{delegation.unlock_at_iso ? ` · ${new Date(delegation.unlock_at_iso).toLocaleString()}` : ''}</p>
                      {delegation.can_withdraw && (
                        <button type="button" onClick={() => withdraw(delegation.validator_address)} disabled={busy} className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"><ArrowDownToLine className="h-3.5 w-3.5" /> Withdraw unlocked SWPX</button>
                      )}
                    </div>
                  ) : active > 0n ? (
                    <div className="mt-3">
                      <label className="text-[11px] font-semibold">Amount to unstake</label>
                      <div className="mt-1 flex gap-2">
                        <input value={input} onChange={(e) => setUnstakeAmounts((prev) => ({ ...prev, [delegation.validator_address]: e.target.value }))} placeholder="0.00" inputMode="decimal" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
                        <button type="button" onClick={() => requestUndelegate(delegation)} disabled={!canRequest || busy} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-secondary disabled:opacity-50">Start unbonding</button>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">You can unstake up to {toDisplay(active.toString())} SWPX. Only one pending unbonding request is allowed per operator.</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {positions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-bold">Recent staking actions</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">These Base44 rows are transaction history. Balances and lifecycle controls above come from the chain.</p>
          <ul className="mt-2 space-y-2">
            {positions.slice(0, 8).map((position) => (
              <li key={position.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <span className="min-w-0"><span className="font-semibold">{String(position.intent_kind || position.role || 'stake').replaceAll('_', ' ')}</span><span className="ml-2 text-muted-foreground">{String(position.status || '').toLowerCase()}</span></span>
                {BigInt(position.staked_amount || '0') > 0n && <span className="font-mono font-semibold">{toDisplay(position.staked_amount)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
