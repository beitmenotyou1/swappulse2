import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Sparkles, ShieldCheck, RefreshCw, X, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ExternalActorSearch from '@/components/follow/ExternalActorSearch';
import { createBridgedFollow } from '@/lib/followBridge';

const SOURCE_LABELS = {
  trust_proximity: { label: 'Trust proximity', icon: ShieldCheck, tone: 'text-success' },
  collection_overlap: { label: 'Collection overlap', icon: UserPlus, tone: 'text-primary' },
  diversity_boost: { label: 'Diversity boost', icon: Sparkles, tone: 'text-accent' },
  serendipity_injection: { label: 'Serendipity', icon: Sparkles, tone: 'text-accent' },
};

export default function WhoToFollow() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recs, setRecs] = useState([]);
  const [actorDid, setActorDid] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchRecs = useCallback(
    async (bypassCache = false) => {
      try {
        setLoading(true);
        const res = await base44.functions.invoke('getFeedSkeleton', {
          limit: 10,
          ...(bypassCache ? { cursor: 0, _bypass: true } : {}),
        });
        setRecs(res.data.recommendations || []);
        setActorDid(res.data.actorDid || '');
      } catch (err) {
        toast({ title: 'Could not load recommendations', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const refresh = async () => {
    setRefreshing(true);
    // Invalidate cache by deleting the cache record, then refetch
    try {
      if (actorDid) {
        const svc = base44.asServiceRole?.entities;
        const cached = await base44.entities.RecommendationCache.filter({ did: actorDid }, '-updated_date', 1);
        if (cached[0]) await base44.entities.RecommendationCache.delete(cached[0].id);
      }
    } catch {
      /* ignore */
    }
    await fetchRecs();
    setRefreshing(false);
  };

  const follow = async (rec) => {
    setBusyId(rec.did);
    try {
      await createBridgedFollow(rec.did, rec.displayName, rec.handle, rec.avatarUrl);
      // bump acceptance counter
      try {
        const prefs = await base44.entities.RecommendationPreference.filter({ did: actorDid }, '-updated_date', 1);
        if (prefs[0]) {
          await base44.entities.RecommendationPreference.update(prefs[0].id, {
            total_accepted: (prefs[0].total_accepted || 0) + 1,
          });
        }
      } catch {
        /* non-critical */
      }
      setRecs((rs) => rs.filter((r) => r.did !== rec.did));
      toast({ title: 'Following', description: rec.displayName || rec.handle });
    } catch (err) {
      toast({ title: 'Could not follow', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (rec, reason = 'not_relevant') => {
    setBusyId(rec.did);
    try {
      const existing = await base44.entities.RecommendationPreference.filter({ did: actorDid }, '-updated_date', 1);
      if (existing[0]) {
        const dismissed = existing[0].dismissed_users || [];
        if (!dismissed.includes(rec.did)) dismissed.push(rec.did);
        const reasons = existing[0].dismissal_reasons || {};
        reasons[rec.did] = reason;
        await base44.entities.RecommendationPreference.update(existing[0].id, {
          dismissed_users: dismissed,
          dismissal_reasons: reasons,
        });
      } else {
        await base44.entities.RecommendationPreference.create({
          did: actorDid,
          dismissed_users: [rec.did],
          dismissal_reasons: { [rec.did]: reason },
        });
      }
      setRecs((rs) => rs.filter((r) => r.did !== rec.did));
      toast({ title: 'Dismissed', description: "We won't suggest them again." });
    } catch (err) {
      toast({ title: 'Could not dismiss', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <PageHeader title="Who to Follow" subtitle="Trust-based collector recommendations from your vouch graph">
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <ExternalActorSearch />

        <div className="border-t border-border pt-4">
          <h2 className="mb-3 text-sm font-bold text-muted-foreground uppercase tracking-wide">Recommended collectors</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="h-12 w-12 animate-pulse rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        ) : recs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <UserPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No recommendations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vouch for collectors you trust and build your collection — we&apos;ll surface people you
              should know from your trust graph.
            </p>
            <Button asChild className="mt-4">
              <Link to="/explore">Explore collectors</Link>
            </Button>
          </div>
        ) : (
          recs.map((rec) => {
            const Src = SOURCE_LABELS[rec.sourceMethod] || SOURCE_LABELS.trust_proximity;
            return (
              <div
                key={rec.did}
                className="rounded-xl border border-border bg-card p-4 shadow-base transition-shadow hover:shadow-raised"
              >
                <div className="flex items-start gap-3">
                  <Link to={`/u/${rec.handle || ''}`}>
                    <Avatar name={rec.displayName || rec.handle} src={rec.avatarUrl} size={52} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/u/${rec.handle || ''}`} className="truncate font-semibold hover:underline">
                          {rec.displayName || rec.handle || 'Collector'}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground">@{rec.handle}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="gap-1">
                          <Src className={`h-3 w-3 ${Src.tone}`} />
                          {Src.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {rec.mutualVouchCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-success" />
                          {rec.mutualVouchCount} mutual vouch{rec.mutualVouchCount === 1 ? '' : 'es'}
                        </span>
                      )}
                      {rec.isNewUser && (
                        <span className="inline-flex items-center gap-1 text-accent">
                          <Sparkles className="h-3 w-3" />
                          New collector
                        </span>
                      )}
                      <span>Trust {Math.round(rec.trustScore)}/100</span>
                    </div>

                    {rec.reasons?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {rec.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                            <span>
                              <span className="font-medium">{r.label}.</span>{' '}
                              <span className="text-muted-foreground">{r.detail}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" onClick={() => follow(rec)} disabled={busyId === rec.did}>
                        <UserPlus className="h-4 w-4" />
                        Follow
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismiss(rec)}
                        disabled={busyId === rec.did}
                      >
                        <X className="h-4 w-4" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}