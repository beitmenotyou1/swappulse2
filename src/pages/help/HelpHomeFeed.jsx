import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpHomeFeed() {
  const content = useHelpContent('home-feed');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="home-feed">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
