import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Eye, EyeOff, GripVertical, Layout } from 'lucide-react';
import { PROFILE_THEMES, BLOCK_LABELS, DEFAULT_BLOCK_ORDER } from '@/lib/profileThemes';

// LayoutThemeTab — pick from the merged 11-theme picker (5 gradient + 6
// platform layouts), drag-to-reorder the About-section content blocks, and
// toggle tab visibility. Posts is locked on (never hideable).
export default function LayoutThemeTab({ draft, update, sectionLabels }) {
  const blockOrder = draft.block_order?.length ? draft.block_order : DEFAULT_BLOCK_ORDER;
  const sectionOrder = draft.section_order || [];
  const hidden = new Set(draft.hidden_sections || []);

  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = Array.from(blockOrder);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    update({ block_order: next });
  };

  const toggleSection = (key) => {
    if (key === 'Posts') return;
    update({
      hidden_sections: hidden.has(key)
        ? draft.hidden_sections.filter((k) => k !== key)
        : [...(draft.hidden_sections || []), key],
    });
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
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-semibold">{th.label}</span>
                {th.platform && <Layout className="h-3 w-3 text-muted-foreground" />}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Gradient themes restyle the header. Platform themes restructure the About view into that platform's layout.</p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-muted-foreground">Content blocks · drag to reorder</label>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="blocks">
            {(provided) => (
              <ol ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                {blockOrder.map((key, i) => (
                  <Draggable key={key} draggableId={key} index={i}>
                    {(p) => (
                      <li
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card p-2"
                      >
                        <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></span>
                        <span className="flex-1 text-sm font-medium">{BLOCK_LABELS[key] || key}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{i + 1}</span>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ol>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {sectionOrder.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-muted-foreground">Tabs · tap eye to hide</label>
          <div className="flex flex-wrap gap-1.5">
            {sectionOrder.map((key) => {
              const isHidden = hidden.has(key);
              const locked = key === 'Posts';
              return (
                <button
                  key={key}
                  type="button"
                  disabled={locked}
                  onClick={() => toggleSection(key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${isHidden ? 'border-dashed border-border opacity-50' : 'border-border hover:bg-secondary'} disabled:opacity-60`}
                  aria-label={isHidden ? 'Show tab' : 'Hide tab'}
                >
                  {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {sectionLabels?.[key] || key}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}