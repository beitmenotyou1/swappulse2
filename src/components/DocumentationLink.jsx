import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { SITE_LINKS } from '@/lib/siteLinks';
import { useT } from '@/lib/i18n/I18nProvider';

export default function DocumentationLink({ className = '', compact = false }) {
  const t = useT();

  return (
    <div className={`mt-8 border-t border-border pt-4 ${className}`.trim()}>
      <a
        href={SITE_LINKS.documentation}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
        </span>
        <span>{compact ? t('footer.documentation') : t('docs.readOfficial')}</span>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}
