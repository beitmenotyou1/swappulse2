import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Lock, Globe, Users, Heart } from 'lucide-react';
import { BINDER_THEMES } from './theme';

export default function BinderCard({ binder }) {
  const theme = BINDER_THEMES[binder.theme] || BINDER_THEMES.classic_purple;
  const pageCount = binder.pages?.length || 1;
  const visIcon =
    binder.visibility === 'private' ? <Lock className="inline h-3 w-3" />
    : binder.visibility === 'public' ? <Globe className="inline h-3 w-3" />
    : <Users className="inline h-3 w-3" />;
  return (
    <Link
      to={`/binder/${binder.id}`}
      className={`block overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${theme.backdrop} shadow-raised transition hover:shadow-elevated`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className={`grid h-16 w-12 shrink-0 place-items-center rounded-lg ${theme.spine} text-white`}>
          <BookOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{binder.title}</p>
          <p className="truncate text-xs text-muted-foreground">{binder.description || 'No description'}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
            <span>·</span>
            {visIcon}
            <span>·</span>
            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {binder.like_count || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}