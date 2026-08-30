import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpCardAttestations() {
  const content = useHelpContent('card-attestations');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="card-attestations">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}