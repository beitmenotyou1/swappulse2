import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import useChainAction from '@/hooks/useChainAction';

const CHAINS = [
  { key: 'ethereum', label: 'Ethereum' },
  { key: 'l2', label: 'Layer 2' },
  { key: 'solana', label: 'Solana' },
];

const DECIMALS = 18n;

function toBaseUnits(input) {
  const raw = String(input || '').trim();
  if (!/^\d+(\.\d{1,18})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const padded = (fraction + '0'.repeat(18)).slice(0, 18);
  const value = BigInt(whole) * 10n ** DECIMALS + BigInt(padded || '0');
  return value > 0n ? value.toString() : null;
}

// Moving an asset out to an external chain. The appchain stays the canonical
// home: tokens are escrowed and cards are burned here before the relay issues
// the wrapped asset on the destination, so the same card is never live twice.
export default function BridgePanel({ identitySecured, valueFeaturesReady }) {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assetKind, setAssetKind] = useState('token');
  const [chain, setChain] = useState('ethereum');
  const [amount, setAmount] = useState('');
  const [cardRecordId, setCardRecordId] = useState('');
  const [recipient, setRecipient] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [transferRows, cardRows] = await Promise.all([
        base44.entities.BridgeTransfer.filter({ user_id: user?.id, network: 'SWAPPULSE_TESTNET' }, '-created_date', 20),
        base44.entities.ChainCardToken.filter({ status: 'MINTED' }, '-created_date', 40),
      ]);
      setTransfers((transferRows || []).filter((row) => row.status !== 'DRAFTED'));
      setCards(cardRows || []);
    } catch {
      setTransfers([]);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const { busy, step, run } = useChainAction({ userId: user?.id, onDone: load });

  const submit = async () => {
    const params = {
      asset_kind: assetKind,
      external_chain: chain,
      recipient_address: recipient.trim(),
    };
    if (assetKind === 'token') params.amount = toBaseUnits(amount);
    else params.card_token_record_id = cardRecordId;

    const ok = await run('bridge_out', params, {
      preparing: 'Preparing the transfer…',
      signing: 'Confirming on this device…',
      submitting: 'Sending to the destination chain…',
      success: 'Transfer on its way',
      successDescription: 'You can follow its progress in the list below.',
      failure: 'Transfer not completed',
    });
    if (ok) {
      setAmount('');
      setRecipient('');
      setCardRecordId('');
    }
  };

  const canSubmit = !busy
    && recipient.trim().length > 7
    && (assetKind === 'token' ? Boolean(toBaseUnits(amount)) : Boolean(cardRecordId));

  if (!identitySecured) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        <p className="text-sm font-bold text-foreground">Move assets out</p>
        <p className="mt-1">Secure your on-chain identity first to move assets to another chain.</p>
      </div>
    );
  }

  if (!valueFeaturesReady) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-bold text-foreground">Cross-chain transfers locked</p>
            <p className="mt-1">
              Moving assets out requires a current private verifier assertion plus an ACTIVE Type 1, Level 2 on-chain attestation. Existing transfer history remains visible while verification is expired or revoked.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-bold text-foreground">Recent transfers</p>
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : transfers.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No transfers yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {transfers.map((transfer) => (
                <li key={transfer.id} className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold capitalize text-foreground">{transfer.asset_kind}</span>
                    <span className="ml-2 text-muted-foreground capitalize">to {transfer.external_chain}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-muted-foreground">
                    {String(transfer.status || '').replaceAll('_', ' ').toLowerCase()}
                  </span>
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
          <ArrowUpRight className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Move assets out</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Send a card or token balance to another chain. SwapPulse remains the home record — the asset is held here until the destination confirms.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setAssetKind('token')}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${assetKind === 'token' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
        >
          Token balance
        </button>
        <button
          type="button"
          onClick={() => setAssetKind('card')}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${assetKind === 'card' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
        >
          A card
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <label htmlFor="swappulse-bridge-chain" className="text-xs font-semibold">Destination</label>
          <select
            id="swappulse-bridge-chain"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {CHAINS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>

        {assetKind === 'token' ? (
          <div>
            <label htmlFor="swappulse-bridge-amount" className="text-xs font-semibold">Amount</label>
            <input
              id="swappulse-bridge-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="swappulse-bridge-card" className="text-xs font-semibold">Card</label>
            <select
              id="swappulse-bridge-card"
              value={cardRecordId}
              onChange={(e) => setCardRecordId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Choose an anchored card…</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.card_name || card.card_id} (L{card.verification_level})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="swappulse-bridge-recipient" className="text-xs font-semibold">Recipient address</label>
          <input
            id="swappulse-bridge-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Address on the destination chain"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
        {busy ? 'Working…' : 'Send out'}
      </button>
      {busy && step && (
        <p className="mt-2 text-center text-xs font-medium text-primary" role="status" aria-live="polite">{step}</p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-bold">Recent transfers</p>
        {loading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : transfers.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No transfers yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {transfers.map((transfer) => (
              <li key={transfer.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <span className="min-w-0 truncate">
                  <span className="font-semibold capitalize">{transfer.asset_kind}</span>
                  <span className="ml-2 text-muted-foreground capitalize">to {transfer.external_chain}</span>
                </span>
                <span className="shrink-0 font-semibold text-muted-foreground">
                  {String(transfer.status || '').replaceAll('_', ' ').toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}