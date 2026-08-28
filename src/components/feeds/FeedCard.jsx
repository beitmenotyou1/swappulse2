import React, { useState } from 'react';
import { Rss, Pin, Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ExternalIndicator from '@/components/ExternalIndicator';
import { useToast } from '@/components/ui/use-toast';

export default function FeedCard({ feed, subscribed, onToggle }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState(false);
  const isSubscribed = !!subscribed;

  const toggleSubscribe = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      if (isSubscribed) {
        await base44.entities.FeedSubscription.delete(subscribed.id);
        onToggle?.(feed, false);
        toast({ title: 'Unsubscribed' });
      } else {
        const created = await base44.entities.FeedSubscription.create({
          did: user.data?.did || '',
          feed_uri: feed.uri,
          feed_name: feed.displayName || feed.uri,
          author_did: feed.author?.did || '',
          pinned: false,
        });
        base44.functions.invoke('bridge-record', { action: 'create', entityName: 'FeedSubscription', recordId: created.id }).catch(() => {});
        onToggle?.(feed, true, created);
        toast({ title: 'Subscribed' });
      }
    } catch (err) {
      toast({ title: 'Could not update subscription', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async () => {
    if (!subscribed) return;
    setBusy(true);
    try {
      const next = !pinned;
      await base44.entities.FeedSubscription.update(subscribed.id, { pinned: next });
      setPinned(next);
      toast({ title: next ? 'Pinned to home' : 'Unpinned' });
    } catch {
      toast({ title: 'Could not pin', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition hover:shadow-raised">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Rss className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-bold">{feed.displayName || 'Untitled feed'}</h3>
            <ExternalIndicator did={feed.author?.did} />
          </div>
          {feed.author?.displayName && (
            <p className="truncate text-xs text-muted-foreground">by {feed.author.displayName}</p>
          )}
          {feed.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{feed.description}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleSubscribe}
          disabled={busy || !user?.id}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${isSubscribed ? 'bg-secondary text-muted-foreground' : 'bg-primary text-white hover:bg-primary/90'}`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSubscribed ? <Check className="h-3.5 w-3.5" /> : <Rss className="h-3.5 w-3.5" />}
          {isSubscribed ? 'Subscribed' : 'Subscribe'}
        </button>
        {isSubscribed && (
          <button
            onClick={togglePin}
            disabled={busy}
            aria-pressed={pinned}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${pinned ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
          >
            <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} /> {pinned ? 'Pinned' : 'Pin'}
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{feed.subscriberCount || 0} subs</span>
      </div>
    </div>
  );
}