import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, MailCheck } from "lucide-react";

export default function SecurityEmailVerification({ onVerified, onCancel, title = "Confirm this security change" }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("security-action-code", { action: "send" });
      if (res.data?.sent) setSent(true);
      else setError(res.data?.error || "Could not send the security code.");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not send the security code.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { sendCode(); }, []);

  const verify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("security-action-code", { action: "verify", code });
      if (!res.data?.management_token) {
        setError(res.data?.error || "Verification failed.");
        return;
      }
      onVerified?.(res.data.management_token);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-4" role="group" aria-label={title}>
      <div className="flex items-start gap-3">
        <MailCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {sent ? "We sent a 6-digit security code to the email on your account." : "Sending a security code to the email on your account…"}
          </p>
        </div>
      </div>
      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      <div className="flex justify-center">
        <InputOTP maxLength={6} value={code} onChange={setCode} autoComplete="one-time-code" disabled={!sent || loading}>
          <InputOTPGroup>
            <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
            <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {onCancel && <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>}
        <Button type="button" className="flex-1" onClick={verify} disabled={loading || !sent || code.length !== 6}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Verify
        </Button>
      </div>
      <button type="button" className="w-full text-xs text-primary hover:underline disabled:opacity-50" onClick={sendCode} disabled={loading}>
        Send a new code
      </button>
    </div>
  );
}
