import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { usePresence } from '@/hooks/usePresence';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import { useT } from '@/lib/i18n/I18nProvider';

// Full real-time list of collectors currently online. Reuses usePresence so the
// list refreshes on the same heartbeat + subscription cadence as the sidebar.
export default function OnlineCollectors() {
  const tr = useT();
  const online = usePresence();

  const newestIds = new Set(
    [...online]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 5)
      .map((u) => u.id),
  );

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <PageHeader title={tr('page.onlineNow.title')} subtitle={tr('page.onlineNow.subtitle')} />
      <div className="mx-auto max-w-4xl space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{tr('sidebar.collectorsActive')}</p>
        {online.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-semibold">{tr('common.noResults')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {online.map((u) => {
              const isNew = newestIds.has(u.id);
              return (
                <Link
                  key={u.id}
                  to={u.handle ? `/u/${u.handle}` : '#'}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary"
                >
                  <div className="relative">
                    <Avatar name={u.name} src={u.avatar} size={44} online />
                    {isNew && (
                      <span
                        className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-foreground ring-2 ring-card"
                        title={tr('sidebar.newCollector')}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.name || u.handle || tr('common.collector')}</p>
                    {u.handle && <p className="truncate text-xs text-muted-foreground">@{u.handle}</p>}
                  </div>
                  {isNew && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                      {tr('sidebar.newCollector')}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}