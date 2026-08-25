import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, Plus, Trash2, Fingerprint, Check } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

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
      const res = await base44.functions.invoke("webauthn-reg-options", {});
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
      });
      if (verifyRes.data?.verified) {
        setSuccess("Security key registered!");
        setEnrolling(false);
        setLabel("");
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
    if (!confirm(`Remove "${cred.label}"? You'll need another 2FA method to log in if this is your last key.`)) return;
    setLoading(true);
    setError("");
    try {
      await base44.entities.WebAuthnCredential.delete(cred.id);
      // Also remove from any active CustodialWallet (unified passkey list)
      const userDid = user?.data?.did || user?.did;
      if (userDid) {
        try {
          const wallets = await base44.entities.CustodialWallet.filter({ did: userDid, active: true });
          for (const w of wallets) {
            const updated = (w.passkey_credential_ids || []).filter((id) => id !== cred.credential_id);
            await base44.entities.CustodialWallet.update(w.id, {
              passkey_credential_ids: updated,
              has_passkey: updated.length > 0,
            });
          }
        } catch {}
      }
      await loadCredentials();
      // If no credentials remain, clear webauthn_enabled
      if (credentials.length <= 1) {
        await base44.auth.updateMe({ webauthn_enabled: false });
        setUser((prev) => ({ ...prev, webauthn_enabled: false }));
      }
      setSuccess("Security key removed.");
    } catch (err) {
      setError(err.message || "Could not remove security key");
    } finally {
      setLoading(false);
    }
  };

  const renameCredential = async (cred, newLabel) => {
    if (!newLabel.trim()) return;
    try {
      await base44.entities.WebAuthnCredential.update(cred.id, { label: newLabel.trim() });
      await loadCredentials();
    } catch (err) {
      setError(err.message || "Could not rename security key");
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

      {enrolling ? (
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
            <Button variant="outline" className="flex-1" onClick={() => { setEnrolling(false); setLabel(""); setError(""); }}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={startEnrollment} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Register key
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => { setEnrolling(true); setError(""); setSuccess(""); }} disabled={loading}>
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