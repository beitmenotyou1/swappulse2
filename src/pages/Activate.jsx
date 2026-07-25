import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import { Mail, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

export default function Activate() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  // checking | valid | expired | invalid | none
  const [linkState, setLinkState] = useState(token ? "checking" : "none");

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke("verify-activation-link", { token });
        const body = res?.data ?? res;
        if (!active) return;
        if (body.valid) {
          setEmail(body.email || "");
          setLinkState("valid");
          setInfo("Your activation link is valid. Enter the code from your email to activate.");
        } else if (body.reason === "expired") {
          setEmail(body.email || "");
          setLinkState("expired");
          setInfo("This activation link has expired. Resend a fresh link, then enter the new code.");
        } else {
          setLinkState("invalid");
        }
      } catch {
        if (active) setLinkState("invalid");
      }
    })();
    return () => { active = false; };
  }, [token]);

  const handleResend = async () => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Enter your email to resend the activation link.");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resendOtp(email);
      try { await base44.functions.invoke("send-activation", { email }); } catch {}
      setInfo("Activation email sent. Check your inbox for the code and link.");
      setLinkState("valid");
    } catch (e) {
      setError(e.message || "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    if (!email) { setError("Enter your email."); return; }
    if (otp.length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode: otp });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      window.location.href = "/";
    } catch (e) {
      setError(e.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Activate your account"
      subtitle="Enter the code from your email to activate"
      footer={
        <>
          <Link to="/login" className="text-primary font-medium hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {linkState === "checking" && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {linkState === "invalid" && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>This activation link is not valid. You can still activate by entering your email and the code from your verification email.</span>
        </div>
      )}
      {info && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-sm">{info}</div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              placeholder="you@example.com"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Verification code</Label>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} autoFocus={linkState !== "none"}>
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
          onClick={handleVerify}
          disabled={loading || otp.length < 6 || !email}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Activating...
            </>
          ) : (
            "Activate account"
          )}
        </Button>
        <button
          onClick={handleResend}
          disabled={loading}
          className="w-full text-sm text-primary font-medium hover:underline disabled:opacity-50"
        >
          Resend activation email
        </button>
      </div>
    </AuthLayout>
  );
}