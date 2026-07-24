import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { useAuth } from '@/lib/AuthContext';
import { Users, LogOut, LogIn, Loader2, ArrowLeftRight, Lock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { cardImageUrl } from '@/lib/tcgdex';

const THEME_LABEL = {
  general: 'General', vintage: 'Vintage', competitive: 'Competitive', shiny: 'Shiny',
  investment: 'Investment', local_region: 'Local Region', artist: 'Artist',
};

export default function CircleDetail() {
  const { circleId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getCircle', { circleId });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [circleId]);

  const join = async () => {
    setActing(true);
    try {
      const { did } = await ensureUserDid();
      const me = await base44.auth.me();
      const c = data.circle;
      const profile = { did, name: me?.full_name || '', handle: me?.email?.split('@')[0] || '', avatar: '' };
      const members = [...(c.member_dids || []), did];
      const profiles = [...(c.member_profiles || []), profile];
      await base44.entities.Circle.update(c.id, {
        member_dids: members,
        member_profiles: profiles,
        member_count: members.length,
      });
      await load();
    } catch {
      /* ignore */
    } finally {
      setActing(false);
    }
  };

  const exit = async () => {
    setActing(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const c = data.circle;
      const members = (c.member_dids || []).filter((d) => d !== did);
      const profiles = (c.member_profiles || []).filter((p) => p.did !== did);
      await base44.entities.Circle.update(c.id, {
        member_dids: members,
        member_profiles: profiles,
        member_count: members.length,
      });
      const stamped = await stampRecord(
        { circle_ref: c.at_uri, circle_id: c.id, exited_at: new Date().toISOString() },
        NSID.CIRCLE_EXIT,
        did,
        signingKey,
      );
      await base44.entities.CircleExit.create(stamped);
      await load();
    } catch {
      /* ignore */
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!data?.circle) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Circle not found.</div>;
  }

  const c = data.circle;
  const canJoin = !data.isMember && !data.isCurator && !data.denied && c.visibility !== 'private';

  return (
    <div>
      <PageHeader title={c.name} subtitle={`${THEME_LABEL[c.theme] || c.theme}${c.region ? ' · ' + c.region : ''}`}>
        {data.isCurator ? (
          <span className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">Curator</span>
        ) : data.isMember ? (
          <button onClick={exit} disabled={acting} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50">
            <LogOut className="h-3.5 w-3.5" /> Leave
          </button>
        ) : data.denied ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Private</span>
        ) : canJoin ? (
          <button onClick={join} disabled={acting} className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            <LogIn className="h-3.5 w-3.5" /> Join
          </button>
        ) : null}
      </PageHeader>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 pb-24 md:pb-8">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{c.member_count || 1} member{(c.member_count || 1) === 1 ? '' : 's'}</p>
              <p className="text-xs capitalize text-muted-foreground">{c.visibility.replace('_', ' ')}</p>
            </div>
          </div>
          {c.description && <p className="mt-3 text-sm">{c.description}</p>}
          {!data.isMember && data.hasExited && !data.denied && (
            <p className="mt-2 text-xs text-muted-foreground">You have left this circle.</p>
          )}
        </div>

        {data.denied ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">This is a private circle. Only members can view its contents.</p>
          </div>
        ) : (
          <>
            {data.canSeeMembers && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Members</h2>
                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex flex-col gap-2">
                    {(c.member_profiles || []).map((p) => (
                      <div key={p.did} className="flex items-center gap-2">
                        <Avatar name={p.name} src={p.avatar} size={28} />
                        <span className="truncate text-sm font-medium">{p.name || p.handle || 'Member'}</span>
                        {p.did === c.did && <span className="text-xs text-primary">curator</span>}
                      </div>
                    ))}
                    {(c.member_profiles || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">No member profiles.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Circle-scoped trades</h2>
              {data.isMember || data.isCurator ? (
                data.scopedTrades.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
                    <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No circle-scoped trades yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.scopedTrades.map((t) => (
                      <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={t.author_name} src={t.author_avatar} size={28} />
                          <span className="text-sm font-semibold">{t.author_name || 'Collector'}</span>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg bg-secondary p-2">
                            <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Offering</p>
                            <div className="flex flex-wrap gap-1.5">
                              {t.offer_card_images?.slice(0, 3).map((img, i) => (
                                <img key={i} src={cardImageUrl(img)} alt="" className="h-12 w-9 rounded object-cover" />
                              ))}
                              <span className="self-center text-xs font-medium">{t.offer_card_names?.join(', ')}</span>
                            </div>
                          </div>
                          <div className="rounded-lg bg-secondary p-2">
                            <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Wants</p>
                            <p className="text-xs font-medium">{t.wanted_card_names?.join(', ')}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-right">
                          <Link to={`/trade/${t.id}`} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary/90">Negotiate</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Join this circle to see member-only trades.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}