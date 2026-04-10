/**
 * Sales Call Hub — Liftori Consulting Call Interface
 *
 * The consultant's weapon for sales calls:
 * - Video call with the lead (WebRTC)
 * - Full lead info panel (company, interest, challenge)
 * - Live note-taking during the call
 * - Post-call summary + follow-up actions
 * - Temperature rating + estimated value
 * - Auto-saves notes to appointment + CRM lead record
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Monitor,
  User, Building2, Target, MessageSquare, Save,
  Clock, Calendar, FileText, ChevronRight, AlertCircle,
  Thermometer, DollarSign, CheckCircle, XCircle,
  Maximize2, Minimize2, PanelRightClose, PanelRight,
  Clipboard, Send, Star, ArrowLeft, Loader2, Mail, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { sendConsultingReminderEmail } from '../lib/videoCallHelpers';

const INTEREST_LABELS = {
  ai_strategy: 'AI Strategy',
  growth_planning: 'Growth Planning',
  eos_implementation: 'EOS Implementation',
  coaching: '1-on-1 Coaching',
  general: 'General Consulting'
};

const TEMP_COLORS = {
  hot: 'bg-red-500/20 text-red-400 border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  dead: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

export default function SalesCall() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Appointment data
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Call state
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  // UI state
  const [sidePanel, setSidePanel] = useState('info'); // 'info', 'notes', 'summary'
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Notes
  const [callNotes, setCallNotes] = useState('');
  const [callSummary, setCallSummary] = useState('');
  const [followUpActions, setFollowUpActions] = useState('');
  const [leadTemp, setLeadTemp] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);

  // Reminder state
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);

  // Load appointment data
  useEffect(() => {
    loadAppointment();
  }, [roomId]);

  async function loadAppointment() {
    try {
      const { data, error: fetchError } = await supabase
        .from('consulting_appointments')
        .select('*')
        .eq('room_id', roomId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Appointment not found');

      setAppointment(data);
      setCallNotes(data.call_notes || '');
      setCallSummary(data.call_summary || '');
      setFollowUpActions(data.follow_up_actions || '');
      setLeadTemp(data.lead_temperature || '');
      setEstimatedValue(data.estimated_value || '');
    } catch (err) {
      console.error('Failed to load appointment:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Send reminder email to the lead
  async function sendReminder() {
    if (!appointment?.lead_email) {
      toast.error('No email address for this lead');
      return;
    }
    setSendingReminder(true);
    try {
      await sendConsultingReminderEmail({
        to: appointment.lead_email,
        leadName: appointment.lead_name,
        roomId,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_start,
        consultantName: user?.user_metadata?.full_name || 'our team',
      });
      setReminderSent(true);
      toast.success(`Reminder sent to ${appointment.lead_name}`);
    } catch (err) {
      console.error('Reminder error:', err);
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  }

  // Copy join link to clipboard
  function copyJoinLink() {
    navigator.clipboard.writeText(`https://liftori.ai/call/${roomId}`);
    toast.success('Join link copied to clipboard');
  }

  // Start local video preview
  async function startLocalVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCallActive(true);

      // Start duration timer
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Update appointment status
      await supabase
        .from('consulting_appointments')
        .update({ status: 'in_progress' })
        .eq('id', appointment.id);

      toast.success('Camera and mic ready');
    } catch (err) {
      console.error('Media error:', err);
      toast.error('Could not access camera/microphone');
    }
  }

  // Toggle video
  function toggleVideo() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }

  // Toggle audio
  function toggleAudio() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }

  // End call
  async function endCall() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    setCallActive(false);
    setSidePanel('summary');

    // Save notes on end
    await saveNotes();
  }

  // Format duration
  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  // Auto-save notes (debounced)
  useEffect(() => {
    if (!appointment) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(() => {
      if (callNotes || callSummary || followUpActions) {
        saveNotes(true);
      }
    }, 5000);
    setAutoSaveTimer(timer);
    return () => clearTimeout(timer);
  }, [callNotes, callSummary, followUpActions, leadTemp, estimatedValue]);

  // Save notes
  async function saveNotes(silent = false) {
    if (!appointment) return;
    setSaving(true);
    try {
      const updates = {
        call_notes: callNotes || null,
        call_summary: callSummary || null,
        follow_up_actions: followUpActions || null,
        lead_temperature: leadTemp || null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
      };

      const { error: updateErr } = await supabase
        .from('consulting_appointments')
        .update(updates)
        .eq('id', appointment.id);

      if (updateErr) throw updateErr;

      // Also update CRM profile if linked
      if (appointment.crm_profile_id && (callNotes || callSummary)) {
        // Log activity to the CRM lead
        await supabase.from('activity_log').insert({
          entity_type: 'profile',
          entity_id: appointment.crm_profile_id,
          action: 'consulting_call_notes',
          details: `Call notes updated. ${callSummary ? 'Summary: ' + callSummary.substring(0, 200) : ''}`
        });
      }

      if (!silent) toast.success('Notes saved');
    } catch (err) {
      console.error('Save error:', err);
      if (!silent) toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  }

  // Complete appointment
  async function completeAppointment() {
    try {
      await supabase
        .from('consulting_appointments')
        .update({
          status: 'completed',
          lead_temperature: leadTemp || 'warm',
          estimated_value: estimatedValue ? parseFloat(estimatedValue) : null
        })
        .eq('id', appointment.id);

      // Post completion to Consulting Lead channel
      const msg = `**CONSULTING CALL COMPLETED**\n\n` +
        `Lead: ${appointment.lead_name}\n` +
        `Company: ${appointment.company_name || 'N/A'}\n` +
        `Temperature: ${leadTemp || 'warm'}\n` +
        `Est. Value: ${estimatedValue ? '$' + estimatedValue : 'TBD'}\n` +
        (callSummary ? `\nSummary: ${callSummary.substring(0, 200)}` : '') +
        (followUpActions ? `\n\nFollow-up: ${followUpActions.substring(0, 200)}` : '');

      await supabase.from('chat_messages').insert({
        channel_id: '2eac196a-bb06-4164-bcdd-4738af7cf2c9',
        sender_name: 'Sage',
        content: msg
      });

      toast.success('Appointment completed!');
      navigate('/admin/customers');
    } catch (err) {
      console.error('Complete error:', err);
      toast.error('Failed to complete');
    }
  }

  // Mark no-show
  async function markNoShow() {
    try {
      await supabase
        .from('consulting_appointments')
        .update({ status: 'no_show' })
        .eq('id', appointment.id);

      toast.success('Marked as no-show');
      navigate('/admin/customers');
    } catch (err) {
      toast.error('Failed to update');
    }
  }

  // Import to CRM
  async function importToCRM() {
    if (!appointment || appointment.imported_to_crm) return;
    try {
      // Create profile
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .insert({
          full_name: appointment.lead_name,
          email: appointment.lead_email,
          phone: appointment.lead_phone,
          company_name: appointment.company_name,
          role: 'customer',
          crm_stage: 'prospect',
          lead_temperature: leadTemp || 'warm',
          lead_source: 'consulting_booking',
          estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
          notes: `Consulting interest: ${INTEREST_LABELS[appointment.primary_interest] || appointment.primary_interest}\nChallenge: ${appointment.biggest_challenge || 'N/A'}\nCompany size: ${appointment.company_size || 'N/A'}\nIndustry: ${appointment.industry || 'N/A'}`
        })
        .select()
        .single();

      if (profErr) {
        if (profErr.code === '23505') {
          toast.info('Lead already exists in CRM');
          return;
        }
        throw profErr;
      }

      // Link to appointment
      await supabase
        .from('consulting_appointments')
        .update({ crm_profile_id: profile.id, imported_to_crm: true })
        .eq('id', appointment.id);

      setAppointment(prev => ({ ...prev, crm_profile_id: profile.id, imported_to_crm: true }));
      toast.success('Lead imported to CRM!');
    } catch (err) {
      console.error('CRM import error:', err);
      toast.error('Import failed: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold">Appointment Not Found</h2>
        <p className="text-gray-400">{error}</p>
        <button onClick={() => navigate('/admin/customers')} className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition">
          Back to Customers
        </button>
      </div>
    );
  }

  return (
    <div className={`flex h-[calc(100vh-64px)] ${fullscreen ? 'fixed inset-0 z-50 bg-slate-950 h-screen' : ''}`}>

      {/* === MAIN VIDEO AREA === */}
      <div className="flex-1 flex flex-col bg-slate-950 relative">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-800 rounded-lg transition">
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div>
              <h1 className="text-sm font-semibold flex items-center gap-2">
                <span className="text-purple-400">Sales Call</span>
                <span className="text-gray-500">|</span>
                <span>{appointment.lead_name}</span>
                {appointment.company_name && <span className="text-gray-500">@ {appointment.company_name}</span>}
              </h1>
              <p className="text-xs text-gray-500">
                {INTEREST_LABELS[appointment.primary_interest] || 'Consulting'} &middot; {appointment.appointment_date} at {formatTime(appointment.appointment_start)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {callActive && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-mono text-red-400">{formatDuration(callDuration)}</span>
              </div>
            )}
            <button onClick={() => setSidePanelOpen(!sidePanelOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg transition">
              {sidePanelOpen ? <PanelRightClose className="w-4 h-4 text-gray-400" /> : <PanelRight className="w-4 h-4 text-gray-400" />}
            </button>
            <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 hover:bg-slate-800 rounded-lg transition">
              {fullscreen ? <Minimize2 className="w-4 h-4 text-gray-400" /> : <Maximize2 className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 relative flex items-center justify-center bg-slate-950">
          {!callActive ? (
            /* Pre-call lobby */
            <div className="text-center space-y-6 max-w-md mx-auto px-6">
              <div className="w-20 h-20 bg-purple-500/15 rounded-full flex items-center justify-center mx-auto">
                <Video className="w-10 h-10 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Ready to join?</h2>
                <p className="text-gray-400">
                  Call with <strong className="text-white">{appointment.lead_name}</strong>
                  {appointment.company_name && <> from <strong className="text-white">{appointment.company_name}</strong></>}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {INTEREST_LABELS[appointment.primary_interest] || 'Consulting'} &middot; 30 minutes
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={startLocalVideo}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                >
                  Start Call
                </button>
                <button
                  onClick={sendReminder}
                  disabled={sendingReminder}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                    reminderSent
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-slate-800 border border-sky-500/30 text-sky-400 hover:bg-sky-500/10'
                  }`}
                >
                  {sendingReminder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : reminderSent ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {reminderSent ? 'Reminder Sent' : 'Send Reminder'}
                </button>
                <button
                  onClick={markNoShow}
                  className="px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl font-semibold hover:bg-slate-700 transition-all text-gray-300"
                >
                  No-Show
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-xs text-gray-600">
                  Lead join link: liftori.ai/call/{roomId}
                </p>
                <button
                  onClick={copyJoinLink}
                  className="p-1 hover:bg-slate-800 rounded transition text-gray-600 hover:text-gray-400"
                  title="Copy join link"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            /* Active call */
            <>
              {/* Remote video (main) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                style={{ display: 'none' /* shown when peer connects */ }}
              />
              {/* Waiting for lead */}
              <div className="absolute inset-0 flex items-center justify-center" id="waitingOverlay">
                <div className="text-center">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-12 h-12 text-gray-500" />
                  </div>
                  <p className="text-gray-400">Waiting for {appointment.lead_name} to join...</p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <button
                      onClick={sendReminder}
                      disabled={sendingReminder}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        reminderSent
                          ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                          : 'bg-sky-500/20 border border-sky-500/30 text-sky-400 hover:bg-sky-500/30'
                      }`}
                    >
                      {sendingReminder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : reminderSent ? <CheckCircle className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                      {reminderSent ? 'Sent' : 'Send Reminder'}
                    </button>
                    <button
                      onClick={copyJoinLink}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-xs font-semibold text-gray-400 hover:text-white transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Link
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">liftori.ai/call/{roomId}</p>
                </div>
              </div>

              {/* Local video (PiP) */}
              <div className="absolute bottom-20 right-4 w-48 h-36 bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
                {!videoEnabled && (
                  <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                    <VideoOff className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Call controls */}
        {callActive && (
          <div className="flex items-center justify-center gap-3 py-3 bg-slate-900/90 border-t border-slate-800">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full transition ${audioEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
            >
              {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition ${videoEnabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
            >
              {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={endCall}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full transition flex items-center gap-2 font-semibold"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </button>
          </div>
        )}
      </div>

      {/* === SIDE PANEL === */}
      {sidePanelOpen && (
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">

          {/* Panel tabs */}
          <div className="flex border-b border-slate-800">
            {[
              { id: 'info', label: 'Lead Info', icon: User },
              { id: 'notes', label: 'Notes', icon: FileText },
              { id: 'summary', label: 'Wrap-Up', icon: CheckCircle },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidePanel(tab.id)}
                className={`flex-1 px-3 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition border-b-2 ${
                  sidePanel === tab.id
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* LEAD INFO TAB */}
            {sidePanel === 'info' && (
              <div className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-2">
                  <InfoCard icon={User} label="Name" value={appointment.lead_name} />
                  <InfoCard icon={Building2} label="Company" value={appointment.company_name || 'N/A'} />
                  <InfoCard icon={Target} label="Interest" value={INTEREST_LABELS[appointment.primary_interest] || 'General'} color="purple" />
                  <InfoCard icon={Clock} label="Size" value={appointment.company_size || 'N/A'} />
                </div>

                {/* Contact */}
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</h4>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-300">{appointment.lead_email}</p>
                    {appointment.lead_phone && <p className="text-gray-300">{appointment.lead_phone}</p>}
                    {appointment.industry && <p className="text-gray-400">Industry: {appointment.industry}</p>}
                    {appointment.how_heard && <p className="text-gray-400">Source: {appointment.how_heard}</p>}
                  </div>
                </div>

                {/* Challenge */}
                {appointment.biggest_challenge && (
                  <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3 text-orange-400" />
                      Their Challenge
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed italic">
                      "{appointment.biggest_challenge}"
                    </p>
                  </div>
                )}

                {/* CRM Status */}
                <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">CRM Status</h4>
                  {appointment.imported_to_crm ? (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      Imported to CRM
                    </div>
                  ) : (
                    <button
                      onClick={importToCRM}
                      className="w-full px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg text-sm font-semibold text-purple-400 hover:bg-purple-600/30 transition flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Import to CRM Pipeline
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* NOTES TAB */}
            {sidePanel === 'notes' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Call Notes
                  </label>
                  <textarea
                    value={callNotes}
                    onChange={e => setCallNotes(e.target.value)}
                    placeholder="Type notes as you talk — they auto-save every 5 seconds..."
                    className="w-full h-64 bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 placeholder-gray-600"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-600">
                      {saving ? 'Saving...' : 'Auto-saves every 5s'}
                    </span>
                    <button
                      onClick={() => saveNotes(false)}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      Save now
                    </button>
                  </div>
                </div>

                {/* Quick tags */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Quick Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Interested in LABOS', 'Needs custom build', 'Budget conscious', 'Ready to start', 'Wants proposal', 'Follow up next week', 'Referred by someone', 'Multiple locations'].map(tag => (
                      <button
                        key={tag}
                        onClick={() => setCallNotes(prev => prev + (prev ? '\n' : '') + '- ' + tag)}
                        className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-gray-400 hover:text-white hover:border-purple-500/30 transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* WRAP-UP TAB */}
            {sidePanel === 'summary' && (
              <div className="space-y-4">
                {/* Temperature */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Lead Temperature
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['hot', 'warm', 'cold', 'dead'].map(temp => (
                      <button
                        key={temp}
                        onClick={() => setLeadTemp(temp)}
                        className={`py-2 rounded-lg text-xs font-semibold capitalize border transition ${
                          leadTemp === temp ? TEMP_COLORS[temp] : 'bg-slate-800 border-slate-700 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {temp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estimated Value */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Estimated Value ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      value={estimatedValue}
                      onChange={e => setEstimatedValue(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Call Summary
                  </label>
                  <textarea
                    value={callSummary}
                    onChange={e => setCallSummary(e.target.value)}
                    placeholder="Brief summary of what was discussed and the outcome..."
                    className="w-full h-28 bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Follow-up */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Follow-Up Actions
                  </label>
                  <textarea
                    value={followUpActions}
                    onChange={e => setFollowUpActions(e.target.value)}
                    placeholder="- Send proposal by Friday&#10;- Schedule demo of LABOS&#10;- Connect with Jeff for pricing"
                    className="w-full h-24 bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={completeAppointment}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete & Save
                  </button>
                  {!appointment.imported_to_crm && (
                    <button
                      onClick={importToCRM}
                      className="w-full py-2.5 bg-slate-800 border border-purple-500/30 rounded-xl text-sm font-semibold text-purple-400 hover:bg-purple-600/10 transition flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Import to CRM First
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .mirror { transform: scaleX(-1); }
      `}</style>
    </div>
  );
}

// Helper: Info card component
function InfoCard({ icon: Icon, label, value, color = 'default' }) {
  const colorClasses = color === 'purple' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-slate-800/50 border-slate-700/50';
  return (
    <div className={`${colorClasses} border rounded-xl p-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-gray-500" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-sm font-medium text-gray-200 truncate">{value}</p>
    </div>
  );
}

// Helper: Format time
function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return h + ':' + m + ' ' + ampm;
}
