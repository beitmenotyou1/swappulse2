import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Heart, Pencil, Trash2, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import { BINDER_THEMES } from '@/components/binder/theme';
import { cardImageUrl } from '@/lib/tcgdex';
import useSEO from '@/hooks/useSEO';
import RecommendButton from '@/components/standard/RecommendButton';

export default function BinderDetail() {
  useSEO({
    title: 'Binder',
    description: 'A curated Pokémon TCG collector binder on SwapPulse, showcase grids of favourite cards.',
    canonicalPath: `/binder/${binderId}`,
    standardDocUri: data?.binder?.standard_doc_uri || '',
  });
  const { binderId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [liked, setLiked] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getBinder', { binderId });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [binderId]);

  const like = async () => {
    if (!data || liked) return;
    setLiked(true);
    const next = (data.binder.like_count || 0) + 1;
    setData((d) => ({ ...d, binder: { ...d.binder, like_count: next } }));
    try {
      await base44.entities.Binder.update(binderId, { like_count: next });
    } catch {
      /* ignore */
    }
  };

  const remove = async () => {
    if (!confirm('Delete this binder?')) return;
    if (data?.binder?.standard_doc_uri) {
      await base44.functions.invoke('publish-standard-document', {
        action: 'delete', documentUri: data.binder.standard_doc_uri,
      }).catch(() => {});
    }
    await base44.entities.Binder.delete(binderId);
    navigate('/binders');
  };

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  if (!data)
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Binder not found.</div>
    );

  const { binder, author, pages, isOwner } = data;
  const theme = BINDER_THEMES[binder.theme] || BINDER_THEMES.classic_purple;
  const currentPage = pages[page] || pages[0] || { slots: [] };
  const cover = cardImageUrl(binder.cover_image_uri);

  return (
    <div>
      <PageHeader title={binder.title} subtitle={binder.description}>
        {isOwner && (
          <div className="flex gap-2">
            <Link
              to={`/binder/${binderId}/edit`}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
            <button
              onClick={remove}
              className="rounded-full p-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </PageHeader>

      <div className={`relative h-40 bg-gradient-to-br ${theme.backdrop}`}>
        <div className="absolute inset-0 grid place-items-center">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover opacity-90" />
          ) : (
            <BookOpen className="h-12 w-12 text-foreground/30" />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/profile" className="flex items-center gap-2">
          <Avatar name={author.name} src={author.avatar} size={36} />
          <div>
            <p className="text-sm font-bold">{author.name || 'Collector'}</p>
            <p className="text-xs text-muted-foreground">@{author.handle}</p>
          </div>
        </Link>
        <button
          onClick={like}
          className={`flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold ${
            liked ? 'text-destructive' : ''
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} /> {binder.like_count}
        </button>
        {binder.standard_doc_uri && (
          <RecommendButton
            documentUri={binder.standard_doc_uri}
            entityType="binder"
            entityId={binderId}
            authorDid={binder.did || ''}
            initialCount={binder.recommend_count || 0}
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 py-2">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-full p-1.5 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">
          {page + 1} / {pages.length}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
          disabled={page === pages.length - 1}
          className="rounded-full p-1.5 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {currentPage.slots.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div
                className={`relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-gradient-to-br ${theme.backdrop} shadow-raised`}
              >
                {s.card ? (
                  cardImageUrl(s.card.card_image) ? (
                    <img
                      src={cardImageUrl(s.card.card_image)}
                      alt={s.card.card_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center p-2 text-center text-xs font-semibold">
                      {s.card.card_name}
                    </div>
                  )
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground/40">
                    <BookOpen className="h-6 w-6" />
                  </div>
                )}
              </div>
              {s.custom_caption ? (
                <p className="truncate text-center text-[11px] text-muted-foreground">{s.custom_caption}</p>
              ) : s.card ? (
                <p className="truncate text-center text-[11px] font-medium">{s.card.card_name}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}