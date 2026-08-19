import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";

export default function TwoFactorChallenge({ email, emailCode, onSuccess, onCancel }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verify = async () => {
    setError("");
    if (code.length < 6) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setLoading(true);
    try {
      // Send both the email OTP (first factor, already verified) and the TOTP
      // (second factor) to verify-login-code. The server verifies the TOTP
      // before releasing the login_key — 2FA is enforced server-side.
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
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app (Google Authenticator, Authy, 1Password, etc.).
      </p>
      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
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
      <Button className="w-full h-12 font-medium" onClick={verify} disabled={loading || code.length < 6}>
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify & continue"}
      </Button>
      {onCancel && (
        <button onClick={onCancel} className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to login code
        </button>
      )}
    </div>
  );
}