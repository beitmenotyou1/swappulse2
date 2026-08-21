import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Mail, Loader2 } from "lucide-react";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import { setStoredAuthEpoch, CURRENT_AUTH_EPOCH } from "@/lib/authEpoch";
import { safeReturnTo } from "@/lib/authReturnTo";

// Passwordless login component — routes through the verify-login-code backend
// function (NOT base44.auth.verifyOtp) so the server-side 2FA gate is enforced.
// This closes the bypass where 2FA-enabled users could log in without their
// second factor by using this component instead of the main Login page.
export default function PasswordlessLogin() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // "email" | "code" | "twofactor"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const sendCode = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setInfo("");
    if (!email) { setError("Enter your email."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("send-login-code", { email });
      if (res.data?.not_found) {
        setError("No account found with this email.");
        return;
      }
      if (res.data?.needs_setup) {
        try { await base44.auth.resetPasswordRequest(email); } catch {}
        setInfo("We've sent a sign-in link to your email. Click it to set up passwordless login.");
        return;
      }
      setStep("code");
      setInfo("We sent a 6-digit code to your email. Enter it below to log in.");
    } catch (err) {
      setError(err.message || "Could not send login code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    if (otp.length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verify-login-code", { email, code: otp });
      if (res.data?.suspended) {
        setError(res.data.reason || "Your account has been suspended.");
        return;
      }
      if (res.data?.needs_setup) {
        try { await base44.auth.resetPasswordRequest(email); } catch {}
        setInfo("We've sent a sign-in link to set up passwordless login.");
        setStep("email");
        return;
      }
      // 2FA gate: server confirmed the email OTP but won't release login_key
      // until the second factor is verified.
      if (res.data?.requires_2fa) {
        setStep("twofactor");
        return;
      }
      const loginKey = res.data?.login_key;
      if (!loginKey) {
        setError(res.data?.error || "Verification failed. Please try again.");
        return;
      }
      setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
      await base44.auth.loginViaEmailPassword(email, loginKey);
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSuccess = async (loginKey) => {
    if (!loginKey) {
      setError("Login failed. Please try again.");
      setStep("code");
      setOtp("");
      return;
    }
    setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
    try {
      await base44.auth.loginViaEmailPassword(email, loginKey);
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setStep("code");
      setOtp("");
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      {info && (
        <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm">{info}</div>
      )}

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pl-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="pl-email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending code...
              </>
            ) : (
              "Send login code"
            )}
          </Button>
        </form>
      ) : step === "code" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Enter the code sent to {email}</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button
            className="w-full h-12 font-medium"
            onClick={verifyCode}
            disabled={loading || otp.length < 6}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "Verify & log in"
            )}
          </Button>
          <div className="flex justify-between text-xs">
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(""); setInfo(""); }}
              className="text-muted-foreground hover:text-foreground"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={loading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </div>
      ) : step === "twofactor" ? (
        <TwoFactorChallenge
          email={email}
          emailCode={otp}
          onSuccess={handleTwoFactorSuccess}
          onCancel={() => { setStep("code"); setOtp(""); }}
        />
      ) : null}
    </div>
  );
}