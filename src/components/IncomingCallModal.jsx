import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useVideoCallContext } from '../contexts/VideoCallContext';

export default function IncomingCallModal() {
  const { incomingCall, joinCallWithStream, declineCall } =
    useVideoCallContext();

  const [previewStream, setPreviewStream] = useState(null);
  const [ringingIntervalId, setRingingIntervalId] = useState(null);
  const [joining, setJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('liftori_ring_muted') === '1';
  });

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    try { localStorage.setItem('liftori_ring_muted', next ? '1' : '0'); } catch {}
    // If muting mid-ring, stop it now
    if (next) {
      if (ringingIntervalId) clearInterval(ringingIntervalId);
      try { if (oscillatorRef.current) oscillatorRef.current.stop(); } catch (e) {}
    }
  };
  const videoPreviewRef = useRef(null);
  const oscillatorRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize camera+mic and ringing sound when modal appears
  useEffect(() => {
    if (!incomingCall) return;
    let cancelled = false;

    // Start camera AND mic upfront so we can hand off the stream directly
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        setPreviewStream(stream);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to access camera/mic:', err);
      }
    };

    startMedia();

    // Respect mute setting — skip ring tone entirely if muted.
    const muted = (typeof localStorage !== 'undefined') && localStorage.getItem('liftori_ring_muted') === '1';
    let interval = null;
    let audioCtx = null;
    if (!muted) {
    // Initialize Web Audio API for triple-whistle ring tone.
    // Pattern: three quick upward glides ("fweet fweet fweet"), then 2s pause, repeat.
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Chrome/Safari may suspend the context until a user gesture — resume it.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0;
    osc.frequency.value = 660;
    osc.start();
    oscillatorRef.current = osc;

    // Schedule one whistle burst starting at time `t`.
    // Upward glide 660 -> 1320 Hz over 180ms, gain envelope 0 -> 0.25 -> 0.
    const scheduleWhistle = (t) => {
      const dur = 0.18;
      osc.frequency.cancelScheduledValues(t);
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(1320, t + dur);
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      gain.gain.setValueAtTime(0, t + dur + 0.001);
    };

    // Play the triple-whistle pattern every 2.5s until the modal unmounts.
    const playTriple = () => {
      const t0 = audioCtx.currentTime + 0.02;
      scheduleWhistle(t0);                // whistle 1
      scheduleWhistle(t0 + 0.28);         // whistle 2
      scheduleWhistle(t0 + 0.56);         // whistle 3
    };
    playTriple();
    interval = setInterval(playTriple, 2500);
    } // end if(!muted)

    setRingingIntervalId(interval);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      try { if (oscillatorRef.current) oscillatorRef.current.stop(); } catch (e) {}
      try { if (audioCtx) audioCtx.close(); } catch (e) {}
      // Only stop stream if we didn't hand it off to the call
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [incomingCall]);

  // Handle accept — hand off existing stream, don't re-request camera
  const handleAccept = async () => {
    if (joining) return;
    setJoining(true);

    try {
      // Stop ringing
      if (ringingIntervalId) clearInterval(ringingIntervalId);
      try { if (oscillatorRef.current) oscillatorRef.current.stop(); } catch (e) {}

      // Hand off stream — null out ref so cleanup doesn't kill it
      const stream = streamRef.current;
      streamRef.current = null;

      if (!stream) {
        // Fallback: try getting a new stream if preview failed
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        await joinCallWithStream(incomingCall.session_id, fallbackStream);
      } else {
        await joinCallWithStream(incomingCall.session_id, stream);
      }
    } catch (err) {
      console.error('Failed to join call:', err);
      // Restore stream ref so cleanup can stop tracks
      if (streamRef.current === null && previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }
      setJoining(false);
    }
  };

  // Handle decline
  const handleDecline = () => {
    if (ringingIntervalId) clearInterval(ringingIntervalId);
    try { if (oscillatorRef.current) oscillatorRef.current.stop(); } catch (e) {}
    declineCall();
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 p-8 shadow-2xl">
        {/* Caller Avatar with Pulsing Ring */}
        <div className="mb-6 flex justify-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full bg-green-500 opacity-0 animate-pulse" />
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-green-500 bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold">
              {incomingCall.caller_name?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
        </div>

        {/* Mute toggle — top-right corner */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? 'Unmute ring' : 'Mute ring'}
          aria-label={isMuted ? 'Unmute ring' : 'Mute ring'}
          className="absolute top-3 right-3 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Caller Info */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-white">
            {incomingCall.caller_name || 'Unknown'}
          </h2>
          {incomingCall.caller_title && (
            <p className="text-sm text-slate-300 font-medium">{incomingCall.caller_title}</p>
          )}
          <p className="mt-1 text-sm text-slate-400">Incoming Video Call</p>
        </div>

        {/* Camera Preview */}
        <div className="mb-6 overflow-hidden rounded-lg bg-black">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            className="h-48 w-full object-cover"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={joining}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 transition-colors disabled:opacity-50"
          >
            <PhoneOff size={20} />
            Decline
          </button>

          <button
            onClick={handleAccept}
            disabled={joining}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 transition-colors disabled:opacity-50"
          >
            <Phone size={20} />
            {joining ? 'Joining...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
