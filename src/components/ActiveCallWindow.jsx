/**
 * ActiveCallWindow — Full-featured call management panel.
 * Renders as an overlay when a call is active. Includes:
 *  - Call controls (mute, hold, keypad, end, pop-out)
 *  - Customer lookup (auto by phone + manual search)
 *  - Call notes (auto-saves)
 *  - Tasks (create during call)
 *  - Messaging (Email, SMS, Channel post, Team DM)
 *  - Live Twilio transfer to other agents
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  hangupCall,
  muteCall,
  sendDigit,
  sendSMS,
  getActiveConnection,
} from '../lib/twilioService';
import {
  fetchAgents,
  endCall as endCallDB,
  createSpeedToLead,
} from '../lib/callCenterService';
import {
  sendMessage as sendChatMessage,
  fetchChannels,
  fetchUsers as fetchChatUsers,
  createOrGetDM,
} from '../lib/chatService';
import {
  Phone, PhoneOff, Mic, MicOff, Hash, ArrowRightLeft,
  Search, User, StickyNote, ListTodo, MessageSquare, Mail,
  Send, X, Minimize2, Maximize2, ExternalLink,
  ChevronDown, Clock, Building2, PhoneCall, CheckCircle2,
  Plus, Loader2, Grid3X3, Flame,
} from 'lucide-react';
import { toast } from 'sonner';

const SUPABASE_URL = 'https://qlerfkdyslndjbaltkwo.supabase.co';

// ─── Tabs ────────────────────────────────────────
const TABS = [
  { id: 'customer', label: 'Customer', icon: User },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'messaging', label: 'Messaging', icon: MessageSquare },
  { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
];

// ─── Keypad digits ───────────────────────────────
const KEYPAD = ['1','2','3','4','5','6','7','8','9','*','0','#'];

// ─── Helper: format seconds ──────────────────────
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Send email via Edge Function ────────────────
async function sendEmailEdge({ to, subject, html }) {
  const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ to, subject, html, from: 'Liftori <noreply@liftori.ai>' }),
  });
  if (!res.ok) throw new Error('Email send failed');
  return res.json();
}

// ═══════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════
export default function ActiveCallWindow({ callData, onClose }) {
  const { user, profile } = useAuth();

  // ── Call state ──
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [activeTab, setActiveTab] = useState('customer');
  const [minimized, setMinimized] = useState(false);
  const timerRef = useRef(null);

  // ── Customer state ──
  const [customer, setCustomer] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [callHistory, setCallHistory] = useState([]);

  // ── Notes state ──
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const notesTimerRef = useRef(null);

  // ── Tasks state ──
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');

  // ── Messaging state ──
  const [msgTab, setMsgTab] = useState('sms');
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [channelMsg, setChannelMsg] = useState('');
  const [channelSending, setChannelSending] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [dmMsg, setDmMsg] = useState('');
  const [dmSending, setDmSending] = useState(false);

  // ── Transfer state ──
  const [agents, setAgents] = useState([]);
  const [transferring, setTransferring] = useState(false);

  // ── Hot Lead state ──
  const [hotLeadSent, setHotLeadSent] = useState(false);
  const [hotLeadSending, setHotLeadSending] = useState(false);

  // ═══════════════════════════════════════
  //  INIT + TIMER
  // ═══════════════════════════════════════
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-lookup customer by phone on mount
  useEffect(() => {
    const phone = callData?.from || callData?.to_number || callData?.from_number || '';
    if (phone && phone.length >= 10) {
      lookupCustomerByPhone(phone);
      setSmsTo(phone);
    }
    loadChannels();
    loadTeamUsers();
    loadAgents();
  }, []);

  // ═══════════════════════════════════════
  //  CALL CONTROLS
  // ═══════════════════════════════════════
  const handleMute = () => { muteCall(!muted); setMuted(!muted); };

  const handleHangup = () => {
    hangupCall();
    if (onClose) onClose();
    toast.success('Call ended');
  };

  const handleDigit = (d) => { sendDigit(d); toast(`Sent: ${d}`); };

  // ═══════════════════════════════════════
  //  CUSTOMER LOOKUP
  // ═══════════════════════════════════════
  async function lookupCustomerByPhone(phone) {
    setCustomerLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, '').slice(-10);
      // Search profiles (customers + leads)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, company_name, role, crm_stage, lead_temperature, created_at')
        .or(`phone.ilike.%${cleaned}%,phone.ilike.%${phone}%`);

      // Search speed-to-lead
      const { data: leads } = await supabase
        .from('cc_speed_to_lead')
        .select('id, lead_name, phone_number, email, source, status, received_at')
        .or(`phone_number.ilike.%${cleaned}%,phone_number.ilike.%${phone}%`);

      if (profiles?.length > 0) {
        const c = profiles[0];
        setCustomer({ type: 'profile', ...c });
        if (c.email) setEmailTo(c.email);
        loadCallHistory(c.phone);
      } else if (leads?.length > 0) {
        const l = leads[0];
        setCustomer({ type: 'lead', id: l.id, full_name: l.lead_name, phone: l.phone_number, email: l.email, source: l.source, crm_stage: l.status });
        if (l.email) setEmailTo(l.email);
        loadCallHistory(l.phone_number);
      }
    } catch (err) {
      console.error('Customer lookup error:', err);
    } finally {
      setCustomerLoading(false);
    }
  }

  async function searchCustomers(q) {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, company_name, role, crm_stage')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`)
        .limit(10);
      setSearchResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  }

  function selectCustomer(c) {
    setCustomer({ type: 'profile', ...c });
    if (c.email) setEmailTo(c.email);
    if (c.phone) setSmsTo(c.phone);
    setSearchResults([]);
    setSearchQuery('');
  }

  async function loadCallHistory(phone) {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    const { data } = await supabase
      .from('cc_calls')
      .select('id, direction, status, department, duration_seconds, started_at, notes')
      .or(`from_number.ilike.%${cleaned}%,to_number.ilike.%${cleaned}%`)
      .order('started_at', { ascending: false })
      .limit(5);
    setCallHistory(data || []);
  }

  // ═══════════════════════════════════════
  //  NOTES (auto-save)
  // ═══════════════════════════════════════
  function handleNotesChange(val) {
    setNotes(val);
    setNotesSaved(false);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => saveNotes(val), 2000);
  }

  async function saveNotes(text) {
    try {
      if (callData?.id) {
        await supabase.from('cc_calls').update({ notes: text }).eq('id', callData.id);
      }
      setNotesSaved(true);
    } catch {}
  }

  // ═══════════════════════════════════════
  //  TASKS
  // ═══════════════════════════════════════
  function addTask() {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: newTask.trim(), done: false }]);
    setNewTask('');
  }

  function toggleTask(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  // ═══════════════════════════════════════
  //  MESSAGING
  // ═══════════════════════════════════════

  // SMS
  async function handleSendSMS() {
    if (!smsTo || !smsBody.trim()) return;
    setSmsSending(true);
    try {
      await sendSMS(smsTo, smsBody, '+19044428970');
      toast.success('SMS sent');
      setSmsBody('');
    } catch (err) {
      toast.error('SMS failed: ' + err.message);
    } finally {
      setSmsSending(false);
    }
  }

  // Email
  async function handleSendEmail() {
    if (!emailTo || !emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    try {
      await sendEmailEdge({ to: emailTo, subject: emailSubject, html: emailBody.replace(/\n/g, '<br/>') });
      toast.success('Email sent');
      setEmailSubject('');
      setEmailBody('');
    } catch (err) {
      toast.error('Email failed: ' + err.message);
    } finally {
      setEmailSending(false);
    }
  }

  // Channel post
  async function loadChannels() {
    if (!user) return;
    try {
      const result = await fetchChannels(user.id);
      const allChannels = result?.channels || result || [];
      setChannels(allChannels.filter(c => c.type !== 'direct'));
    } catch {}
  }

  async function handleSendChannel() {
    if (!selectedChannel || !channelMsg.trim()) return;
    setChannelSending(true);
    try {
      await sendChatMessage(selectedChannel, { content: channelMsg }, user);
      toast.success('Posted to channel');
      setChannelMsg('');
    } catch (err) {
      toast.error('Post failed: ' + err.message);
    } finally {
      setChannelSending(false);
    }
  }

  // DM
  async function loadTeamUsers() {
    try {
      const result = await fetchChatUsers();
      const allUsers = result?.users || result || [];
      setTeamUsers(allUsers.filter(u => u.id !== user?.id));
    } catch {}
  }

  async function handleSendDM() {
    if (!selectedUser || !dmMsg.trim()) return;
    setDmSending(true);
    try {
      const dm = await createOrGetDM(user.id, selectedUser);
      await sendChatMessage(dm.id, { content: dmMsg }, user);
      toast.success('DM sent');
      setDmMsg('');
    } catch (err) {
      toast.error('DM failed: ' + err.message);
    } finally {
      setDmSending(false);
    }
  }

  // ═══════════════════════════════════════
  //  TRANSFER
  // ═══════════════════════════════════════
  async function loadAgents() {
    try {
      const data = await fetchAgents();
      setAgents((data || []).filter(a => a.user_id !== user?.id));
    } catch {}
  }

  async function handleTransfer(agent) {
    setTransferring(true);
    try {
      // Get the active Twilio connection's call SID
      const conn = getActiveConnection();
      if (!conn) throw new Error('No active call');

      const callSid = conn.parameters?.CallSid;
      if (!callSid) throw new Error('No CallSid on connection');

      // Call edge function to transfer
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/twilio-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          callSid,
          targetIdentity: agent.twilio_client_identity || `agent_${agent.user_id}`,
          targetAgentId: agent.user_id,
          transferredBy: user.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Transfer failed');
      }

      toast.success(`Transferring to ${agent.display_name || 'agent'}...`);
      // The caller stays on the line; the agent's device rings
      // When the new agent picks up, the original agent can hang up
    } catch (err) {
      toast.error('Transfer failed: ' + err.message);
    } finally {
      setTransferring(false);
    }
  }

  // ═══════════════════════════════════════
  //  HOT LEAD
  // ═══════════════════════════════════════
  async function handleHotLead() {
    if (hotLeadSent || hotLeadSending) return;
    setHotLeadSending(true);
    try {
      const callerPhone = callData?.from || callData?.from_number || callData?.to_number || '';
      const callerName = customer?.full_name || callData?.callerName || callerPhone || 'Unknown Caller';
      const callerEmail = customer?.email || '';

      // 1. Add to speed-to-lead queue (columns: lead_name, lead_phone, lead_email, lead_source)
      await createSpeedToLead({
        lead_name: callerName,
        lead_phone: callerPhone,
        lead_email: callerEmail,
        lead_source: 'hot_lead_call',
        status: 'new',
        notes: `HOT LEAD - Flagged during active call by ${profile?.full_name || 'agent'}. Needs immediate follow-up or appointment.`,
      });

      // 2. Post to sales channel
      // Find the sales or announcements channel
      const salesChannel = channels.find(c =>
        c.name?.toLowerCase().includes('sales') ||
        c.name?.toLowerCase().includes('announcement')
      );

      if (salesChannel) {
        const msg = `HOT LEAD - ${callerName} (${callerPhone}) is on the line and needs an appointment RIGHT NOW. Flagged by ${profile?.full_name || 'agent'}. ${callerEmail ? `Email: ${callerEmail}` : ''} ${notes ? `Notes: ${notes}` : ''}`;
        await sendChatMessage(salesChannel.id, { content: msg }, user);
      }

      setHotLeadSent(true);
      toast.success('Hot Lead posted to sales channel + speed-to-lead queue');
    } catch (err) {
      toast.error('Hot Lead failed: ' + err.message);
    } finally {
      setHotLeadSending(false);
    }
  }

  // ═══════════════════════════════════════
  //  POP OUT
  // ═══════════════════════════════════════
  function handlePopOut() {
    // Open a new window and broadcast call state
    const w = window.open('', 'liftori-call', 'width=800,height=700,menubar=no,toolbar=no');
    if (!w) { toast.error('Popup blocked — allow popups for this site'); return; }
    // For now, notify user
    toast('Pop-out coming soon — use this window for now');
  }

  // ═══════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════
  const callerName = callData?.callerName || customer?.full_name || callData?.from || 'Unknown';
  const callerNumber = callData?.from || callData?.from_number || callData?.to_number || '';

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[9998] bg-slate-900 border border-green-500/50 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setMinimized(false)}>
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="text-white font-medium text-sm">{callerName}</span>
        <span className="text-green-400 font-mono text-sm">{fmtTime(elapsed)}</span>
        <button onClick={(e) => { e.stopPropagation(); handleHangup(); }}
          className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white"><PhoneOff size={14} /></button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-[85vh] max-h-[750px] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden">

        {/* ════════ TOP BAR — Call controls ════════ */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 px-5 py-3 flex items-center gap-3 shrink-0">
          {/* Caller info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {callData?.callerAvatar ? (
              <img src={callData.callerAvatar} className="w-10 h-10 rounded-full border-2 border-green-300 object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full border-2 border-green-300 bg-green-500/30 flex items-center justify-center">
                <span className="text-white font-bold">{callerName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white font-semibold truncate">{callerName}</p>
              {callData?.callerTitle && <p className="text-green-200 text-xs">{callData.callerTitle}</p>}
              {callerNumber && callerNumber !== callerName && (
                <p className="text-green-200/70 text-xs">{callerNumber}</p>
              )}
            </div>
          </div>

          {/* Timer */}
          <div className="text-white font-mono text-lg font-bold tabular-nums">{fmtTime(elapsed)}</div>

          {/* Controls */}
          <div className="flex items-center gap-2 ml-4">
            <button onClick={handleHotLead} disabled={hotLeadSent || hotLeadSending}
              title={hotLeadSent ? 'Hot Lead sent' : 'Flag as Hot Lead'}
              className={`p-2 rounded-full transition-colors ${
                hotLeadSent ? 'bg-orange-500 text-white cursor-default' :
                hotLeadSending ? 'bg-orange-500/50 text-white' :
                'bg-white/20 text-white hover:bg-orange-500 hover:text-white'
              }`}>
              {hotLeadSending ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
            </button>
            <div className="w-px h-6 bg-white/20" />
            <button onClick={handleMute} title={muted ? 'Unmute' : 'Mute'}
              className={`p-2 rounded-full transition-colors ${muted ? 'bg-amber-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button onClick={() => setShowKeypad(!showKeypad)} title="Keypad"
              className={`p-2 rounded-full transition-colors ${showKeypad ? 'bg-sky-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}>
              <Grid3X3 size={18} />
            </button>
            <button onClick={() => setMinimized(true)} title="Minimize"
              className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <Minimize2 size={18} />
            </button>
            <button onClick={handlePopOut} title="Pop Out"
              className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <ExternalLink size={18} />
            </button>
            <button onClick={handleHangup} title="End Call"
              className="p-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors ml-1">
              <PhoneOff size={20} />
            </button>
          </div>
        </div>

        {/* Keypad overlay */}
        {showKeypad && (
          <div className="bg-slate-800 border-b border-slate-700 px-5 py-3">
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
              {KEYPAD.map(d => (
                <button key={d} onClick={() => handleDigit(d)}
                  className="py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg transition-colors">
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════════ TAB NAV ════════ */}
        <div className="flex border-b border-slate-700 bg-slate-800/50 shrink-0">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  active ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ════════ TAB CONTENT ════════ */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── CUSTOMER TAB ── */}
          {activeTab === 'customer' && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchCustomers(e.target.value); }}
                  placeholder="Search by name, email, phone, or company..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500" />
                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto z-10">
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => selectCustomer(r)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-700/50 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0">
                          <span className="text-sky-400 font-bold text-sm">{(r.full_name || '?').charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{r.full_name}</p>
                          <p className="text-slate-400 text-xs truncate">{r.email} {r.phone ? `| ${r.phone}` : ''}</p>
                        </div>
                        {r.crm_stage && (
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{r.crm_stage}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer card */}
              {customerLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 size={24} className="animate-spin mr-2" /> Looking up caller...
                </div>
              ) : customer ? (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-sky-500/20 border-2 border-sky-500/50 flex items-center justify-center shrink-0">
                      <span className="text-sky-400 text-xl font-bold">{(customer.full_name || '?').charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-lg font-bold">{customer.full_name || 'Unknown'}</h3>
                      {customer.company_name && (
                        <p className="text-slate-300 text-sm flex items-center gap-1"><Building2 size={14} /> {customer.company_name}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
                        {customer.email && <span>{customer.email}</span>}
                        {customer.phone && <span>{customer.phone}</span>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        {customer.crm_stage && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-400 font-medium">{customer.crm_stage}</span>
                        )}
                        {customer.lead_temperature && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            customer.lead_temperature === 'hot' ? 'bg-red-500/20 text-red-400' :
                            customer.lead_temperature === 'warm' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{customer.lead_temperature}</span>
                        )}
                        {customer.type === 'lead' && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-400 font-medium">Speed-to-Lead</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-8 text-center">
                  <User size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-400 text-sm">No customer match found for this number.</p>
                  <p className="text-slate-500 text-xs mt-1">Search above to manually link a customer.</p>
                </div>
              )}

              {/* Call history */}
              {callHistory.length > 0 && (
                <div>
                  <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Recent Call History</h4>
                  <div className="space-y-1.5">
                    {callHistory.map(h => (
                      <div key={h.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                        <PhoneCall size={14} className={h.direction === 'inbound' ? 'text-green-400' : 'text-sky-400'} />
                        <span className="text-slate-300 capitalize">{h.direction}</span>
                        <span className="text-slate-500">{h.department}</span>
                        <span className="text-slate-500">{h.duration_seconds ? fmtTime(h.duration_seconds) : '--'}</span>
                        <span className="ml-auto text-slate-500 text-xs">{new Date(h.started_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES TAB ── */}
          {activeTab === 'notes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">Call Notes</h3>
                <span className={`text-xs ${notesSaved ? 'text-green-400' : 'text-amber-400'}`}>
                  {notesSaved ? 'Saved' : 'Saving...'}
                </span>
              </div>
              <textarea value={notes} onChange={e => handleNotesChange(e.target.value)}
                placeholder="Type call notes here... auto-saves every 2 seconds."
                className="w-full h-[400px] bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-sky-500" />
            </div>
          )}

          {/* ── TASKS TAB ── */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Call Tasks</h3>
              {/* Add task */}
              <div className="flex gap-2">
                <input value={newTask} onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="Add a task..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500" />
                <button onClick={addTask} disabled={!newTask.trim()}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                  <Plus size={18} />
                </button>
              </div>
              {/* Task list */}
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No tasks yet. Add one above.</p>
                ) : tasks.map(t => (
                  <div key={t.id} onClick={() => toggleTask(t.id)}
                    className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700/50">
                    <CheckCircle2 size={20} className={t.done ? 'text-green-400' : 'text-slate-600'} />
                    <span className={`text-sm ${t.done ? 'text-slate-500 line-through' : 'text-white'}`}>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MESSAGING TAB ── */}
          {activeTab === 'messaging' && (
            <div className="space-y-4">
              {/* Sub-tabs */}
              <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
                {[
                  { id: 'sms', label: 'SMS' },
                  { id: 'email', label: 'Email' },
                  { id: 'channel', label: 'Channel' },
                  { id: 'dm', label: 'Team DM' },
                ].map(t => (
                  <button key={t.id} onClick={() => setMsgTab(t.id)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      msgTab === t.id ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}>{t.label}</button>
                ))}
              </div>

              {/* SMS */}
              {msgTab === 'sms' && (
                <div className="space-y-3">
                  <input value={smsTo} onChange={e => setSmsTo(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500" />
                  <textarea value={smsBody} onChange={e => setSmsBody(e.target.value)}
                    placeholder="Message..."
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-sky-500" />
                  <button onClick={handleSendSMS} disabled={smsSending || !smsTo || !smsBody.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                    {smsSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Send SMS
                  </button>
                </div>
              )}

              {/* Email */}
              {msgTab === 'email' && (
                <div className="space-y-3">
                  <input value={emailTo} onChange={e => setEmailTo(e.target.value)}
                    placeholder="To (email)"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500" />
                  <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500" />
                  <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                    placeholder="Email body..."
                    className="w-full h-40 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-sky-500" />
                  <button onClick={handleSendEmail} disabled={emailSending || !emailTo || !emailSubject.trim() || !emailBody.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                    {emailSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Send Email
                  </button>
                </div>
              )}

              {/* Channel post */}
              {msgTab === 'channel' && (
                <div className="space-y-3">
                  <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500">
                    <option value="">Select channel...</option>
                    {channels.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <textarea value={channelMsg} onChange={e => setChannelMsg(e.target.value)}
                    placeholder="Channel message..."
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-sky-500" />
                  <button onClick={handleSendChannel} disabled={channelSending || !selectedChannel || !channelMsg.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                    {channelSending ? <Loader2 size={16} className="animate-spin" /> : <Hash size={16} />}
                    Post to Channel
                  </button>
                </div>
              )}

              {/* Team DM */}
              {msgTab === 'dm' && (
                <div className="space-y-3">
                  <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-sky-500">
                    <option value="">Select team member...</option>
                    {teamUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.full_name || u.email}</option>
                    ))}
                  </select>
                  <textarea value={dmMsg} onChange={e => setDmMsg(e.target.value)}
                    placeholder="Direct message..."
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-sky-500" />
                  <button onClick={handleSendDM} disabled={dmSending || !selectedUser || !dmMsg.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                    {dmSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Send DM
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TRANSFER TAB ── */}
          {activeTab === 'transfer' && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Transfer Call</h3>
              <p className="text-slate-400 text-sm">Select an agent to transfer this call. The caller stays on the line while the new agent is connected.</p>
              <div className="space-y-2">
                {agents.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No other agents found.</p>
                ) : agents.map(a => (
                  <div key={a.user_id} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700/50">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-white font-bold">{(a.display_name || '?').charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{a.display_name || a.twilio_client_identity}</p>
                      <p className={`text-xs ${a.status === 'available' ? 'text-green-400' : 'text-slate-500'}`}>
                        {a.status || 'offline'}
                      </p>
                    </div>
                    <button onClick={() => handleTransfer(a)} disabled={transferring || a.status !== 'available'}
                      className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center gap-1.5">
                      {transferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                      Transfer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
