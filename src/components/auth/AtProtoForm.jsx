import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AtSign, KeyRound, ExternalLink, Info } from "lucide-react";

/**
 * AtProtoForm — collects an AT Protocol handle + app password and verifies
 * them against the user's PDS via the `atproto-auth` backend function.
 *
 * Props:
 *   mode: "verify" | "login"  — verify returns DID + profile; login sends a code
 *   onSuccess(verifiedData)   — called with the verified result
 *   submitLabel?: string     — override the button label
 */
export default function AtProtoForm({ mode = "verify", onSuccess, submitLabel }) {
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!handle.trim() || !appPassword.trim()) {
      setError("Enter your handle and app password.");
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("atproto-auth", {
        handle: handle.trim(),
        appPassword: appPassword.trim(),
        mode,
      });
      if (res.data?.not_found) {
        setError("not_found");
        return;
      }
      if (res.data?.needs_setup) {
        setError("needs_setup");
        return;
      }
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      onSuccess?.(res.data);
    } catch (err) {
      setError(err.message || "Verification failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && error !== "not_found" && error !== "needs_setup" && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      {error === "not_found" && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          No SwapPulse account is linked to that AT Protocol identity. Create an account to get started.
        </div>
      )}
      {error === "needs_setup" && (
        <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm">
          Your account needs a one-time setup. Please log in with your email first.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="atproto-handle">AT Protocol handle</Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="atproto-handle"
              type="text"
              autoFocus
              placeholder="alice.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="atproto-password">App password</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="atproto-password"
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Use an app password from{" "}
              <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Bluesky settings <ExternalLink className="w-3 h-3" />
              </a>
              , not your main password.
            </span>
          </p>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
          ) : (
            submitLabel || "Verify identity"
          )}
        </Button>
      </form>
    </div>
  );
}