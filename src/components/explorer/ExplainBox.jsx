import React from 'react';
import { Lightbulb } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

// Plain-language explanation box — subtle tinted background with a lightbulb
// icon, written in conversational tone. Renders the children (already-
// localized text) inside.
export default function ExplainBox({ title, children }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Lightbulb className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{title || t('explorer.whatHappened')}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{children}</p>
        </div>
      </div>
    </div>
  );
}