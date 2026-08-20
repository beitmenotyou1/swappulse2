import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';

// ShinyLanding — celebratory achievement showcase with a radiant gold/glowing
// palette. Earned medallions and milestones are front-and-center to motivate
// continued accomplishment.
export default function ShinyLanding({ data, did, isOwner, profile, posts, collection }) {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!did) return;
    let active = true;
    base44.entities.Achievement.filter({ did }, '-created_date', 24)
      .then((a) => { if (active) setAchievements(a || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [did]);

  return (
    <div className="py-4 space-y-4">
      {achievements.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-700">
            <Sparkles className="h-4 w-4" /> Earned Medallions
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {achievements.map((a) => (
              <div key={a.id} className="flex flex-col items-center rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-yellow-50 p-3 text-center rarity-glow-holo">
                <Award className="h-8 w-8 text-amber-500" />
                <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-amber-800">{a.title || a.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-amber-500" /></div>}

      <MilestonesTimeline milestones={data?.milestones || []} />

      {isOwner && achievements.length > 0 && (
        <Link to="/achievements" className="block rounded-xl bg-amber-100 p-3 text-center text-sm font-semibold text-amber-700 hover:bg-amber-200">
          View all achievements →
        </Link>
      )}
    </div>
  );
}