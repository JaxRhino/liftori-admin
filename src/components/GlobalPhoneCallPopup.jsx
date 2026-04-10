/**
 * GlobalPhoneCallPopup — Full-screen centered popup for incoming phone calls.
 * Renders on every admin page via AdminLayout. Manages its own Twilio device
 * lifecycle so agents receive calls regardless of which page they're on.
 *
 * After accepting, transitions to a compact active-call bar so the agent
 * always has end-call / mute controls no matter which page they navigate to.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import {
  initializeTwilioDevice,
  destroyTwilioDevice,
  acceptIncomingCall,
  rejectIncomingCall,
  hangupCall,
  onTwilioEvent,
  isDeviceReady,
  muteCall,
} from '../lib/twilioService';
import { playIncomingAlert, stopIncomingAlert } from '../lib/callCenterAudio';
import { sendDeclineNotification } from '../lib/callCenterService';
import {
  Phone,
  PhoneOff,
  Voicemail,
  MessageSquare,
  X,
  PhoneIncoming,
  Mic,
  MicOff,
} from 'lucide-react';
import { toast } from 'sonner';

const DECLINE_REASONS = [
  'In a meeting',
  'On another call',
  'Busy right now — will call back',
  'Stepped away',
];

export default function GlobalPhoneCallPopup() {
  const { user, profile } = useAuth();
  const [incoming, setIncoming] = useState(null);
  const [activeCall, setActiveCall] = useState(null);   // ← active call state
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showDeclinePanel, setShowDeclinePanel] = useState(false);
  const [customReason, setCustomReason] = useState('');
  const [agentStatus, setAgentStatus] = useState('offline');
  const cleanupRef = useRef([]);
  const timerRef = useRef(null);

  // ── Call timer ──
  useEffect(() => {
    if (activeCall) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setElapsed(0);
      setMuted(false);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeCall]);

  // Check agent status from cc_agents
  useEffect(() => {
    if (!user) return;
    let sub;

    const loadStatus = async () => {
      const { data } = await supabase
        .from('cc_agents')
        .select('status')
        .eq('user_id', user.id)
        .single();
      if (data) setAgentStatus(data.status);
    };

    loadStatus();

    // Subscribe to status changes
    sub = supabase
      .channel('global-agent-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cc_agents',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new?.status) setAgentStatus(payload.new.status);
      })
      .subscribe();

    return () => {
      if (sub) supabase.removeChannel(sub);
    };
  }, [user]);

  // Initialize Twilio device when agent goes available
  useEffect(() => {
    if (!user || agentStatus !== 'available') return;

    // Only init if not already ready (CallCenter might have already done it)
    if (!isDeviceReady()) {
      initializeTwilioDevice(user.id).catch(err => {
        console.error('[GlobalPhone] Failed to init Twilio:', err);
      });
    }

    // Wire up incoming call events
    let ringTimeout = null;

    const clearIncoming = (msg) => {
      setIncoming(null);
      stopIncomingAlert();
      if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
      if (msg) toast(msg);
    };

    const unsubs = [
      onTwilioEvent('incoming', ({ from, call, isInternal, callerUserId, callerName, callerAvatar }) => {
        // Set state IMMEDIATELY (sync) so popup renders without delay
        setIncoming({ from, call, isInternal, callerUserId, callerName, callerAvatar, callerTitle: '' });
        playIncomingAlert();

        // Fetch title in background and update if found
        if (callerUserId) {
          supabase.from('profiles').select('title').eq('id', callerUserId).single()
            .then(({ data }) => {
              if (data?.title) {
                setIncoming(prev => prev ? { ...prev, callerTitle: data.title } : prev);
              }
            })
            .catch(() => {});
        }

        // Safety timeout — stop ringing after 30s even if no cancel event fires
        if (ringTimeout) clearTimeout(ringTimeout);
        ringTimeout = setTimeout(() => {
          clearIncoming('Call timed out');
        }, 30000);
      }),
      onTwilioEvent('accepted', () => {
        // DON'T clear everything — transition to active call panel
        stopIncomingAlert();
        if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
        // Only set active call if we have incoming data (we accepted it)
        setIncoming(prev => {
          if (prev) {
            setActiveCall({
              from: prev.from,
              callerName: prev.callerName,
              callerAvatar: prev.callerAvatar,
              callerTitle: prev.callerTitle,
              isInternal: prev.isInternal,
            });
          }
          return null;
        });
      }),
      onTwilioEvent('disconnected', () => {
        clearIncoming();
        setActiveCall(null);
        toast('Call ended');
      }),
      onTwilioEvent('cancelled', () => clearIncoming('Caller hung up')),
      onTwilioEvent('rejected', () => clearIncoming()),
    ];

    cleanupRef.current = unsubs;

    return () => {
      unsubs.forEach(fn => { try { fn(); } catch(e) {} });
      cleanupRef.current = [];
      if (ringTimeout) { clearTimeout(ringTimeout); ringTimeout = null; }
      stopIncomingAlert();
    };
  }, [user, agentStatus]);

  // ── Actions ──
  const handleAnswer = useCallback(() => {
    stopIncomingAlert();
    acceptIncomingCall();
    // Don't clear incoming here — the 'accepted' event handler transitions to active call
  }, []);

  const handleHangup = useCallback(() => {
    hangupCall();
    setActiveCall(null);
    toast.success('Call ended');
  }, []);

  const handleToggleMute = useCallback(() => {
    const newMuted = !muted;
    muteCall(newMuted);
    setMuted(newMuted);
  }, [muted]);

  const handleDeclineNoReason = useCallback(async () => {
    stopIncomingAlert();
    rejectIncomingCall();
    if (incoming?.isInternal && incoming?.callerUserId) {
      await sendDeclineNotification(
        incoming.callerUserId,
        user.id,
        profile?.full_name || user.user_metadata?.full_name || 'Team Member',
        ''
      );
    }
    setIncoming(null);
    setShowDeclinePanel(false);
    setCustomReason('');
    toast('Call declined');
  }, [incoming, user, profile]);

  const handleDeclineWithReason = useCallback(async (reason) => {
    stopIncomingAlert();
    rejectIncomingCall();
    if (incoming?.callerUserId) {
      await sendDeclineNotification(
        incoming.callerUserId,
        user.id,
        profile?.full_name || user.user_metadata?.full_name || 'Team Member',
        reason
      );
    }
    setIncoming(null);
    setShowDeclinePanel(false);
    setCustomReason('');
    toast('Call declined: ' + reason);
  }, [incoming, user, profile]);

  const handleVoicemail = useCallback(async () => {
    stopIncomingAlert();
    rejectIncomingCall();
    if (incoming?.callerUserId) {
      await sendDeclineNotification(
        incoming.callerUserId,
        user.id,
        profile?.full_name || user.user_metadata?.full_name || 'Team Member',
        'Sent to voicemail — please leave a message or try again later.'
      );
    }
    setIncoming(null);
    setShowDeclinePanel(false);
    toast('Sent to voicemail');
  }, [incoming, user, profile]);

  // Format elapsed seconds as mm:ss
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ════════════════════════════════════════════
  //  ACTIVE CALL BAR (after accepting)
  // ════════════════════════════════════════════
  if (activeCall) {
    const name = activeCall.callerName || activeCall.from || 'Unknown';
    const initial = name.charAt(0).toUpperCase();

    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg">
        <div className="rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
          {/* Green header */}
          <div className="px-4 py-2 bg-green-600 flex items-center gap-2">
            <Phone size={16} className="text-white" />
            <span className="text-white font-semibold text-sm">
              {activeCall.isInternal ? 'Team Call' : 'Active Call'}
            </span>
            <span className="ml-auto text-green-100 text-sm font-mono">{formatTime(elapsed)}</span>
          </div>

          <div className="px-4 py-3 flex items-center gap-4">
            {/* Avatar */}
            {activeCall.callerAvatar ? (
              <img src={activeCall.callerAvatar} alt={name}
                className="w-10 h-10 rounded-full border-2 border-green-400 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full border-2 border-green-400 bg-green-500/20 flex items-center justify-center">
                <span className="text-white text-lg font-bold">{initial}</span>
              </div>
            )}

            {/* Name + title */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{name}</p>
              {activeCall.callerTitle && (
                <p className="text-slate-400 text-xs">{activeCall.callerTitle}</p>
              )}
              {!activeCall.isInternal && activeCall.from && activeCall.from !== name && (
                <p className="text-slate-500 text-xs">{activeCall.from}</p>
              )}
            </div>

            {/* Mute button */}
            <button
              onClick={handleToggleMute}
              className={`p-2.5 rounded-full transition-colors ${
                muted
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* End call button */}
            <button
              onClick={handleHangup}
              className="p-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
              title="End Call"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  //  INCOMING CALL POPUP
  // ════════════════════════════════════════════
  if (!incoming) return null;

  const displayName = incoming.callerName || incoming.from || 'Unknown';
  const initial = (incoming.callerName || incoming.from || '?').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Pulsing header bar */}
        <div className={`px-6 py-3 ${incoming.isInternal ? 'bg-indigo-600' : 'bg-blue-600'} flex items-center gap-2`}>
          <PhoneIncoming size={18} className="text-white animate-pulse" />
          <span className="text-white font-semibold text-sm">
            {incoming.isInternal ? 'Team Call' : 'Incoming Call'}
          </span>
        </div>

        {/* Caller info */}
        <div className="px-8 pt-8 pb-4 flex flex-col items-center">
          {/* Avatar */}
          <div className="relative mb-4">
            {/* Pulsing ring */}
            <div className={`absolute -inset-2 rounded-full ${incoming.isInternal ? 'bg-indigo-500' : 'bg-blue-500'} opacity-20 animate-ping`} />
            <div className={`absolute -inset-2 rounded-full ${incoming.isInternal ? 'bg-indigo-500' : 'bg-blue-500'} opacity-10 animate-pulse`} />
            {incoming.callerAvatar ? (
              <img
                src={incoming.callerAvatar}
                alt={displayName}
                className={`relative w-24 h-24 rounded-full border-4 ${incoming.isInternal ? 'border-indigo-400' : 'border-blue-400'} object-cover`}
              />
            ) : (
              <div className={`relative w-24 h-24 rounded-full border-4 ${incoming.isInternal ? 'border-indigo-400 bg-indigo-500/30' : 'border-blue-400 bg-blue-500/30'} flex items-center justify-center`}>
                <span className="text-white text-3xl font-bold">{initial}</span>
              </div>
            )}
          </div>

          <h2 className="text-white text-2xl font-bold text-center">{displayName}</h2>
          {incoming.callerTitle && (
            <p className="text-slate-300 text-sm font-medium mt-0.5">{incoming.callerTitle}</p>
          )}
          <p className="text-slate-400 text-sm mt-1">
            {incoming.isInternal ? 'Internal Extension' : incoming.from || 'Unknown Number'}
          </p>
        </div>

        {/* Action buttons */}
        {!showDeclinePanel ? (
          <div className="px-8 pb-8 space-y-3">
            {/* Main action row */}
            <div className="flex gap-3">
              <button
                onClick={handleAnswer}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold py-4 px-4 transition-colors text-lg"
              >
                <Phone size={22} />
                Answer
              </button>
              <button
                onClick={() => incoming.isInternal ? setShowDeclinePanel(true) : handleDeclineNoReason()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-4 px-4 transition-colors text-lg"
              >
                <PhoneOff size={22} />
                Decline
              </button>
            </div>

            {/* Internal call extras */}
            {incoming.isInternal && (
              <button
                onClick={handleVoicemail}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white font-medium py-3 px-4 transition-colors"
              >
                <Voicemail size={20} />
                Send to Voicemail
              </button>
            )}
          </div>
        ) : (
          /* Decline reason panel */
          <div className="px-8 pb-8 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-slate-400 font-medium">Decline with message:</p>
              <button
                onClick={() => setShowDeclinePanel(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick reasons */}
            {DECLINE_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => handleDeclineWithReason(reason)}
                className="w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white py-3 px-4 transition-colors text-left"
              >
                <MessageSquare size={16} className="text-slate-500 shrink-0" />
                <span className="text-sm">{reason}</span>
              </button>
            ))}

            {/* Custom message */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Custom message..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 px-4 py-3 text-sm focus:outline-none focus:border-slate-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customReason.trim()) {
                    handleDeclineWithReason(customReason.trim());
                  }
                }}
              />
              <button
                onClick={() => customReason.trim() && handleDeclineWithReason(customReason.trim())}
                disabled={!customReason.trim()}
                className="rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white px-4 py-3 text-sm font-medium transition-colors"
              >
                Send
              </button>
            </div>

            {/* Decline without reason */}
            <button
              onClick={handleDeclineNoReason}
              className="w-full text-center text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
            >
              Decline without message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
