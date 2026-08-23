import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, Mail } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { checkPasswordBreach, BREACH_WARNING } from "@/lib/hibp";
import { setStoredAuthEpoch, CURRENT_AUTH_EPOCH } from "@/lib/authEpoch";
import { useT } from "@/lib/i18n/I18nProvider";

export default function ResetPassword() {
  const t = useT();
  useSEO({
    title: 'Reset Password',
    description: 'Set a new password for your SwapPulse account.',
    canonicalPath: '/reset-password',
  });
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const migration = searchParams.get("migration") === "1";
  const storedSetupEmail = localStorage.getItem("swappulse_setup_email");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupEmail, setSetupEmail] = useState(storedSetupEmail || "");
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    if (!resetToken || !setupEmail) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke("store-login-key", { reset_token: resetToken, email: setupEmail });
        if (cancelled) return;
        const pwd = res.data?.login_key;
        if (!pwd) throw new Error(res.data?.error || t('auth.reset.couldNotSetup'));
        localStorage.removeItem("swappulse_setup_email");
        setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
        try {
          await base44.auth.loginViaEmailPassword(setupEmail, pwd);
          if (!cancelled) window.location.href = "/";
          return;
        } catch (loginErr) {
          console.error("Auto-login after setup failed:", loginErr?.message || loginErr);
        }
        if (!cancelled) setSetupComplete(true);
      } catch (err) {
        if (!cancelled) setError(err.message || t('auth.reset.couldNotSetupRetry'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resetToken, setupEmail, t]);

  if (resetToken && setupEmail && !migration) {
    return (
      <AuthLayout
        icon={Mail}
        title={t('auth.reset.signingIn')}
        subtitle={t('auth.reset.confirmingLink')}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {setupComplete ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">
              {t('auth.reset.signedIn')}
            </p>
            <Button className="w-full h-12 font-medium" onClick={() => { window.location.href = "/"; }}>
              {t('auth.reset.goHome')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
      </AuthLayout>
    );
  }

  if (resetToken && !setupEmail && !migration) {
    const handleEmailSubmit = (e) => {
      e.preventDefault();
      setError("");
      const trimmed = emailInput.trim().toLowerCase();
      if (!trimmed) { setError(t('auth.reset.enterEmailError')); return; }
      setSetupEmail(trimmed);
    };
    return (
      <AuthLayout
        icon={Mail}
        title={t('auth.reset.completeSignin')}
        subtitle={t('auth.reset.enterEmailContinue')}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setupEmail">{t('auth.reset.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="setupEmail" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium">
            {t('auth.reset.continue')}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title={t('auth.reset.invalidLink')}
        subtitle={t('auth.reset.invalidSubtitle')}
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            {t('auth.reset.requestNew')}
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          {t('auth.reset.invalidDesc')}
        </p>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t('auth.reset.passwordsDontMatch'));
      return;
    }
    setLoading(true);
    try {
      const breachCount = await checkPasswordBreach(newPassword);
      if (breachCount > 0) {
        setError(BREACH_WARNING);
        setLoading(false);
        return;
      }
    } catch {
      // non-blocking - proceed
    }
    try {
      await base44.auth.resetPassword({ resetToken, newPassword });
      window.location.href = migration ? "/login?migration_success=1" : "/login";
    } catch (err) {
      setError(err.message || t('auth.reset.failedReset'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Lock}
      title={migration ? t('auth.reset.migrateTitle') : t('auth.reset.newTitle')}
      subtitle={migration ? t('auth.reset.migrateSubtitle') : t('auth.reset.newSubtitle')}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.reset.newPassword')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              minLength={12}
              placeholder={t('auth.reset.minChars')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('auth.reset.passwordHint')}
            </p>
        </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">{t('auth.reset.confirmPassword')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2" />
              {t('auth.reset.resetting')}
            </>
          ) : (
            t('auth.reset.resetPassword')
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}