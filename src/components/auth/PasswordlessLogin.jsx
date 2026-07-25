import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Mail, Loader2 } from "lucide-react";

// Passwordless login: enter email -> platform emails a 6-digit code -> enter
// code -> verifyOtp returns an access token -> hard redirect. Reuses the
// platform's documented OTP methods (same ones used by registration).
// NOTE: whether the platform issues a login session for an *existing verified*
// account (vs. only post-registration) is the open behaviour we're testing.
export default function PasswordlessLogin() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // "email" | "code"
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
      await base44.auth.resendOtp(email);
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
      const result = await base44.auth.verifyOtp({ email, otpCode: otp });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setLoading(false);
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
      ) : (
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
      )}
    </div>
  );
}