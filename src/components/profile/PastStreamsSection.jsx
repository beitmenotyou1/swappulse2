import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, Mic, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import SaveAsPodcastModal from '@/components/spaces/SaveAsPodcastModal';

const GRADIENT = {
  twitch: 'from-[#9146FF] to-[#5a189a]',
  youtube: 'from-[#FF0000] to-[#7a0d0d]',
  kick: 'from-[#53FC18] to-[#1a7a0c]',
  facebook_gaming: 'from-[#1877F2] to-[#0a3d80]',
  rumble: 'from-[#85C742] to-[#3d6b1e]',
  custom: 'from-primary to-primary-muted',
  other: 'from-muted-foreground to-secondary',
};

// Profile "Past Streams" - ended voiceSpace records for the profile owner,
// each convertible into a podcast episode. Rendered under the Podcasts tab.
export default function PastStreamsSection({ did, onEpisodePublished }) {
  const { toast } = useToast();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [convert, setConvert] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.VoiceSpace.filter(did ? { status: 'ended', did } : { status: 'ended' }, '-created_date', 100);
      setStreams(all);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [did]);

  const del = async (s) => {
    if (!window.confirm('Delete this past stream?')) return;
    try {
      await base44.entities.VoiceSpace.delete(s.id);
      setStreams((p) => p.filter((x) => x.id !== s.id));
    } catch (e) {
      toast({ title: 'Could not delete', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (streams.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border p-4 pt-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
        <Mic className="h-4 w-4 text-primary" /> Past Streams
      </h3>
      <div className="space-y-2">
        {streams.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${GRADIENT[s.platform] || GRADIENT.custom}`}>
              <Radio className="h-5 w-5 text-white/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                Ended {formatDistanceToNow(new Date(s.ended_at || s.created_date), { addSuffix: true })} · ~{s.viewer_count_estimate || 0} peak viewers
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setConvert(s)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                Save as Podcast
              </button>
              <button
                onClick={() => del(s)}
                className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {convert && (
        <SaveAsPodcastModal
          space={convert}
          onClose={() => setConvert(null)}
          onPublished={() => { setConvert(null); load(); onEpisodePublished?.(); }}
        />
      )}
    </div>
  );
}