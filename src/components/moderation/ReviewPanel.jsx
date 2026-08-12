import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Avatar from '@/components/Avatar';
import { Check, X, ShieldAlert, AlertTriangle, Info } from 'lucide-react';

const severityIcon = { warn: AlertTriangle, escalate: ShieldAlert, inform: Info };
const severityColor = { warn: 'text-warning', escalate: 'text-destructive', inform: 'text-muted-foreground' };

export default function ReviewPanel({ post, open, onClose, onResolve, resolving }) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) setNotes('');
  }, [open]);

  if (!post) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Review Post</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Avatar name={post.author.displayName} src={post.author.avatarUrl} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{post.author.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{post.author.did}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Prior flags: {post.author.priorFlags}</p>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm">{post.post.text}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(post.post.hashtags || []).map((h, i) => (
                <span key={i} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                  #{h}
                </span>
              ))}
            </div>
            {post.post.canonical_tags && post.post.canonical_tags.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Canonical: {post.post.canonical_tags.map((t) => '#' + t).join(' ')}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Detected Labels</p>
            <div className="space-y-2">
              {post.labels.map((l, i) => {
                const Icon = severityIcon[l.severity] || Info;
                return (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${severityColor[l.severity] || 'text-muted-foreground'}`} />
                      <span className="font-semibold">{l.label}</span>
                      <span className="text-xs text-muted-foreground">{Math.round((l.confidence || 0) * 100)}% confidence</span>
                    </div>
                    <p className="ml-6 text-xs text-muted-foreground">{l.reason}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Notes (optional)</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add moderation notes…" rows={3} />
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="default" onClick={() => onResolve('approve', notes)} disabled={resolving}>
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button variant="secondary" onClick={() => onResolve('dismiss', notes)} disabled={resolving}>
            <X className="h-4 w-4" /> Dismiss
          </Button>
          <Button variant="destructive" onClick={() => onResolve('escalate', notes)} disabled={resolving}>
            <ShieldAlert className="h-4 w-4" /> Escalate
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}