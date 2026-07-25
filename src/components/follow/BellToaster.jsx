import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { ensureUserDid } from '@/lib/atproto';

// In-app bell toaster - subscribes to the realtime feed and surfaces an in-app
// toast for new posts by bell-followed authors. Re-syncs the watched-author
// set whenever a followPreference record changes. Push (offline) delivery is
// handled server-side by dispatchBellNotifications.
export default function BellToaster() {
  const { toast } = useToast();
  const bellSet = useRef(new Set());
  const myDid = useRef('');

  const loadBell = async (did) => {
    const prefs = await base44.entities.FollowPreference.filter({ did, bell_enabled: true }).catch(() => []);
    bellSet.current = new Set(prefs.map((p) => p.subject_did));
  };

  useEffect(() => {
    let active = true;
    let unsub = () => {};
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      const { did } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
      if (!active || !did) return;
      myDid.current = did;
      await loadBell(did);
      unsub = base44.entities.FollowPreference.subscribe(() => { if (active) loadBell(did); });
    })();
    return () => { active = false; unsub(); };
  }, []);

  const handle = (post, label) => {
    if (!post?.did || post.did === myDid.current) return;
    if (!bellSet.current.has(post.did)) return;
    toast({
      title: `${post.author_name || 'A collector'} · ${label}`,
      description: post.content
        ? post.content.slice(0, 100)
        : post.card_name
          ? `New pull: ${post.card_name}`
          : 'New post',
    });
  };

  useRealtimeEvent('feed.new_pull', (p) => handle(p, 'Pack Pull'));
  useRealtimeEvent('feed.new_post', (p) => handle(p, 'New Post'));
  return null;
}