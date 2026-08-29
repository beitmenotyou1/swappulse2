import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, Plus, Trash2, Fingerprint } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

export default function WebAuthnSection({ managementToken, securityUnlocked, onSecurityExpired }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const creds = await base44.entities.WebAuthnCredential.list("-created_date", 20);
      setCredentials(creds || []);
    } catch {
      setCredentials([]);
    }
  };

  const handleExpired = (err) => {
    if (err?.response?.status === 403) onSecurityExpired?.();
  };

  const startEnrollment = async () => {
    if (!securityUnlocked) {
      setError("Verify your email above before adding a security key.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("webauthn-reg-options", {
        management_token: managementToken,
      });
      const { options, challenge_signature } = res.data || {};
      if (!options?.challenge) throw new Error(res.data?.error || "Could not generate registration options");
      const attestation = await startRegistration(options);
      const verifyRes = await base44.functions.invoke("webauthn-verify-reg", {
        attestation,
        challenge: options.challenge,
        challenge_signature,
        label: label || "Security Key",
        management_token: managementToken,
      });
      if (!verifyRes.data?.verified) throw new Error(verifyRes.data?.error || "Registration failed");
      setSuccess(verifyRes.data?.already_registered ? "Security key is already registered." : "Security key registered.");
      setEnrolling(false);
      setLabel("");
      await loadCredentials();
    } catch (err) {
      handleExpired(err);
      if (err.name !== "AbortError") {
        setError(err.response?.data?.error || err.message || "Could not register security key");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteCredential = async (cred) => {
    if (!securityUnlocked) {
      setError("Verify your email above before removing a security key.");
      return;
    }
    if (!confirm(`Remove "${cred.label || "Security Key"}"?`)) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await base44.functions.invoke("security-factor-manage", {
        action: "delete_webauthn",
        credential_id: cred.id,
        management_token: managementToken,
      });
      await loadCredentials();
      setSuccess("Security key removed.");
    } catch (err) {
      handleExpired(err);
      setError(err.response?.data?.error || err.message || "Could not remove security key");
    } finally {
      setLoading(false);
    }
  };

  const renameCredential = async (cred, newLabel) => {
    const clean = newLabel.trim();
    if (!clean || clean === (cred.label || "")) return;
    if (!securityUnlocked) {
      setError("Verify your email above before renaming a security key.");
      return;
    }
    try {
      await base44.functions.invoke("security-factor-manage", {
        action: "rename_webauthn",
        credential_id: cred.id,
        label: clean,
        management_token: managementToken,
      });
      await loadCredentials();
    } catch (err) {
      handleExpired(err);
      setError(err.response?.data?.error || err.message || "Could not rename security key");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-bold">Security keys and passkeys</h3>
      </div>

      {success && <div className="mb-3 p-3 rounded-lg bg-success/10 text-success text-sm" role="status">{success}</div>}
      {error && <div className="mb-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">{error}</div>}

      {credentials.length > 0 && (
        <div className="space-y-2 mb-4">
          {credentials.map((cred) => (
            <div key={cred.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor={`key-label-${cred.id}`}>Security key name</label>
                <input
                  id={`key-label-${cred.id}`}
                  aria-label="Security key name"
                  type="text"
                  defaultValue={cred.label || "Security Key"}
                  onBlur={(e) => renameCredential(cred, e.target.value)}
                  disabled={!securityUnlocked || loading}
                  className="text-sm font-medium bg-transparent border-none outline-none w-full focus:bg-muted/50 rounded px-1 -mx-1 disabled:opacity-70"
                />
                <p className="text-xs text-muted-foreground">
                  Added {new Date(cred.created_at || cred.created_date).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteCredential(cred)}
                disabled={loading || !securityUnlocked}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                aria-label={`Remove ${cred.label || "security key"}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {enrolling ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="webauthn-label">Name this key (optional)</Label>
            <Input
              id="webauthn-label"
              maxLength={60}
              placeholder="e.g. YubiKey 5C, Touch ID"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setEnrolling(false); setLabel(""); setError(""); }}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={startEnrollment} disabled={loading || !securityUnlocked}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4 mr-2" aria-hidden="true" />}
              Register key
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => { setEnrolling(true); setError(""); setSuccess(""); }} disabled={loading || !securityUnlocked}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Add security key
        </Button>
      )}

      <p className="text-sm text-muted-foreground mt-3">
        {credentials.length === 0
          ? "Add a hardware key, biometric or passkey as an additional sign-in factor."
          : "Verify your email above before adding, renaming or removing security keys."}
      </p>
    </div>
  );
}
