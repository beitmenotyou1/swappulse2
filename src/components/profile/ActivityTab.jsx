import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, ArrowLeftRight, ShieldCheck, Award, Layers, Trophy, BookOpen, BookMarked, MapPin, Camera, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import moment from 'moment';

const ICONS = {
  post: MessageCircle,
  trade: ArrowLeftRight,
  vouch: ShieldCheck,
  achievement: Award,
  collection: Layers,
  challenge_entry: Trophy,
  journal: BookOpen,
  binder: BookMarked,
  meetup_rsvp: MapPin,
  story: Camera,
};

export default function ActivityTab({ did }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await base44.functions.invoke('get-activity', { did, limit: 50 });
        const body = res?.data ?? res;
        if (!active) return;
        setItems(body?.items || []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (error) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Couldn't load activity right now.</p>;
  }
  if (items.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No recent activity yet.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {items.map((it, i) => {
        const Icon = ICONS[it.type] || Sparkles;
        const row = (
          <div className="flex items-start gap-3 py-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium capitalize">{it.verb}</span>{' '}
                <span className="text-muted-foreground truncate">{it.target}</span>
              </p>
              <p className="text-xs text-muted-foreground">{moment(it.created_date).fromNow()}</p>
            </div>
          </div>
        );
        return it.target_path ? (
          <Link key={it.id || i} to={it.target_path} className="block hover:bg-secondary/50 transition-colors">{row}</Link>
        ) : (
          <div key={it.id || i}>{row}</div>
        );
      })}
    </div>
  );
}