import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Persistent activation prompt shown to logged-in users whose account is not
// yet activated (user.is_verified === false). Disappears permanently once the
// account is activated.
export default function ActivationBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  if (!user || user.is_verified) return null;

  const resend = async () => {
    setSending(true);
    try {
      await base44.auth.resendOtp(user.email);
      try { await base44.functions.invoke("send-activation", { email: user.email }); } catch {}
      toast({ title: "Activation email sent", description: "Check your inbox for the code and link." });
    } catch (e) {
      toast({ title: "Could not resend", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-3 mt-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-accent shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Activate your account</p>
        <p className="text-xs text-muted-foreground">
          Your account isn't activated yet. Activate it to secure your access - unactivated accounts are deleted after 90 days.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <button
            onClick={resend}
            disabled={sending}
            className="text-xs font-semibold text-primary hover:underline disabled:opacity-50 inline-flex items-center"
          >
            {sending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Sending...
              </>
            ) : (
              "Resend activation email"
            )}
          </button>
          <Link to="/activate" className="text-xs font-semibold text-primary hover:underline">
            Enter code
          </Link>
        </div>
      </div>
    </div>
  );
}