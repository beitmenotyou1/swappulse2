import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, PenLine, BookOpen, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// EngagementHub — surfaces a collector's communities (circles), recent
// discussions (their latest posts), and quick content-creation entry points.
// Reuses existing Circle/Post data and compose/binder/spaces routes rather
// than parallel systems.
export default function EngagementHub({ did }) {
  const [circles, setCircles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!did) { setLoading(false); return; }
      setLoading(true);
      try {
        const [c, p] = await Promise.all([
          base44.entities.Circle.filter({}, '-updated_date', 50).catch(() => []),
          base44.entities.Post.filter({ did }, '-created_date', 3).catch(() => []),
        ]);
        if (!active) return;
        setCircles((c || []).filter((x) => (x.member_dids || []).includes(did)).slice(0, 6));
        setPosts(p || []);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did]);

  const createCards = [
    { to: '/compose', icon: PenLine, label: 'Compose a post' },
    { to: '/binders/new', icon: BookOpen, label: 'Create a binder' },
    { to: '/spaces', icon: Radio, label: 'Go live' },
    { to: '/circles', icon: Users, label: 'Start a circle' },
  ];

  return (
    <div className="space-y-5 p-1">
      <section>
        <h3 className="mb-2 text-sm font-bold">Create</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {createCards.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.to} to={c.to} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-secondary">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-semibold">{c.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4" /> Communities</h3>
          <Link to="/circles" className="text-xs font-semibold text-primary hover:underline">View all</Link>
        </div>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : circles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Not in any circles yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {circles.map((c) => (
              <Link key={c.id} to={`/circles/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-secondary">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Users className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.member_count || (c.member_dids || []).length} members</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><MessageSquare className="h-4 w-4" /> Recent discussions</h3>
        {posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((p) => (
              <Link key={p.id} to={`/post/${p.id}`} className="block rounded-xl border border-border bg-card p-3 hover:bg-secondary">
                <p className="line-clamp-2 text-sm">{p.content || p.text || ''}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}