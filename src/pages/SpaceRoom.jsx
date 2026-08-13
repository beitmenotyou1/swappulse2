import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mic, MicOff, Hand, LogOut, Radio, Crown, Disc3, Users, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, generateDid, generateSigningKey, NSID } from '@/lib/atproto';
import LiveAvatar from '@/components/LiveAvatar';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { rt } from '@/lib/realtime';

const DEMO_NAMES = ['PokeProf', 'ShinyHunter', 'CardQueen', 'VintageVince', 'FoilFiend', 'BinderBaron'];

function roleOrder(r) {
  return { host: 0, co_host: 1, speaker: 2, listener: 3 }[r] ?? 9;
}

export default function SpaceRoom() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [space, setSpace] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [myDid, setMyDid] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState(false);
  const [speaking, setSpeaking] = useState({});
  const [ended, setEnded] = useState(false);
  const [ending, setEnding] = useState(false);

  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const myPartIdRef = useRef('');
  const leftRef = useRef(false);
  const audioCtxRef = useRef(null);

  const isHost = space?.did === myDid;

  const loadSpace = useCallback(async () => {
    const s = await base44.entities.VoiceSpace.get(spaceId).catch(() => null);
    setSpace(s);
    return s;
  }, [spaceId]);

  const loadParticipants = useCallback(async () => {
    const ps = await base44.entities.SpaceParticipant.filter({ space_id: spaceId }, '-joined_at', 200).catch(() => []);
    setParticipants(ps);
  }, [spaceId]);

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
  }, []);

  const startAudio = async (s) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      setMicOn(true);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const lvl = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(lvl);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      if (s.recording_enabled) {
        const rec = new MediaRecorder(stream);
        chunksRef.current = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
        rec.start(1000);
        recorderRef.current = rec;
        recordStartRef.current = Date.now();
      }
    } catch {
      setMicError(true);
    }
  };

  const seedDemoListeners = async (sid) => {
    const existing = await base44.entities.SpaceParticipant.filter({ space_id: sid }).catch(() => []);
    if (existing.length > 1) return;
    const stamped = await Promise.all(
      Array.from({ length: 4 }, (_, i) => {
        const did = generateDid();
        const signingKey = generateSigningKey();
        const name = DEMO_NAMES[i % DEMO_NAMES.length];
        return stampRecord({
          space_ref: `at://did:web:swappulse.org/${NSID.VOICE_SPACE}/${sid}`,
          space_id: sid,
          role: 'listener',
          joined_at: new Date().toISOString(),
          participant_name: name,
          participant_handle: name.toLowerCase(),
          participant_avatar: '',
        }, NSID.SPACE_PARTICIPANT, did, signingKey);
      }),
    );
    await base44.entities.SpaceParticipant.bulkCreate(stamped);
    loadParticipants();
  };

  // Init: identity, join, host audio + demo audience.
  useEffect(() => {
    (async () => {
      const { did, signingKey } = await ensureUserDid();
      setMyDid(did);
      const s = await loadSpace();
      if (!s || s.status === 'ended' || s.status === 'cancelled') { setEnded(true); return; }
      await loadParticipants();
      const existing = await base44.entities.SpaceParticipant.filter({ space_id: spaceId, did }).catch(() => []);
      let myPart;
      if (existing.length === 0) {
        const stamped = await stampRecord({
          space_ref: s.at_uri || `at://${did}/${NSID.VOICE_SPACE}/${spaceId}`,
          space_id: spaceId,
          role: s.did === did ? 'host' : 'listener',
          joined_at: new Date().toISOString(),
          participant_name: user?.full_name || 'Collector',
          participant_handle: user?.email?.split('@')[0] || 'collector',
          participant_avatar: user?.avatar_url || '',
        }, NSID.SPACE_PARTICIPANT, did, signingKey);
        myPart = await base44.entities.SpaceParticipant.create(stamped);
      } else {
        myPart = existing[0];
      }
      myPartIdRef.current = myPart.id;
      if (s.did === did) {
        startAudio(s);
        seedDemoListeners(spaceId);
      }
    })();
    return () => cleanupAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  // Realtime subscriptions for this space.
  useEffect(() => {
    const onPart = () => loadParticipants();
    const onSpace = (s) => { if (s.id === spaceId && (s.status === 'ended' || s.status === 'cancelled')) setEnded(true); };
    const u1 = rt.on('space.participant_update', onPart);
    const u2 = rt.on('space.ended', onSpace);
    return () => { u1?.(); u2?.(); };
  }, [spaceId, loadParticipants]);

  // Simulated speaking indicators for non-host participants.
  useEffect(() => {
    const id = setInterval(() => {
      setSpeaking((prev) => {
        const next = { ...prev };
        participants.forEach((p) => {
          if (p.id === myPartIdRef.current && isHost && micOn) return;
          if (['host', 'co_host', 'speaker'].includes(p.role) && Math.random() < 0.25) {
            next[p.id] = !next[p.id];
          } else if (p.role === 'listener') {
            next[p.id] = false;
          }
        });
        return next;
      });
    }, 1200);
    return () => clearInterval(id);
  }, [participants, isHost, micOn]);

  // Host speaking from real mic level.
  useEffect(() => {
    if (isHost && micOn) {
      setSpeaking((prev) => ({ ...prev, [myPartIdRef.current]: micLevel > 12 }));
    }
  }, [micLevel, isHost, micOn]);

  const goLive = async () => {
    try { await base44.functions.invoke('provisionSpace', { space_id: spaceId }); await loadSpace(); } catch { /* ignore */ }
  };

  const toggleMic = () => {
    const on = !micOn;
    setMicOn(on);
    streamRef.current?.getAudioTracks?.().forEach((t) => { t.enabled = on; });
  };

  const promote = async (p, role) => {
    await base44.entities.SpaceParticipant.update(p.id, { role, hand_raised: false }).catch(() => {});
    loadParticipants();
  };

  const raiseHand = async () => {
    if (!myPartIdRef.current) return;
    const me = participants.find((p) => p.id === myPartIdRef.current);
    await base44.entities.SpaceParticipant.update(myPartIdRef.current, { hand_raised: !me?.hand_raised }).catch(() => {});
    loadParticipants();
  };

  const leave = async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    if (myPartIdRef.current) {
      await base44.entities.SpaceParticipant.update(myPartIdRef.current, { left_at: new Date().toISOString() }).catch(() => {});
    }
    cleanupAudio();
    navigate('/spaces');
  };

  const endSpace = async () => {
    if (ending) return;
    setEnding(true);
    try {
      let recordingUrl = '';
      let duration = 0;
      let podcastId = '';
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        await new Promise((res) => {
          recorderRef.current.onstop = res;
          recorderRef.current.stop();
        });
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        if (blob.size > 0) {
          const file = new File([blob], `space-${spaceId}.webm`, { type: 'audio/webm' });
          const up = await base44.integrations.Core.UploadFile({ file });
          recordingUrl = up.file_url;
        }
      }
      if (recordingUrl) {
        const { did, signingKey } = await ensureUserDid();
        const stamped = await stampRecord({
          title: space.title,
          description: space.description || `Recorded Voice Space · ${new Date().toLocaleDateString()}`,
          audio_url: recordingUrl,
          duration_seconds: duration,
          episode_number: 1,
          season_number: 1,
          source_space_id: spaceId,
          show_notes: (space.topic_tags || []).map((t) => `#${t}`).join(' '),
          tags: space.topic_tags || [],
          published_at: new Date().toISOString(),
          host_name: space.host_name,
          host_handle: space.host_handle,
          host_avatar: space.host_avatar,
        }, NSID.PODCAST_EPISODE, did, signingKey);
        const ep = await base44.entities.PodcastEpisode.create(stamped);
        podcastId = ep.id;
      }
      await base44.functions.invoke('endSpace', {
        space_id: spaceId,
        recording_url: recordingUrl,
        recording_duration_seconds: duration,
        podcast_episode_id: podcastId,
      });
      toast({ title: 'Space ended', description: recordingUrl ? 'Recording published as a podcast' : 'Space ended' });
      cleanupAudio();
      navigate('/spaces');
    } catch (e) {
      toast({ title: 'Could not end space', description: e.message, variant: 'destructive' });
      setEnding(false);
    }
  };

  if (!space) {
    return <div className="flex h-[60vh] items-center justify-center"><Radio className="h-6 w-6 animate-pulse text-primary" /></div>;
  }
  if (ended) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <Radio className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-bold">This space has ended</p>
        <Link to="/spaces" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Back to Spaces</Link>
      </div>
    );
  }

  const speakersList = participants
    .filter((p) => ['host', 'co_host', 'speaker'].includes(p.role) && !p.left_at)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
  const listenersList = participants.filter((p) => p.role === 'listener' && !p.left_at);
  const handRaised = participants.filter((p) => p.hand_raised && !p.left_at && p.role === 'listener');
  const myPart = participants.find((p) => p.id === myPartIdRef.current);
  const myRole = myPart?.role || (isHost ? 'host' : 'listener');

  return (
    <div className="flex min-h-[80vh] flex-col">
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> {space.status === 'live' ? 'LIVE' : 'SCHEDULED'}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {space.listener_count || listenersList.length}</span>
          </div>
          <button onClick={leave} className="rounded-full p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pb-3">
          <h1 className="text-lg font-extrabold">{space.title}</h1>
          <p className="text-sm text-muted-foreground">Hosted by {space.host_name || 'Collector'}</p>
          {space.topic_tags?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">{space.topic_tags.map((t, i) => <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">#{t}</span>)}</div>
          )}
        </div>
      </div>

      <div className="flex-1 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Speakers</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {speakersList.map((p) => {
            const isMe = p.id === myPartIdRef.current;
            const speakingNow = speaking[p.id] || (isMe && isHost && micLevel > 12);
            return (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <span className="relative inline-block">
                  <span className={`absolute -inset-1 rounded-full ${speakingNow ? 'animate-pulse bg-primary/50' : 'bg-transparent'}`} />
                  <LiveAvatar did={p.did} name={p.participant_name} src={p.participant_avatar} size={56} className="relative" />
                  {p.role === 'host' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary p-0.5 text-white"><Crown className="h-3 w-3" /></span>}
                </span>
                <p className="max-w-[72px] truncate text-xs font-semibold">{p.participant_name || 'Collector'}{isMe ? ' (you)' : ''}</p>
                <p className="text-[10px] capitalize text-muted-foreground">{p.role}</p>
              </div>
            );
          })}
        </div>

        {handRaised.length > 0 && (
          <>
            <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-accent">Raised Hands</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {handRaised.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <span className="relative inline-block">
                    <Hand className="absolute -right-1 -top-1 h-4 w-4 text-accent" />
                    <LiveAvatar did={p.did} name={p.participant_name} size={48} />
                  </span>
                  <p className="max-w-[72px] truncate text-xs">{p.participant_name}</p>
                  {isHost && <button onClick={() => promote(p, 'speaker')} className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Promote</button>}
                </div>
              ))}
            </div>
          </>
        )}

        <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Listeners ({listenersList.length})</p>
        <div className="flex flex-wrap gap-2">
          {listenersList.length === 0 ? (
            <p className="text-xs text-muted-foreground">No listeners yet.</p>
          ) : (
            listenersList.map((p) => <LiveAvatar key={p.id} did={p.did} name={p.participant_name} src={p.participant_avatar} size={32} />)
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        {space.status === 'scheduled' && isHost && (
          <div className="px-4 pt-3"><button onClick={goLive} className="w-full rounded-full bg-destructive py-2.5 text-sm font-bold text-white">Start Now</button></div>
        )}
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          {isHost && (
            <button onClick={toggleMic} disabled={micError} className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold ${micOn ? 'bg-primary text-primary-foreground' : 'bg-secondary'} disabled:opacity-50`}>
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} {micOn ? 'Mute' : 'Unmute'}
            </button>
          )}
          {myRole === 'listener' && (
            <button onClick={raiseHand} className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold ${myPart?.hand_raised ? 'bg-accent text-accent-foreground' : 'bg-secondary'}`}>
              <Hand className="h-4 w-4" /> {myPart?.hand_raised ? 'Lower Hand' : 'Raise Hand'}
            </button>
          )}
          {isHost ? (
            <button onClick={endSpace} disabled={ending} className="flex items-center gap-1.5 rounded-full bg-destructive px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <LogOut className="h-4 w-4" /> {ending ? 'Ending…' : 'End Space'}
            </button>
          ) : (
            <button onClick={leave} className="flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-bold">
              <LogOut className="h-4 w-4" /> Leave
            </button>
          )}
        </div>
        {micError && isHost && <p className="pb-2 text-center text-xs text-muted-foreground">Mic access denied - you can still host; listeners won't hear you.</p>}
        {space.recording_enabled && isHost && recorderRef.current && <p className="flex items-center justify-center gap-1 pb-2 text-[10px] text-muted-foreground"><Disc3 className="h-3 w-3" /> Recording in progress</p>}
      </div>
    </div>
  );
}