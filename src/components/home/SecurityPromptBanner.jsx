import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Shield, Fingerprint, Smartphone, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DISMISS_KEY = "swappulse_2fa_banner_dismissed";

// SecurityPromptBanner — dismissible banner shown on the Home page when the
// user has no second factor enrolled (no TOTP and no WebAuthn passkeys).
// Encourages enabling 2FA with CTAs to Settings → Security.
export default function SecurityPromptBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) {
      setLoading(false);
      return;
    }
    base44.auth.me().then((u) => {
      const has2fa = u?.two_factor_enabled || u?.webauthn_enabled;
      if (!has2fa) setShow(true);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setShow(false);
  };

  if (loading || !show) return null;

  return (
    <div className="relative mx-4 my-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Secure your account</h3>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Add a second factor to protect your account. After your email code, you'll also verify with a passkey or authenticator app.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Fingerprint className="h-3.5 w-3.5" /> Add a passkey
            </Link>
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <Smartphone className="h-3.5 w-3.5" /> Enable 2FA app
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}