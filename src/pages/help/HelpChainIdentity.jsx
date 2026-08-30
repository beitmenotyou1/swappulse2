import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpChainIdentity() {
  const content = useHelpContent('chain-identity');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="chain-identity">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}