import React, { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const STORAGE_KEY = 'swappulse-cookie-consent';
const CONSENT_VERSION = '1.0';

const CATEGORIES = [
  { key: 'essential', label: 'Essential', desc: 'Login, session, security. Always on.', locked: true },
  { key: 'functional', label: 'Functional', desc: 'Preferences, offline cache, PWA features.' },
  { key: 'analytics', label: 'Analytics', desc: 'Aggregate usage insights (no individual tracking).' },
  { key: 'marketing', label: 'Marketing', desc: 'Onboarding emails and weekly digest.' },
];

export default function CookieConsentBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    essential: true,
    analytics: false,
    marketing: false,
    functional: true,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setVisible(true);
      } else {
        const parsed = JSON.parse(stored);
        if (parsed.version !== CONSENT_VERSION) {
          setVisible(true);
        }
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const persist = async (categories) => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: CONSENT_VERSION,
        categories,
        given_at: new Date().toISOString(),
      }));
      if (user) {
        await base44.functions.invoke('update-consent-preferences', {
          cookie_categories: categories,
          analytics_consent: categories.analytics,
          marketing_consent: categories.marketing,
          notification_consent: true,
          do_not_sell: false,
        }).catch(() => {});
      }
    } finally {
      setSaving(false);
      setVisible(false);
      setExpanded(false);
    }
  };

  const acceptAll = () => {
    const all = { essential: true, analytics: true, marketing: true, functional: true };
    setPrefs(all);
    persist(all);
  };

  const rejectAll = () => {
    const minimal = { essential: true, analytics: false, marketing: false, functional: true };
    setPrefs(minimal);
    persist(minimal);
  };

  const savePrefs = () => persist(prefs);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:p-4" role="dialog" aria-label="Cookie consent">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-elevated">
        <div className="flex items-start gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Cookie className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Cookie preferences</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We use essential cookies to run SwapPulse. Optional cookies help us improve. See our{' '}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
            {expanded && (
              <div className="mt-3 space-y-2">
                {CATEGORIES.map((cat) => (
                  <label key={cat.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">{cat.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={cat.locked ? true : prefs[cat.key]}
                      disabled={cat.locked}
                      onChange={(e) => setPrefs({ ...prefs, [cat.key]: e.target.checked })}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={acceptAll}
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                Accept all
              </button>
              <button
                onClick={rejectAll}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                Reject all
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {expanded ? 'Hide options' : 'Preferences'}
              </button>
              {expanded && (
                <button
                  onClick={savePrefs}
                  disabled={saving}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                >
                  Save preferences
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}