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
import { useT } from "@/lib/i18n/I18nProvider";

function randomPassword() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(36).padStart(2, "0")).join("") + "!A1";
}

export default function Register() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("email"); // email | confirm-email | code | profile | tour
  const [otp, setOtp] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [inviteCode] = useState(searchParams.get("invite") || "");
  const generatedPasswordRef = useRef("");

  const handleContinue = (e) => {
    e.preventDefault();
    setError("");
    if (!ageConfirmed) {
      setError(t('auth.register.ageError'));
      return;
    }
    if (!termsConfirmed) {
      setError(t('auth.register.termsError'));
      return;
    }
    if (!privacyConfirmed) {
      setError(t('auth.register.privacyError'));
      return;
    }
    setConfirmEmail("");
    setStep("confirm-email");
  };

  const handleRegister = async () => {
    setError("");
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setError(t('auth.register.emailMismatch'));
      return;
    }
    setLoading(true);
    try {
      const blocklistCheck = await base44.functions.invoke("check-username", { email: email.trim().toLowerCase() });
      if (blocklistCheck.data?.available === false) {
        setError(blocklistCheck.data.reason || t('auth.register.emailUnavailable'));
        return;
      }
      const pwd = randomPassword();
      generatedPasswordRef.current = pwd;
      await base44.auth.register({ email, password: pwd });
      try { await base44.functions.invoke("send-activation", { email }); } catch {}
      setStep("code");
    } catch (err) {
      setError(err.message || t('auth.register.registrationFailed'));
      setStep("email");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    if (otp.length < 6) { setError(t('auth.register.enterCode')); return; }
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode: otp });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
        try { await base44.auth.updateMe({ login_key: generatedPasswordRef.current }); } catch {}
        if (inviteCode) {
          try { await base44.functions.invoke("validate-invite", { code: inviteCode, redeem: true }); } catch {}
        }
      }
      setStep("profile");
    } catch (err) {
      setError(err.message || t('auth.register.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
    } catch (err) {
      setError(err.message || t('auth.register.resendFailed'));
    }
  };

  if (step === "tour") {
    return <OnboardingTour onComplete={() => navigate("/profile")} />;
  }

  if (step === "profile") {
    return (
      <ProfileSetup
        onDone={() => setStep("tour")}
      />
    );
  }

  if (step === "confirm-email") {
    return (
      <AuthLayout
        icon={Mail}
        title={t('auth.register.confirmTitle')}
        subtitle={t('auth.register.confirmSubtitle')}
        footer={<button onClick={() => setStep("email")} className="text-primary font-medium hover:underline">{t('auth.register.backToEdit')}</button>}
      >
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-secondary/60 text-center">
            <p className="text-sm text-muted-foreground">{t('auth.register.youEntered')}</p>
            <p className="font-semibold text-foreground">{email}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmEmail">{t('auth.register.confirmEmail')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="confirmEmail" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="pl-10 h-12" />
            </div>
          </div>
          <Button className="w-full h-12 font-medium" onClick={handleRegister} disabled={loading || !confirmEmail.trim()}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('auth.register.sendingCode')}</> : t('auth.register.sendVerification')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (step === "code") {
    return (
      <AuthLayout
        icon={Mail}
        title={t('auth.register.verifyTitle')}
        subtitle={t('auth.register.verifySubtitle').replace('{email}', email)}
        footer={<Link to="/login" className="text-primary font-medium hover:underline">{t('auth.register.backToLogin')}</Link>}
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
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('auth.register.verifying')}</> : t('auth.register.verify')}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('auth.register.didntReceive')}{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">{t('auth.register.resend')}</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title={t('auth.register.createAccount')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.haveAccount')}{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">{t('auth.register.login')}</Link>
        </>
      }
    >
      {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <form onSubmit={handleContinue} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.register.email')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" />
          <span>{t('auth.register.ageConfirm')}</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={termsConfirmed} onChange={(e) => setTermsConfirmed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" />
          <span>
            {t('auth.register.termsConfirm')}{" "}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">{t('auth.register.terms')}</Link>.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={privacyConfirmed} onChange={(e) => setPrivacyConfirmed(e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" />
          <span>
            {t('auth.register.privacyConfirm')}{" "}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">{t('auth.register.privacyPolicy')}</Link>.
          </span>
        </label>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('auth.register.creating')}</> : t('auth.register.continue')}
        </Button>
      </form>
    </AuthLayout>
  );
}