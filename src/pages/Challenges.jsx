import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Target } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import ChallengeCard from '@/components/challenges/ChallengeCard';
import { useAuth } from '@/lib/AuthContext';
import useSEO from '@/hooks/useSEO';
import GuideFooterLink from '@/components/help/GuideFooterLink';
import { useT } from '@/lib/i18n/I18nProvider';

const TABS = ['active', 'upcoming', 'completed', 'mine'];
const FILTERS = ['all', 'collective', 'competitive', 'circle'];

function statusOf(c, now) {
  if (c.status === 'completed' || c.status === 'cancelled') return 'completed';
  const start = c.starts_at ? new Date(c.starts_at) : null;
  const end = c.ends_at ? new Date(c.ends_at) : null;
  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'completed';
  return 'active';
}

export default function Challenges() {
  const t = useT();
  useSEO({
    title: 'Challenges',
    description: 'Join Pokémon TCG collector challenges on SwapPulse, set completion races, pack opening contests, and community goals.',
    canonicalPath: '/challenges',
  });
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const [filter, setFilter] = useState('all');
  const [challenges, setChallenges] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.Challenge.list('-starts_at', 100)
      .then(setChallenges)
      .catch((e) => setError(e?.message || 'Failed to load'));
  }, []);

  useEffect(() => {
    const did = user?.did || user?.id;
    if (!did || tab !== 'mine') return;
    base44.entities.ChallengeEntry.filter({ participant_did: did }, '-submitted_at', 100)
      .then(setMine).catch(() => {});
  }, [user, tab]);

  const visible = useMemo(() => {
    if (!challenges) return [];
    const now = new Date();
    let list = challenges.map((c) => ({ c, status: statusOf(c, now) }));
    if (tab === 'mine') {
      const ids = new Set(mine.map((m) => m.challenge_id));
      list = list.filter(({ c }) => ids.has(c.id));
    } else {
      list = list.filter(({ status }) => status === tab);
    }
    if (filter === 'collective') list = list.filter(({ c }) => c.mode === 'collective');
    if (filter === 'competitive') list = list.filter(({ c }) => c.mode === 'competitive');
    if (filter === 'circle') list = list.filter(({ c }) => c.scope === 'circle');
    list.sort((a, b) => {
      if (a.c.mode !== b.c.mode) return a.c.mode === 'collective' ? -1 : 1;
      return new Date(a.c.ends_at || 0).getTime() - new Date(b.c.ends_at || 0).getTime();
    });
    return list;
  }, [challenges, tab, filter, mine]);

  return (
    <div>
      <PageHeader title={t('page.challenges.title')} subtitle={t('page.challenges.subtitle')} />
      <div className="sticky top-[57px] z-20 space-y-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map((tabKey) => (
            <button key={tabKey} onClick={() => setTab(tabKey)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${tab === tabKey ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}>{t(`challenges.tab.${tabKey}`)}</button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}>{f === 'circle' ? 'Circle-Scoped' : f}</button>
          ))}
        </div>
      </div>
      <div className="space-y-3 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!challenges && !error && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {challenges && visible.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <Target className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>{t('page.challenges.empty')}</p>
          </div>
        )}
        {visible.map(({ c }) => <ChallengeCard key={c.id} challenge={c} />)}
      </div>
      <GuideFooterLink slug="challenges" />
    </div>
  );
}