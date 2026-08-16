import React from 'react';
import { Link } from 'react-router-dom';

const FOOTER_LINKS = [
  { label: 'Terms', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Help', to: '/help' },
  { label: 'Status', to: '/status' },
  { label: 'Explore', to: '/explore' },
  { label: 'Donate', to: '/donate' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SwapPulse · A decentralized Pokémon TCG community
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
          SwapPulse is a free, open-source platform. Pokémon and Pokémon TCG are trademarks of Nintendo, Game Freak, and The Pokémon Company. SwapPulse is not affiliated with or endorsed by them.
        </p>
      </div>
    </footer>
  );
}