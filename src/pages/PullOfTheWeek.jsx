import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy, Plus, Star, Sparkles } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { format, getISOWeek } from 'date-fns';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import useSEO from '@/hooks/useSEO';

// PullOfTheWeek — weekly community contest where collectors nominate their best
// card pull and vote for their favourites. Nominations are federated to the AT
// Protocol as org.swappulse.pullNomination records so the wider network can
// participate across SwapPulse instances.
export default function PullOfTheWeek() {
  useSEO({
    title: 'Pull of the Week',
    description: 'Nominate your best Pokémon TCG pull each week and vote on the community top pulls on SwapPulse.',
    canonicalPath: '/pull-of-the-week',
  });
  const [user, setUser] = useState(null);
  const [nominations, setNominations] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNominate, setShowNominate] = useState(false);

  const weekKey = useMemo(() => {
    const now = new Date();
    const year = format(now, 'yyyy');
    const week = String(getISOWeek(now)).padStart(2, '0');
    return `${year}-W${week}`;
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadData();
  }, [weekKey]);

  const loadData = async () => {
    try {
      const [noms, votes] = await Promise.all([
        base44.entities.PullNomination.filter({ week_key: weekKey }, '-vote_count', 50),
        base44.entities.PullVote.filter({ week_key: weekKey }, '-created_date', 50).catch(() => []),
      ]);
      setNominations(noms);
      if (votes.length > 0) setMyVote(votes[0].nomination_id);
    } catch { setNominations([]); }
    finally { setLoading(false); }
  };

  const vote = async (nominationId) => {
    if (myVote || !user) return;
    try {
      await base44.entities.PullVote.create({
        week_key: weekKey,
        nomination_id: nominationId,
        voter_name: user.full_name || user.email?.split('@')[0] || 'Collector',
      });
      await base44.entities.PullNomination.update(nominationId, {
        vote_count: (nominations.find((n) => n.id === nominationId)?.vote_count || 0) + 1,
      });
      setMyVote(nominationId);
      loadData();
    } catch (e) {
      alert('Could not vote: ' + e.message);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <PageHeader title="Pull of the Week" subtitle={`Week ${weekKey} — nominate your best pull and vote`}>
        {user && !showNominate && (
          <Button size="sm" onClick={() => setShowNominate(true)}>
            <Plus className="h-4 w-4" /> Nominate
          </Button>
        )}
      </PageHeader>

      <div className="p-4 space-y-4">
        {/* Leader banner */}
        {nominations.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <Trophy className="h-8 w-8 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-bold">{nominations[0].card_name}</p>
              <p className="text-xs text-muted-foreground">
                Leading with {nominations[0].vote_count} vote{nominations[0].vote_count !== 1 ? 's' : ''}
              </p>
            </div>
            <Avatar name={nominations[0].nominator_name} src={nominations[0].nominator_avatar} size={32} />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : nominations.length === 0 ? (
          <div className="mx-auto max-w-md py-16 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-primary/40" />
            <h2 className="mt-4 text-lg font-bold">No nominations yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Be the first to nominate your best pull this week!
            </p>
            {user && (
              <Button className="mt-4" onClick={() => setShowNominate(true)}>
                <Plus className="h-4 w-4" /> Nominate a Pull
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {nominations.map((n, i) => (
              <div key={n.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                {n.card_image && (
                  <img src={n.card_image} alt={n.card_name} className="h-20 w-16 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {i === 0 && <Trophy className="h-4 w-4 text-accent" />}
                    <span className="text-sm font-bold">{n.card_name}</span>
                  </div>
                  {n.card_rarity && (
                    <p className="text-xs text-muted-foreground">{n.card_rarity}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar name={n.nominator_name} src={n.nominator_avatar} size={20} />
                    <span className="text-xs text-muted-foreground">{n.nominator_name}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {n.vote_count}
                    </span>
                    {myVote === n.id ? (
                      <span className="text-xs font-medium text-success">Voted</span>
                    ) : myVote ? (
                      <span className="text-xs text-muted-foreground">Already voted</span>
                    ) : user ? (
                      <Button size="sm" variant="outline" onClick={() => vote(n.id)}>Vote</Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNominate && user && (
        <NominateModal
          user={user}
          weekKey={weekKey}
          onClose={() => setShowNominate(false)}
          onCreated={() => { setShowNominate(false); loadData(); }}
        />
      )}
    </div>
  );
}

function NominateModal({ user, weekKey, onClose, onCreated }) {
  const [cardId, setCardId] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardImage, setCardImage] = useState('');
  const [cardRarity, setCardRarity] = useState('');
  const [setName, setSetName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!cardName) return;
    setSubmitting(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        week_key: weekKey,
        card_id: cardId,
        card_name: cardName,
        card_image: cardImage,
        card_rarity: cardRarity,
        set_name: setName,
        nominator_name: user.full_name || user.email?.split('@')[0] || 'Collector',
        nominator_handle: user.email?.split('@')[0] || '',
      }, NSID.PULL_NOMINATION, did, signingKey);
      await base44.entities.PullNomination.create(stamped);
      // Bridge to PDS (non-fatal)
      base44.functions.invoke('atproto-bridge', {
        collection: NSID.PULL_NOMINATION,
        record: {
          weekKey: weekKey,
          cardId: cardId,
          cardName: cardName,
          cardImage: cardImage,
          cardRarity: cardRarity,
          setName: setName,
          nominatorDid: did,
          nominatorName: user.full_name || 'Collector',
          createdAt: new Date().toISOString(),
        },
      }).catch(() => {});
      onCreated();
    } catch (e) {
      alert('Could not nominate: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Nominate Your Pull</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enter the card you pulled this week.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium">Card name</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Charizard ex"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Card ID (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="sv3-215"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Image URL (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="https://..."
              value={cardImage}
              onChange={(e) => setCardImage(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Rarity</label>
              <input
                className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Rare Holo"
                value={cardRarity}
                onChange={(e) => setCardRarity(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Set</label>
              <input
                className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Scarlet & Violet"
                value={setName}
                onChange={(e) => setSetName(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!cardName || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nominate'}
          </Button>
        </div>
      </div>
    </div>
  );
}