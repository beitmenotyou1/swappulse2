import React, { useState, useRef } from 'react';
import { X, Loader2, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { uploadMedia } from '@/lib/pdsBlob';

// Inline edit modal for the current user's profile (name, bio, avatar).
// Saves via base44.auth.updateMe and fire-and-forget syncs the new profile to
// the PDS as an app.bsky.actor.profile record so it shows on Bluesky.
export default function EditProfileModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [description, setDescription] = useState(user?.description || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setAvatar(await uploadMedia(file));
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload image', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.auth.updateMe({
        full_name: fullName || user?.username || 'Collector',
        description,
        avatar,
      });
      // Push the updated profile to the PDS so it's visible off-site on Bluesky.
      base44.functions.invoke('sync-profile-records', {}).catch(() => {});
      toast({ title: 'Profile updated' });
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const initial = (fullName || user?.username || 'C').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Profile</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative h-20 w-20">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-muted-foreground ring-2 ring-border">
                  {initial}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full bg-background/80 p-1.5 backdrop-blur hover:bg-background"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Bio</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell other collectors about yourself…"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{(description || '').length}/500</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="flex flex-[1.5] items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}