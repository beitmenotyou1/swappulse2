import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpNetworkingConcierge() {
  const content = useHelpContent('networking-concierge');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="networking-concierge">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}