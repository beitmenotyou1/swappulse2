import React from 'react';
import { Moon, Plus, Trash2, Clock } from 'lucide-react';

const DAYS = [
  { key: 0, label: 'Sun' },
  { key: 1, label: 'Mon' },
  { key: 2, label: 'Tue' },
  { key: 3, label: 'Wed' },
  { key: 4, label: 'Thu' },
  { key: 5, label: 'Fri' },
  { key: 6, label: 'Sat' },
];

export default function QuietHoursBuilder({ quietHours, update }) {
  const windows = Array.isArray(quietHours.windows)
    ? quietHours.windows
    : quietHours.start && quietHours.end
    ? [{ start: quietHours.start, end: quietHours.end, days: [], mode: 'hold' }]
    : [];

  const setWindows = (next) => update({ notifications: { quietHours: { windows: next } } });

  const addWindow = () => {
    setWindows([...windows, { start: '22:00', end: '08:00', days: [], mode: 'hold' }]);
  };

  const updateWindow = (idx, patch) => {
    setWindows(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  const removeWindow = (idx) => {
    setWindows(windows.filter((_, i) => i !== idx));
  };

  const toggleDay = (idx, day) => {
    const w = windows[idx];
    const days = w.days || [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    updateWindow(idx, { days: next });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Moon className="h-4 w-4 text-primary" /> Quiet hours
      </p>
      <p className="text-xs text-muted-foreground">Suppress non-critical push notifications during these windows.</p>

      <div className="mt-3 space-y-3">
        {windows.map((w, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Window {idx + 1}
              </span>
              <button onClick={() => removeWindow(idx)} className="text-muted-foreground transition hover:text-destructive" aria-label="Remove window">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <input
                aria-label={`Quiet hours start time for window ${idx + 1}`}
                type="time"
                value={w.start || '22:00'}
                onChange={(e) => updateWindow(idx, { start: e.target.value })}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                aria-label={`Quiet hours end time for window ${idx + 1}`}
                type="time"
                value={w.end || '08:00'}
                onChange={(e) => updateWindow(idx, { end: e.target.value })}
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>

            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground">Repeat on</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => toggleDay(idx, d.key)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      (w.days || []).includes(d.key) ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {(w.days || []).length === 0 ? 'Every day' : `${(w.days || []).length} day(s) selected`}
              </p>
            </div>

            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground">During quiet hours</p>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => updateWindow(idx, { mode: 'hold' })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    (w.mode || 'hold') === 'hold' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  Hold until end
                </button>
                <button
                  onClick={() => updateWindow(idx, { mode: 'digest' })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    w.mode === 'digest' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  Batch into digest
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addWindow}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add quiet hours window
      </button>
    </div>
  );
}