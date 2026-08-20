import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { PROFILE_THEMES } from '@/lib/profileThemes';

// LayoutThemeTab — pick a preset profile theme (header gradient) and
// drag-to-reorder the profile sections, toggling each section's visibility.
// Posts is locked on (never hideable).
export default function LayoutThemeTab({ draft, update, sectionLabels }) {
  const order = draft.section_order || [];
  const hidden = new Set(draft.hidden_sections || []);

  const toggle = (key) => {
    if (key === 'Posts') return;
    update({ hidden_sections: hidden.has(key) ? draft.hidden_sections.filter((k) => k !== key) : [...draft.hidden_sections, key] });
  };

  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = Array.from(order);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    update({ section_order: next });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Profile theme</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROFILE_THEMES.map((th) => (
            <button
              key={th.key}
              type="button"
              onClick={() => update({ theme: th.key })}
              className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${draft.theme === th.key ? 'border-primary' : 'border-border hover:border-border-strong'}`}
            >
              <div className={`h-12 w-full bg-gradient-to-r ${th.gradient}`} />
              <div className="px-2 py-1.5 text-xs font-semibold">{th.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Sections · drag to reorder, tap eye to hide</label>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="sections">
            {(provided) => (
              <ol ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                {order.map((key, i) => {
                  const isHidden = hidden.has(key);
                  const locked = key === 'Posts';
                  return (
                    <Draggable key={key} draggableId={key} index={i}>
                      {(p) => (
                        <li
                          ref={p.innerRef}
                          {...p.draggableProps}
                          className={`flex items-center gap-2 rounded-xl border bg-card p-2 ${isHidden ? 'border-dashed border-border opacity-60' : 'border-border'}`}
                        >
                          <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></span>
                          <span className="flex-1 text-sm font-medium">{sectionLabels?.[key] || key}</span>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggle(key)}
                            className="rounded-lg p-1.5 hover:bg-secondary disabled:opacity-40"
                            aria-label={isHidden ? 'Show section' : 'Hide section'}
                          >
                            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </ol>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}