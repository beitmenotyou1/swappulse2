import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// Grouped profile tab navigation. Renders a compact set of primary tabs inline
// and tucks the remaining tabs into a "More" dropdown, so the row never
// overflows horizontally — even when a profile has 12 sections.
//
// WCAG 2.1 AA: role="tablist"/role="tab" with aria-selected and roving
// tabindex, arrow-key + Home/End navigation between tabs, and a
// keyboard-operable "More" menu (focus moves into the menu on open, Arrow
// Up/Down moves between items, Escape closes, click-outside dismisses).
// Touch targets meet 44px minimum height at mobile breakpoints.
export default function ProfileTabNav({ tabs, activeTab, onChange, primaryCount = 5, accentHex }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const tabRefs = useRef([]);

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

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open && menuRef.current) {
      const first = menuRef.current.querySelector('[role="menuitem"]');
      if (first) first.focus();
    }
  }, [open]);

  const primary = tabs.slice(0, primaryCount);
  const overflow = tabs.slice(primaryCount);
  const overflowActive = overflow.some((t) => t.key === activeTab);
  const primaryActiveIdx = primary.findIndex((t) => t.key === activeTab);

  const focusTab = (idx) => {
    const el = tabRefs.current[idx];
    if (el) el.focus();
  };

  const onTabKeyDown = (e, idx) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusTab((idx + 1) % primary.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusTab((idx - 1 + primary.length) % primary.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(primary.length - 1);
    }
  };

  const onMenuKeyDown = (e) => {
    if (!menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]'));
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    }
  };

  const TabButton = ({ tab, idx }) => {
    const selected = activeTab === tab.key;
    // Roving tabindex: the active tab (or the first primary tab when the
    // active tab lives in the overflow menu) is tabbable; the rest are not.
    const tabbable = selected || (primaryActiveIdx === -1 && idx === 0);
    return (
      <button
        ref={(el) => { tabRefs.current[idx] = el; }}
        role="tab"
        id={`profile-tab-${tab.key}`}
        aria-selected={selected}
        aria-controls="profile-tabpanel"
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onChange(tab.key)}
        onKeyDown={(e) => onTabKeyDown(e, idx)}
        className={`relative flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors ${selected ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
      >
        {tab.icon}
        {tab.label}
        {selected && <span className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full" style={{ backgroundColor: accentHex || 'hsl(var(--primary))' }} />}
      </button>
    );
  };

  return (
    <nav aria-label="Profile sections" className="mt-4">
      <div className="flex items-stretch border-b border-border">
        <div className="flex flex-1 overflow-x-auto" role="tablist" aria-orientation="horizontal">
          {primary.map((tab, i) => <TabButton key={tab.key} tab={tab} idx={i} />)}
        </div>
        {overflow.length > 0 && (
          <div className="relative flex" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="More profile sections"
              className={`relative flex min-h-[44px] shrink-0 items-center gap-1 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors ${overflowActive ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'}`}
            >
              More
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              {overflowActive && <span className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full" style={{ backgroundColor: accentHex || 'hsl(var(--primary))' }} />}
            </button>
            {open && (
              <div ref={menuRef} role="menu" aria-label="More profile sections" onKeyDown={onMenuKeyDown} className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-elevated">
                {overflow.map((tab) => (
                  <button
                    key={tab.key}
                    role="menuitem"
                    onClick={() => { onChange(tab.key); setOpen(false); }}
                    className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
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
    </nav>
  );
}