import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ArrowDownLeft, ArrowUpRight, Undo2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import VouchForm from '@/components/trust/VouchForm';

const REL_LABEL = {
  trade_partner: 'Trade Partner',
  repeat_trader: 'Repeat Trader',
  personal_acquaintance: 'Personal',
  community_member: 'Community',
};

export default function Trust() {
  const [myDid, setMyDid] = useState('');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!myDid) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getTrustProfile', { did: myDid });
      setProfile(res.data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [myDid]);

  useEffect(() => {
    (async () => {
      try {
        const { did } = await ensureUserDid();
        setMyDid(did);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (myDid) load();
  }, [myDid, load]);

  const [revoking, setRevoking] = useState(null);

  const score = profile?.normalised_score ?? 0;

  const revoke = async (v) => {
    if (!confirm('Revoke this vouch? It will no longer count towards their trust score.')) return;
    setRevoking(v.id);
    try {
      await base44.entities.Vouch.update(v.id, { revoked_at: new Date().toISOString() });
      await load();
    } catch {
      /* ignore */
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div>
      <PageHeader title="Trust Network" subtitle="Vouch-based reputation across the community" />
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-raised">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative grid h-24 w-24 shrink-0 place-items-center">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-2xl font-extrabold">{score}</p>
                  <p className="text-[10px] text-muted-foreground">/ 100</p>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Your Trust Score</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Based on incoming vouches from trusted collectors.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                    {profile?.vouch_count || 0} vouches
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                    {profile?.mutual_vouches || 0} mutual
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <VouchForm onCreated={load} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 font-bold">
              <ArrowDownLeft className="h-4 w-4 text-success" /> Vouches for you
            </h3>
            {!profile?.incoming?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No one has vouched for you yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.incoming.map((v) => (
                  <div key={v.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                    <Avatar name={v.voucher_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {v.voucher_name || 'Collector'}{' '}
                        <span className="font-normal text-muted-foreground">@{v.voucher_handle}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{REL_LABEL[v.relationship] || v.relationship}</p>
                      {v.context && <p className="mt-1 text-xs">{v.context}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 font-bold">
              <ArrowUpRight className="h-4 w-4 text-primary" /> You vouched for
            </h3>
            {!profile?.outgoing?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">You haven't vouched for anyone yet.</p>
            ) : (
              <div className="space-y-2">
                {profile.outgoing.map((v) => (
                  <div key={v.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                    <Avatar name={v.vouched_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {v.vouched_name || 'Collector'}{' '}
                        <span className="font-normal text-muted-foreground">@{v.vouched_handle}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{REL_LABEL[v.relationship] || v.relationship}</p>
                      {v.context && <p className="mt-1 text-xs">{v.context}</p>}
                      {v.revoked_at && <p className="mt-1 text-xs font-semibold text-destructive">Revoked</p>}
                    </div>
                    {!v.revoked_at && (
                      <button
                        onClick={() => revoke(v)}
                        disabled={revoking === v.id}
                        className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        <Undo2 className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}