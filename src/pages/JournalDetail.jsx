import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, ArrowLeft, Calendar, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { formatPrice } from '@/lib/format';
import { remarkHashtags } from '@/lib/remarkHashtags';
import { isExternalUrl, confirmExternalLink } from '@/lib/externalLink';
import Avatar from '@/components/Avatar';
import PageHeader from '@/components/PageHeader';
import RecommendButton from '@/components/standard/RecommendButton';
import SubscribeToWritingButton from '@/components/standard/SubscribeToWritingButton';
import useSEO from '@/hooks/useSEO';

// JournalDetail — public standalone page for a single journal entry.
// Renders the full markdown body, author info, embedded stats, tags, and the
// Standard.site Recommend + Subscribe-to-writing buttons. The route is
// /journal/:journalId — the same path stored in the site.standard.document's
// `path` field, so Bluesky link cards resolve here.
export default function JournalDetail() {
  const { journalId } = useParams();
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useSEO({
    title: journal?.title || 'Journal',
    description: journal?.subtitle || '',
    canonicalPath: `/journal/${journalId}`,
    ogImage: journal?.cover_image_uri || undefined,
    standardDocUri: journal?.standard_doc_uri || '',
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!journalId) return;
      setLoading(true);
      try {
        const j = await base44.entities.Journal.get(journalId);
        if (alive) setJournal(j);
      } catch (e) {
        if (alive) setError(e.message || 'Journal not found');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [journalId]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Journal" />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      </div>
    );
  }

  if (error || !journal) {
    return (
      <div>
        <PageHeader title="Journal" />
        <div className="p-8 text-center">
          <p className="text-sm text-muted-foreground">{error || 'Journal not found.'}</p>
          <Link to="/explore" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={journal.title} subtitle={journal.subtitle} />
      <div className="mx-auto max-w-2xl p-4">
        <Link to={journal.did ? `/profile/${journal.did}` : '/explore'} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Link>

        {/* Author bar */}
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={journal.author_name || 'Collector'} src={journal.author_avatar} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{journal.author_name || 'Anonymous Collector'}</p>
            <p className="text-xs text-muted-foreground">
              {journal.published_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {new Date(journal.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
            </p>
          </div>
          {journal.did && <SubscribeToWritingButton authorDid={journal.did} />}
        </div>

        {/* Tags */}
        {journal.tags?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {journal.tags.map((t) => (
              <Link key={t} to={`/hashtag/${t}`} className="flex items-center gap-0.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80">
                <Tag className="h-3 w-3" /> {t}
              </Link>
            ))}
          </div>
        )}

        {/* Recommend button */}
        {journal.standard_doc_uri && (
          <div className="mb-4">
            <RecommendButton
              documentUri={journal.standard_doc_uri}
              entityType="journal"
              entityId={journal.id}
              authorDid={journal.did || ''}
              initialCount={journal.recommend_count || 0}
              size="md"
            />
          </div>
        )}

        {/* Embedded stats snapshot */}
        {journal.embedded_stats && (
          <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-border bg-secondary p-3 text-center">
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

        {/* Body */}
        <article className="prose prose-sm max-w-none space-y-3 leading-relaxed [&_a]:text-primary [&_a]:underline [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:bg-secondary [&_code]:rounded [&_code]:px-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:rounded-lg">
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
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {journal.body || ''}
          </ReactMarkdown>
        </article>

        {/* Footer */}
        <div className="mt-6 flex items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="h-4 w-4" /> {journal.like_count || 0} likes</span>
          {journal.standard_doc_uri && (
            <span className="font-mono text-[10px] break-all">{journal.standard_doc_uri}</span>
          )}
        </div>
      </div>
    </div>
  );
}