import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, Check, QrCode } from "lucide-react";
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

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const enabled = user?.two_factor_enabled;

  const startEnrollment = async () => {
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
    if (code.length < 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verify-2fa", { mode: "setup", secret, code });
      if (res.data?.verified) {
        setSuccess("Two-factor authentication enabled!");
        setEnrolling(false);
        setCode("");
        setSecret("");
        setQrUrl("");
        setUser((prev) => ({ ...prev, two_factor_enabled: true }));
      } else {
        setError(res.data?.error || "Invalid code");
      }
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const disable2fa = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await base44.auth.updateMe({ two_factor_enabled: false, two_factor_secret: "" });
      setUser((prev) => ({ ...prev, two_factor_enabled: false, two_factor_secret: "" }));
      setSuccess("Two-factor authentication disabled.");
    } catch (err) {
      setError(err.message || "Failed to disable 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Two-factor authentication</h3>
        </div>
        {success && <div className="mb-3 p-3 rounded-lg bg-success/10 text-success text-sm">{success}</div>}
        {error && <div className="mb-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

        {enabled && !enrolling ? (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              2FA is enabled. You'll need a code from your authenticator app each time you log in.
            </p>
            <Button variant="outline" onClick={disable2fa} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Disable 2FA
            </Button>
          </div>
        ) : enrolling ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it generates.
            </p>
            <div className="flex justify-center">
              <img src={qrUrl} alt="2FA QR code" className="rounded-lg border border-border" />
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Can't scan? Enter manually</summary>
              <p className="mt-2 font-mono break-all">{secret}</p>
            </details>
            <div className="space-y-2">
              <Label>Enter verification code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
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
              <Button className="flex-1" onClick={confirmEnrollment} disabled={loading || code.length < 6}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Enable
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Add an extra layer of security. After entering your email code, you'll also need a code from your authenticator app.
            </p>
            <Button onClick={startEnrollment} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
              Set up 2FA
            </Button>
          </div>
        )}
      </div>
      <WebAuthnSection />
    </div>
  );
}