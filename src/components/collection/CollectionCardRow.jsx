import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2, CheckSquare, Square } from 'lucide-react';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import { formatPrice, conditionLabel, variantLabel } from '@/lib/format';

export default function CollectionCardRow({ item, selected, selectMode, onToggleSelect, onToggleShowcase, onRemove }) {
  const { text } = rarityClasses(item.rarity);
  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-card p-3 ${selected ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
      {selectMode && (
        <button
          onClick={() => onToggleSelect(item.id)}
          className="shrink-0"
          title={selected ? 'Deselect' : 'Select'}
          aria-label={selected ? 'Deselect card' : 'Select card'}
        >
          {selected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
        </button>
      )}
      <button
        onClick={() => onToggleShowcase(item)}
        className={`shrink-0 ${item.showcased ? 'text-accent' : 'text-muted-foreground hover:text-accent'}`}
        title={item.showcased ? 'Remove from binder' : 'Pin to binder'}
      >
        <Star className={`h-5 w-5 ${item.showcased ? 'fill-accent' : ''}`} />
      </button>
      <Link to={`/card/${item.card_id}`}>
        <div className="h-20 w-14 overflow-hidden rounded-lg bg-secondary">
          <CardImage src={item.card_image} alt={item.card_name} quality="low" />
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/card/${item.card_id}`} className="block truncate font-semibold hover:text-primary">{item.card_name}</Link>
        <p className="truncate text-xs text-muted-foreground">{item.set_name} · #{item.local_id}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {item.rarity && <span className={`text-xs font-semibold ${text}`}>{item.rarity}</span>}
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{conditionLabel(item.condition)}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{variantLabel(item.variant)}</span>
        </div>
      </div>
      <div className="text-right">
        {item.purchase_price ? (
          <p className="text-sm font-bold">{formatPrice(item.purchase_price)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">-</p>
        )}
        <button onClick={() => onRemove(item.id)} className="mt-1 text-muted-foreground hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}