import React from 'react';
import { Trophy, Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const CATEGORIES = ['helpful-trader', 'accuracy-champion', 'community-builder', 'set-completer', 'shiny-hunter', 'journal-writer', 'meetup-organiser'];
const VISIBILITY = ['public', 'friends-only', 'circle-scoped', 'private'];

export default function ChallengesSection({ settings, update }) {
  const c = settings.challenges || {};
  const toggleCat = (cat, on) => {
    const set = new Set(c.leaderboardCategories || []);
    if (on) set.add(cat); else set.delete(cat);
    update({ challenges: { ...c, leaderboardCategories: [...set] } });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-accent" /> Leaderboard Visibility</p>
            <p className="text-sm text-muted-foreground">Default: off. You control whether your challenge contributions appear on ranked leaderboards.</p>
          </div>
          <Switch checked={c.leaderboardOptIn === true} onCheckedChange={(v) => update({ challenges: { ...c, leaderboardOptIn: v } })} />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-accent" /> Categories</p>
        <p className="text-sm text-muted-foreground">Appear only on the leaderboard axes you choose.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
              <span className="text-sm font-medium capitalize">{cat.replace(/-/g, ' ')}</span>
              <Switch checked={(c.leaderboardCategories || []).includes(cat)} onCheckedChange={(v) => toggleCat(cat, v)} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold"><Eye className="h-4 w-4 text-primary" /> Challenge Activity Visibility</p>
        <p className="text-sm text-muted-foreground">Who can see your challenge activity.</p>
        <div className="flex flex-wrap gap-2">
          {VISIBILITY.map((v) => (
            <button key={v} onClick={() => update({ challenges: { ...c, challengeVisibility: v } })} className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${(c.challengeVisibility || 'friends-only') === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}>{v.replace(/-/g, ' ')}</button>
          ))}
        </div>
      </div>
    </div>
  );
}