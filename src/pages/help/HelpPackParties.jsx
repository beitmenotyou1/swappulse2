import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpPackParties() {
  const content = useHelpContent('pack-parties');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="pack-parties">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}