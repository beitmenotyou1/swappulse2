import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpPodcasts() {
  const content = useHelpContent('podcasts');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="podcasts">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
