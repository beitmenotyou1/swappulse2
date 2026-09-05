import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ComposeBox from '@/components/feed/ComposeBox';
import PageHeader from '@/components/PageHeader';
import BlueskyLinkPrompt from '@/components/BlueskyLinkPrompt';
import DocumentationLink from '@/components/DocumentationLink';
import { useT } from '@/lib/i18n/I18nProvider';
import useSEO from '@/hooks/useSEO';

export default function Compose() {
  const t = useT();
  useSEO({
    title: 'Compose Post',
    description: 'Share a post, pack pull, or trade showcase with the SwapPulse Pokémon TCG collector community.',
    canonicalPath: '/compose',
  });
  const navigate = useNavigate();
  const location = useLocation();
  const replyTo = location.state?.replyTo || null;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={replyTo ? t('page.compose.reply') : t('page.compose.newPost')} />
      <BlueskyLinkPrompt />
      <ComposeBox onPosted={() => navigate('/')} replyTo={replyTo} />
      <DocumentationLink slug="compose" />
    </div>
  );
}