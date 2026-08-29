import React, { useState } from 'react';
import { X } from 'lucide-react';
import FieldVisibilitySelect from './FieldVisibilitySelect';

// Field — labelled editor row with an optional per-field visibility dropdown
// aligned to the right of the label.
export function Field({ label, visibility, onVis, children }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-muted-foreground">{label}</label>
        {visibility && onVis && <FieldVisibilitySelect value={visibility} onChange={onVis} />}
      </div>
      {children}
    </div>
  );
}

// TagInput — chip-style multi-value editor (interests, favourites). Enter or
// blur commits the current text as a new tag; chips remove on click.
export function TagInput({ value = [], onChange, placeholder }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setText('');
  };
  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="hover:opacity-70" aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
       aria-label={placeholder}/>
    </div>
  );
}