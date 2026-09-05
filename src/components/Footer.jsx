import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, ExternalLink, Github } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import PWAInstallButton from '@/components/PWAInstallButton';
import { SITE_LINKS } from '@/lib/siteLinks';

const SECONDARY_LINKS = [
  { tKey: 'footer.about', to: '/about' },
  { tKey: 'footer.terms', to: '/terms' },
  { tKey: 'footer.privacy', to: '/privacy' },
  { tKey: 'footer.chainExplorer', to: '/chain/' },
  { tKey: 'footer.donate', to: '/donate' },
];

export default function Footer() {
  const t = useT();

  return (
    <footer className="mt-10 border-t border-border bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={SITE_LINKS.documentation}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/5 p-4 transition-colors hover:border-primary/45 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-foreground">{t('footer.documentation')}</span>
                <span className="block text-xs text-muted-foreground">{t('docs.footerDescription')}</span>
              </span>
            </span>
            <ExternalLink className="h-4 w-4 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </a>

          <Link
            to="/status"
            className="group flex items-center justify-between rounded-2xl border border-success/25 bg-success/5 p-4 transition-colors hover:border-success/45 hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/15 text-success">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-foreground">{t('footer.status')}</span>
                <span className="block text-xs text-muted-foreground">{t('status.footerDescription')}</span>
              </span>
            </span>
            <span className="text-xs font-bold text-success">{t('status.viewStatus')}</span>
          </Link>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4 border-t border-border pt-5 sm:flex-row sm:justify-between">
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} SwapPulse · {t('footer.tagline')}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2" aria-label="Footer">
            {SECONDARY_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {t(link.tKey)}
              </Link>
            ))}
            <a
              href={SITE_LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('footer.githubNewTab')}
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              {t('footer.github')}
            </a>
            <PWAInstallButton />
          </nav>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {t('footer.disclaimer')}
        </p>
      </div>
    </footer>
  );
}
