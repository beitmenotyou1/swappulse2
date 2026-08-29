import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, Plus, Trash2, Fingerprint } from "lucide-react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import SecurityEmailVerification from "@/components/settings/SecurityEmailVerification";

// WebAuthnSection — Settings UI for managing WebAuthn/U2F security keys.
// Users can register new security keys (YubiKey, Touch ID, Windows Hello,
// passkeys) and delete existing ones. When all keys are deleted, the
// webauthn_enabled flag is cleared on the user record.
export default function WebAuthnSection() {
  const [user, setUser] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [managementToken, setManagementToken] = useState("");
  const [showEnrollmentVerification, setShowEnrollmentVerification] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      if (u?.id) loadCredentials();
    }).catch(() => {});
  }, []);

  const loadCredentials = async () => {
    try {
      const creds = await base44.entities.WebAuthnCredential.list("-created_date", 20);
      setCredentials(creds || []);
    } catch {}
  };

  const startEnrollment = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("webauthn-reg-options", { management_token: managementToken });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      const { options, challenge_signature } = res.data;
      if (!options || !options.challenge) {
        setError("Could not generate registration options. Please try again.");
        return;
      }
      const attestation = await startRegistration(options);
      const verifyRes = await base44.functions.invoke("webauthn-verify-reg", {
        attestation,
        challenge: options.challenge,
        challenge_signature,
        label: label || "Security Key",
        management_token: managementToken,
      });
      if (verifyRes.data?.verified) {
        setSuccess("Security key registered!");
        setEnrolling(false);
        setLabel("");
        setManagementToken("");
        setUser((prev) => ({ ...prev, webauthn_enabled: true }));
        await loadCredentials();
      } else {
        setError(verifyRes.data?.error || "Registration failed");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Could not register security key");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteCredential = async (cred) => {
    if (!confirm(`Remove "${cred.label}"? You'll be asked to verify with one of your registered security keys first.`)) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const optsRes = await base44.functions.invoke("webauthn-management-options", {});
      const { options, challenge_signature } = optsRes.data || {};
      if (!options?.challenge) throw new Error(optsRes.data?.error || "Could not start security verification.");
      const assertion = await startAuthentication(options);
      const removeRes = await base44.functions.invoke("security-factor-management", {
        action: "remove_webauthn",
        credential_id: cred.id,
        assertion,
        challenge: options.challenge,
        challenge_signature,
      });
      if (!removeRes.data?.removed) throw new Error(removeRes.data?.error || "Could not remove security key.");
      await loadCredentials();
      if ((removeRes.data?.remaining || 0) === 0) setUser((prev) => ({ ...prev, webauthn_enabled: false }));
      setSuccess("Security key removed.");
    } catch (err) {
      if (err.name !== "AbortError") setError(err.response?.data?.error || err.message || "Could not remove security key");
    } finally {
      setLoading(false);
    }
  };

  const renameCredential = async (cred, newLabel) => {
    if (!newLabel.trim() || newLabel.trim() === (cred.label || "").trim()) return;
    try {
      const res = await base44.functions.invoke("security-factor-management", {
        action: "rename_webauthn",
        credential_id: cred.id,
        label: newLabel.trim(),
      });
      if (!res.data?.renamed) throw new Error(res.data?.error || "Could not rename security key");
      await loadCredentials();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not rename security key");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="h-5 w-5 text-primary" />
        <h3 className="font-bold">Security keys (WebAuthn)</h3>
      </div>

      {success && <div className="mb-3 p-3 rounded-lg bg-success/10 text-success text-sm">{success}</div>}
      {error && <div className="mb-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {credentials.length > 0 && (
        <div className="space-y-2 mb-4">
          {credentials.map((cred) => (
            <div key={cred.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
              <Key className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  defaultValue={cred.label}
                  onBlur={(e) => renameCredential(cred, e.target.value)}
                  className="text-sm font-medium bg-transparent border-none outline-none w-full focus:bg-muted/50 rounded px-1 -mx-1"
                />
                <p className="text-xs text-muted-foreground">
                  Added {new Date(cred.created_at || cred.created_date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => deleteCredential(cred)}
                disabled={loading}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remove security key"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showEnrollmentVerification ? (
        <SecurityEmailVerification
          title="Verify your email before adding a security key"
          onVerified={(token) => { setManagementToken(token); setShowEnrollmentVerification(false); setEnrolling(true); }}
          onCancel={() => setShowEnrollmentVerification(false)}
        />
      ) : enrolling ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="webauthn-label">Name this key (optional)</Label>
            <Input
              id="webauthn-label"
              placeholder="e.g. YubiKey 5C, Touch ID"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setEnrolling(false); setLabel(""); setManagementToken(""); setError(""); }}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={startEnrollment} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Register key
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => { setShowEnrollmentVerification(true); setError(""); setSuccess(""); }} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          Add security key
        </Button>
      )}

      {credentials.length === 0 && !enrolling && (
        <p className="text-sm text-muted-foreground mt-3">
          Register a hardware security key (YubiKey), biometric (Touch ID, Windows Hello), or passkey as a second factor.
          You'll need to tap or verify it each time you log in.
        </p>
      )}
    </div>
  );
}