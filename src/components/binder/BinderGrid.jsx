import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Star, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cardImageUrl, rarityClasses, rarityKey } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import { formatPrice, conditionLabel } from '@/lib/format';

const RARITY_HEX = {
  common: 'hsl(220 9% 64%)',
  uncommon: 'hsl(0 0% 75%)',
  rare: 'hsl(217 91% 60%)',
  holo: 'hsl(45 100% 48%)',
  ex: 'hsl(258 90% 66%)',
  secret: 'hsl(45 100% 48%)',
};

export default function BinderGrid({ items, gridSize, onReorder, binderPublic, onTogglePublic }) {
  const [flipped, setFlipped] = useState({});
  const isLarge = gridSize === '9x9';
  const totalSlots = isLarge ? 81 : 9;
  const cell = isLarge ? 'w-[52px] h-[72px]' : 'w-28 h-40';

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const next = Array.from(items);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  const emptySlots = Math.max(0, totalSlots - items.length);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{items.length}</span> / {totalSlots} slots
        </div>
        <button
          onClick={onTogglePublic}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            binderPublic
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-border bg-secondary text-muted-foreground'
          }`}
        >
          {binderPublic ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {binderPublic ? 'Public' : 'Private'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Your binder is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the star on any collection card to pin it here.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="binder" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-wrap gap-2.5"
              >
                {items.map((item, index) => {
                  const key = rarityKey(item.rarity);
                  const isFlipped = !!flipped[item.id];
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(dragProvided) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={`group relative ${cell} shrink-0`}
                          style={{ ...dragProvided.draggableProps.style, perspective: '800px' }}
                        >
                          <div
                            className="relative h-full w-full transition-transform duration-500"
                            style={{
                              transformStyle: 'preserve-3d',
                              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            }}
                          >
                            {/* Front - card art */}
                            <Link
                              to={`/card/${item.card_id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className="absolute inset-0 overflow-hidden rounded-lg border bg-secondary"
                                style={{ backfaceVisibility: 'hidden', borderColor: RARITY_HEX[key] }}
                              >
                                <CardImage src={item.card_image} alt={item.card_name} quality="low" />
                                <div className="pointer-events-none absolute left-0 top-0 h-1 w-full" style={{ background: RARITY_HEX[key] }} />
                              </div>
                            </Link>

                            {/* Back - stats */}
                            <div
                              className="absolute inset-0 flex flex-col justify-between rounded-lg border border-border bg-card p-2 text-[10px]"
                              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                            >
                              <div>
                                <p className="line-clamp-2 font-bold leading-tight text-foreground">{item.card_name}</p>
                                <p className="mt-0.5 text-muted-foreground">{item.set_name}</p>
                                {item.rarity && (
                                  <p className="mt-0.5 font-semibold" style={{ color: RARITY_HEX[key] }}>{item.rarity}</p>
                                )}
                              </div>
                              <div className="space-y-0.5 text-muted-foreground">
                                <p>{conditionLabel(item.condition)}</p>
                                <p className="font-bold text-foreground">
                                  {formatPrice(item.market_value || item.purchase_price)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setFlipped((p) => ({ ...p, [item.id]: !p[item.id] }));
                            }}
                            className="absolute inset-0 z-10 cursor-pointer"
                            aria-label="Flip card"
                          />
                          <div className="absolute -right-1 -top-1 z-20 rounded-full bg-card/80 p-0.5 opacity-0 transition group-hover:opacity-100">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} className={`${cell} shrink-0 rounded-lg border border-dashed border-border/60`} />
                ))}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}