import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, X, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { useExplorerBookmarks } from '@/hooks/useExplorerBookmarks';

// Bookmark/save button for the explorer address page. Saves the address
// to local storage immediately and syncs to the user's account if logged
// in. Includes an optional label input shown when bookmarking.
export default function BookmarkButton({ address, chain = 'pulse' }) {
  const t = useT();
  const { isBookmarked, addBookmark, removeBookmark } = useExplorerBookmarks();
  const bookmarked = isBookmarked(address, chain);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [label, setLabel] = useState('');

  const handleToggle = () => {
    if (bookmarked) {
      removeBookmark(address, chain);
    } else {
      setShowLabelInput(true);
    }
  };

  const handleSave = () => {
    addBookmark(address, label.trim(), chain);
    setShowLabelInput(false);
    setLabel('');
  };

  const handleCancel = () => {
    setShowLabelInput(false);
    setLabel('');
  };

  if (showLabelInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('explorer.bookmarkLabelPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          autoFocus
          maxLength={50}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Check className="h-3.5 w-3.5" /> {t('explorer.save')}
        </button>
        <button
          onClick={handleCancel}
          className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        bookmarked
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'border border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {bookmarked ? t('explorer.bookmarked') : t('explorer.bookmark')}
    </button>
  );
}