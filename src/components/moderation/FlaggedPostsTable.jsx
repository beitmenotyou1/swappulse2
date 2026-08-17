import React from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import Avatar from '@/components/Avatar';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const statusStyle = {
  pending: 'bg-secondary text-foreground',
  reviewed: 'bg-success/15 text-success',
  dismissed: 'bg-muted text-muted-foreground',
  escalated: 'bg-destructive/15 text-destructive',
};

const severityStyle = {
  warn: 'bg-warning/15 text-warning',
  escalate: 'bg-destructive/15 text-destructive',
  inform: 'bg-secondary text-muted-foreground',
};

export default function FlaggedPostsTable({ rows, loading, selectedIds, onToggleSelect, onSelect, page, totalPages, totalCount, onPage }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-2"></th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Author</th>
              <th className="p-2 text-left">Content</th>
              <th className="p-2 text-left">Hashtags</th>
              <th className="p-2 text-left">Labels</th>
              <th className="p-2 text-left">AI Rec</th>
              <th className="p-2 text-left">Conf.</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  Loading flagged posts…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  No flagged posts match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const maxConf = Math.max(0, ...row.labels.map((l) => (l.confidence || 0) * 100));
                const selected = selectedIds.includes(row.id);
                return (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="p-2">
                      <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(row.id)} aria-label="Select row" />
                    </td>
                    <td className="p-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${statusStyle[row.status] || statusStyle.pending}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">{timeAgo(row.timestamp)}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={row.author.displayName} src={row.author.avatarUrl} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold">{row.author.displayName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {row.author.priorFlags > 0 ? `${row.author.priorFlags} prior flags` : 'no prior flags'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[280px] p-2">
                      <p className="line-clamp-2 text-xs">{row.post.text}</p>
                    </td>
                    <td className="max-w-[160px] p-2">
                      <div className="flex flex-wrap gap-1">
                        {(row.post.hashtags || []).slice(0, 4).map((h, i) => (
                          <span key={i} className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                            #{h}
                          </span>
                        ))}
                        {(row.post.hashtags || []).length > 4 && (
                          <span className="text-[11px] text-muted-foreground">+{row.post.hashtags.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {row.labels.map((l, i) => (
                          <span
                            key={i}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${severityStyle[l.severity] || severityStyle.inform}`}
                          >
                            {l.label.replace('hashtag-', '')}
                            {l.ai_generated && ' · AI'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">
                      {row.aiRecommendation ? (
                        <div className="text-[11px]">
                          <span className={`rounded px-1.5 py-0.5 font-semibold ${
                            row.aiRecommendation.action === 'hide' ? 'bg-destructive/15 text-destructive' :
                            row.aiRecommendation.action === 'warn' ? 'bg-warning/15 text-warning' :
                            'bg-secondary text-muted-foreground'
                          }`}>
                            {row.aiRecommendation.action}
                          </span>
                          <p className="mt-0.5 text-muted-foreground">{Math.round((row.aiRecommendation.confidence || 0) * 100)}%</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="p-2 text-xs">{Math.round(maxConf)}%</td>
                    <td className="p-2">
                      <Button variant="ghost" size="sm" onClick={() => onSelect(row)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border p-2 text-xs text-muted-foreground">
        <span>{totalCount} flagged</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            Page {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}