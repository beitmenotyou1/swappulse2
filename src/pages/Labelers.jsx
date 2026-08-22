import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, ShieldCheck, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import LabelerCard from '@/components/labelers/LabelerCard';
import useSEO from '@/hooks/useSEO';
import { useAuth } from '@/lib/AuthContext';

const CATEGORIES = ['all', 'authenticity', 'safety', 'grading', 'expertise', 'quality', 'other'];

export default function Labelers() {
  useSEO({
    title: 'Community Labelers',
    description: 'Subscribe to community labeling services to shape your SwapPulse feed with trust signals from expert collectors.',
    canonicalPath: '/labelers',
  });
  const { user } = useAuth();
  const [labelers, setLabelers] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = category === 'all' ? {} : { category };
      const [labs, subs] = await Promise.all([
        base44.entities.CommunityLabeler.filter(filter, '-created_date', 50),
        user?.id ? base44.entities.LabelerSubscription.filter({}, '-created_date', 100).catch(() => []) : Promise.resolve([]),
      ]);
      const map = {};
      (subs || []).forEach((s) => { map[s.labeler_id] = s; });
      setLabelers(labs || []);
      setSubscriptions(map);
    } catch { setLabelers([]); } finally { setLoading(false); }
  }, [category, user?.id]);

  useEffect(() => { load(); }, [load]);

  const onToggle = (labeler, nowSubscribed, created) => {
    setSubscriptions((prev) => {
      const next = { ...prev };
      if (nowSubscribed) next[labeler.id] = created;
      else delete next[labeler.id];
      return next;
    });
  };

  return (
    <div>
      <PageHeader title="Community Labelers" subtitle="Stackable trust layers from expert collector communities." />
      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${category === c ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              {c}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : labelers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No labelers in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {labelers.map((l) => (
              <LabelerCard key={l.id} labeler={l} subscribed={subscriptions[l.id]} onToggle={onToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}