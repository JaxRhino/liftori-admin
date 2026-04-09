/**
 * Rally Guest Join — Public page for external guests to join a Rally video call.
 * URL: /rally/join/:code
 * No auth required — guest enters their name and joins.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import * as videoSvc from '../lib/videoService';
import { RallyIcon } from '../components/chat/RallyVideoCall';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, AlertCircle, Users, Monitor
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast, Toaster } from 'sonner';

// WebRTC config — STUN + TURN for NAT traversal
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ]
};

export default function RallyGuestJoin() {
  const { code } = useParams();
  const navigate = useNavigate();

  // Phases: loading, invalid, lobby, joining, in_call, ended
  const [phase, setPhase] = useState('loading');
  const [rallyLink, setRallyLink] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Media state
  const [localStream, setLocalStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const previewRef = useRef(null);
  const streamRef = useRef(null);

  // In-call state
  const [activeCall, setActiveCall] = useState(null);
  const activeCallRef = useRef(null); // Ref to avoid stale closures in callbacks
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});
  const peerConnections = useRef({});
  const guestIdRef = useRef(`guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const subscriptionsRef = useRef([]);

  // ─── Load rally link ───
  useEffect(() => {
    async function loadLink() {
      try {
        const link = await videoSvc.getRallyLinkByCode(code);
        if (!link) {
          setErrorMsg('This meeting link is invalid or has expired.');
          setPhase('invalid');
          return;
        }
        setRallyLink(link);
        setPhase('lobby');
      } catch (err) {
        console.error('Error loading rally link:', err);
        setErrorMsg('This meeting link is invalid or has expired.');
        setPhase('invalid');
      }
    }
    loadLink();
  }, [code]);

  // ─── Start camera preview in lobby ───
  useEffect(() => {
    if (phase !== 'lobby') return;

    let cancelled = false;

    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error('Media error:', err);
        // Camera denied — still let them join audio-only
        setVideoEnabled(false);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!cancelled) {
            streamRef.current = audioStream;
            setLocalStream(audioStream);
          }
        } catch {
          // No media at all
          toast.error('Could not access camera or microphone');
        }
      }
    }

    startPreview();

    return () => {
      cancelled = true;
      // Only stop tracks if we're NOT transitioning into the call
      // (joining/in_call need the stream alive for WebRTC)
    };
  }, [phase]);

  // Bind preview video
  useEffect(() => {
    if (previewRef.current && localStream) {
      previewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // ─── Toggle media ───
  const toggleVideo = () => {
    const track = localStream?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
    }
  };

  const toggleAudio = () => {
    const track = localStream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
    }
  };

  // ─── Join call ───
  const handleJoin = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setPhase('joining');

    try {
      // Mark the link as used
      await videoSvc.useRallyLink(rallyLink.id);

      // Find or create a call for this rally link
      let call;

      // Check for an active call on this link
      const { data: activeCalls } = await supabase
        .from('video_calls')
        .select('*')
        .eq('rally_link_id', rallyLink.id)
        .in('status', ['ringing', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (activeCalls && activeCalls.length > 0) {
        call = activeCalls[0];
        // Notify the host that a guest joined the existing call
        await supabase.from('notifications').insert({
          user_id: rallyLink.created_by,
          type: 'general',
          title: 'Incoming Rally Call',
          body: `${guestName.trim()} joined via "${rallyLink.label}"`,
          link: `/admin/chat?callId=${call.id}`,
        });
      } else {
        // Create a new call linked to this rally link
        const { data: newCall, error } = await supabase
          .from('video_calls')
          .insert({
            created_by: rallyLink.created_by,
            call_type: 'video',
            status: 'active',
            rally_link_id: rallyLink.id,
          })
          .select()
          .single();

        if (error) throw error;
        call = newCall;

        // Notify the host that a guest joined — include callId so incoming call modal triggers
        await supabase.from('notifications').insert({
          user_id: rallyLink.created_by,
          type: 'general',
          title: 'Incoming Rally Call',
          body: `${guestName.trim()} joined via "${rallyLink.label}"`,
          link: `/admin/chat?callId=${call.id}`,
        });
      }

      setActiveCall(call);
      activeCallRef.current = call; // Sync ref immediately for callbacks

      // Add ourselves as a guest participant (guest_id, not user_id — guests aren't in auth.users)
      const guestId = guestIdRef.current;
      await supabase.from('video_call_participants').insert({
        call_id: call.id,
        guest_id: guestId,
        display_name: guestName.trim(),
        is_audio_on: audioEnabled,
        is_video_on: videoEnabled,
        role: 'guest',
      });

      // Subscribe to signaling for this call
      subscribeToCall(call.id, guestId);

      setPhase('in_call');
      toast.success('You\'ve joined the call!');
    } catch (err) {
      console.error('Error joining call:', err);
      toast.error('Failed to join the call. Please try again.');
      setPhase('lobby');
    }
  };

  // ─── Supabase Realtime subscriptions ───
  const subscribeToCall = (callId, guestId) => {
    // 1. Listen for WebRTC signals addressed to us
    const signalChannel = supabase
      .channel(`guest-signals-${callId}-${guestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'video_signals',
        filter: `call_id=eq.${callId}`,
      }, (payload) => {
        const signal = payload.new;
        if (signal.to_user === guestId) {
          handleSignal(signal);
        }
      })
      .subscribe();

    // 2. Listen for participant changes
    const participantChannel = supabase
      .channel(`guest-participants-${callId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_call_participants',
        filter: `call_id=eq.${callId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Identify the participant — use guest_id if present, otherwise user_id
          const p = payload.new;
          const peerId = p.guest_id || p.user_id;
          if (peerId === guestId) return; // Skip our own insert

          // New participant joined — add them to the list
          // DON'T initiate WebRTC here — the auth user (VideoCallContext) will
          // send us an offer. This prevents double-offer glare.
          setParticipants(prev => {
            if (prev.find(x => x.peerId === peerId)) return prev;
            return [...prev, { peerId, user_name: p.display_name, status: 'connected', role: p.role }];
          });
        } else if (payload.eventType === 'DELETE') {
          const peerId = payload.old.guest_id || payload.old.user_id;
          setParticipants(prev => prev.filter(x => x.peerId !== peerId));
          if (peerConnections.current[peerId]) {
            peerConnections.current[peerId].close();
            delete peerConnections.current[peerId];
          }
          setRemoteStreams(prev => {
            const copy = { ...prev };
            delete copy[peerId];
            return copy;
          });
        }
      })
      .subscribe();

    // 3. Listen for call status changes (ended)
    const callChannel = supabase
      .channel(`guest-call-${callId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'video_calls',
        filter: `id=eq.${callId}`,
      }, (payload) => {
        if (payload.new.status === 'ended') {
          toast.info('The host has ended the call');
          handleLeave();
        }
      })
      .subscribe();

    subscriptionsRef.current = [signalChannel, participantChannel, callChannel];
  };

  // ─── WebRTC ───
  const createPeerConnection = (remoteUserId) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({ ...prev, [remoteUserId]: event.streams[0] }));
    };

    // Handle ICE candidates — use ref to avoid stale closure
    pc.onicecandidate = async (event) => {
      const call = activeCallRef.current;
      if (event.candidate && call) {
        await supabase.from('video_signals').insert({
          call_id: call.id,
          from_user: guestIdRef.current,
          to_user: remoteUserId,
          signal_type: 'ice-candidate',
          payload: { candidate: event.candidate },
        });
      }
    };

    peerConnections.current[remoteUserId] = pc;
    return pc;
  };

  const initiateConnection = async (callId, fromUserId, toUserId) => {
    const pc = createPeerConnection(toUserId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await supabase.from('video_signals').insert({
        call_id: callId,
        from_user: fromUserId,
        to_user: toUserId,
        signal_type: 'offer',
        payload: { sdp: pc.localDescription },
      });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };

  const handleSignal = async (signal) => {
    const { from_user, signal_type, payload } = signal;

    if (signal_type === 'offer') {
      const pc = createPeerConnection(from_user);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await supabase.from('video_signals').insert({
        call_id: activeCallRef.current?.id || signal.call_id,
        from_user: guestIdRef.current,
        to_user: from_user,
        signal_type: 'answer',
        payload: { sdp: pc.localDescription },
      });
    } else if (signal_type === 'answer') {
      const pc = peerConnections.current[from_user];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
    } else if (signal_type === 'ice-candidate') {
      const pc = peerConnections.current[from_user];
      if (pc && payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    }
  };

  // ─── Leave call ───
  const handleLeave = useCallback(() => {
    // Stop media
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    // Close peer connections
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};

    // Unsubscribe
    subscriptionsRef.current.forEach(ch => supabase.removeChannel(ch));
    subscriptionsRef.current = [];

    // Remove ourselves from participants (use guest_id, not user_id)
    const call = activeCallRef.current;
    if (call) {
      supabase
        .from('video_call_participants')
        .delete()
        .eq('call_id', call.id)
        .eq('guest_id', guestIdRef.current)
        .then(() => {});
    }

    setLocalStream(null);
    setRemoteStreams({});
    setParticipants([]);
    setActiveCall(null);
    activeCallRef.current = null;
    setPhase('ended');
  }, [activeCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      subscriptionsRef.current.forEach(ch => supabase.removeChannel(ch));
      Object.values(peerConnections.current).forEach(pc => pc.close());
    };
  }, []);

  // ─── RENDER: Loading ───
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading meeting...</p>
        </div>
      </div>
    );
  }

  // ─── RENDER: Invalid link ───
  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-slate-400 mb-6">{errorMsg}</p>
          <p className="text-slate-500 text-sm">
            Contact the meeting organizer for a new link.
          </p>
        </div>
      </div>
    );
  }

  // ─── RENDER: Call ended ───
  if (phase === 'ended') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
            <PhoneOff className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Call Ended</h1>
          <p className="text-slate-400 mb-6">Thanks for joining the Rally!</p>
          <Button
            variant="outline"
            onClick={() => setPhase('lobby')}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Rejoin
          </Button>
        </div>
      </div>
    );
  }

  // ─── RENDER: Lobby ───
  if (phase === 'lobby' || phase === 'joining') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Toaster position="top-right" richColors theme="dark" />
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4">
              <RallyIcon className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {rallyLink?.label || 'Rally Meeting'}
            </h1>
            <p className="text-slate-400 text-sm">You've been invited to join a video call</p>
          </div>

          {/* Video preview */}
          <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video mb-6">
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)', display: videoEnabled && localStream ? 'block' : 'none' }}
            />
            {(!videoEnabled || !localStream) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="text-3xl bg-slate-700 text-white">
                    {guestName ? guestName.charAt(0).toUpperCase() : '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}

            {/* Media toggle controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
              <Button
                variant={audioEnabled ? 'secondary' : 'destructive'}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={toggleAudio}
              >
                {audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                variant={videoEnabled ? 'secondary' : 'destructive'}
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={toggleVideo}
              >
                {videoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Name input + join button */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Your name</label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoFocus
                disabled={phase === 'joining'}
              />
            </div>
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white h-12 text-base font-semibold"
              onClick={handleJoin}
              disabled={phase === 'joining' || !guestName.trim()}
            >
              {phase === 'joining' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Joining...
                </>
              ) : (
                <>
                  <Video className="h-5 w-5 mr-2" />
                  Join Rally
                </>
              )}
            </Button>
          </div>

          {/* Branding */}
          <p className="text-center text-slate-600 text-xs mt-6">
            Powered by Rally — Liftori Video Calls
          </p>
        </div>
      </div>
    );
  }

  // ─── RENDER: In call ───
  if (phase === 'in_call') {
    const allParticipants = [
      { peerId: guestIdRef.current, user_name: guestName, status: 'connected' },
      ...participants,
    ];
    const remoteParticipants = participants.filter(p => p.peerId !== guestIdRef.current);
    const gridCols =
      allParticipants.length <= 1 ? 'grid-cols-1' :
      allParticipants.length <= 2 ? 'grid-cols-2' :
      allParticipants.length <= 4 ? 'grid-cols-2' :
      'grid-cols-3';

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Toaster position="top-right" richColors theme="dark" />

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <RallyIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">{rallyLink?.label || 'Rally Call'}</h1>
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <Users className="h-3 w-3" />
                {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-medium">Connected</span>
          </div>
        </div>

        {/* Video grid */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className={`grid gap-3 h-full ${gridCols}`}>
            {/* Self */}
            <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
              <video
                autoPlay
                playsInline
                muted
                ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)', display: videoEnabled && localStream ? 'block' : 'none' }}
              />
              {(!videoEnabled || !localStream) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-xl bg-slate-700 text-white">
                      {guestName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
                {!audioEnabled && <MicOff className="h-3 w-3 text-red-400" />}
                <span className="text-white text-xs">{guestName} (You)</span>
              </div>
            </div>

            {/* Remote participants */}
            {remoteParticipants.map(p => {
              const stream = remoteStreams[p.peerId];
              return (
                <div key={p.peerId} className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
                  {stream ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => { if (el) el.srcObject = stream; }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-xl bg-slate-700 text-white">
                          {(p.user_name || '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/60 rounded-full px-2 py-1">
                    <span className="text-white text-xs">{p.user_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-4">
          <Button
            variant={audioEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="h-12 w-12 rounded-full"
            onClick={toggleAudio}
          >
            {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          <Button
            variant={videoEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="h-12 w-12 rounded-full"
            onClick={toggleVideo}
          >
            {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <div className="w-px h-10 bg-slate-700" />
          <Button
            variant="destructive"
            size="lg"
            className="h-12 px-6 rounded-full"
            onClick={handleLeave}
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            Leave
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
