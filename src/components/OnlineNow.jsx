import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useT } from '@/lib/i18n/I18nProvider';

// Highlights the five newest collectors currently online. "Newest" is
// approximated by the Presence record's created_date (first heartbeat), which
// stays stable per user and reflects when they first joined the platform.
export default function OnlineNow({ users }) {
  const tr = useT();
  if (!users?.length) return null;

  const newestIds = new Set(
    [...users]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 5)
      .map((u) => u.id),
  );
  const visible = users.slice(0, 12);
  const hasMore = users.length > 12;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-success/30" /> {tr('sidebar.onlineNow')} · {users.length}
      </h3>
      <div className="flex flex-wrap gap-2">
        {visible.map((u) => {
          const isNew = newestIds.has(u.id);
          return (
            <div key={u.id} title={u.name || u.handle || tr('common.collector')} className="relative">
              <Avatar name={u.name} src={u.avatar} size={36} online />
              {isNew && (
                <span
                  className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-foreground ring-2 ring-card"
                  title={tr('sidebar.newCollector')}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{tr('sidebar.collectorsActive')}</p>
        {hasMore && (
          <Link to="/online-now" className="text-xs font-semibold text-primary hover:underline">
            {tr('common.viewMore')}
          </Link>
        )}
      </div>
    </section>
  );
}