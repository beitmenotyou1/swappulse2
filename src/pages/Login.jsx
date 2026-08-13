import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import { setStoredAuthEpoch, CURRENT_AUTH_EPOCH } from "@/lib/authEpoch";

const CODE_EXPIRY_SECONDS = 300; // 5 minutes

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(initialEmail ? "code" : "email"); // email | code | twofactor | setup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pendingLoginKey, setPendingLoginKey] = useState(null);
  const [countdown, setCountdown] = useState(CODE_EXPIRY_SECONDS);
  const timerRef = useRef(null);

  useEffect(() => {
    if (step !== "code") return;
    setCountdown(CODE_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setError("Code expired. Please request a new one.");
          setStep("email");
          return CODE_EXPIRY_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  const sendCode = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setInfo("");
    if (!email) { setError("Enter your email."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("send-login-code", { email });
      if (res.data?.not_found) {
        setError("not_found");
        return;
      }
      if (res.data?.needs_setup) {
        // Existing user without passwordless login — trigger one-time setup
        try {
          await base44.auth.resetPasswordRequest(email);
          localStorage.setItem("swappulse_setup_email", email);
        } catch {}
        setStep("setup");
        return;
      }
      setStep("code");
      setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
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
      if (res.data?.needs_setup) {
        // User lost their login_key between send and verify — fall back to setup
        try {
          await base44.auth.resetPasswordRequest(email);
          localStorage.setItem("swappulse_setup_email", email);
        } catch {}
        setStep("setup");
        return;
      }
      const loginKey = res.data?.login_key;
      if (!loginKey) {
        setError("Verification failed. Please try again.");
        return;
      }
      // Check 2FA before logging in
      try {
        const twofaRes = await base44.functions.invoke("verify-2fa", { mode: "check", email });
        if (twofaRes.data?.requires_2fa) {
          setPendingLoginKey(loginKey);
          setStep("twofactor");
          return;
        }
      } catch {
        // If check fails, proceed without 2FA
      }
      // Log in with the stored login_key
      setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
      await base44.auth.loginViaEmailPassword(email, loginKey);
      // SDK sets the token but does NOT hard-redirect — redirect explicitly
      const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSuccess = async () => {
    setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
    try {
      await base44.auth.loginViaEmailPassword(email, pendingLoginKey);
      // SDK sets the token but does NOT hard-redirect — redirect explicitly
      const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      setStep("code");
      setOtp("");
      setPendingLoginKey(null);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <AuthLayout
      icon={Mail}
      title="Welcome back"
      subtitle="Sign in with your email — no password needed"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {error && error !== "not_found" && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      {error === "not_found" && (
        <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
          <p className="text-sm text-destructive font-medium">
            No account found with this email address.
          </p>
          <p className="text-sm text-muted-foreground">
            You'll need to create an account to join SwapPulse and start collecting, trading, and connecting.
          </p>
          <Link to={`/register?email=${encodeURIComponent(email)}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Create an account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      {info && (step === "code" || step === "setup") && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-sm">{info}</div>
      )}

      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
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
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending code...</>
            ) : (
              <>Send login code <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </form>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Enter the code sent to {email}</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className={countdown < 60 ? "text-destructive font-semibold" : "text-muted-foreground"}>
              Code expires in {formatTime(countdown)}
            </span>
          </div>
          <Button className="w-full h-12 font-medium" onClick={verifyCode} disabled={loading || otp.length < 6}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
            ) : (
              "Verify & log in"
            )}
          </Button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); setInfo(""); }} className="text-muted-foreground hover:text-foreground">
              Change email
            </button>
            <button type="button" onClick={sendCode} disabled={loading} className="text-primary hover:underline disabled:opacity-50">
              Resend code
            </button>
          </div>
        </div>
      )}

      {step === "setup" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            We've sent a sign-in link to <strong>{email}</strong>. Click the link in the email to sign in instantly — next time you'll get a 6-digit code instead.
          </p>
          <button type="button" onClick={() => { setStep("email"); setInfo(""); setError(""); }} className="text-primary hover:underline text-sm">
            Back to login
          </button>
        </div>
      )}

      {step === "twofactor" && (
        <TwoFactorChallenge
          email={email}
          onSuccess={handleTwoFactorSuccess}
          onCancel={() => { setStep("code"); setOtp(""); setPendingLoginKey(null); }}
        />
      )}
    </AuthLayout>
  );
}