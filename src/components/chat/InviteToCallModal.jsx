/**
 * InviteToCallModal — invite people to an in-progress or scheduled call.
 *
 * Three invite paths:
 *   1. Team members (admin/dev profiles) — pick from list, sends in-app notif + joins via Rally link
 *   2. External guest via Rally link — generate, copy to clipboard, optional email
 *   3. Future: schedule for later — opens ScheduleCallModal (not yet wired)
 *
 * Uses videoCallHelpers for Rally link + email reminder.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useVideoCallContext } from '../../contexts/VideoCallContext';
import { createOutboundRallyLink, sendCallReminderEmail } from '../../lib/videoCallHelpers';
import {
  X, Copy, Mail, Users, Link2, Check, Loader2, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

export default function InviteToCallModal({ open, onClose, callId, channelId }) {
  const { user } = useAuth();
  const { participants } = useVideoCallContext();
  const [mode, setMode] = useState('team'); // 'team' | 'link' | 'email'
  const [team, setTeam] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [rallyLink, setRallyLink] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [sending, setSending] = useState(false);

  const activeIds = new Set((participants || []).map(p => p.user_id));

  useEffect(() => {
    if (!open) return;
    loadTeam();
    // Pre-generate a Rally link so the "Link" tab is instant
    generateRallyLink();
  }, [open]);

  async function loadTeam() {
    setLoadingTeam(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .in('role', ['admin', 'dev'])
        .order('full_name', { ascending: true });
      if (error) throw error;
      // Hide current user + anyone already on the call
      const filtered = (data || []).filter(
        p => p.id !== user?.id && !activeIds.has(p.id)
      );
      setTeam(filtered);
    } catch (err) {
      console.error('[InviteToCallModal] loadTeam', err);
      toast.error('Could not load team list');
    } finally {
      setLoadingTeam(false);
    }
  }

  async function generateRallyLink() {
    if (!user) return;
    setLinkLoading(true);
    try {
      const url = await createOutboundRallyLink(user.id, `Join ${user.email}'s call`);
      setRallyLink(url);
    } catch (err) {
      console.error('[InviteToCallModal] rally link', err);
    } finally {
      setLinkLoading(false);
    }
  }

  async function inviteTeamMember(memberId) {
    try {
      // Record invite — also surfaces as a notification for the invitee
      const { error } = await supabase.from('video_call_invites').insert({
        call_id: callId,
        inviter_id: user.id,
        invitee_id: memberId,
        channel_id: channelId || null,
      });
      if (error && error.code !== '42P01') throw error; // tolerate missing table
      toast.success('Invite sent');
      // Optimistically remove from list
      setTeam(prev => prev.filter(p => p.id !== memberId));
    } catch (err) {
      console.error('[InviteToCallModal] inviteTeamMember', err);
      toast.error('Could not send invite');
    }
  }

  async function copyLink() {
    if (!rallyLink) return;
    try {
      await navigator.clipboard.writeText(rallyLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed — select and copy manually');
    }
  }

  async function emailGuest(e) {
    e?.preventDefault();
    if (!guestEmail || !rallyLink) return;
    setSending(true);
    try {
      await sendCallReminderEmail({
        to: guestEmail,
        leadName: guestName || 'there',
        joinUrl: rallyLink,
        consultantName: user?.user_metadata?.full_name || user?.email || 'Liftori',
      });
      toast.success(`Invite sent to ${guestEmail}`);
      setGuestName('');
      setGuestEmail('');
    } catch (err) {
      console.error('[InviteToCallModal] emailGuest', err);
      toast.error('Could not send email');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1220] border border-sky-900/60 rounded-xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <UserPlus size={18} className="text-sky-400" />
            <span className="font-semibold">Invite to Call</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <TabBtn active={mode === 'team'} onClick={() => setMode('team')} icon={<Users size={14} />}>
            Team
          </TabBtn>
          <TabBtn active={mode === 'link'} onClick={() => setMode('link')} icon={<Link2 size={14} />}>
            Link
          </TabBtn>
          <TabBtn active={mode === 'email'} onClick={() => setMode('email')} icon={<Mail size={14} />}>
            Email
          </TabBtn>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {mode === 'team' && (
            <div>
              {loadingTeam ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Loading team…
                </div>
              ) : team.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-6">
                  Everyone's either on the call already or not on the team.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {team.map(p => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-sky-900 flex items-center justify-center text-white text-xs">
                            {(p.full_name || p.email || '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">
                            {p.full_name || p.email}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{p.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => inviteTeamMember(p.id)}
                        className="px-3 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium transition"
                      >
                        Invite
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === 'link' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Share this link with anyone — they'll land in a waiting room and you'll see a
                "knock" notification to let them in.
              </p>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={linkLoading ? 'Generating…' : rallyLink}
                  onClick={e => e.target.select()}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                />
                <button
                  onClick={copyLink}
                  disabled={!rallyLink}
                  className="px-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium transition flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <button
                onClick={generateRallyLink}
                className="text-xs text-slate-400 hover:text-sky-400 transition"
              >
                Generate a fresh link
              </button>
            </div>
          )}

          {mode === 'email' && (
            <form onSubmit={emailGuest} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Their name (optional)</label>
                <input
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="Rachel"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Their email *</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  placeholder="rachel@example.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="text-xs text-slate-500 bg-slate-900/60 rounded-lg p-2 font-mono break-all">
                {linkLoading ? 'Preparing link…' : rallyLink}
              </div>
              <button
                type="submit"
                disabled={sending || !guestEmail || !rallyLink}
                className="w-full px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                {sending ? 'Sending…' : 'Send invite email'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-sm flex items-center justify-center gap-1.5 transition ${
        active
          ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800/30'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
