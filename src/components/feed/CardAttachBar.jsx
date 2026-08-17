import React, { useState } from 'react';
import { Image, ScanLine, FolderOpen, X } from 'lucide-react';
import CardSearchModal from '@/components/cards/CardSearchModal';
import CardScanModal from '@/components/feed/CardScanModal';
import CollectionPickerModal from '@/components/feed/CollectionPickerModal';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

// Reusable attach bar shared by the post composer, comment composer, and
// quote composer. Renders three triggers — text search (Card), AI scanner
// (Scan), and collection picker (Collection) — plus a compact preview of the
// attached card with a remove button. `value` is the attached card
// ({ id, name, image, rarity, set: { name } }) or null; `onChange` receives
// the new card or null when cleared.
export default function CardAttachBar({ value, onChange, searchTitle = 'Attach a card', compact = false }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);

  const attach = (card) => onChange(card);
  const clear = () => onChange(null);

  if (value) {
    const { text } = rarityClasses(value.rarity);
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-secondary p-2">
        {cardImageUrl(value.image) ? (
          <img src={cardImageUrl(value.image)} alt={value.name} className="h-12 w-9 shrink-0 rounded object-cover" />
        ) : (
          <div className="grid h-12 w-9 shrink-0 place-items-center rounded bg-muted text-[9px] text-muted-foreground">No img</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{value.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{value.set?.name || ''}</p>
          {value.rarity && <p className={`truncate text-[10px] ${text}`}>{value.rarity}</p>}
        </div>
        <button onClick={clear} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove card">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const btn = 'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10 sm:text-sm';

  return (
    <>
      <div className={`flex flex-wrap items-center gap-1 ${compact ? 'mt-1.5' : 'mt-2'}`}>
        <button onClick={() => setSearchOpen(true)} className={btn}>
          <Image className="h-4 w-4" /> Card
        </button>
        <button onClick={() => setScanOpen(true)} className={btn}>
          <ScanLine className="h-4 w-4" /> Scan
        </button>
        <button onClick={() => setCollectionOpen(true)} className={btn}>
          <FolderOpen className="h-4 w-4" /> Collection
        </button>
      </div>
      <CardSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={attach} title={searchTitle} />
      <CardScanModal open={scanOpen} onClose={() => setScanOpen(false)} onAttach={attach} />
      <CollectionPickerModal open={collectionOpen} onClose={() => setCollectionOpen(false)} onAttach={attach} />
    </>
  );
}