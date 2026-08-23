import React, { useState } from 'react';
import { X, Loader2, Plus, Users, Rss, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import SettingSelect from '@/components/settings/SettingSelect';
import Avatar from '@/components/Avatar';
import MemberSearchInput from '@/components/starterpack/MemberSearchInput';
import FeedSearchInput from '@/components/starterpack/FeedSearchInput';
import CircleSearchInput from '@/components/starterpack/CircleSearchInput';

const CATEGORIES = ['vintage', 'modern', 'competitive', 'investment', 'sealed', 'japanese', 'trading', 'general'];

export default function StarterPackComposer({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [members, setMembers] = useState([]); // [{ did, displayName, handle, avatar }]
  const [feeds, setFeeds] = useState([]); // [{ uri, name }]
  const [circles, setCircles] = useState([]); // [{ id, name }]
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const addMember = (m) => {
    if (members.some((x) => x.did === m.did)) return;
    setMembers((prev) => [...prev, m].slice(0, 100));
  };
  const removeMember = (did) => setMembers((prev) => prev.filter((m) => m.did !== did));

  const addFeed = (uri, feedName) => {
    if (feeds.some((f) => f.uri === uri)) return;
    setFeeds((prev) => [...prev, { uri, name: feedName }].slice(0, 10));
  };
  const removeFeed = (uri) => setFeeds((prev) => prev.filter((f) => f.uri !== uri));

  const addCircle = (id, circleName) => {
    if (circles.some((c) => c.id === id)) return;
    setCircles((prev) => [...prev, { id, name: circleName }].slice(0, 10));
  };
  const removeCircle = (id) => setCircles((prev) => prev.filter((c) => c.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !user?.id) return;
    setSaving(true);
    try {
      // Enforce max 5 starter packs per author.
      const existing = await base44.entities.StarterPack.filter({ did: user.data?.did || '' }, '-created_date', 10).catch(() => []);
      if (existing.length >= 5) {
        toast({ title: 'Pack limit reached', description: 'You can create up to 5 starter packs. Delete one to make room.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const created = await base44.entities.StarterPack.create({
        name: name.trim(),
        description: description.trim(),
        category,
        member_dids: [],
        circle_ids: circles.map((c) => c.id),
        feed_uris: feeds.map((f) => f.uri),
        feed_names: feeds.map((f) => f.name),
        author_name: user.full_name || user.email,
        author_handle: user.data?.bsky_handle || '',
        author_avatar: user.data?.avatar_url || '',
        did: user.data?.did || '',
      });

      // Send inclusion requests to each selected member. Auto-accept targets
      // are promoted immediately inside the function; others get a pending
      // request + notification.
      let pending = 0;
      let autoAccepted = 0;
      for (const m of members) {
        if (!m.did) continue;
        try {
          const res = await base44.functions.invoke('add-starter-pack-member', {
            packId: created.id,
            targetDid: m.did,
            targetName: m.displayName,
            targetHandle: m.handle,
            targetAvatar: m.avatar,
          });
          if (res.data?.autoAccepted) autoAccepted++;
          else if (res.data?.pending) pending++;
        } catch { /* ignore per-member failures */ }
      }

      base44.functions.invoke('bridge-record', { action: 'create', entityName: 'StarterPack', recordId: created.id }).catch(() => {});

      toast({
        title: 'Starter pack published',
        description: members.length
          ? `${autoAccepted} joined automatically · ${pending} pending response`
          : undefined,
      });
      onCreated?.(created);
      onClose?.();
      setName(''); setDescription(''); setMembers([]); setFeeds([]); setCircles([]);
    } catch (err) {
      toast({ title: 'Could not publish pack', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">New Starter Pack</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sp-name">Name *</Label>
            <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New to Vintage WOTC" maxLength={64} required />
          </div>
          <div>
            <Label htmlFor="sp-desc">Description</Label>
            <Textarea id="sp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is this pack for?" maxLength={300} rows={2} />
          </div>
          <div>
            <Label htmlFor="sp-cat">Category</Label>
            <div className="mt-1">
              <SettingSelect value={category} onChange={setCategory} label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </div>
          </div>

          {/* Members — searchable, friends-first */}
          <div>
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Members</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">Search a username to add. They'll be asked to accept before appearing in the pack.</p>
            <MemberSearchInput onAdd={addMember} excludeDids={members.map((m) => m.did)} />
            {members.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {members.map((m) => (
                  <div key={m.did} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
                    <Avatar name={m.displayName} src={m.avatar} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{m.displayName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">@{m.handle}</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning"><Clock className="h-2.5 w-2.5" /> pending</span>
                    <button type="button" onClick={() => removeMember(m.did)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{members.length}/100 members</p>
          </div>

          {/* Feeds — searchable, subscribed-first */}
          <div>
            <Label className="flex items-center gap-1.5"><Rss className="h-3.5 w-3.5" /> Pinned feeds</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">Search your subscribed feeds or discover new ones.</p>
            <FeedSearchInput onAdd={addFeed} excludeUris={feeds.map((f) => f.uri)} />
            {feeds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {feeds.map((f) => (
                  <span key={f.uri} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-semibold">
                    <Rss className="h-3 w-3 text-primary" /> {f.name}
                    <button type="button" onClick={() => removeFeed(f.uri)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Circles — searchable by name */}
          <div>
            <Label className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Recommended circles</Label>
            <p className="mb-1.5 text-xs text-muted-foreground">Search local SwapPulse circles by name.</p>
            <CircleSearchInput onAdd={addCircle} excludeIds={circles.map((c) => c.id)} />
            {circles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {circles.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-semibold">
                    <Sparkles className="h-3 w-3 text-accent" /> {c.name}
                    <button type="button" onClick={() => removeCircle(c.id)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publish
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}