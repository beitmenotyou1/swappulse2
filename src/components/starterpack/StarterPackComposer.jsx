import React, { useState } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = ['vintage', 'modern', 'competitive', 'investment', 'sealed', 'japanese', 'trading', 'general'];

export default function StarterPackComposer({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [memberHandles, setMemberHandles] = useState('');
  const [circleIds, setCircleIds] = useState('');
  const [feedUris, setFeedUris] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !user?.id) return;
    setSaving(true);
    try {
      const member_dids = memberHandles.split('\n').map((h) => h.trim().replace(/^@/, '')).filter(Boolean);
      const circle_ids = circleIds.split('\n').map((s) => s.trim()).filter(Boolean);
      const feed_uris = feedUris.split('\n').map((s) => s.trim()).filter(Boolean);
      const created = await base44.entities.StarterPack.create({
        name: name.trim(),
        description: description.trim(),
        category,
        member_dids,
        circle_ids,
        feed_uris,
        author_name: user.full_name || user.email,
        author_handle: user.data?.bsky_handle || '',
        author_avatar: user.data?.avatar_url || '',
        did: user.data?.did || '',
      });
      toast({ title: 'Starter pack published' });
      onCreated?.(created);
      onClose?.();
      setName(''); setDescription(''); setMemberHandles(''); setCircleIds(''); setFeedUris('');
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
            <select id="sp-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="sp-members">Member handles (one per line)</Label>
            <Textarea id="sp-members" value={memberHandles} onChange={(e) => setMemberHandles(e.target.value)} placeholder={'@collector.bsky.social\n@another.dev'} rows={3} />
          </div>
          <div>
            <Label htmlFor="sp-circles">Circle IDs (one per line, optional)</Label>
            <Textarea id="sp-circles" value={circleIds} onChange={(e) => setCircleIds(e.target.value)} placeholder="circle-id-1" rows={2} />
          </div>
          <div>
            <Label htmlFor="sp-feeds">Feed URIs (one per line, optional)</Label>
            <Textarea id="sp-feeds" value={feedUris} onChange={(e) => setFeedUris(e.target.value)} placeholder="at://did:plc:.../app.bsky.feed.generator/name" rows={2} />
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