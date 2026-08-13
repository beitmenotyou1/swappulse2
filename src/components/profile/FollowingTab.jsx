import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, UserMinus, CheckSquare, Square } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { deleteBridgedFollow } from '@/lib/followBridge';
import Avatar from '@/components/Avatar';
import { useToast } from '@/components/ui/use-toast';

export default function FollowingTab() {
  const [follows, setFollows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [unfollowing, setUnfollowing] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Follow.list('-created_date', 200);
      setFollows(list);
    } catch {
      /* guest or error */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = follows.length > 0 && selected.size === follows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(follows.map((f) => f.id)));

  const unfollowSelected = async () => {
    if (selected.size === 0 || unfollowing) return;
    setUnfollowing(true);
    const ids = [...selected];
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await deleteBridgedFollow(id);
        ok++;
      } catch {
        fail++;
      }
    }
    setSelected(new Set());
    await load();
    setUnfollowing(false);
    toast({
      title: fail > 0 ? 'Unfollowed with errors' : 'Unfollowed',
      description: `${ok} unfollowed${fail > 0 ? `, ${fail} failed` : ''}`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (follows.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">You're not following anyone yet.</p>;
  }

  return (
    <div className="p-4">
      {/* Bulk action bar */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        {selected.size > 0 && (
          <button
            onClick={unfollowSelected}
            disabled={unfollowing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-sm font-bold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {unfollowing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            Unfollow{selected.size > 1 ? ` ${selected.size}` : ''}
          </button>
        )}
      </div>

      {/* Following list */}
      <div className="space-y-1">
        {follows.map((f) => {
          const checked = selected.has(f.id);
          return (
            <div
              key={f.id}
              className={`flex items-center gap-3 rounded-lg border p-2 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-secondary'}`}
            >
              <button onClick={() => toggle(f.id)} className="shrink-0" aria-label={checked ? 'Deselect' : 'Select'}>
                {checked ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
              </button>
              <Link to={f.subject_did ? `/profile/${f.subject_did}` : '#'} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={f.subject_name} src={f.subject_avatar} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{f.subject_name || 'Collector'}</p>
                  <p className="truncate text-sm text-muted-foreground">@{f.subject_handle || 'collector'}</p>
                </div>
              </Link>
              {f.bridged && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Bridged
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}