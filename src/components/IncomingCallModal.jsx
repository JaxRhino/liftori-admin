import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useVideoCallContext } from '../contexts/VideoCallContext';

export default function IncomingCallModal() {
  const { incomingCall, joinCallWithStream, declineCall, getMedia } =
    useVideoCallContext();

  const [cameraStream, setCameraStream] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [ringingIntervalId, setRingingIntervalId] = useState(null);
  const videoPreviewRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);

  // Initialize camera and ringing sound when modal appears
  useEffect(() => {
    if (!incomingCall) return;

    // Start camera preview
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setCameraStream(stream);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to access camera:', err);
      }
    };

    startCamera();

    // Initialize Web Audio API for ringing
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(audioCtx);

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 440; // A4 note
    gain.gain.value = 0; // Start silent

    osc.start();
    oscillatorRef.current = osc;
    gainRef.current = gain;

    // Ring pattern: 0.5s on, 0.2s off, 0.5s on, 1.8s off (2.5s total, repeats)
    let ringPhase = 0;
    const startRinging = () => {
      const interval = setInterval(() => {
        const time = audioCtx.currentTime;

        if (ringPhase === 0) {
          // 0-0.5s: tone on
          gain.gain.setValueAtTime(0.3, time);
          ringPhase = 1;
        } else if (ringPhase === 1) {
          // 0.5-0.7s: silence
          gain.gain.setValueAtTime(0, time);
          ringPhase = 2;
        } else if (ringPhase === 2) {
          // 0.7-1.2s: tone on
          gain.gain.setValueAtTime(0.3, time);
          ringPhase = 3;
        } else {
          // 1.2-2.5s: silence
          gain.gain.setValueAtTime(0, time);
          ringPhase = 0;
        }
      }, 250); // Phase changes every 250ms

      return interval;
    };

    const intervalId = startRinging();
    setRingingIntervalId(intervalId);

    // Cleanup on unmount or when call ends
    return () => {
      if (intervalId) clearInterval(intervalId);
      try { if (osc) osc.stop(); } catch(e) {}
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [incomingCall]);

  // Handle accept
  const handleAccept = async () => {
    try {
      // Stop ringing and camera preview
      if (ringingIntervalId) clearInterval(ringingIntervalId);
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (oscillatorRef.current) oscillatorRef.current.stop();

      // Get full media stream with audio
      const stream = await getMedia(true, true);
      await joinCallWithStream(incomingCall.session_id, stream);
    } catch (err) {
      console.error('Failed to join call:', err);
    }
  };

  // Handle decline
  const handleDecline = () => {
    // Stop ringing and camera preview
    if (ringingIntervalId) clearInterval(ringingIntervalId);
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    if (oscillatorRef.current) oscillatorRef.current.stop();

    declineCall();
  };

  // Auto-dismiss if incomingCall becomes null
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-8 shadow-2xl">
        {/* Caller Avatar with Pulsing Ring */}
        <div className="mb-6 flex justify-center">
          <div className="relative inline-block">
            {/* Pulsing ring animation */}
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
          {/* Decline Button */}
          <button
            onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 transition-colors"
          >
            <PhoneOff size={20} />
            Decline
          </button>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 transition-colors"
          >
            <Phone size={20} />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
