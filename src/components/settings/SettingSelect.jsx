import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// SettingSelect — a bottom-sheet drawer replacement for native <select> tags
// in Settings. Renders a full-width tappable button showing the current value;
// tapping opens a bottom sheet with the options listed as full-width rows.
// Designed for Android WebView where native <select> dropdowns feel jarring.
export default function SettingSelect({ value, options, onChange, label, className }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-secondary ${className || ''}`}
      >
        <span>{selected?.label || 'Select…'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="px-4 pt-4 pb-2 text-left">
            <SheetTitle>{label}</SheetTitle>
          </SheetHeader>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm transition-colors hover:bg-secondary ${opt.value === value ? 'font-bold text-primary' : 'text-foreground'}`}
              >
                {opt.label}
                {opt.value === value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}