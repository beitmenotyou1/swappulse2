import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Lock, Globe } from 'lucide-react';

export default function BoardCard({ board }) {
  const itemCount = (board.items || []).length;
  return (
    <Link
      to={`/boards/${board.id}`}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-raised"
    >
      <div className="flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Bookmark className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-bold">{board.name}</h3>
            {board.visibility === 'private' ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0 text-success" />
            )}
          </div>
          {board.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{board.description}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </Link>
  );
}