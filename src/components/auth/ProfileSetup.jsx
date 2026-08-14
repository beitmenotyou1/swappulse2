import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Image as ImageIcon } from "lucide-react";
import UsernameField from "@/components/auth/UsernameField";

export default function ProfileSetup({ onDone, portedDid, initialUsername, initialFullName, initialAvatar, initialDescription, initialHeader }) {
  const [username, setUsername] = useState(initialUsername || "");
  const [fullName, setFullName] = useState(initialFullName || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [avatar, setAvatar] = useState(initialAvatar || "");
  const [header, setHeader] = useState(initialHeader || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const avatarRef = useRef(null);
  const headerRef = useRef(null);

  const uploadImage = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatar(await uploadImage(file));
    } catch {
      setError("Failed to upload avatar");
    }
  };

  const handleHeader = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setHeader(await uploadImage(file));
    } catch {
      setError("Failed to upload header");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username || username.length < 3) {
      setError("Choose a username (at least 3 characters).");
      return;
    }
    setLoading(true);
    try {
      const check = await base44.functions.invoke("check-username", { username });
      if (!check.data?.available) {
        setError("That username was just taken. Try another.");
        setLoading(false);
        return;
      }
      const updateData = {
        username,
        full_name: fullName || username,
        description,
        avatar,
        header,
      };
      if (portedDid) {
        updateData.did = portedDid;
      }
      await base44.auth.updateMe(updateData);
      // Provision a real AT Protocol DID on the PDS (unless the user ported
      // an existing AT Protocol identity, which already has a real DID).
      if (!portedDid) {
        try {
          await base44.functions.invoke('provision-identity', { username });
        } catch (e) {
          console.error('ProfileSetup: provision-identity failed (non-fatal)', e);
        }
      }
      onDone?.();
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Set up your profile</h1>
          <p className="text-muted-foreground mt-2">This is how you'll appear to other collectors</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Header image <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative h-28 rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary">
                {header ? (
                  <img src={header} alt="Header" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <button type="button" onClick={() => headerRef.current?.click()} className="absolute bottom-2 right-2 rounded-full bg-background/80 p-2 backdrop-blur hover:bg-background">
                  <Camera className="h-4 w-4" />
                </button>
                <input ref={headerRef} type="file" accept="image/*" onChange={handleHeader} className="hidden" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 rounded-full border-2 border-dashed border-border overflow-hidden bg-secondary">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
                <button type="button" onClick={() => avatarRef.current?.click()} className="absolute bottom-0 right-0 rounded-full bg-background/80 p-1.5 backdrop-blur hover:bg-background">
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Profile picture</p>
                <p className="text-xs text-muted-foreground">Optional — you can add it later</p>
              </div>
            </div>
            <UsernameField value={username} onChange={setUsername} />
            <div className="space-y-2">
              <Label htmlFor="name">Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="name" type="text" placeholder="Your display name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Bio <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea id="desc" placeholder="Tell other collectors about yourself..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
            <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}