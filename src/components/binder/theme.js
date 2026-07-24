// §2.1 binder theme system — drives the binder backdrop + spine styling.
// Classes are literal strings so Tailwind keeps them.
export const BINDER_THEMES = {
  classic_purple: {
    label: 'Classic Purple',
    backdrop: 'from-primary/20 via-primary/5 to-background',
    spine: 'bg-primary',
  },
  holo_foil: {
    label: 'Holo Foil',
    backdrop: 'from-rarity-holo/25 via-cyan-300/10 to-background',
    spine: 'bg-gradient-to-b from-rarity-holo to-cyan-300',
  },
  vintage_leather: {
    label: 'Vintage Leather',
    backdrop: 'from-amber-900/30 via-amber-800/10 to-background',
    spine: 'bg-amber-700',
  },
  midnight: {
    label: 'Midnight',
    backdrop: 'from-indigo-900/40 via-slate-900/20 to-background',
    spine: 'bg-indigo-800',
  },
  rainbow: {
    label: 'Rainbow',
    backdrop: 'from-pink-500/20 via-yellow-400/15 to-cyan-400/20',
    spine: 'bg-gradient-to-b from-pink-500 via-yellow-400 to-cyan-400',
  },
  custom: {
    label: 'Custom',
    backdrop: 'from-secondary to-background',
    spine: 'bg-muted-foreground',
  },
};

export const THEME_KEYS = Object.keys(BINDER_THEMES);