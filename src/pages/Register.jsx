import React, { useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { UserPlus, Mail, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import ProfileSetup from "@/components/auth/ProfileSetup";
import OnboardingTour from "@/components/onboarding/OnboardingTour";
import { setStoredAuthEpoch, CURRENT_AUTH_EPOCH } from "@/lib/authEpoch";

function randomPassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(36).padStart(2, "0")).join("") + "!A1";
}

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("email"); // email | confirm-email | code | profile | tour
  const [otp, setOtp] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const generatedPasswordRef = useRef("");

  const handleContinue = (e) => {
    e.preventDefault();
    setError("");
    if (!ageConfirmed) {
      setError("Please confirm you are 13 or older to create an account.");
      return;
    }
    setConfirmEmail("");
    setStep("confirm-email");
  };

  const handleRegister = async () => {
    setError("");
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError("Email addresses do not match. Please check and try again.");
      return;
    }
    setLoading(true);
    try {
      // Register with a random password (user never sees it; login is passwordless)
      const pwd = randomPassword();
      generatedPasswordRef.current = pwd;
      await base44.auth.register({ email, password: pwd });
      try { await base44.functions.invoke("send-activation", { email }); } catch {}
      setStep("code");
    } catch (err) {
      setError(err.message || "Registration failed");
      setStep("email");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    if (otp.length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode: otp });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
        try { await base44.auth.updateMe({ login_key: generatedPasswordRef.current }); } catch {}
      }
      setStep("profile");
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  if (step === "tour") {
    return <OnboardingTour onComplete={() => navigate("/profile")} />;
  }

  if (step === "profile") {
    return <ProfileSetup onDone={() => setStep("tour")} />;
  }

  if (step === "confirm-email") {
    return (
      <AuthLayout
        icon={Mail}
        title="Confirm your email"
        subtitle="Re-enter your email address to make sure it's correct — this is where we'll send your verification code"
        footer={<button onClick={() => setStep("email")} className="text-primary font-medium hover:underline">Back to edit</button>}
      >
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-secondary/60 text-center">
            <p className="text-sm text-muted-foreground">You entered</p>
            <p className="font-semibold text-foreground">{email}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmEmail">Confirm email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="confirmEmail" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="pl-10 h-12" />
            </div>
          </div>
          <Button className="w-full h-12 font-medium" onClick={handleRegister} disabled={loading || !confirmEmail.trim()}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending code...</> : "Send verification code"}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (step === "code") {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
        footer={<Link to="/login" className="text-primary font-medium hover:underline">Back to log in</Link>}
      >
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="w-full h-12 font-medium" onClick={handleVerify} disabled={loading || otp.length < 6}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</> : "Verify"}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">Resend</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up — no password needed, just your email"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </>
      }
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <form onSubmit={handleContinue} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" required />
          <span>I confirm I am 13 or older and agree to SwapPulse's terms (under-16s need a parent or guardian's consent).</span>
        </label>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</> : "Continue"}
        </Button>
      </form>
    </AuthLayout>
  );
}