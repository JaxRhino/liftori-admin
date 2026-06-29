/**
 * EventRsvp — public Accept/Decline page for a calendar-event invitation.
 * URL: /rsvp/:token  (no auth). Reads/writes via SECURITY DEFINER RPCs
 * (get_rsvp_info / event_rsvp) so external guests can respond.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, Calendar as CalIcon, Check, X, Video } from 'lucide-react';

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function fmtDate(d) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function EventRsvp() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState('loading'); // loading | invalid | ready
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadInfo() {
    const { data, error } = await supabase.rpc('get_rsvp_info', { p_token: token });
    if (error || !data) { setPhase('invalid'); return; }
    setInfo(data); setPhase('ready');
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = params.get('r');
      if (r === 'accepted' || r === 'declined') {
        try { await supabase.rpc('event_rsvp', { p_token: token, p_status: r }); } catch (e) { /* ignore */ }
      }
      if (!cancelled) await loadInfo();
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function respond(status) {
    setBusy(true);
    try { await supabase.rpc('event_rsvp', { p_token: token, p_status: status }); await loadInfo(); }
    catch (e) { /* ignore */ } finally { setBusy(false); }
  }

  if (phase === 'loading') {
    return <Shell><Loader2 className="h-10 w-10 animate-spin text-sky-400" /></Shell>;
  }
  if (phase === 'invalid') {
    return (
      <Shell>
        <div className="text-center max-w-md px-6">
          <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Not Found</h1>
          <p className="text-slate-400">This invite link is invalid or has expired.</p>
        </div>
      </Shell>
    );
  }

  const when = info.all_day
    ? fmtDate(info.start_date)
    : `${fmtDate(info.start_date)} · ${fmtTime(info.start_time)}${info.end_time ? ' - ' + fmtTime(info.end_time) : ''}`;
  const status = info.rsvp_status;

  return (
    <Shell>
      <div className="w-full max-w-md px-6">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center mx-auto mb-6">
          <CalIcon className="h-7 w-7 text-white" />
        </div>
        <p className="text-slate-400 text-sm text-center mb-1">
          {info.attendee_name ? `Hi ${info.attendee_name}, you're invited to` : "You're invited to"}
        </p>
        <h1 className="text-2xl font-bold text-white text-center mb-4">{info.event_title}</h1>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center mb-6">
          <p className="text-sky-300 text-sm">{when}</p>
          {info.description && <p className="text-slate-400 text-xs mt-2">{info.description}</p>}
        </div>

        {status === 'accepted' ? (
          <div className="text-center">
            <p className="text-emerald-400 font-medium mb-3 flex items-center justify-center gap-1.5"><Check className="h-4 w-4" /> You're going</p>
            {info.meeting_url && (
              <a href={info.meeting_url} className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white px-5 h-11 rounded-xl text-sm font-semibold">
                <Video className="h-4 w-4" /> Join video call
              </a>
            )}
            <button onClick={() => respond('declined')} disabled={busy} className="block mx-auto mt-4 text-slate-500 hover:text-slate-300 text-xs">Can't make it anymore? Decline</button>
          </div>
        ) : status === 'declined' ? (
          <div className="text-center">
            <p className="text-slate-400 font-medium mb-3 flex items-center justify-center gap-1.5"><X className="h-4 w-4" /> You declined</p>
            <button onClick={() => respond('accepted')} disabled={busy} className="text-sky-400 hover:text-sky-300 text-sm">Changed your mind? Accept</button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => respond('accepted')} disabled={busy} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"><Check className="h-4 w-4" /> Accept</button>
            <button onClick={() => respond('declined')} disabled={busy} className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"><X className="h-4 w-4" /> Decline</button>
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-8">Powered by Liftori</p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">{children}</div>;
}
