/**
 * Rally Guest Join — public page for external guests to join a Rally video call.
 * URL: /rally/join/:code  (no auth required)
 *
 * Powered by a managed Daily.co room behind Liftori/Rally branding. The rally-room
 * edge function validates the invite code and returns a shared room URL (host + every
 * guest who open the same link land in the same room).
 *
 * We navigate the browser DIRECTLY into the Daily room (top-level) rather than embedding
 * it in an iframe. On mobile — especially iOS — an iframed call often can't surface the
 * camera/mic permission prompt, and in-app browsers block it entirely. Running Daily as
 * the top-level page lets it request permissions natively and, in a locked-down in-app
 * browser, prompt the user to open in Safari/Chrome.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RallyIcon } from '../components/chat/RallyVideoCall';
import { Loader2, AlertCircle, Video, ShieldCheck } from 'lucide-react';

export default function RallyGuestJoin() {
  const { code } = useParams();

  const [phase, setPhase] = useState('loading'); // loading | invalid | ready
  const [roomUrl, setRoomUrl] = useState('');
  const [label, setLabel] = useState('Rally Meeting');
  const [errorMsg, setErrorMsg] = useState('');
  const [entering, setEntering] = useState(false);

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
    if (!roomUrl) return;
    setEntering(true);
    window.location.href = roomUrl;
  }

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
          disabled={entering}
          className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white h-12 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60"
        >
          {entering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
          {entering ? 'Opening…' : 'Join the meeting'}
        </button>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-slate-500 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          No download or sign-up — allow camera &amp; mic when asked
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
