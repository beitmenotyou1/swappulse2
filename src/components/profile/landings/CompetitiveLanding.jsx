import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, BarChart3, Star, Target, TrendingUp, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// CompetitiveLanding — stats-forward overview with bold metric cards for
// trade win-rate, vouch count, and challenge progress. Dark high-contrast
// styling matches the Competitive theme's rivalry-focused personality.
export default function CompetitiveLanding({ data, did, isOwner, profile, posts, trades, reputation }) {
  const [vouches, setVouches] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!did) return;
    let active = true;
    (async () => {
      const [v, c] = await Promise.all([
        base44.entities.Vouch.filter({ vouched_did: did }, '-created_date', 50).catch(() => []),
        base44.entities.Challenge.filter({ status: 'active' }, '-created_date', 5).catch(() => []),
      ]);
      if (!active) return;
      setVouches(v || []);
      setChallenges(c || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [did]);

  const completedTrades = (trades || []).filter((t) => t.status === 'completed').length;
  const winRate = trades?.length ? Math.round((completedTrades / trades.length) * 100) : 0;

  return (
    <div className="py-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Trophy} label="Win Rate" value={`${winRate}%`} color="text-blue-400" />
        <StatCard icon={Star} label="Vouches" value={vouches.length} color="text-yellow-400" />
        <StatCard icon={BarChart3} label="Trades" value={trades?.length || 0} color="text-green-400" />
        <StatCard icon={Target} label="Posts" value={posts?.length || 0} color="text-red-400" />
      </div>

      {challenges.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-400">Active Challenges</h3>
          <div className="space-y-2">
            {challenges.map((c) => (
              <Link key={c.id} to={`/challenges/${c.id}`} className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-slate-800/50 p-3 hover:border-blue-500/60">
                <div>
                  <p className="text-sm font-bold">{c.title}</p>
                  <p className="text-xs text-slate-400">{c.challenge_type}</p>
                </div>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div>
      ) : vouches.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-400">Trust Vouches</h3>
          <p className="text-sm text-slate-300">{vouches.length} collectors have vouched for this trader.</p>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-blue-500/30 bg-slate-800/50 p-4 text-center">
      <Icon className={`h-6 w-6 ${color}`} />
      <span className="mt-2 text-2xl font-black">{value}</span>
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}