import React from 'react';
import { Link } from 'react-router-dom';
import MilestonesTimeline from '@/components/profile/MilestonesTimeline';
import { cardImageUrl } from '@/lib/tcgdex';

// VintageLanding — minimalist, distraction-free single-column layout with
// serif headings, muted sepia tones, and generous whitespace. Only the most
// essential personal blocks are surfaced.
export default function VintageLanding({ data, blockOrder, did, isOwner, profile, posts, collection }) {
  const binderCards = (collection || []).slice(0, 4);
  return (
    <div className="py-6 space-y-6">
      {data?.bio && (
        <div className="px-2">
          <p className="font-serif text-lg leading-relaxed text-amber-900/80">{data.bio}</p>
        </div>
      )}

      <MilestonesTimeline milestones={data?.milestones || []} />

      {binderCards.length > 0 && (
        <div className="px-2">
          <h3 className="mb-3 font-serif text-base font-bold text-amber-900">Collection</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {binderCards.map((c) => (
              <Link key={c.id} to={`/card/${c.card_id}`} className="block">
                <img src={cardImageUrl(c.card_image)} alt={c.card_name} className="aspect-[3/4] w-full rounded-lg object-cover shadow-md" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {data?.interests?.length > 0 && (
        <div className="px-2">
          <h3 className="mb-2 font-serif text-base font-bold text-amber-900">Interests</h3>
          <div className="flex flex-wrap gap-2">
            {data.interests.map((i, idx) => (
              <span key={idx} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800">{i}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}