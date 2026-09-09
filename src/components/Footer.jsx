import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, ExternalLink, Github } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import PWAInstallButton from '@/components/PWAInstallButton';
import { SITE_LINKS } from '@/lib/siteLinks';

export default function Footer() {
  const t = useT();

  return (
    <footer className="mt-8 border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 text-muted-foreground">
        <p className="text-xs font-medium">{t('sidebar.copyright')}</p>
        <nav className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Footer">
          <a
            href={SITE_LINKS.documentation}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {t('footer.documentation')}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <Link to="/status" className="inline-flex items-center gap-1 text-xs font-semibold text-success transition-colors hover:underline">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            {t('footer.status')}
          </Link>
          <Link to="/terms" className="text-xs font-medium transition-colors hover:text-foreground">{t('nav.terms')}</Link>
          <Link to="/privacy" className="text-xs font-medium transition-colors hover:text-foreground">{t('nav.privacy')}</Link>
          <Link to="/chain/" className="text-xs font-medium transition-colors hover:text-foreground">{t('footer.chainExplorer')}</Link>
          <Link to="/donate" className="text-xs font-medium transition-colors hover:text-foreground">{t('nav.donate')}</Link>
          <a
            href={SITE_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('footer.githubNewTab')}
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" />
            {t('footer.github')}
          </a>
          <PWAInstallButton />
        </nav>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
          {t('footer.disclaimer')}
        </p>
      </div>
    </footer>
  );
}
