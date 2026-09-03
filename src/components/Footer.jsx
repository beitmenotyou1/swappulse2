import React from 'react';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import PWAInstallButton from '@/components/PWAInstallButton';

const FOOTER_LINKS = [
  { tKey: 'footer.about', to: '/about' },
  { tKey: 'footer.terms', to: '/terms' },
  { tKey: 'footer.privacy', to: '/privacy' },
  { tKey: 'footer.help', to: '/help' },
  { tKey: 'footer.status', to: '/status' },
  { tKey: 'footer.chainExplorer', to: '/chain/' },
  { tKey: 'footer.donate', to: '/donate' },
];

export default function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SwapPulse · {t('footer.tagline')}
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {t(link.tKey)}
              </Link>
            ))}
            <a
              href="https://github.com/beitmenotyou1/swappulse2"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('footer.githubNewTab')}
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              {t('footer.github')}
            </a>
            <PWAInstallButton />
          </nav>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          {t('footer.disclaimer')}
        </p>
      </div>
    </footer>
  );
}