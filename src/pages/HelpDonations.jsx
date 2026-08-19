import React from 'react';
import { MessageSquare } from 'lucide-react';
import HelpArticle from '@/components/help/HelpArticle';
import HelpContentRenderer from '@/components/help/HelpContentRenderer';
import { useHelpContent } from '@/hooks/useHelpContent';
import DonationContactForm from '@/components/donate/DonationContactForm';

export default function HelpDonations() {
  const content = useHelpContent('donations');
  if (!content) return null;
  return (
    <HelpArticle title={content.title} subtitle={content.subtitle} slug="donations">
      <HelpContentRenderer content={content} />
      <div className="mt-8 border-t border-border pt-6">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Contact us</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Have a question about donating? Send us a message and we'll get back to you.
        </p>
        <DonationContactForm />
      </div>
    </HelpArticle>
  );
}