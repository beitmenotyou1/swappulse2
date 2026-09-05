import React, { useEffect, useState } from 'react';
import { Loader2, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import PostCard from '@/components/feed/PostCard';
import useSEO from '@/hooks/useSEO';
import DocumentationLink from '@/components/DocumentationLink';
import { useT } from '@/lib/i18n/I18nProvider';
import { sortPostsDescending } from '@/lib/postSort';

export default function PackOpenings() {
  const t = useT();
  useSEO({
    title: 'Pack Openings',
    description: 'See the latest pack pulls from the SwapPulse community, fresh Pokémon TCG openings shared in real time.',
    canonicalPath: '/packs',
  });
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setPosts(sortPostsDescending(await base44.entities.Post.filter({ post_type: 'pack_opening' }, '-created_date', 50)));
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title={t('page.packs.title')} subtitle={t('page.packs.subtitle')} />
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : posts.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">{t('page.packs.empty')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('page.packs.emptySub')}</p>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} />)
      )}
      <DocumentationLink slug="pack-openings" />
    </div>
  );
}