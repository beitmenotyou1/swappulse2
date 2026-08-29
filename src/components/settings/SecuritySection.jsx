import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Check, QrCode, LockKeyhole, MailCheck } from "lucide-react";
import WebAuthnSection from "@/components/settings/WebAuthnSection";

export default function SecuritySection() {
  const [user, setUser] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [secret, setSecret] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [stepCodeSent, setStepCodeSent] = useState(false);
  const [stepCode, setStepCode] = useState("");
  const [managementToken, setManagementToken] = useState("");
  const [managementExpiresAt, setManagementExpiresAt] = useState(0);
  const [stepLoading, setStepLoading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const enabled = !!user?.two_factor_enabled;
  const securityUnlocked = !!managementToken && Date.now() < managementExpiresAt;

  const clearUnlock = () => {
    setManagementToken("");
    setManagementExpiresAt(0);
    setStepCode("");
    setStepCodeSent(false);
  };

  const sendStepUpCode = async () => {
    setStepLoading(true);
    setError("");
    setSuccess("");
    try {
      await base44.functions.invoke("security-stepup-send", {});
      setStepCodeSent(true);
      setStepCode("");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not send security code");
    } finally {
      setStepLoading(false);
    }
  };

  const verifyStepUpCode = async () => {
    if (stepCode.length !== 6) return;
    setStepLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("security-stepup-verify", { code: stepCode });
      const token = res.data?.management_token;
      if (!token) throw new Error(res.data?.error || "Verification failed");
      setManagementToken(token);
      setManagementExpiresAt(Date.now() + (Number(res.data?.expires_in_seconds || 600) * 1000));
      setStepCode("");
      setStepCodeSent(false);
      setSuccess("Security changes unlocked for 10 minutes.");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Security verification failed");
    } finally {
      setStepLoading(false);
    }
  };

  const requireUnlock = () => {
    if (securityUnlocked) return true;
    setError("Verify your email below before changing sign-in security.");
    return false;
  };

  const startEnrollment = async () => {
    if (!requireUnlock()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await base44.functions.invoke("setup-2fa", {});
      setSecret(res.data.secret);
      setQrUrl(res.data.qr_data_uri);
      setEnrolling(true);
    } catch (err) {
      setError(err.message || "Failed to start 2FA setup");
    } finally {
      setLoading(false);
    }
  };

  const confirmEnrollment = async () => {
    setError("");
    if (!requireUnlock()) return;
    if (code.length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verify-2fa", {
        mode: "setup",
        secret,
        code,
        management_token: managementToken,
      });
      if (res.data?.verified) {
        setSuccess("Two-factor authentication enabled.");
        setEnrolling(false);
        setCode("");
        setSecret("");
        setQrUrl("");
        setUser((prev) => ({ ...prev, two_factor_enabled: true }));
      } else {
        setError(res.data?.error || "Invalid code");
      }
    } catch (err) {
      if (err.response?.status === 403) clearUnlock();
      setError(err.response?.data?.error || err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const disable2fa = async () => {
    if (!requireUnlock()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await base44.functions.invoke("security-factor-manage", {
        action: "disable_totp",
        management_token: managementToken,
      });
      setUser((prev) => ({ ...prev, two_factor_enabled: false }));
      setSuccess("Two-factor authentication disabled.");
    } catch (err) {
      if (err.response?.status === 403) clearUnlock();
      setError(err.response?.data?.error || err.message || "Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4" aria-labelledby="security-unlock-title">
        <div className="flex items-center gap-2 mb-2">
          <LockKeyhole className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 id="security-unlock-title" className="font-bold">Verify before security changes</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Sensitive sign-in changes require a fresh code sent to your account email. This limits what a stolen browser session can change.
        </p>
        {securityUnlocked ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-success" role="status">
              <MailCheck className="h-4 w-4" aria-hidden="true" /> Security changes unlocked for this session.
            </div>
            <Button variant="ghost" size="sm" onClick={clearUnlock}>Lock now</Button>
          </div>
        ) : stepCodeSent ? (
          <div className="space-y-3">
            <Label htmlFor="security-step-code">Email verification code</Label>
            <div className="flex justify-center sm:justify-start">
              <InputOTP id="security-step-code" maxLength={6} value={stepCode} onChange={setStepCode} autoComplete="one-time-code">
                <InputOTPGroup>
                  <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                  <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={verifyStepUpCode} disabled={stepLoading || stepCode.length !== 6}>
                {stepLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
                Verify code
              </Button>
              <Button variant="outline" onClick={sendStepUpCode} disabled={stepLoading}>Resend</Button>
              <Button variant="ghost" onClick={() => { setStepCodeSent(false); setStepCode(""); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={sendStepUpCode} disabled={stepLoading}>
            {stepLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <MailCheck className="h-4 w-4 mr-2" aria-hidden="true" />}
            Send verification code
          </Button>
        )}
      </div>

      {success && <div className="p-3 rounded-lg bg-success/10 text-success text-sm" role="status">{success}</div>}
      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">{error}</div>}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="font-bold">Two-factor authentication</h3>
        </div>

        {enabled && !enrolling ? (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              2FA is enabled. You'll need a code from your authenticator app each time you log in.
            </p>
            <Button variant="outline" onClick={disable2fa} disabled={loading || !securityUnlocked}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Disable 2FA
            </Button>
          </div>
        ) : enrolling ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code it generates.
            </p>
            <div className="flex justify-center">
              <img src={qrUrl} alt="QR code for adding SwapPulse to your authenticator app" className="rounded-lg border border-border" />
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Can't scan? Enter manually</summary>
              <p className="mt-2 font-mono break-all">{secret}</p>
            </details>
            <div className="space-y-2">
              <Label>Authenticator verification code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus autoComplete="one-time-code">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setEnrolling(false); setCode(""); setSecret(""); setQrUrl(""); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmEnrollment} disabled={loading || code.length < 6 || !securityUnlocked}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4 mr-2" aria-hidden="true" />}
                Enable
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Add an authenticator-app code after your email sign-in code.
            </p>
            <Button onClick={startEnrollment} disabled={loading || !securityUnlocked}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <QrCode className="h-4 w-4 mr-2" aria-hidden="true" />}
              Set up 2FA
            </Button>
          </div>
        )}
      </div>

      <WebAuthnSection managementToken={managementToken} securityUnlocked={securityUnlocked} onSecurityExpired={clearUnlock} />
    </div>
  );
}
