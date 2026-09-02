import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Coins, Loader2, ShieldCheck } from 'lucide-react';
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

export default function StakingPanel({ identitySecured, valueFeaturesReady }) {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('delegate');
  const [validator, setValidator] = useState('');
  const [commissionPct, setCommissionPct] = useState('5');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.StakePosition.filter({ user_id: user?.id, network: 'SWAPPULSE_TESTNET' }, '-created_date', 25);
      setPositions((rows || []).filter((row) => row.status !== 'DRAFTED'));
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const { busy, step, run } = useChainAction({ userId: user?.id, onDone: load });
  const activeOperator = positions.find((position) =>
    position.role === 'validator' && position.status === 'ACTIVE'
  ) || null;
  const pendingOperator = positions.find((position) =>
    position.role === 'validator' && ['SUBMITTED', 'UNBONDING'].includes(position.status)
  ) || null;
  const increasingOperatorStake = mode === 'validator' && Boolean(activeOperator);

  const submit = async () => {
    const base = toBaseUnits(amount);
    if (!base) return;
    const commissionBps = commissionToBps(commissionPct);
    if (mode === 'validator' && !activeOperator && commissionBps === null) return;
    if (mode === 'validator' && pendingOperator && !activeOperator) return;
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

  const canSubmit = !busy
    && Boolean(toBaseUnits(amount))
    && (mode === 'validator'
      ? activeOperator
        ? true
        : !pendingOperator && commissionToBps(commissionPct) !== null
      : validator.trim().length > 3);

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
              New staking actions require a current private verifier assertion plus an ACTIVE Type 1, Level 2 on-chain attestation. Your permanent identity, faucet and any existing on-chain stake remain intact while verification is expired or revoked.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-bold text-foreground">Existing stake</p>
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : positions.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">You have no existing stake.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {positions.map((position) => (
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
      </div>

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
            <p className="font-semibold text-foreground">Operator action pending</p>
            <p className="mt-1 text-muted-foreground">
              Wait for the current operator transaction to reconcile before submitting another registration.
            </p>
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
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stored on-chain when this operator is registered. Choose 0–30%; the default is 5%.
            </p>
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
                ? 'Operator action pending'
                : 'Stake and run an operator'
            : 'Stake to this operator'}
      </button>
      {busy && step && (
        <p className="mt-2 text-center text-xs font-medium text-primary" role="status" aria-live="polite">{step}</p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-bold">Your stake</p>
        {loading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : positions.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">You have no stake yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {positions.map((position) => (
              <li key={position.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-semibold capitalize">{position.role}</span>
                  <span className="ml-2 text-muted-foreground">{position.status.toLowerCase()}</span>
                </span>
                <span className="font-mono font-semibold">{toDisplay(position.staked_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}