// WebRTC peer-mesh manager for in-platform voice spaces.
//
// Each on-stage speaker publishes an audio track; every other participant
// (listeners + other speakers) establishes an RTCPeerConnection directly to
// each speaker (mesh, no SFU). Signaling rides over the SpaceSignal entity:
// offers/answers/ICE candidates are written as records and consumed via the
// realtime subscription in realtime.js (space.signal event). ICE uses Google
// public STUN; there is no TURN, so symmetric-NAT peers may fail to connect
// (a known limitation surfaced to the host in the UI).
//
// Cap: the stage supports ~6 concurrent speakers. Beyond that the host sees a
// warning; extra promotions are still attempted but mesh cost grows O(n^2).

import { base44 } from '@/api/base44Client';

const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const MAX_SPEAKERS = 6;

function pcConfig() {
  return { iceServers: STUN_SERVERS, iceTransportPolicy: 'all' };
}

export class SpaceMesh {
  constructor({ spaceId, myDid, myParticipantId, onRemoteTrack, onPeerLeft, onIceFail }) {
    this.spaceId = spaceId;
    this.myDid = myDid;
    this.myParticipantId = myParticipantId;
    this.onRemoteTrack = onRemoteTrack || (() => {});
    this.onPeerLeft = onPeerLeft || (() => {});
    this.onIceFail = onIceFail || (() => {});

    this.localStream = null;           // my published mic stream (stage members)
    this.pcs = new Map();              // remoteDid -> RTCPeerConnection
    this.remoteStreams = new Map();    // remoteDid -> MediaStream
    this.analysers = new Map();        // remoteDid -> AnalyserNode
    this.audioCtx = null;
    this.mixDest = null;               // MediaStreamAudioDestinationNode for recording
    this.published = false;
    this.role = 'listener';           // current role (drives sendonly vs recvonly)
  }

  // Lazily create the shared AudioContext + mix destination used for both
  // analyser-based speaking indicators and the recording mix.
  _ensureAudio() {
    if (this.audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new Ctx();
    this.mixDest = this.audioCtx.createMediaStreamDestination();
  }

  // Start publishing my mic to the mesh (called when I become a stage member).
  async startPublishing() {
    if (this.published) return;
    this._ensureAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.localStream = stream;
      // Route my own mic into the mix destination so the recording includes me.
      const src = this.audioCtx.createMediaStreamSource(stream);
      src.connect(this.mixDest);
      // Local analyser for the host's/speaker's own speaking ring.
      this.localAnalyser = this.audioCtx.createAnalyser();
      this.localAnalyser.fftSize = 256;
      src.connect(this.localAnalyser);
      this.published = true;
      // Renegotiate all existing connections so they receive my new track.
      for (const [remoteDid, pc] of this.pcs.entries()) {
        this._addTrackAndRenegotiate(pc, remoteDid);
      }
    } catch (err) {
      console.error('spaceMesh: mic access failed', err);
      throw err;
    }
  }

  // Stop publishing my mic (mute / demote / leave).
  stopPublishing() {
    if (!this.published) return;
    this.localStream?.getTracks?.().forEach((t) => t.stop());
    this.localStream = null;
    this.published = false;
  }

  // Create (or reuse) a peer connection to a remote participant and send an
  // offer. Called when a new stage speaker appears (I initiate to them).
  async connectToSpeaker(remoteDid, remoteRole) {
    if (remoteDid === this.myDid) return;
    if (this.pcs.has(remoteDid)) {
      // Already connected; if I just started publishing, renegotiate.
      if (this.published) this._addTrackAndRenegotiate(this.pcs.get(remoteDid), remoteDid);
      return;
    }
    const pc = new RTCPeerConnection(pcConfig());
    this.pcs.set(remoteDid, pc);

    // Direction: I send my audio only if I'm a stage member; I always receive.
    const direction = this.published ? 'sendrecv' : 'recvonly';
    pc.addTransceiver('audio', { direction });

    pc.ontrack = (e) => this._handleRemoteTrack(remoteDid, e);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendSignal(remoteDid, 'candidate', JSON.stringify(e.candidate.toJSON()));
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.onIceFail?.(remoteDid);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._sendSignal(remoteDid, 'offer', JSON.stringify(offer));
  }

  // Add my local track to an existing PC and renegotiate (when I start
  // publishing after the PC was already created recvonly).
  async _addTrackAndRenegotiate(pc, remoteDid) {
    if (!this.localStream) return;
    const senders = pc.getSenders();
    if (senders.length === 0) {
      this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
    } else {
      // Replace the null track sender with the real track.
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) await senders[0].replaceTrack(audioTrack);
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._sendSignal(remoteDid, 'offer', JSON.stringify(offer));
  }

  // Route an incoming remote audio track: attach to an <audio> element for
  // playback, wire an AnalyserNode for speaking indicators, and feed the mix
  // destination so the recording captures every speaker.
  _handleRemoteTrack(remoteDid, e) {
    this._ensureAudio();
    const stream = e.streams[0];
    this.remoteStreams.set(remoteDid, stream);

    // Playback element (muted is fine; the browser plays remote audio).
    let el = this._audioEls?.get(remoteDid);
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      this._audioEls = this._audioEls || new Map();
      this._audioEls.set(remoteDid, el);
    }
    el.srcObject = stream;
    el.play().catch(() => {});

    // Analyser for speaking ring + mix tap for recording.
    const src = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    src.connect(this.mixDest);
    this.analysers.set(remoteDid, analyser);
    this.onRemoteTrack(remoteDid, stream);
  }

  // Handle an incoming signaling message from SpaceSignal realtime events.
  async handleSignal({ from_did, signal_type, payload }) {
    if (!from_did || from_did === this.myDid) return;
    let pc = this.pcs.get(from_did);
    const data = (() => { try { return JSON.parse(payload); } catch { return null; } })();
    if (!data && signal_type !== 'leave') return;

    if (signal_type === 'leave') {
      this._closePeer(from_did);
      this.onPeerLeft(from_did);
      return;
    }

    if (signal_type === 'offer') {
      if (!pc) {
        pc = new RTCPeerConnection(pcConfig());
        this.pcs.set(from_did, pc);
        pc.ontrack = (e) => this._handleRemoteTrack(from_did, e);
        pc.onicecandidate = (e) => {
          if (e.candidate) this._sendSignal(from_did, 'candidate', JSON.stringify(e.candidate.toJSON()));
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            this.onIceFail?.(from_did);
          }
        };
        // If I'm publishing, add my track before answering.
        if (this.published && this.localStream) {
          this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
        } else {
          pc.addTransceiver('audio', { direction: 'recvonly' });
        }
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this._sendSignal(from_did, 'answer', JSON.stringify(answer));
      return;
    }

    if (signal_type === 'answer') {
      if (!pc) return;
      try { await pc.setRemoteDescription(new RTCSessionDescription(data)); } catch (e) { /* stale */ }
      return;
    }

    if (signal_type === 'candidate') {
      if (!pc) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(data)); } catch (e) { /* stale */ }
      return;
    }
  }

  // Persist a signaling message as a SpaceSignal record (consumed by the
  // target via realtime subscription).
  async _sendSignal(toDid, type, payload) {
    try {
      await base44.entities.SpaceSignal.create({
        space_id: this.spaceId,
        from_participant_id: this.myParticipantId,
        from_did: this.myDid,
        to_did: toDid || '',
        signal_type: type,
        payload,
      });
    } catch (err) {
      console.error('spaceMesh: signal send failed', err);
    }
  }

  // Broadcast a leave signal so peers close the connection promptly.
  async sendLeave() {
    // Send a broadcast leave (to_did empty) — peers filter by space_id.
    try {
      await base44.entities.SpaceSignal.create({
        space_id: this.spaceId,
        from_participant_id: this.myParticipantId,
        from_did: this.myDid,
        to_did: '',
        signal_type: 'leave',
        payload: '',
      });
    } catch { /* non-fatal */ }
  }

  // The mixed audio stream (all remote speakers + my own mic) for recording.
  getRecordingStream() {
    this._ensureAudio();
    return this.mixDest?.stream || null;
  }

  // Per-remote speaking level (0..1) for the speaking-ring UI.
  speakingLevel(remoteDid) {
    const analyser = this.analysers.get(remoteDid);
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return Math.min(1, sum / data.length / 60);
  }

  // Speaking level for my own mic (0..1).
  localLevel() {
    if (!this.published || !this.localAnalyser) return 0;
    const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
    this.localAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return Math.min(1, sum / data.length / 60);
  }

  getLocalStream() { return this.localStream; }

  _closePeer(remoteDid) {
    const pc = this.pcs.get(remoteDid);
    if (pc) { try { pc.close(); } catch {} this.pcs.delete(remoteDid); }
    const el = this._audioEls?.get(remoteDid);
    if (el) { el.srcObject = null; this._audioEls.delete(remoteDid); }
    this.remoteStreams.delete(remoteDid);
    this.analysers.delete(remoteDid);
  }

  destroy() {
    this.sendLeave().catch(() => {});
    this.stopPublishing();
    this.pcs.forEach((_, did) => this._closePeer(did));
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
  }
}

export { MAX_SPEAKERS };