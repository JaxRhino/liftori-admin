/**
 * Rally Guest Join — public page for external guests to join a Rally video call.
 * URL: /rally/join/:code  (no auth required)
 *
 * Powered by a managed Daily.co room behind Liftori/Rally branding. The rally-room
 * edge function validates the invite code and returns a shared room URL, so the host
 * and every guest who opens the same link land in the same room. Daily's own prejoin
 * handles camera/mic permission with a real user gesture — reliable on mobile.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RallyIcon } from '../components/chat/RallyVideoCall';
import { Loader2, AlertCircle, Video, ShieldCheck } from 'lucide-react';

export default function RallyGuestJoin() {
  const { code } = useParams();

  // Phases: loading, invalid, ready, in_room
  const [phase, setPhase] = useState('loading');
  const [roomUrl, setRoomUrl] = useState('');
  const [label, setLabel] = useState('Rally Meeting');
  const [errorMsg, setErrorMsg] = useState('');
  const [joining, setJoining] = useState(false);
  const iframeRef = useRef(null);

  // Resolve the invite code -> managed room URL via the edge function.
  useEffect(() => {
    let cancelled = false;
    async function resolveRoom() {
      try {
        const { data, error } = await supabase.functions.invoke('rally-room', {
          body: { code },
        });
        if (cancelled) return;
        if (error || !data?.url) {
          setErrorMsg(data?.error || 'This meeting link is invalid or has expired.');
          setPhase('invalid');
          return;
        }
        setRoomUrl(data.url);
        if (data.label) setLabel(data.label);
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[RallyGuestJoin] resolveRoom', err);
        setErrorMsg('This meeting link is invalid or has expired.');
        setPhase('invalid');
      }
    }
    resolveRoom();
    return () => { cancelled = true; };
  }, [code]);

  function enterRoom() {
    setJoining(true);
    setPhase('in_room');
  }

  // ─── Loading ───
  if (phase === 'loading') {
    return (
      <Shell>
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading your meeting…</p>
        </div>
      </Shell>
    );
  }

  // ─── Invalid ───
  if (phase === 'invalid') {
    return (
      <Shell>
        <div className="text-center max-w-md px-6">
          <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Link Not Found</h1>
          <p className="text-slate-400 mb-6">{errorMsg}</p>
          <p className="text-slate-500 text-sm">Contact the meeting organizer for a new link.</p>
        </div>
      </Shell>
    );
  }

  // ─── In room (Daily embed) ───
  if (phase === 'in_room') {
    return (
      <div className="min-h-screen h-screen bg-slate-950 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center">
              <RallyIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">{label}</span>
          </div>
          <span className="text-slate-500 text-xs">Liftori Rally</span>
        </div>
        <iframe
          ref={iframeRef}
          title="Rally Video"
          src={roomUrl}
          className="flex-1 w-full border-0"
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write"
          allowFullScreen
        />
      </div>
    );
  }

  // ─── Ready (branded landing -> tap to enter Daily prejoin) ───
  return (
    <Shell>
      <div className="w-full max-w-md text-center px-6">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center mx-auto mb-6">
          <RallyIcon className="h-9 w-9 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{label}</h1>
        <p className="text-slate-400 text-sm mb-8">You've been invited to a video call</p>

        <button
          onClick={enterRoom}
          disabled={joining}
          className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white h-12 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60"
        >
          <Video className="h-5 w-5" />
          Join the meeting
        </button>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-slate-500 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          No download or sign-up — works right in your browser
        </div>
        <p className="mt-8 text-slate-600 text-xs">Powered by Liftori Rally</p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
