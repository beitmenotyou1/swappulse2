import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// Grouped profile tab navigation. Renders a compact set of primary tabs inline
// and tucks the remaining tabs into a "More" dropdown, so the row never
// overflows horizontally — even when a profile has 12 sections.
export default function ProfileTabNav({ tabs, activeTab, onChange, primaryCount = 5, accentHex }) {
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

  const primary = tabs.slice(0, primaryCount);
  const overflow = tabs.slice(primaryCount);
  const overflowActive = overflow.some((t) => t.key === activeTab);

  const TabButton = ({ tab }) => (
    <button
      onClick={() => onChange(tab.key)}
      className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors ${activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
    >
      {tab.icon}
      {tab.label}
      {activeTab === tab.key && <span className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full" style={{ backgroundColor: accentHex || 'hsl(var(--primary))' }} />}
    </button>
  );

  return (
    <div className="mt-4 flex items-stretch border-b border-border">
      <div className="flex flex-1 overflow-x-auto">
        {primary.map((tab) => <TabButton key={tab.key} tab={tab} />)}
      </div>
      {overflow.length > 0 && (
        <div className="relative flex" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors ${overflowActive ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
          >
            More
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            {overflowActive && <span className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full" style={{ backgroundColor: accentHex || 'hsl(var(--primary))' }} />}
          </button>
          {open && (
            <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-elevated">
              {overflow.map((tab) => (
                <button
                  key={tab.key}
                  role="menuitem"
                  onClick={() => { onChange(tab.key); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}