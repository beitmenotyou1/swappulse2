import React from 'react';
import Avatar from '@/components/Avatar';
import { useI18n } from '@/lib/i18n/I18nProvider';

export default function OnlineNow({ users }) {
  const { tr } = useI18n();
  if (!users?.length) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="h-2.5 w-2.5 rounded-full bg-success ring-2 ring-success/30" /> {tr('sidebar.onlineNow')} · {users.length}
      </h3>
      <div className="flex flex-wrap gap-2">
        {users.slice(0, 12).map((u) => (
          <div key={u.id} title={u.name || u.handle || tr('common.collector')} className="relative">
            <Avatar name={u.name} src={u.avatar} size={36} online />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tr('sidebar.collectorsActive')}</p>
    </section>
  );
}