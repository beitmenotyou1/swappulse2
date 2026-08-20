import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, ArrowLeft, Fingerprint, Smartphone } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

// TwoFactorChallenge — handles both TOTP (authenticator app) and WebAuthn
// (security key / biometric) second factors during login.
//
// Props:
//   email      — the user's email (for lookup)
//   emailCode  — the first-factor email OTP (already verified by the server)
//   methods    — array of available 2FA methods: ['totp'], ['webauthn'], or both
//   onSuccess  — called with login_key when the second factor is verified
//   onCancel   — called when the user goes back to the email code step
export default function TwoFactorChallenge({ email, emailCode, methods = ["totp"], onSuccess, onCancel }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeMethod, setActiveMethod] = useState(methods.includes("webauthn") ? "webauthn" : "totp");
  const webauthnTriggered = useRef(false);

  const hasWebAuthn = methods.includes("webauthn");
  const hasTotp = methods.includes("totp");

  // Auto-trigger WebAuthn on mount if it's the preferred method
  useEffect(() => {
    if (activeMethod === "webauthn" && !webauthnTriggered.current) {
      webauthnTriggered.current = true;
      triggerWebAuthn();
    }
  }, [activeMethod]);

  const triggerWebAuthn = async () => {
    setError("");
    setLoading(true);
    try {
      const optsRes = await base44.functions.invoke("webauthn-auth-options", { email });
      const { options, challenge_signature } = optsRes.data;
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await base44.functions.invoke("webauthn-verify-auth", {
        email,
        assertion,
        challenge: options.challenge,
        challenge_signature,
      });
      if (verifyRes.data?.login_key) {
        onSuccess?.(verifyRes.data.login_key);
      } else if (verifyRes.data?.suspended) {
        setError(verifyRes.data.reason || "Your account has been suspended.");
      } else if (verifyRes.data?.needs_setup) {
        setError("Account setup required. Please request a new login code.");
      } else {
        setError(verifyRes.data?.error || "Security key verification failed");
      }
    } catch (err) {
      // AbortError means the user cancelled the browser prompt — don't show an error
      if (err.name === "AbortError") {
        setError("");
      } else {
        setError(err.message || "Security key authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyTotp = async () => {
    setError("");
    if (code.length < 6) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verify-login-code", {
        email,
        code: emailCode,
        two_factor_code: code,
      });
      if (res.data?.login_key) {
        onSuccess?.(res.data.login_key);
      } else {
        setError(res.data?.error || "Invalid 2FA code");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <KeyRound className="h-5 w-5" />
        <p className="text-sm font-bold">Two-factor authentication</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {activeMethod === "webauthn" ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Fingerprint className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {loading ? "Waiting for your security key..." : "Tap your security key or use biometrics to continue."}
            </p>
          </div>
          {loading && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && (
            <Button className="w-full h-12 font-medium" onClick={triggerWebAuthn}>
              <Fingerprint className="w-4 h-4 mr-2" /> Try again
            </Button>
          )}
          {hasTotp && !loading && (
            <button
              onClick={() => { setError(""); setActiveMethod("totp"); }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Smartphone className="h-3.5 w-3.5" /> Use authenticator app instead
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, 1Password, etc.).
          </p>
          <div className="space-y-2">
            <Label>Authentication code</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus autoComplete="one-time-code">
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button className="w-full h-12 font-medium" onClick={verifyTotp} disabled={loading || code.length < 6}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify & continue"}
          </Button>
          {hasWebAuthn && (
            <button
              onClick={() => { setError(""); setActiveMethod("webauthn"); }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Fingerprint className="h-3.5 w-3.5" /> Use security key instead
            </button>
          )}
        </div>
      )}

      {onCancel && (
        <button onClick={onCancel} className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to login code
        </button>
      )}
    </div>
  );
}