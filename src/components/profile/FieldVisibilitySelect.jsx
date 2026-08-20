import React, { useState, useRef, useEffect } from 'react';
import { Globe, UserCheck, Users, Lock, ChevronDown } from 'lucide-react';

const OPTIONS = [
  { value: 'public', label: 'Everyone', icon: Globe },
  { value: 'friends', label: 'Friends', icon: UserCheck },
  { value: 'followers', label: 'Followers', icon: Users },
  { value: 'private', label: 'Just me', icon: Lock },
];

// Compact visibility dropdown used beside each personal-info / trade-detail
// field in the profile editor. Values: public | friends | followers | private.
export default function FieldVisibilitySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];
  const Icon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-1 text-xs font-medium hover:bg-secondary/70"
      >
        <Icon className="h-3.5 w-3.5" /> {current.label} <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-elevated">
          {OPTIONS.map((o) => {
            const OIcon = o.icon;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={value === o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-medium ${value === o.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                <OIcon className="h-3.5 w-3.5" /> {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}