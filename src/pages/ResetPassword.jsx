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

function randomPassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(36).padStart(2, "0")).join("") + "!A1";
}

export default function ResetPassword() {
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

  // Auto-setup passwordless login when the user arrives via the setup flow
  useEffect(() => {
    if (!resetToken || !setupEmail) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pwd = randomPassword();
        await base44.auth.resetPassword({ resetToken, newPassword: pwd });
        if (cancelled) return;
        await base44.functions.invoke("store-login-key", { email: setupEmail, login_key: pwd });
        if (cancelled) return;
        localStorage.removeItem("swappulse_setup_email");
        // Auto-login: use the freshly-bound password to sign in immediately
        setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
        try {
          await base44.auth.loginViaEmailPassword(setupEmail, pwd);
          // SDK sets the token but does NOT hard-redirect — redirect explicitly
          if (!cancelled) window.location.href = "/";
          return;
        } catch (loginErr) {
          // If auto-login fails (e.g. 2FA required), fall back to showing the success screen
          console.error("Auto-login after setup failed:", loginErr?.message || loginErr);
        }
        if (!cancelled) setSetupComplete(true);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not set up passwordless login. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resetToken, setupEmail]);

  // Setup mode: automatic passwordless setup (no user interaction needed)
  if (resetToken && setupEmail && !migration) {
    return (
      <AuthLayout
        icon={Mail}
        title="Signing you in"
        subtitle="Confirming your sign-in link"
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {setupComplete ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">
              You're signed in! Next time, you'll get a 6-digit code instead.
            </p>
            <Button className="w-full h-12 font-medium" onClick={() => { window.location.href = "/"; }}>
              Go to home
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

  // Setup mode but email not stored (e.g. opened on a different device) — ask for email
  if (resetToken && !setupEmail && !migration) {
    const handleEmailSubmit = (e) => {
      e.preventDefault();
      setError("");
      const trimmed = emailInput.trim().toLowerCase();
      if (!trimmed) { setError("Enter your email to continue."); return; }
      setSetupEmail(trimmed);
    };
    return (
      <AuthLayout
        icon={Mail}
        title="Complete your sign-in"
        subtitle="Enter your email to continue"
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setupEmail">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="setupEmail" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium">
            Continue
          </Button>
        </form>
      </AuthLayout>
    );
  }

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Invalid reset link"
        subtitle="This password reset link is missing or invalid"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          The link you used appears to be incomplete. Please request a new password reset email.
        </p>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
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
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Lock}
      title={migration ? "Set your new password" : "New password"}
      subtitle={migration ? "Complete your migration from Google" : "Enter your new password below"}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              minLength={12}
              placeholder="At least 12 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum 12 characters - use a mix of upper and lower case, numbers and symbols.
            </p>
        </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
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
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}