import React from 'react';
import { MoreVertical } from 'lucide-react';

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// §Alpha 1.4 - chapter marks dropdown for the sticky player. Lists chapter
// timestamps + titles (with an optional card thumbnail placeholder) and
// seeks the audio to the chapter on click.
export default function ChapterDropdown({ chapters, onSeek }) {
  return (
    <div className="group relative">
      <button
        className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        aria-label="Chapters"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <div className="invisible absolute bottom-10 right-0 z-50 w-64 rounded-lg border border-border bg-popover p-1 opacity-0 shadow-elevated transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Chapters</p>
        <div className="max-h-60 overflow-auto">
          {chapters.map((c, i) => (
            <button
              key={i}
              onClick={() => onSeek(c.timestamp_seconds || 0)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary"
            >
              <span className="font-mono text-muted-foreground">{fmt(c.timestamp_seconds || 0)}</span>
              <span className="flex-1 truncate">{c.title}</span>
              {c.card_uri && <span className="h-8 w-8 shrink-0 rounded bg-gradient-to-br from-primary/40 to-primary/20" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}