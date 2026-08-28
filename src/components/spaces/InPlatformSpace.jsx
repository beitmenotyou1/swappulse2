import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mic, MicOff, Hand, LogOut, Radio, Crown, Disc3, Users, X, Shield, Settings2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import LiveAvatar from '@/components/LiveAvatar';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { rt } from '@/lib/realtime';
import { SpaceMesh, MAX_SPEAKERS } from '@/lib/spaceMesh';
import SpaceAdminPanel from '@/components/spaces/SpaceAdminPanel';

function roleOrder(r) {
  return { host: 0, co_host: 1, mod: 2, speaker: 3, listener: 4 }[r] ?? 9;
}

const STAGE_ROLES = ['host', 'co_host', 'mod', 'speaker'];

// In-platform voice space — a true X-Spaces-style audio stage. Stage members
// publish mic audio over a WebRTC peer mesh; listeners hear every speaker in
// real time. The host (and mods) manage the stage from the admin panel.
export default function InPlatformSpace({ space: initialSpace }) {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [space, setSpace] = useState(initialSpace);
  const [participants, setParticipants] = useState([]);
  const [myDid, setMyDid] = useState('');
  const [micError, setMicError] = useState(false);
  const [speaking, setSpeaking] = useState({});
  const [ended, setEnded] = useState(initialSpace?.status === 'ended' || initialSpace?.status === 'cancelled');
  const [ending, setEnding] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [recording, setRecording] = useState(!!initialSpace?.recording_enabled);
  const [left, setLeft] = useState(false);

  const meshRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const myPartIdRef = useRef('');
  const leftRef = useRef(false);
  const partialRecordingRef = useRef(null);

  const isHost = space?.did === myDid;
  const myPart = participants.find((p) => p.id === myPartIdRef.current);
  const myRole = myPart?.role || (isHost ? 'host' : 'listener');
  const canManage = isHost || myRole === 'mod' || myRole === 'co_host';
  const onStage = STAGE_ROLES.includes(myRole);

  const loadSpace = useCallback(async () => {
    const s = await base44.entities.VoiceSpace.get(spaceId).catch(() => null);
    if (s) setSpace(s);
    return s;
  }, [spaceId]);

  const loadParticipants = useCallback(async () => {
    const ps = await base44.entities.SpaceParticipant.filter({ space_id: spaceId }, '-joined_at', 200).catch(() => []);
    setParticipants(ps);
  }, [spaceId]);

  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* */ }
    }
    meshRef.current?.destroy();
    meshRef.current = null;
  }, []);

  // Mount: identity, join, mesh, host publishing + recording, realtime subs.
  useEffect(() => {
    (async () => {
      const { did, signingKey } = await ensureUserDid();
      setMyDid(did);
      const [s, , existing] = await Promise.all([
        loadSpace(),
        loadParticipants(),
        base44.entities.SpaceParticipant.filter({ space_id: spaceId, did }).catch(() => []),
      ]);
      if (!s || s.status === 'ended' || s.status === 'cancelled') { setEnded(true); return; }
      let myPart;
      if (existing.length === 0) {
        const stamped = await stampRecord({
          space_ref: s.at_uri || `at://${did}/${NSID.VOICE_SPACE}/${spaceId}`,
          space_id: spaceId,
          role: s.did === did ? 'host' : 'listener',
          muted: s.did === did ? false : true,
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

      const mesh = new SpaceMesh({ spaceId, myDid: did, myParticipantId: myPart.id });
      meshRef.current = mesh;

      // Realtime: signals, participant updates, space ended.
      const onSignal = (sig) => {
        if (!sig || sig.space_id !== spaceId) return;
        if (sig.to_did && sig.to_did !== did) return;
        mesh.handleSignal(sig);
      };
      const onPart = () => loadParticipants();
      const onSpace = (sp) => {
        if (sp.id === spaceId) {
          setSpace(sp);
          if (sp.status === 'ended' || sp.status === 'cancelled') setEnded(true);
          if ('recording_enabled' in sp) setRecording(!!sp.recording_enabled);
        }
      };
      const u1 = rt.on('space.signal', onSignal);
      const u2 = rt.on('space.participant_update', onPart);
      const u3 = rt.on('space.ended', onSpace);
      // Pick up recording-toggle and other VoiceSpace updates.
      const u4 = rt.on('space.updated', onSpace);
      cleanup._unsub = () => { u1?.(); u2?.(); u3?.(); u4?.(); };

      // Host starts publishing immediately; start recording if enabled.
      if (s.did === did) {
        mesh.startPublishing().catch(() => setMicError(true));
        if (s.recording_enabled) startRecording(mesh);
      }
    })();
    return () => {
      cleanup._unsub?.();
      if (!leftRef.current) {
        // Tab close / unmount without explicit leave — mark left + destroy mesh.
        if (myPartIdRef.current) {
          base44.entities.SpaceParticipant.update(myPartIdRef.current, { left_at: new Date().toISOString() }).catch(() => {});
        }
      }
      cleanup();
    };
     
  }, [spaceId]);

  // Connect to every current stage speaker (mesh).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !myDid) return;
    const speakers = participants.filter((p) => STAGE_ROLES.includes(p.role) && !p.left_at && p.did !== myDid);
    speakers.forEach((p) => mesh.connectToSpeaker(p.did, p.role).catch(() => {}));
  }, [participants, myDid]);

  // Drive my own publishing based on role + muted_by_host.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !myPartIdRef.current || !myPart) return;
    const shouldPublish = STAGE_ROLES.includes(myPart.role) && !myPart.muted_by_host;
    if (shouldPublish && !mesh.published) {
      mesh.startPublishing().catch(() => setMicError(true));
    } else if (!shouldPublish && mesh.published) {
      mesh.stopPublishing();
    }
  }, [myPart?.role, myPart?.muted_by_host]);

  // Speaking-ring poll (real WebRTC analyser levels).
  useEffect(() => {
    const id = setInterval(() => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const next = {};
      participants.forEach((p) => {
        if (!STAGE_ROLES.includes(p.role) || p.left_at) return;
        if (p.id === myPartIdRef.current) next[p.id] = mesh.localLevel() > 0.08;
        else next[p.id] = mesh.speakingLevel(p.did) > 0.08;
      });
      setSpeaking(next);
    }, 200);
    return () => clearInterval(id);
  }, [participants]);

  const startRecording = (mesh) => {
    const stream = mesh.getRecordingStream();
    if (!stream || !stream.getAudioTracks?.().length) return;
    try {
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start(1000);
      recorderRef.current = rec;
      recordStartRef.current = Date.now();
      setRecording(true);
    } catch (e) { console.error('recorder start failed', e); }
  };

  const stopRecording = () => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') { resolve({ url: '', duration: 0 }); return; }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        resolve({ blob, duration });
      };
      rec.stop();
    });
  };

  const toggleRecording = async () => {
    if (!isHost) return;
    if (recording) {
      const { blob } = await stopRecording();
      recorderRef.current = null;
      setRecording(false);
      await base44.entities.VoiceSpace.update(spaceId, { recording_enabled: false }).catch(() => {});
      if (blob && blob.size > 0) {
        // Stash the partial recording for the end-of-space publish.
        partialRecordingRef.current = blob;
        toast({ title: 'Recording stopped', description: 'Will be saved when you end the Space.' });
      }
    } else {
      startRecording(meshRef.current);
      await base44.entities.VoiceSpace.update(spaceId, { recording_enabled: true }).catch(() => {});
    }
  };

  const toggleMic = () => {
    const mesh = meshRef.current;
    if (!mesh || !mesh.published) return;
    const on = !(myPart?.muted === false);
    mesh.getLocalStream()?.getAudioTracks?.().forEach((t) => { t.enabled = on; });
    base44.entities.SpaceParticipant.update(myPartIdRef.current, { muted: !on }).catch(() => {});
  };

  const raiseHand = async () => {
    if (!myPartIdRef.current) return;
    await base44.entities.SpaceParticipant.update(myPartIdRef.current, { hand_raised: !myPart?.hand_raised }).catch(() => {});
    loadParticipants();
  };

  const updatePart = async (p, patch) => {
    await base44.entities.SpaceParticipant.update(p.id, patch).catch(() => {});
    loadParticipants();
  };

  const promote = (p) => updatePart(p, { role: 'speaker', hand_raised: false, muted: false });
  const demote = (p) => updatePart(p, { role: 'listener', hand_raised: false });
  const makeMod = (p) => updatePart(p, { role: 'mod', hand_raised: false, muted: false });
  const revokeMod = (p) => updatePart(p, { role: 'speaker' });
  const muteByHost = (p) => updatePart(p, { muted_by_host: true });
  const unmuteByHost = (p) => updatePart(p, { muted_by_host: false });
  const removePart = (p) => updatePart(p, { left_at: new Date().toISOString() });

  const leave = async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    setLeft(true);
    if (myPartIdRef.current) {
      await base44.entities.SpaceParticipant.update(myPartIdRef.current, { left_at: new Date().toISOString() }).catch(() => {});
    }
    cleanup();
    navigate('/spaces');
  };

  const endSpace = async () => {
    if (ending) return;
    setEnding(true);
    try {
      let recordingUrl = '';
      let duration = 0;
      let podcastId = '';
      // Finalize active or partial recording.
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        const { blob, duration: d } = await stopRecording();
        duration = d;
        if (blob && blob.size > 0) {
          const file = new File([blob], `space-${spaceId}.webm`, { type: 'audio/webm' });
          const up = await base44.integrations.Core.UploadFile({ file });
          recordingUrl = up.file_url;
        }
      } else if (partialRecordingRef.current && partialRecordingRef.current.size > 0) {
        duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const file = new File([partialRecordingRef.current], `space-${spaceId}.webm`, { type: 'audio/webm' });
        const up = await base44.integrations.Core.UploadFile({ file });
        recordingUrl = up.file_url;
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
          original_audio_url: recordingUrl,
          show_notes: (space.topic_tags || []).map((t) => `#${t}`).join(' '),
          tags: space.topic_tags || [],
          trim_start_seconds: 0,
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
      toast({ title: 'Space ended', description: recordingUrl ? 'Recording saved to your podcasts' : 'Space ended' });
      cleanup();
      navigate('/spaces');
    } catch (e) {
      toast({ title: 'Could not end space', description: e.message, variant: 'destructive' });
      setEnding(false);
    }
  };

  if (ended) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <Radio className="h-8 w-8 text-muted-foreground" />
        <p className="text-lg font-bold">This Space has ended</p>
        {space?.podcast_episode_id && (
          <Link to={`/profile/${space.did}`} className="text-sm font-semibold text-primary hover:underline">Listen to the recording</Link>
        )}
        <Link to="/spaces" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Back to Spaces</Link>
      </div>
    );
  }

  const speakersList = participants
    .filter((p) => STAGE_ROLES.includes(p.role) && !p.left_at)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
  const listenersList = participants.filter((p) => p.role === 'listener' && !p.left_at);
  const handRaised = participants.filter((p) => p.hand_raised && !p.left_at && p.role === 'listener');
  const micOn = myPart ? myPart.muted === false : false;
  const tooManySpeakers = speakersList.length > MAX_SPEAKERS;

  return (
    <div className="flex min-h-[80vh] flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {listenersList.length + speakersList.length}</span>
            {recording && (
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                <Disc3 className="h-3 w-3 animate-spin" style={{ animationDuration: '2.5s' }} /> REC
              </span>
            )}
          </div>
          <button onClick={leave} className="rounded-full p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pb-3">
          <h1 className="text-lg font-extrabold">{space.title}</h1>
          {space.description && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{space.description}</p>}
          <p className="text-xs text-muted-foreground">Hosted by {space.host_name || 'Collector'}</p>
          {space.topic_tags?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">{space.topic_tags.map((t, i) => <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">#{t}</span>)}</div>
          )}
        </div>
      </div>

      <div className="flex-1 p-4">
        {tooManySpeakers && canManage && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {speakersList.length} speakers, the peer mesh works best with ≤{MAX_SPEAKERS}. Consider demoting some.
          </div>
        )}
        {/* Speakers */}
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Speakers ({speakersList.length})</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {speakersList.map((p) => {
            const isMe = p.id === myPartIdRef.current;
            const speakingNow = speaking[p.id];
            return (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <span className="relative inline-block">
                  <span className={`absolute -inset-1 rounded-full transition ${speakingNow ? 'bg-primary/40 animate-pulse' : 'bg-transparent'}`} />
                  <LiveAvatar did={p.did} name={p.participant_name} src={p.participant_avatar} size={56} className="relative" />
                  {p.role === 'host' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-primary p-0.5 text-white"><Crown className="h-3 w-3" /></span>}
                  {p.role === 'mod' && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-accent p-0.5 text-accent-foreground"><Shield className="h-3 w-3" /></span>}
                  {p.muted_by_host && <span className="absolute -right-0 top-0 rounded-full bg-destructive p-0.5 text-white"><MicOff className="h-2.5 w-2.5" /></span>}
                </span>
                <p className="max-w-[72px] truncate text-xs font-semibold">{p.participant_name || 'Collector'}{isMe ? ' (you)' : ''}</p>
                <p className="text-[10px] capitalize text-muted-foreground">{p.role}</p>
              </div>
            );
          })}
        </div>

        {/* Raised hands */}
        {handRaised.length > 0 && (
          <>
            <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-accent">Raised Hands ({handRaised.length})</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {handRaised.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <span className="relative inline-block">
                    <Hand className="absolute -right-1 -top-1 z-10 h-4 w-4 text-accent" />
                    <LiveAvatar did={p.did} name={p.participant_name} src={p.participant_avatar} size={48} />
                  </span>
                  <p className="max-w-[72px] truncate text-xs">{p.participant_name}</p>
                  {canManage && <button onClick={() => promote(p)} className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Promote</button>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Listeners */}
        <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Listeners ({listenersList.length})</p>
        <div className="flex flex-wrap gap-2">
          {listenersList.length === 0 ? (
            <p className="text-xs text-muted-foreground">No listeners yet.</p>
          ) : (
            listenersList.map((p) => <LiveAvatar key={p.id} did={p.did} name={p.participant_name} src={p.participant_avatar} size={32} />)
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-center gap-2 px-4 py-3">
          {onStage && (
            <button onClick={toggleMic} disabled={micError || myPart?.muted_by_host} className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${micOn ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} {micOn ? 'Mute' : 'Unmute'}
            </button>
          )}
          {myRole === 'listener' && (
            <button onClick={raiseHand} className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold ${myPart?.hand_raised ? 'bg-accent text-accent-foreground' : 'bg-secondary'}`}>
              <Hand className="h-4 w-4" /> {myPart?.hand_raised ? 'Lower Hand' : 'Raise Hand'}
            </button>
          )}
          {isHost && (
            <button onClick={toggleRecording} className={`flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold ${recording ? 'bg-destructive/10 text-destructive' : 'bg-secondary'}`}>
              <Disc3 className={`h-4 w-4 ${recording ? 'animate-spin' : ''}`} style={recording ? { animationDuration: '2.5s' } : undefined} /> {recording ? 'Stop' : 'Rec'}
            </button>
          )}
          {canManage && (
            <button onClick={() => setAdminOpen(true)} className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2.5 text-sm font-semibold">
              <Settings2 className="h-4 w-4" /> Manage
            </button>
          )}
          {isHost ? (
            <button onClick={endSpace} disabled={ending} className="flex items-center gap-1.5 rounded-full bg-destructive px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <LogOut className="h-4 w-4" /> {ending ? 'Ending…' : 'End'}
            </button>
          ) : (
            <button onClick={leave} className="flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-bold">
              <LogOut className="h-4 w-4" /> Leave
            </button>
          )}
        </div>
        {micError && onStage && <p className="pb-2 text-center text-xs text-muted-foreground">Mic access denied, others won't hear you.</p>}
        {myPart?.muted_by_host && onStage && <p className="pb-2 text-center text-xs text-muted-foreground">You were muted by the host.</p>}
      </div>

      <SpaceAdminPanel
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        participants={participants}
        myDid={myDid}
        onPromote={promote}
        onDemote={demote}
        onMakeMod={makeMod}
        onRevokeMod={revokeMod}
        onMute={muteByHost}
        onUnmute={unmuteByHost}
        onRemove={removePart}
      />
    </div>
  );
}