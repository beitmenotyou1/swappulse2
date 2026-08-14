import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, RefreshCw, UserPlus, UserCheck, ExternalLink, Loader2, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createBridgedFollow } from '@/lib/followBridge';

// BlueskyMutualsSection — surfaces the user's AT Protocol mutuals (accounts they
// follow who follow them back), splitting them into SwapPulse members to connect
// with here and external accounts to follow on the federated network.
export default function BlueskyMutualsSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutuals, setMutuals] = useState([]);
  const [hasIdentity, setHasIdentity] = useState(true);
  const [onSwapPulseCount, setOnSwapPulseCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all | members | external
  const [busyId, setBusyId] = useState(null);

  const fetchMutuals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await base44.functions.invoke('get-bluesky-mutuals', {});
      setMutuals(res.data.mutuals || []);
      setHasIdentity(res.data.hasIdentity !== false);
      setOnSwapPulseCount(res.data.onSwapPulse || 0);
    } catch (err) {
      toast({ title: 'Could not load mutuals', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMutuals();
  }, [fetchMutuals]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchMutuals();
    setRefreshing(false);
  };

  const follow = async (m) => {
    setBusyId(m.did);
    try {
      await createBridgedFollow(m.did, m.displayName, m.handle, m.avatar);
      setMutuals((ms) => ms.map((x) => (x.did === m.did ? { ...x, isFollowed: true } : x)));
      toast({ title: 'Following', description: m.displayName || m.handle });
    } catch (err) {
      toast({ title: 'Could not follow', description: err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = mutuals.filter((m) => {
    if (filter === 'members') return m.isMember;
    if (filter === 'external') return !m.isMember;
    return true;
  });

  if (!loading && hasIdentity && mutuals.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-base">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Your Bluesky mutuals</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={refresh} disabled={refreshing || loading} aria-label="Refresh mutuals">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Collectors you follow on the AT Protocol who follow you back.{' '}
        {onSwapPulseCount > 0 && <span className="text-foreground font-medium">{onSwapPulseCount} already on SwapPulse.</span>}
      </p>

      {!hasIdentity ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Connect your AT Protocol identity in{' '}
          <Link to="/settings" className="text-primary hover:underline font-medium">Settings</Link>{' '}
          to discover your Bluesky mutuals.
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-1/3 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {mutuals.length > 0 && (
            <div className="mb-3 flex gap-1.5">
              {[
                { key: 'all', label: `All ${mutuals.length}` },
                { key: 'members', label: `On SwapPulse ${onSwapPulseCount}` },
                { key: 'external', label: `External ${mutuals.length - onSwapPulseCount}` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2.5">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No mutuals in this category.</p>
            ) : (
              filtered.map((m) => (
                <div key={m.did} className="flex items-center gap-3">
                  <Link to={`/u/${m.handle || ''}`}>
                    <Avatar name={m.displayName || m.handle} src={m.avatar} size={40} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link to={`/u/${m.handle || ''}`} className="truncate font-semibold text-sm hover:underline">
                        {m.displayName || m.handle || 'Collector'}
                      </Link>
                      {m.isMember ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">SwapPulse</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                          <ExternalLink className="w-2.5 h-2.5" />
                          External
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">@{m.handle}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={m.isFollowed ? 'secondary' : 'default'}
                    onClick={() => follow(m)}
                    disabled={busyId === m.did || m.isFollowed}
                    className="shrink-0"
                  >
                    {busyId === m.did ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : m.isFollowed ? (
                      <UserCheck className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{m.isFollowed ? 'Following' : 'Follow'}</span>
                  </Button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}