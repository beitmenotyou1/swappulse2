import React from 'react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';

export default function HelpStarterPacks() {
  const content = useHelpContent('starter-packs');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="starter-packs">
      <HelpContentRenderer content={content} />
    </HelpArticle>
  );
}