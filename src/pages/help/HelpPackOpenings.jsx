import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpPackOpenings() {
  const content = useHelpContent('pack-openings');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="pack-openings">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}
