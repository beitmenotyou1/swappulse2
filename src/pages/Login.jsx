import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Mail, Loader2, ArrowRight, Ban } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import { setStoredAuthEpoch, CURRENT_AUTH_EPOCH } from "@/lib/authEpoch";
import { safeReturnTo } from "@/lib/authReturnTo";
import { useT } from "@/lib/i18n/I18nProvider";
import useSEO from "@/hooks/useSEO";

const CODE_EXPIRY_SECONDS = 300; // 5 minutes

export default function Login() {
  const t = useT();
  useSEO({
    title: 'Sign In',
    description: 'Log in to SwapPulse, the decentralized social network for Pokémon TCG collectors.',
    canonicalPath: '/login',
  });
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(initialEmail ? "code" : "email"); // email | code | twofactor | setup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [countdown, setCountdown] = useState(CODE_EXPIRY_SECONDS);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [suspension, setSuspension] = useState(null);
  const [twoFactorMethods, setTwoFactorMethods] = useState(["totp"]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (step !== "code") return;
    setCountdown(CODE_EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setError(t('auth.login.codeExpired'));
          setStep("email");
          return CODE_EXPIRY_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, t]);

  const sendCode = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setInfo("");
    if (!email) { setError(t('auth.login.enterEmail')); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("send-login-code", { email });
      if (res.data?.not_found) {
        setError("not_found");
        return;
      }
      if (res.data?.needs_setup) {
        try {
          await base44.auth.resetPasswordRequest(email);
          localStorage.setItem("swappulse_setup_email", email);
        } catch {}
        setStep("setup");
        return;
      }
      setStep("code");
      setInfo(t('auth.login.codeSent').replace('{email}', email));
    } catch (err) {
      setError(err.response?.data?.error || err.data?.error || err.message || t('auth.login.couldNotSend'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setError("");
    if (otp.length < 6) { setError(t('auth.login.enterCode')); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verify-login-code", { email, code: otp });
      if (res.data?.suspended) {
        setSuspension(res.data);
        setStep("suspended");
        return;
      }
      if (res.data?.needs_setup) {
        try {
          await base44.auth.resetPasswordRequest(email);
          localStorage.setItem("swappulse_setup_email", email);
        } catch {}
        setStep("setup");
        return;
      }
      if (res.data?.requires_2fa) {
        setTwoFactorMethods(res.data.methods || ["totp"]);
        setStep("twofactor");
        return;
      }
      const loginKey = res.data?.login_key;
      if (!loginKey) {
        setError(t('auth.login.verificationFailed'));
        return;
      }
      if (!stayLoggedIn) {
        sessionStorage.setItem("swappulse_session_only", "true");
      } else {
        sessionStorage.removeItem("swappulse_session_only");
      }
      setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
      await base44.auth.loginViaEmailPassword(email, loginKey);
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.response?.data?.error || err.data?.error || err.message || t('auth.login.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSuccess = async (loginKey) => {
    if (!loginKey) {
      setError(t('auth.login.loginFailed'));
      setStep("code");
      setOtp("");
      return;
    }
    setStoredAuthEpoch(CURRENT_AUTH_EPOCH);
    if (!stayLoggedIn) {
      sessionStorage.setItem("swappulse_session_only", "true");
    } else {
      sessionStorage.removeItem("swappulse_session_only");
    }
    try {
      await base44.auth.loginViaEmailPassword(email, loginKey);
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || t('auth.login.loginFailed'));
      setStep("code");
      setOtp("");
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <AuthLayout
      icon={Mail}
      title={t('auth.login.welcomeBack')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            {t('auth.login.createOne')}
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
            {t('auth.login.notFoundTitle')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('auth.login.notFoundDesc')}
          </p>
          <Link to={`/register?email=${encodeURIComponent(email)}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            {t('auth.login.createAccount')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      {info && (step === "code" || step === "setup") && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-sm">{info}</div>
      )}

      {step === "email" && (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.login.email')}</Label>
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
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>{t('auth.login.stayLoggedIn')}</span>
          </label>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('auth.login.sendingCode')}</>
            ) : (
              <>{t('auth.login.sendCode')} <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </form>
      )}

      {step === "code" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('auth.login.enterCodeSent').replace('{email}', email)}</Label>
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
              {t('auth.login.codeExpiresIn').replace('{time}', formatTime(countdown))}
            </span>
          </div>
          <Button className="w-full h-12 font-medium" onClick={verifyCode} disabled={loading || otp.length < 6}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('auth.login.verifying')}</>
            ) : (
              t('auth.login.verifyLogin')
            )}
          </Button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); setInfo(""); }} className="text-muted-foreground hover:text-foreground">
              {t('auth.login.changeEmail')}
            </button>
            <button type="button" onClick={sendCode} disabled={loading} className="text-primary hover:underline disabled:opacity-50">
              {t('auth.login.resendCode')}
            </button>
          </div>
        </div>
      )}

      {step === "setup" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            <>{t('auth.login.setupLinkSent').split('{email}')[0]}<strong>{email}</strong>{t('auth.login.setupLinkSent').split('{email}')[1]}</>
          </p>
          <button type="button" onClick={() => { setStep("email"); setInfo(""); setError(""); }} className="text-primary hover:underline text-sm">
            {t('auth.login.backToLogin')}
          </button>
        </div>
      )}

      {step === "suspended" && suspension && (
        <div className="space-y-4 text-center">
          <div className="mx-auto mb-2 rounded-full bg-destructive/10 p-3 w-fit">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-destructive">{t('auth.login.accountSuspended')}</h2>
          <p className="text-sm text-muted-foreground">{suspension.reason}</p>
          {suspension.suspended_until && (
            <p className="text-sm text-muted-foreground">
              {t('auth.login.suspensionLifted').replace('{date}', new Date(suspension.suspended_until).toLocaleDateString())}
            </p>
          )}
          {!suspension.suspended_until && (
            <p className="text-sm text-muted-foreground">{t('auth.login.suspensionIndefinite')}</p>
          )}
          <button type="button" onClick={() => { setStep("email"); setOtp(""); setSuspension(null); }} className="text-primary hover:underline text-sm">
            {t('auth.login.backToLogin')}
          </button>
        </div>
      )}

      {step === "twofactor" && (
        <TwoFactorChallenge
          email={email}
          emailCode={otp}
          methods={twoFactorMethods}
          onSuccess={handleTwoFactorSuccess}
          onCancel={() => { setStep("code"); setOtp(""); }}
        />
      )}
    </AuthLayout>
  );
}