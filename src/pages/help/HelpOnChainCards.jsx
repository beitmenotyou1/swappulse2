import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpOnChainCards() {
  const content = useHelpContent('on-chain-cards');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="on-chain-cards">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}