import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { Link2, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ChainMedallion from '@/components/chain/ChainMedallion';

// Cards a collector has proved possession of and anchored on chain. Minting is
// authorised server-side from a verified CardVerificationSession, so this panel
// only offers the action for sessions that already passed verification.
export default function MintedCardsPanel({ identitySecured }) {
  const { toast } = useToast();
  const [tokens, setTokens] = useState([]);
  const [mintable, setMintable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tokenRows, sessionRows] = await Promise.all([
        base44.entities.ChainCardToken.filter({ network: 'SWAPPULSE_TESTNET' }, '-created_date', 40),
        base44.entities.CardVerificationSession.filter({ status: 'verified' }, '-created_date', 40),
      ]);
      const minted = tokenRows || [];
      setTokens(minted);
      const usedSessions = new Set(minted.map((token) => String(token.verification_session_id)));
      setMintable((sessionRows || []).filter((session) => !usedSessions.has(String(session.id))));
    } catch {
      setTokens([]);
      setMintable([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mint = async (session) => {
    setMinting(session.id);
    try {
      const res = await base44.functions.invoke('mint-card', { verification_session_id: session.id });
      const data = res?.data || res;
      toast({
        title: data?.already_minted ? 'Already on chain' : 'Card anchored on chain',
        description: `${session.card_name || session.card_id} now has a permanent ownership record.`,
      });
      await load();
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Could not anchor this card on chain.';
      toast({ title: 'Minting failed', description: message, variant: 'destructive' });
    } finally {
      setMinting('');
    }
  };

  if (!identitySecured) {
    return (
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        <p className="text-sm font-bold text-foreground">Verified cards on chain</p>
        <p className="mt-1">Secure your on-chain identity first to anchor verified cards.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-accent/15 p-2 text-accent-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Verified cards on chain</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each anchored card carries the verification level you achieved, so anyone can check your possession proof without trusting SwapPulse.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your cards…
        </div>
      ) : (
        <>
          {mintable.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold">Ready to anchor</p>
              <ul className="mt-2 space-y-2">
                {mintable.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                    <ChainMedallion level={session.verification_level} showLabel={false} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{session.card_name || session.card_id}</span>
                    <button
                      type="button"
                      onClick={() => mint(session)}
                      disabled={Boolean(minting)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {minting === session.id && <Loader2 className="h-3 w-3 animate-spin" />}
                      {minting === session.id ? 'Anchoring…' : 'Mint to chain'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs font-bold">Anchored</p>
            {tokens.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No cards anchored yet. Verify a card in your collection, then anchor it here.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {tokens.map((token) => (
                  <li key={token.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                    {token.card_image ? (
                      <Image src={token.card_image} alt={token.card_name} className="h-12 w-9 shrink-0 rounded" fittingType="fit" />
                    ) : (
                      <span className="h-12 w-9 shrink-0 rounded bg-secondary" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{token.card_name || token.card_id}</span>
                      <ChainMedallion level={token.verification_level} className="mt-1" />
                      {token.status === 'BRIDGED_OUT' && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                          <Link2 className="h-3 w-3" /> Bridged out
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}