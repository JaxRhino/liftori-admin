import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useVideoCallContext } from '../contexts/VideoCallContext';

export default function IncomingCallModal() {
  const { incomingCall, joinCallWithStream, declineCall } =
    useVideoCallContext();

  const [previewStream, setPreviewStream] = useState(null);
  const [ringingIntervalId, setRingingIntervalId] = useState(null);
  const [joining, setJoining] = useState(false);
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

    // Initialize Web Audio API for ringing
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 440;
    gain.gain.value = 0;

    osc.start();
    oscillatorRef.current = osc;

    // Ring pattern
    let ringPhase = 0;
    const interval = setInterval(() => {
      const time = audioCtx.currentTime;
      if (ringPhase === 0) {
        gain.gain.setValueAtTime(0.3, time);
        ringPhase = 1;
      } else if (ringPhase === 1) {
        gain.gain.setValueAtTime(0, time);
        ringPhase = 2;
      } else if (ringPhase === 2) {
        gain.gain.setValueAtTime(0.3, time);
        ringPhase = 3;
      } else {
        gain.gain.setValueAtTime(0, time);
        ringPhase = 0;
      }
    }, 250);

    setRingingIntervalId(interval);

    return () => {
      cancelled = true;
      clearInterval(interval);
      try { osc.stop(); } catch (e) {}
      try { audioCtx.close(); } catch (e) {}
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
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-8 shadow-2xl">
        {/* Caller Avatar with Pulsing Ring */}
        <div className="mb-6 flex justify-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-full bg-green-500 opacity-0 animate-pulse" />
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-green-500 bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold">
              {incomingCall.caller_name?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
        </div>

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
