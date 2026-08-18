import React from 'react';
import { X, Heart, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatPrice } from '@/lib/format';
import { remarkHashtags } from '@/lib/remarkHashtags';
import { confirmExternalLink, isExternalUrl } from '@/lib/externalLink';
import RecommendButton from '@/components/standard/RecommendButton';

export default function JournalView({ journal, onClose }) {
  if (!journal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 w-full max-w-2xl animate-slide-up rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="min-w-0 pr-2">
            <h2 className="truncate text-lg font-bold">{journal.title}</h2>
            {journal.subtitle && <p className="truncate text-sm text-muted-foreground">{journal.subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{journal.visibility}</span>
            {journal.published_at && <span>{new Date(journal.published_at).toLocaleDateString()}</span>}
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {journal.like_count || 0}</span>
            {journal.tags?.map((t) => (
              <span key={t} className="rounded bg-secondary px-2 py-0.5">#{t}</span>
            ))}
          </div>

          {journal.standard_doc_uri && (
            <div className="mb-3">
              <RecommendButton
                documentUri={journal.standard_doc_uri}
                entityType="journal"
                entityId={journal.id}
                authorDid={journal.did || ''}
                initialCount={journal.recommend_count || 0}
              />
            </div>
          )}

          {journal.embedded_stats && (
            <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-border bg-secondary p-3 text-center">
              <div>
                <p className="text-sm font-bold">{formatPrice(journal.embedded_stats.total_collection_value || 0)}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Value</p>
              </div>
              <div>
                <p className="text-sm font-bold">{journal.embedded_stats.total_cards || 0}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cards</p>
              </div>
              <div>
                <p className="text-sm font-bold">{journal.embedded_stats.set_completion_percent || 0}%</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Set</p>
              </div>
            </div>
          )}

          <div className="space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:bg-secondary [&_code]:rounded [&_code]:px-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:rounded-lg">
            <ReactMarkdown
              remarkPlugins={[remarkHashtags]}
              components={{
                a: ({ href, children }) => {
                  const external = isExternalUrl(href);
                  return (
                    <a
                      href={external ? undefined : href}
                      onClick={(e) => {
                        if (!external) return;
                        e.preventDefault();
                        confirmExternalLink(href);
                      }}
                      className="inline-flex items-center gap-0.5"
                    >
                      {children}
                      {external && <ExternalLinkIcon className="h-3 w-3 shrink-0" />}
                    </a>
                  );
                },
              }}
            >
              {journal.body || ''}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}