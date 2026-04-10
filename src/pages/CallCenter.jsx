import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchActiveCalls,
  fetchCallHistory,
  fetchTodayCallStats,
  createCall,
  updateCall,
  endCall,
  fetchCallQueue,
  createQueueItem,
  updateQueueItem,
  completeQueueItem,
  fetchSpeedToLead,
  updateSpeedToLead,
  contactLead,
  createSpeedToLead,
  fetchAgents,
  setAgentStatus as updateAgentStatusDB,
  fetchAgent,
  fetchCallCenterDashboard,
  fetchScheduledCalls,
  createScheduledCall,
  updateScheduledCall,
  cancelScheduledCall,
  completeScheduledCall,
  checkAgentAvailability,
  fetchAllAgentAvailability,
  upsertAgentAvailability,
  fetchVoicemails,
  markVoicemailRead,
  archiveVoicemail,
  sendDeclineNotification,
  fetchAgentByUserId,
} from '../lib/callCenterService';
import {
  initializeTwilioDevice,
  destroyTwilioDevice,
  makeOutboundCall,
  callExtension,
  acceptIncomingCall,
  rejectIncomingCall,
  hangupCall,
  muteCall,
  sendDigit,
  onTwilioEvent,
  isDeviceReady,
  sendSMS,
  fetchSMSHistory,
} from '../lib/twilioService';
import { playIncomingAlert, stopIncomingAlert } from '../lib/callCenterAudio';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  PhoneIncoming,
  Phone,
  Activity,
  CheckCircle,
  PhoneMissed,
  Timer,
  Zap,
  Calendar,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Plus,
  MoreVertical,
  Settings,
  AlertCircle as Alert,
  Video,
  Mail,
  Copy,
  Loader2,
  ExternalLink,
  Users,
  Circle,
  CalendarPlus,
  Voicemail,
  Play,
  Archive,
  UserCheck,
  Ban,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  X,
} from 'lucide-react';
import { createOutboundRallyLink, sendCallReminderEmail } from '../lib/videoCallHelpers';

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${diffHours}h ago`;
}

function getStatusColor(status) {
  const colors = {
    ringing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    in_progress: 'bg-green-500/10 text-green-400 border-green-500/30',
    on_hold: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    completed: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    missed: 'bg-red-500/10 text-red-400 border-red-500/30',
    new: 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse',
    attempting: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    contacted: 'bg-green-500/10 text-green-400 border-green-500/30',
    no_answer: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
}

function getPriorityColor(priority) {
  const colors = {
    urgent: 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    normal: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    low: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  return colors[priority] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
}

// ═══════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, icon, color = 'text-sky-400' }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-2 text-white`}>{value}</p>
        </div>
        <div className={`${color} opacity-50`}>{icon}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT ROSTER PANEL
// ═══════════════════════════════════════════════════════════════

function AgentRosterPanel() {
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const fetchAllAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('cc_agents')
        .select('*, profile:profiles!cc_agents_user_id_fkey(id, full_name, avatar_url, email, role)')
        .order('status');
      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    fetchAllAgents();

    // Real-time subscription for agent status changes
    const channel = supabase
      .channel('agent-roster')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cc_agents',
      }, () => {
        fetchAllAgents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const available = agents.filter(a => a.status === 'available');
  const busy = agents.filter(a => a.status === 'on_call' || a.status === 'busy');
  const offline = agents.filter(a => a.status === 'offline' || (!['available', 'on_call', 'busy'].includes(a.status)));

  const getStatusDot = (status) => {
    if (status === 'available') return 'text-green-400';
    if (status === 'on_call' || status === 'busy') return 'text-yellow-400';
    return 'text-gray-500';
  };

  const getStatusLabel = (status) => {
    if (status === 'available') return 'Available';
    if (status === 'on_call') return 'On Call';
    if (status === 'busy') return 'Busy';
    return 'Offline';
  };

  const AgentPill = ({ agent }) => {
    const name = agent.profile?.full_name || agent.display_name || 'Unknown';
    const avatar = agent.profile?.avatar_url;
    const role = agent.profile?.role;
    const roleLabel = role === 'super_admin' ? 'Admin' : role === 'sales_director' ? 'Sales Dir.' : role === 'call_agent' ? 'Agent' : role || '';

    return (
      <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
        {avatar ? (
          <img src={avatar} alt={name} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs text-gray-300 font-bold">
            {name.charAt(0)}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-white text-sm font-medium truncate">{name}</span>
          {roleLabel && <span className="text-gray-500 text-[10px] leading-tight">{roleLabel}</span>}
        </div>
        <Circle size={8} className={`${getStatusDot(agent.status)} fill-current ml-auto flex-shrink-0`} />
      </div>
    );
  };

  if (loadingAgents) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <Users size={18} className="text-sky-400" />
        <h3 className="text-white font-semibold text-sm">Agent Roster</h3>
        <div className="flex items-center gap-2 ml-auto">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
            {available.length} Active
          </Badge>
          {busy.length > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
              {busy.length} Busy
            </Badge>
          )}
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">
            {offline.length} Offline
          </Badge>
        </div>
      </div>

      {agents.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-2">No agents registered</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {/* Available agents first, then busy, then offline */}
          {[...available, ...busy, ...offline].map((agent) => (
            <AgentPill key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ACTIVE CALL PANEL
// ═══════════════════════════════════════════════════════════════

function ActiveCallPanel({ call, onEnd, onUpdateCall }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [notes, setNotes] = useState(call?.notes || '');
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [disposition, setDisposition] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (call?.started_at) {
      const startTime = new Date(call.started_at);
      intervalRef.current = setInterval(() => {
        const now = new Date();
        setElapsedSeconds(Math.floor((now - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [call?.started_at]);

  const handleEndCall = async () => {
    if (!disposition) {
      toast.error('Please select a disposition');
      return;
    }
    try {
      await endCall(call.id, disposition, notes);
      toast.success('Call ended');
      setShowEndDialog(false);
      onEnd();
    } catch (err) {
      toast.error('Failed to end call');
    }
  };

  const handleUpdateNotes = async () => {
    try {
      await updateCall(call.id, { notes });
      toast.success('Notes saved');
    } catch (err) {
      toast.error('Failed to save notes');
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center">
              <PhoneIncoming className="text-sky-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{call?.caller_name || 'Unknown'}</h3>
              <p className="text-gray-400 text-sm">{call?.caller_number || 'No number'}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{formatDuration(elapsedSeconds)}</p>
          <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
            {call?.status || 'in_progress'}
          </Badge>
        </div>
      </div>

      {call?.department && (
        <div>
          <p className="text-gray-400 text-sm">Department</p>
          <Badge className="mt-1 bg-purple-500/20 text-purple-400 border-purple-500/30">
            {call.department}
          </Badge>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => setIsOnHold(!isOnHold)}
          variant={isOnHold ? 'default' : 'outline'}
          className="flex items-center gap-2"
        >
          <Pause size={16} />
          {isOnHold ? 'Resume' : 'Hold'}
        </Button>
        <Button
          onClick={() => {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            muteCall(newMuted);
          }}
          variant={isMuted ? 'default' : 'outline'}
          className="flex items-center gap-2"
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <ArrowUpRight size={16} />
          Transfer
        </Button>
        <Button
          onClick={() => setShowEndDialog(true)}
          variant="destructive"
          className="flex items-center gap-2 ml-auto"
        >
          <PhoneOff size={16} />
          End Call
        </Button>
      </div>

      <div>
        <label className="text-gray-400 text-sm font-medium block mb-2">Call Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes during the call..."
          className="bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 min-h-24"
        />
        <Button
          onClick={handleUpdateNotes}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          Save Notes
        </Button>
      </div>

      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">End Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-2">Disposition</label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              >
                <option value="">— Select disposition —</option>
                <option value="qualified">Qualified Lead</option>
                <option value="not_interested">Not Interested</option>
                <option value="callback">Callback</option>
                <option value="voicemail">Voicemail</option>
                <option value="wrong_number">Wrong Number</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowEndDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEndCall}
              variant="destructive"
            >
              End Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// INCOMING CALLS LIST
// ═══════════════════════════════════════════════════════════════

function IncomingCallsList({ calls, onAccept, onReject, onVideoCall, creatingVideoCall }) {
  if (calls.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
        <PhoneIncoming className="mx-auto text-gray-500 mb-3" size={32} />
        <p className="text-gray-400">No incoming calls — you're all caught up</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <div
          key={call.id}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <PhoneIncoming className="text-blue-400" size={16} />
              </div>
              <div>
                <h4 className="text-white font-semibold">{call.caller_name || 'Unknown'}</h4>
                <p className="text-gray-400 text-sm">{call.caller_number}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {call.department && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                {call.department}
              </Badge>
            )}
            <Button
              onClick={() => onAccept(call)}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              Accept
            </Button>
            <Button
              onClick={() => onVideoCall(call)}
              disabled={creatingVideoCall === call.id}
              size="sm"
              variant="outline"
              className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
            >
              {creatingVideoCall === call.id ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
            </Button>
            <Button
              onClick={() => onReject(call)}
              variant="destructive"
              size="sm"
            >
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPEED TO LEAD SECTION
// ═══════════════════════════════════════════════════════════════

function SpeedToLeadSection({ leads, onCallNow, onVideoCall, onMarkContacted, onAddLead, creatingVideoCall }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLead, setNewLead] = useState({
    lead_name: '',
    phone_number: '',
    source: '',
  });

  const handleAddLead = async () => {
    if (!newLead.lead_name || !newLead.phone_number) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      await onAddLead(newLead);
      setNewLead({ lead_name: '', phone_number: '', source: '' });
      setShowAddDialog(false);
      toast.success('Lead added');
    } catch (err) {
      toast.error('Failed to add lead');
    }
  };

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="text-yellow-400" size={20} />
            <div>
              <h2 className="text-white text-lg font-bold">Speed to Lead</h2>
              <p className="text-gray-400 text-sm">Respond quickly to new prospects</p>
            </div>
          </div>
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            {leads.filter(l => l.status === 'new').length} New
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Lead Name</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Phone</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Source</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Received</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Status</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    No leads to contact
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-700 hover:bg-slate-700/20">
                    <td className="px-6 py-4 text-white font-medium">{lead.lead_name}</td>
                    <td className="px-6 py-4 text-gray-300">{lead.phone_number}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{lead.source || '—'}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {formatTimeAgo(lead.received_at)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={getStatusColor(lead.status)}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      <Button
                        onClick={() => onCallNow(lead)}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        Call Now
                      </Button>
                      <Button
                        onClick={() => onVideoCall(lead)}
                        disabled={creatingVideoCall === lead.id}
                        size="sm"
                        variant="outline"
                        className="text-xs text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                      >
                        {creatingVideoCall === lead.id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Video size={12} className="mr-1" />}
                        Video
                      </Button>
                      <Button
                        onClick={() => onMarkContacted(lead)}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        Mark Done
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-slate-700">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Add Lead
          </Button>
        </div>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-2">Lead Name</label>
              <Input
                value={newLead.lead_name}
                onChange={(e) => setNewLead({ ...newLead, lead_name: e.target.value })}
                placeholder="John Smith"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-2">Phone Number</label>
              <Input
                value={newLead.phone_number}
                onChange={(e) => setNewLead({ ...newLead, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-2">Source (optional)</label>
              <Input
                value={newLead.source}
                onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                placeholder="Web Form, Direct Call, etc."
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowAddDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddLead}
              className="bg-sky-600 hover:bg-sky-700"
            >
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALL QUEUE SECTION
// ═══════════════════════════════════════════════════════════════

function CallQueueSection({ queueItems, onCallNow, onVideoCall, onComplete, onReschedule, creatingVideoCall }) {
  const [activeTab, setActiveTab] = useState('all');
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newScheduleTime, setNewScheduleTime] = useState('');

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'callback', label: 'Callbacks' },
    { id: 'follow_up', label: 'Follow-Ups' },
    { id: 'scheduled', label: 'Scheduled' },
  ];

  const filteredItems = activeTab === 'all'
    ? queueItems
    : queueItems.filter(item => item.queue_type === activeTab);

  const handleReschedule = async () => {
    if (!newScheduleTime) {
      toast.error('Please select a time');
      return;
    }
    try {
      await onReschedule(selectedItem.id, newScheduleTime);
      setShowRescheduleDialog(false);
      setSelectedItem(null);
      setNewScheduleTime('');
      toast.success('Call rescheduled');
    } catch (err) {
      toast.error('Failed to reschedule');
    }
  };

  return (
    <>
      <Card className="bg-slate-800/50 border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-sky-400" size={20} />
            <div>
              <h2 className="text-white text-lg font-bold">Call Queue</h2>
              <p className="text-gray-400 text-sm">Scheduled calls and callbacks</p>
            </div>
          </div>
          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30">
            {queueItems.length} Items
          </Badge>
        </div>

        <div className="flex gap-4 px-6 pt-4 border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Contact</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Phone</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Type</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Scheduled</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Priority</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Attempts</th>
                <th className="text-left px-6 py-3 text-gray-400 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                    No items in this queue
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isUrgent = item.priority === 'urgent';
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-700 hover:bg-slate-700/20 ${
                        isUrgent ? 'border-l-4 border-l-red-500' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-white font-medium">{item.contact_name}</td>
                      <td className="px-6 py-4 text-gray-300">{item.phone_number}</td>
                      <td className="px-6 py-4">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                          {item.queue_type?.replace('_', ' ') || 'Call'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {item.scheduled_at
                          ? new Date(item.scheduled_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getPriorityColor(item.priority)}>
                          {item.priority}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{item.attempt_count || 0}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <Button
                          onClick={() => onCallNow(item)}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          Call Now
                        </Button>
                        <Button
                          onClick={() => onVideoCall(item)}
                          disabled={creatingVideoCall === item.id}
                          size="sm"
                          variant="outline"
                          className="text-xs text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                        >
                          {creatingVideoCall === item.id ? <Loader2 size={12} className="animate-spin mr-1" /> : <Video size={12} className="mr-1" />}
                          Video
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowRescheduleDialog(true);
                          }}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          Reschedule
                        </Button>
                        <Button
                          onClick={() => onComplete(item)}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                        >
                          Complete
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reschedule Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-gray-400 text-sm mb-3">
                {selectedItem?.contact_name} • {selectedItem?.phone_number}
              </p>
              <label className="text-gray-400 text-sm font-medium block mb-2">New Date & Time</label>
              <Input
                type="datetime-local"
                value={newScheduleTime}
                onChange={(e) => setNewScheduleTime(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowRescheduleDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              className="bg-sky-600 hover:bg-sky-700"
            >
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULED CALLS — Leadership assigns calls to agents
// ═══════════════════════════════════════════════════════════════

function ScheduledCallsSection({ userId }) {
  const [calls, setCalls] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [checking, setChecking] = useState(false);
  const [availResult, setAvailResult] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [form, setForm] = useState({
    assigned_to: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    purpose: '',
    notes: '',
    scheduled_at: '',
    duration_minutes: 30,
    priority: 'normal',
  });

  const loadData = async () => {
    try {
      const [sc, ag] = await Promise.all([
        fetchScheduledCalls({}),
        fetchAgents(),
      ]);
      setCalls(sc);
      setAgents(ag);
    } catch (err) {
      console.error('Error loading scheduled calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCheckAvailability = async () => {
    if (!form.assigned_to || !form.scheduled_at) {
      toast.error('Select an agent and time first');
      return;
    }
    setChecking(true);
    try {
      const available = await checkAgentAvailability(
        form.assigned_to,
        new Date(form.scheduled_at).toISOString(),
        form.duration_minutes
      );
      setAvailResult(available);
      if (available) {
        toast.success('Agent is available for this time slot');
      } else {
        toast.error('Agent is NOT available — conflict or outside hours');
      }
    } catch (err) {
      toast.error('Could not check availability');
    } finally {
      setChecking(false);
    }
  };

  const handleAssign = async () => {
    if (!form.assigned_to || !form.contact_name || !form.contact_phone || !form.scheduled_at) {
      toast.error('Fill in agent, contact name, phone, and scheduled time');
      return;
    }
    try {
      await createScheduledCall({
        ...form,
        assigned_by: userId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      });
      toast.success('Call scheduled and assigned');
      setShowAssign(false);
      setForm({ assigned_to: '', contact_name: '', contact_phone: '', contact_email: '', purpose: '', notes: '', scheduled_at: '', duration_minutes: 30, priority: 'normal' });
      setAvailResult(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to schedule call');
    }
  };

  const handleComplete = async (id) => {
    try {
      await completeScheduledCall(id, '');
      toast.success('Call marked complete');
      await loadData();
    } catch (err) {
      toast.error('Failed to complete');
    }
  };

  const handleCancel = async (id) => {
    try {
      await cancelScheduledCall(id);
      toast.success('Call cancelled');
      await loadData();
    } catch (err) {
      toast.error('Failed to cancel');
    }
  };

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatScheduledTime = (iso) => {
    const d = new Date(iso);
    return `${DAY_LABELS[d.getDay()]} ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <div
        className="p-6 border-b border-slate-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <CalendarPlus className="text-sky-400" size={20} />
          <div>
            <h2 className="text-white text-lg font-bold">Scheduled Calls</h2>
            <p className="text-gray-400 text-sm">Assign and schedule calls to agents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30">
            {calls.length} Scheduled
          </Badge>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <>
          <div className="p-4 border-b border-slate-700">
            <Button onClick={() => setShowAssign(true)} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700">
              <CalendarPlus size={16} />
              Assign New Call
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Contact</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Phone</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Assigned To</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Scheduled</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Duration</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Priority</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Purpose</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : calls.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-400">No scheduled calls</td></tr>
                ) : calls.map((c) => (
                  <tr key={c.id} className="border-b border-slate-700 hover:bg-slate-700/20">
                    <td className="px-6 py-4 text-white font-medium">{c.contact_name}</td>
                    <td className="px-6 py-4 text-gray-300">{c.contact_phone}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {c.assigned_to_profile?.avatar_url ? (
                          <img src={c.assigned_to_profile.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs text-gray-300">
                            {(c.assigned_to_profile?.full_name || '?').charAt(0)}
                          </div>
                        )}
                        <span className="text-gray-300 text-sm">{c.assigned_to_profile?.full_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-xs">{formatScheduledTime(c.scheduled_at)}</td>
                    <td className="px-6 py-4 text-gray-400">{c.duration_minutes}m</td>
                    <td className="px-6 py-4">
                      <Badge className={getPriorityColor(c.priority)}>{c.priority}</Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs max-w-[150px] truncate">{c.purpose || '—'}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <Button onClick={() => handleComplete(c.id)} size="sm" variant="outline" className="text-xs text-green-400 border-green-500/30 hover:bg-green-500/10">
                        <CheckCircle size={12} className="mr-1" /> Done
                      </Button>
                      <Button onClick={() => handleCancel(c.id)} size="sm" variant="outline" className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10">
                        <Ban size={12} className="mr-1" /> Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Assign Call Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Assign & Schedule Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1">Assign To Agent</label>
              <select
                value={form.assigned_to}
                onChange={(e) => { setForm({ ...form, assigned_to: e.target.value }); setAvailResult(null); }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
              >
                <option value="">— Select agent —</option>
                {agents.map(a => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.profile?.full_name || a.display_name || a.user_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm font-medium block mb-1">Contact Name</label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="John Smith" className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <label className="text-gray-400 text-sm font-medium block mb-1">Phone Number</label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+1 (555) 123-4567" className="bg-slate-800 border-slate-600 text-white" />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1">Email (optional)</label>
              <Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="john@example.com" className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-sm font-medium block mb-1">Scheduled Date & Time</label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => { setForm({ ...form, scheduled_at: e.target.value }); setAvailResult(null); }} className="bg-slate-800 border-slate-600 text-white" />
              </div>
              <div>
                <label className="text-gray-400 text-sm font-medium block mb-1">Duration (min)</label>
                <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1">Purpose</label>
              <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Follow-up demo, Sales call, etc." className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1">Notes</label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional context for the agent..." className="bg-slate-800 border-slate-600 text-white" rows={2} />
            </div>

            {/* Availability Check */}
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleCheckAvailability} disabled={checking || !form.assigned_to || !form.scheduled_at} variant="outline" size="sm" className="text-xs">
                {checking ? <Loader2 size={12} className="animate-spin mr-1" /> : <UserCheck size={12} className="mr-1" />}
                Check Availability
              </Button>
              {availResult === true && <span className="text-green-400 text-xs font-medium">Available</span>}
              {availResult === false && <span className="text-red-400 text-xs font-medium">Not Available — conflict or outside hours</span>}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAssign(false)} variant="outline">Cancel</Button>
            <Button onClick={handleAssign} className="bg-sky-600 hover:bg-sky-700">Assign Call</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT AVAILABILITY GRID — Weekly hours per agent
// ═══════════════════════════════════════════════════════════════

function AgentAvailabilitySection() {
  const [availability, setAvailability] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ start_time: '08:00', end_time: '18:00', is_available: true });

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    const load = async () => {
      try {
        const [avail, ag] = await Promise.all([
          fetchAllAgentAvailability(),
          fetchAgents(),
        ]);
        setAvailability(avail);
        setAgents(ag);
      } catch (err) {
        console.error('Error loading availability:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!editing) return;
    try {
      await upsertAgentAvailability(
        editing.agent_user_id,
        editing.day_of_week,
        editForm.start_time,
        editForm.end_time,
        editForm.is_available
      );
      toast.success('Availability updated');
      setEditing(null);
      const avail = await fetchAllAgentAvailability();
      setAvailability(avail);
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  // Group availability by agent
  const agentMap = new Map();
  for (const a of agents) {
    agentMap.set(a.user_id, {
      name: a.profile?.full_name || a.display_name || 'Unknown',
      avatar: a.profile?.avatar_url,
      role: a.profile?.role,
      slots: [],
    });
  }
  for (const slot of availability) {
    const agent = agentMap.get(slot.agent_user_id);
    if (agent) agent.slots.push(slot);
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <div
        className="p-6 border-b border-slate-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Clock className="text-emerald-400" size={20} />
          <div>
            <h2 className="text-white text-lg font-bold">Agent Availability</h2>
            <p className="text-gray-400 text-sm">Weekly hours — 8am to 6pm ET default</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </div>

      {expanded && (
        <div className="p-4 overflow-x-auto">
          {loading ? (
            <p className="text-gray-400 text-center py-6">Loading availability...</p>
          ) : agents.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No agents registered</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2 text-gray-400 font-semibold">Agent</th>
                  {DAY_NAMES.map(d => (
                    <th key={d} className="text-center px-2 py-2 text-gray-400 font-semibold">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...agentMap.entries()].map(([uid, agent]) => (
                  <tr key={uid} className="border-b border-slate-700">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {agent.avatar ? (
                          <img src={agent.avatar} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs text-gray-300">{agent.name.charAt(0)}</div>
                        )}
                        <span className="text-white text-sm">{agent.name}</span>
                      </div>
                    </td>
                    {DAY_NAMES.map((_, dayIdx) => {
                      const slot = agent.slots.find(s => s.day_of_week === dayIdx);
                      const isOn = slot ? slot.is_available : (dayIdx >= 1 && dayIdx <= 5);
                      const timeStr = slot ? `${slot.start_time?.slice(0,5)}-${slot.end_time?.slice(0,5)}` : '08:00-18:00';
                      return (
                        <td key={dayIdx} className="text-center px-1 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing({ agent_user_id: uid, day_of_week: dayIdx, agentName: agent.name, dayName: DAY_NAMES[dayIdx] });
                              setEditForm({
                                start_time: slot?.start_time?.slice(0,5) || '08:00',
                                end_time: slot?.end_time?.slice(0,5) || '18:00',
                                is_available: isOn,
                              });
                            }}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              isOn
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                                : 'bg-gray-700/30 text-gray-500 border border-gray-700 hover:bg-gray-700/50'
                            }`}
                          >
                            {isOn ? timeStr : 'Off'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Slot Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing?.agentName} — {editing?.dayName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-gray-400 text-sm">Available</label>
              <button
                onClick={() => setEditForm({ ...editForm, is_available: !editForm.is_available })}
                className={`w-10 h-6 rounded-full transition-colors relative ${editForm.is_available ? 'bg-emerald-500' : 'bg-gray-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${editForm.is_available ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            {editForm.is_available && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Start</label>
                  <Input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} className="bg-slate-800 border-slate-600 text-white" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm block mb-1">End</label>
                  <Input type="time" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} className="bg-slate-800 border-slate-600 text-white" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setEditing(null)} variant="outline">Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// VOICEMAIL INBOX
// ═══════════════════════════════════════════════════════════════

function VoicemailInbox({ userId }) {
  const [voicemails, setVoicemails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all');
  const [playingId, setPlayingId] = useState(null);

  const loadVoicemails = async () => {
    try {
      const statusFilter = filter === 'all' ? undefined : filter;
      const vms = await fetchVoicemails({ status: statusFilter === 'all' ? undefined : statusFilter });
      setVoicemails(vms);
    } catch (err) {
      console.error('Error loading voicemails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVoicemails(); }, [filter]);

  const handleMarkRead = async (vm) => {
    try {
      await markVoicemailRead(vm.id, userId);
      await loadVoicemails();
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const handleArchive = async (vm) => {
    try {
      await archiveVoicemail(vm.id);
      toast.success('Voicemail archived');
      await loadVoicemails();
    } catch (err) {
      toast.error('Failed to archive');
    }
  };

  const unreadCount = voicemails.filter(v => v.status === 'new').length;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <div
        className="p-6 border-b border-slate-700 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Voicemail className="text-purple-400" size={20} />
          <div>
            <h2 className="text-white text-lg font-bold">Voicemail</h2>
            <p className="text-gray-400 text-sm">Messages from callers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
              {unreadCount} New
            </Badge>
          )}
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            {voicemails.length} Total
          </Badge>
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <>
          <div className="flex gap-2 px-6 pt-4 pb-2">
            {['all', 'new', 'read', 'returned', 'archived'].map(f => (
              <button
                key={f}
                onClick={(e) => { e.stopPropagation(); setFilter(f); }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-gray-400 hover:text-gray-300 border border-transparent'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-2">
            {loading ? (
              <p className="text-gray-400 text-center py-6">Loading voicemails...</p>
            ) : voicemails.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No voicemails</p>
            ) : voicemails.map((vm) => (
              <div
                key={vm.id}
                className={`border rounded-lg p-4 transition-colors ${
                  vm.status === 'new'
                    ? 'bg-purple-900/20 border-purple-500/30'
                    : 'bg-slate-800/40 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{vm.caller_name || vm.caller_number}</span>
                      {vm.caller_name && <span className="text-gray-500 text-xs">{vm.caller_number}</span>}
                      <Badge className={`text-[10px] ${
                        vm.target_type === 'department' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        vm.target_type === 'agent' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}>
                        {vm.target_type === 'department' ? (vm.target_department || 'Dept') : vm.target_type}
                      </Badge>
                      {vm.status === 'new' && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                    </div>
                    {vm.transcription && (
                      <p className="text-gray-400 text-sm line-clamp-2 mb-2">{vm.transcription}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{new Date(vm.created_at).toLocaleString()}</span>
                      <span>{vm.recording_duration}s</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {vm.recording_url && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (playingId === vm.id) {
                            setPlayingId(null);
                          } else {
                            setPlayingId(vm.id);
                            if (vm.status === 'new') handleMarkRead(vm);
                          }
                        }}
                        size="sm"
                        variant="outline"
                        className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                      >
                        <Play size={14} />
                      </Button>
                    )}
                    {vm.status === 'new' && (
                      <Button onClick={(e) => { e.stopPropagation(); handleMarkRead(vm); }} size="sm" variant="outline" className="text-xs">
                        <CheckCircle size={12} className="mr-1" /> Read
                      </Button>
                    )}
                    <Button onClick={(e) => { e.stopPropagation(); handleArchive(vm); }} size="sm" variant="outline" className="text-xs text-gray-400">
                      <Archive size={12} />
                    </Button>
                  </div>
                </div>
                {playingId === vm.id && vm.recording_url && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <audio controls autoPlay src={vm.recording_url} className="w-full h-8" onEnded={() => setPlayingId(null)}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHONE DIALER MODAL
// ═══════════════════════════════════════════════════════════════

function PhoneDialerModal({ open, onOpenChange, onCall, onCallExtension, twilioReady }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tab, setTab] = useState('dialer'); // 'dialer' | 'team'
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (open && tab === 'team' && teamMembers.length === 0) {
      loadTeam();
    }
  }, [open, tab]);

  const loadTeam = async () => {
    setLoadingTeam(true);
    try {
      const agents = await fetchAgents();
      setTeamMembers(agents);
    } catch (err) {
      console.error('Error loading team:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleDialerClick = (digit) => {
    setPhoneNumber(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (!phoneNumber) {
      toast.error('Enter a phone number');
      return;
    }
    onCall(phoneNumber);
    setPhoneNumber('');
    onOpenChange(false);
  };

  const handleCallTeamMember = (agent) => {
    const identity = agent.twilio_client_identity || `agent_${agent.user_id}`;
    if (onCallExtension) {
      onCallExtension(identity, agent.profile?.full_name || agent.display_name || 'Team Member');
    }
    onOpenChange(false);
  };

  const getTeamStatusColor = (status) => {
    if (status === 'available') return 'bg-green-400';
    if (status === 'on_call' || status === 'busy') return 'bg-yellow-400';
    return 'bg-gray-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Phone</DialogTitle>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-700 mb-2">
          <button
            onClick={() => setTab('dialer')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'dialer' ? 'border-sky-500 text-sky-400' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Phone size={14} className="inline mr-1" /> Dialer
          </button>
          <button
            onClick={() => { setTab('team'); if (teamMembers.length === 0) loadTeam(); }}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'team' ? 'border-sky-500 text-sky-400' : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <Users size={14} className="inline mr-1" /> Team
          </button>
        </div>

        {tab === 'dialer' && (
          <div className="space-y-4">
            <Input
              type="tel"
              value={phoneNumber}
              placeholder="Enter number..."
              className="bg-slate-800 border-slate-600 text-white text-center text-lg font-mono"
              readOnly
            />

            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handleDialerClick(String(num))}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleDialerClick('*')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded"
              >
                *
              </button>
              <button
                onClick={() => handleDialerClick('0')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded"
              >
                0
              </button>
              <button
                onClick={() => handleDialerClick('#')}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3 rounded"
              >
                #
              </button>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleBackspace} variant="outline" className="flex-1">
                Backspace
              </Button>
              <Button
                onClick={handleCall}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
              >
                <Phone size={16} />
                Call
              </Button>
            </div>
          </div>
        )}

        {tab === 'team' && (
          <div className="space-y-2">
            {!twilioReady && (
              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-xs mb-2">
                Go Active first to make internal calls
              </div>
            )}
            {loadingTeam ? (
              <p className="text-gray-400 text-center py-6">Loading team...</p>
            ) : teamMembers.length === 0 ? (
              <p className="text-gray-400 text-center py-6">No team members found</p>
            ) : (
              teamMembers.map((agent) => {
                const name = agent.profile?.full_name || agent.display_name || 'Unknown';
                const avatar = agent.profile?.avatar_url;
                const role = agent.profile?.role;
                const roleLabel = role === 'super_admin' ? 'Admin' : role === 'sales_director' ? 'Sales Director' : role === 'call_agent' ? 'Call Agent' : role || '';
                const isOnline = agent.status === 'available' || agent.status === 'on_call' || agent.status === 'busy';

                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-lg p-3 hover:bg-slate-700/40 transition-colors"
                  >
                    <div className="relative">
                      {avatar ? (
                        <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-sm text-gray-300 font-bold">
                          {name.charAt(0)}
                        </div>
                      )}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${getTeamStatusColor(agent.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{name}</p>
                      <p className="text-gray-500 text-xs">{roleLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                        {agent.status === 'available' ? 'Available' : agent.status === 'on_call' ? 'On Call' : agent.status === 'busy' ? 'Busy' : 'Offline'}
                      </span>
                      <Button
                        onClick={() => handleCallTeamMember(agent)}
                        disabled={!twilioReady || !isOnline}
                        size="sm"
                        className={`${
                          twilioReady && isOnline
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Phone size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// VIDEO CALL LINK DIALOG
// ═══════════════════════════════════════════════════════════════

function VideoCallLinkDialog({ open, onOpenChange, rallyLink, leadName, leadEmail, onSendEmail }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendEmail = async () => {
    if (!leadEmail) {
      toast.error('No email address for this lead');
      return;
    }
    setSending(true);
    try {
      await onSendEmail();
      setSent(true);
      toast.success(`Video link sent to ${leadName}`);
    } catch (err) {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(rallyLink?.joinUrl || '');
    toast.success('Video link copied');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Video size={18} className="text-purple-400" />
            Video Call — {leadName || 'Lead'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            A video call link has been created. Share it with the lead so they can join.
          </p>

          {/* Link display */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-2">
            <code className="text-sm text-sky-400 truncate flex-1">
              {rallyLink?.joinUrl || 'Generating...'}
            </code>
            <Button onClick={copyLink} variant="outline" size="sm" className="shrink-0">
              <Copy size={14} />
            </Button>
          </div>

          {/* Email option */}
          {leadEmail && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-400">Send to: <span className="text-gray-300">{leadEmail}</span></p>
              <Button
                onClick={handleSendEmail}
                disabled={sending || sent}
                className={`w-full flex items-center justify-center gap-2 ${
                  sent ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-sky-600 hover:bg-sky-700'
                }`}
                size="sm"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : sent ? <CheckCircle size={14} /> : <Mail size={14} />}
                {sent ? 'Email Sent' : 'Send Video Link via Email'}
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-600 text-center">
            When the lead joins, you will receive an incoming call notification
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CallCenter() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState('offline');
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [stats, setStats] = useState({
    inbound_calls_today: 0,
    outbound_calls_today: 0,
    active_right_now: 0,
    completed_today: 0,
    missed_calls: 0,
    avg_duration: 0,
  });
  const [speedToLeads, setSpeedToLeads] = useState([]);
  const [queueItems, setQueueItems] = useState([]);
  const [showDialer, setShowDialer] = useState(false);
  const [showTestCall, setShowTestCall] = useState(false);

  // Video call outbound state
  const [showVideoLink, setShowVideoLink] = useState(false);
  const [activeRallyLink, setActiveRallyLink] = useState(null);
  const [videoCallLead, setVideoCallLead] = useState({ name: '', email: '' });
  const [creatingVideoCall, setCreatingVideoCall] = useState(null); // lead id being processed

  // Twilio state
  const [twilioReady, setTwilioReady] = useState(false);
  const [twilioIdentity, setTwilioIdentity] = useState(null);
  const [twilioIncoming, setTwilioIncoming] = useState(null); // raw Twilio incoming call object
  const [smsMessages, setSmsMessages] = useState([]);
  const [showSmsPanel, setShowSmsPanel] = useState(false);
  const [smsTo, setSmsTo] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const twilioCleanupRef = useRef([]);

  const pollIntervalRef = useRef(null);
  const stlIntervalRef = useRef(null);

  // Initialize agent on mount
  useEffect(() => {
    const initializeAgent = async () => {
      try {
        if (!user) return;

        // Create/fetch agent record
        const existingAgent = await fetchAgent(user.id);
        if (!existingAgent) {
          await updateAgentStatusDB(user.id, 'offline');
        } else {
          setAgentStatus(existingAgent.status);
        }

        // Load initial data
        await loadDashboardData();
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize agent:', err);
        toast.error('Failed to load dashboard');
        setLoading(false);
      }
    };

    initializeAgent();
    return () => {
      destroyTwilioDevice();
    };
  }, [user]);

  // Initialize / destroy Twilio device when agent goes active/offline
  useEffect(() => {
    if (agentStatus === 'available' && !twilioReady) {
      initializeTwilioDevice()
        .then(({ identity }) => {
          setTwilioIdentity(identity);
          console.log('[CallCenter] Twilio device ready, identity:', identity);
        })
        .catch(err => {
          console.error('[CallCenter] Twilio init failed:', err);
          toast.error('Voice connection failed — calls may not ring in browser');
        });

      // Subscribe to Twilio events
      const unsubs = [
        onTwilioEvent('ready', () => {
          setTwilioReady(true);
          toast.success('Phone line connected');
        }),
        onTwilioEvent('incoming', ({ from, call, isInternal, callerUserId, callerName, callerAvatar }) => {
          setTwilioIncoming({ from, call, isInternal, callerUserId, callerName, callerAvatar });
          const displayName = callerName || from;
          toast(isInternal ? `Team call from ${displayName}` : `Incoming call from ${displayName}`, { duration: 15000 });
          playIncomingAlert();
        }),
        onTwilioEvent('accepted', () => {
          setTwilioIncoming(null);
          stopIncomingAlert();
        }),
        onTwilioEvent('disconnected', () => {
          setActiveCall(null);
          setTwilioIncoming(null);
          stopIncomingAlert();
          loadDashboardData();
        }),
        onTwilioEvent('cancelled', () => {
          setTwilioIncoming(null);
          stopIncomingAlert();
          toast('Caller hung up');
        }),
        onTwilioEvent('callEnded', () => {
          setActiveCall(null);
          loadDashboardData();
        }),
        onTwilioEvent('error', ({ error }) => {
          toast.error('Phone error: ' + error);
        }),
      ];
      twilioCleanupRef.current = unsubs;
    }

    if (agentStatus === 'offline') {
      // Clean up event listeners FIRST to prevent state updates during teardown
      twilioCleanupRef.current.forEach(unsub => { try { unsub(); } catch(e) {} });
      twilioCleanupRef.current = [];
      destroyTwilioDevice();
      stopIncomingAlert();
      setTwilioReady(false);
      setTwilioIdentity(null);
      setTwilioIncoming(null);
    }
  }, [agentStatus]);

  // Poll for incoming calls
  useEffect(() => {
    if (agentStatus !== 'available') return;

    const pollCalls = async () => {
      try {
        const calls = await fetchActiveCalls();
        const ringing = calls.filter(c => c.status === 'ringing');
        setIncomingCalls(ringing);

        // If no active call and there are incoming, keep polling
        if (!activeCall && ringing.length > 0) {
          // Auto-show first ringing call
          if (incomingCalls.length === 0 && ringing.length > 0) {
            toast('Incoming call from ' + (ringing[0].caller_name || ringing[0].caller_number));
          }
        }
      } catch (err) {
        console.error('Error polling calls:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollCalls, 5000);
    return () => clearInterval(pollIntervalRef.current);
  }, [agentStatus, activeCall, incomingCalls.length]);

  // Poll for speed to lead updates
  useEffect(() => {
    const pollSpeedToLead = async () => {
      try {
        const leads = await fetchSpeedToLead('all');
        setSpeedToLeads(leads);
      } catch (err) {
        console.error('Error polling speed to lead:', err);
      }
    };

    stlIntervalRef.current = setInterval(pollSpeedToLead, 10000);
    return () => clearInterval(stlIntervalRef.current);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [callStats, queue, stl] = await Promise.all([
        fetchTodayCallStats(user?.id),
        fetchCallQueue({}),
        fetchSpeedToLead('all'),
      ]);

      setStats({
        inbound_calls_today: callStats.inbound_calls,
        outbound_calls_today: callStats.outbound_calls,
        active_right_now: 0,
        completed_today: callStats.completed_calls,
        missed_calls: callStats.missed_calls,
        avg_duration: callStats.avg_duration,
      });

      setQueueItems(queue);
      setSpeedToLeads(stl);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const newStatus = agentStatus === 'offline' ? 'available' : 'offline';
      await updateAgentStatusDB(user.id, newStatus);
      setAgentStatus(newStatus);
      toast.success(newStatus === 'available' ? 'You are now available' : 'You are now offline');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleAcceptCall = async (call) => {
    try {
      stopIncomingAlert();
      // If this is a real Twilio incoming call, accept via SDK
      if (twilioIncoming?.call) {
        acceptIncomingCall();
        setActiveCall({ ...call, isTwilio: true, from_number: twilioIncoming.from });
        setTwilioIncoming(null);
        toast.success('Call connected');
        return;
      }
      await updateCall(call.id, { status: 'in_progress', answered_at: new Date().toISOString() });
      setActiveCall(call);
      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
      toast.success('Call accepted');
    } catch (err) {
      toast.error('Failed to accept call');
    }
  };

  const handleRejectCall = async (call) => {
    try {
      stopIncomingAlert();
      // If this is a real Twilio incoming call, reject via SDK
      if (twilioIncoming?.call) {
        rejectIncomingCall();
        setTwilioIncoming(null);
        toast.success('Call rejected');
        return;
      }
      await updateCall(call.id, { status: 'missed' });
      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
      toast.success('Call rejected');
    } catch (err) {
      toast.error('Failed to reject call');
    }
  };

  const handleEndCall = async () => {
    hangupCall();
    setActiveCall(null);
    await loadDashboardData();
  };

  const handleCallNow = async (lead) => {
    try {
      if (twilioReady && lead.phone_number) {
        // Real Twilio outbound call
        await makeOutboundCall(lead.phone_number, user.id, '+19044428970', 'sales');
        setActiveCall({
          isTwilio: true,
          direction: 'outbound',
          from_number: '+19044428970',
          to_number: lead.phone_number,
          caller_name: lead.lead_name,
          caller_number: lead.phone_number,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        });
        await contactLead(lead.id, user.id);
        toast.success('Calling ' + lead.lead_name);
      } else {
        const call = await createCall({
          agent_user_id: user.id,
          caller_name: lead.lead_name,
          caller_number: lead.phone_number,
          direction: 'outbound',
          status: 'in_progress',
          started_at: new Date().toISOString(),
        });
        setActiveCall(call);
        await contactLead(lead.id, user.id);
        toast.success('Call started');
      }
    } catch (err) {
      toast.error('Failed to start call: ' + err.message);
    }
  };

  const handleMarkContacted = async (lead) => {
    try {
      await updateSpeedToLead(lead.id, { status: 'contacted' });
      setSpeedToLeads(prev => prev.filter(l => l.id !== lead.id));
      toast.success('Lead marked as contacted');
    } catch (err) {
      toast.error('Failed to update lead');
    }
  };

  const handleAddLead = async (leadData) => {
    try {
      await createSpeedToLead(leadData);
      const leads = await fetchSpeedToLead('all');
      setSpeedToLeads(leads);
    } catch (err) {
      toast.error('Failed to add lead');
    }
  };

  const handleCompleteQueueItem = async (item) => {
    try {
      await completeQueueItem(item.id, user.id);
      setQueueItems(prev => prev.filter(q => q.id !== item.id));
      toast.success('Item completed');
    } catch (err) {
      toast.error('Failed to complete item');
    }
  };

  const handleRescheduleQueueItem = async (itemId, newTime) => {
    try {
      await updateQueueItem(itemId, {
        status: 'rescheduled',
        scheduled_at: newTime,
      });
      const queue = await fetchCallQueue({});
      setQueueItems(queue);
    } catch (err) {
      toast.error('Failed to reschedule');
    }
  };

  const handleTestCall = async () => {
    try {
      const testCall = await createCall({
        agent_user_id: user.id,
        caller_name: 'Test Caller',
        caller_number: '+1 (555) 000-0000',
        direction: 'inbound',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        is_test_mode: true,
      });
      setActiveCall(testCall);
      setShowTestCall(false);
      toast.success('Test call started');
    } catch (err) {
      toast.error('Failed to start test call');
    }
  };

  const handlePhoneCall = async (phoneNumber) => {
    try {
      if (twilioReady) {
        // Real Twilio outbound call
        await makeOutboundCall(phoneNumber, user.id, '+19044428970', 'sales');
        setActiveCall({
          isTwilio: true,
          direction: 'outbound',
          from_number: '+19044428970',
          to_number: phoneNumber,
          caller_name: phoneNumber,
          caller_number: phoneNumber,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        });
        toast.success('Calling ' + phoneNumber);
      } else {
        // Fallback: log-only call
        const call = await createCall({
          agent_user_id: user.id,
          caller_name: 'Dialed Call',
          caller_number: phoneNumber,
          direction: 'outbound',
          status: 'in_progress',
          started_at: new Date().toISOString(),
        });
        setActiveCall(call);
        toast.success('Call started');
      }
    } catch (err) {
      toast.error('Failed to start call: ' + err.message);
    }
  };

  // SMS send handler
  const handleSendSms = async () => {
    if (!smsTo || !smsBody) {
      toast.error('Enter a phone number and message');
      return;
    }
    setSendingSms(true);
    try {
      await sendSMS(smsTo, smsBody);
      toast.success('SMS sent');
      setSmsBody('');
      // Refresh SMS history
      const msgs = await fetchSMSHistory();
      setSmsMessages(msgs);
    } catch (err) {
      toast.error('Failed to send SMS: ' + err.message);
    } finally {
      setSendingSms(false);
    }
  };

  // Start an outbound video call for any lead/contact
  const handleVideoCall = async (lead) => {
    const leadId = lead.id;
    const name = lead.lead_name || lead.caller_name || lead.contact_name || 'Lead';
    const email = lead.email || lead.lead_email || '';
    setCreatingVideoCall(leadId);
    try {
      const link = await createOutboundRallyLink(user.id, `Video Call — ${name}`);
      setActiveRallyLink(link);
      setVideoCallLead({ name, email });
      setShowVideoLink(true);
    } catch (err) {
      console.error('Failed to create video call link:', err);
      toast.error('Failed to create video call link');
    } finally {
      setCreatingVideoCall(null);
    }
  };

  // Send video link email from dialog
  const handleSendVideoEmail = async () => {
    if (!videoCallLead.email || !activeRallyLink) return;
    await sendCallReminderEmail({
      to: videoCallLead.email,
      leadName: videoCallLead.name,
      joinUrl: activeRallyLink.joinUrl,
      consultantName: user?.user_metadata?.full_name || 'our team',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="animate-spin text-sky-400 mx-auto mb-4" size={32} />
          <p className="text-gray-400">Loading Call Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* TOP BAR - STICKY */}
      <div className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-700 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Call Center</h1>
            <p className="text-gray-400 text-sm">Control Panel</p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleToggleStatus}
              className={`flex items-center gap-2 ${
                agentStatus === 'available'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  agentStatus === 'available' ? 'bg-green-300' : 'bg-gray-300'
                }`}
              />
              {agentStatus === 'available' ? 'Go Offline' : 'Go Active'}
            </Button>

            <Badge className={agentStatus === 'available'
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }>
              {agentStatus === 'available' ? 'Available' : 'Offline'}
            </Badge>

            <div className="w-px h-6 bg-slate-700" />

            <Button
              onClick={() => setShowDialer(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Phone size={16} />
              Dialer
            </Button>

            <Button
              onClick={() => setShowTestCall(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
            >
              Test Call
            </Button>

            {twilioReady && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Phone size={12} className="mr-1 inline" /> Live
              </Badge>
            )}

            <Button
              onClick={() => { setShowSmsPanel(true); fetchSMSHistory().then(setSmsMessages).catch(() => {}); }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Mail size={16} />
              SMS
            </Button>

            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30">
              {incomingCalls.length + (twilioIncoming ? 1 : 0)} Incoming
            </Badge>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="p-6 space-y-6">
        {/* STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Inbound Today"
            value={stats.inbound_calls_today}
            icon={<PhoneIncoming size={24} />}
            color="text-blue-400"
          />
          <StatCard
            label="Outbound Today"
            value={stats.outbound_calls_today}
            icon={<Phone size={24} />}
            color="text-green-400"
          />
          <StatCard
            label="Active Now"
            value={stats.active_right_now}
            icon={<Activity size={24} className="animate-pulse" />}
            color="text-blue-400"
          />
          <StatCard
            label="Completed"
            value={stats.completed_today}
            icon={<CheckCircle size={24} />}
            color="text-green-400"
          />
          <StatCard
            label="Missed"
            value={stats.missed_calls}
            icon={<PhoneMissed size={24} />}
            color="text-red-400"
          />
          <StatCard
            label="Avg Duration"
            value={formatDuration(stats.avg_duration)}
            icon={<Timer size={24} />}
            color="text-orange-400"
          />
        </div>

        {/* AGENT ROSTER */}
        <AgentRosterPanel />

        {/* Incoming call popup is now handled globally by GlobalPhoneCallPopup in AdminLayout */}

        {/* ACTIVE CALL OR INCOMING CALLS */}
        <div>
          {activeCall ? (
            <ActiveCallPanel
              call={activeCall}
              onEnd={handleEndCall}
              onUpdateCall={updateCall}
            />
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PhoneIncoming className="text-blue-400" size={20} />
                  <div>
                    <h2 className="text-white text-lg font-bold">Incoming Calls</h2>
                    <p className="text-gray-400 text-sm">Waiting for answer</p>
                  </div>
                </div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {incomingCalls.length}
                </Badge>
              </div>
              <div className="p-6">
                <IncomingCallsList
                  calls={incomingCalls}
                  onAccept={handleAcceptCall}
                  onReject={handleRejectCall}
                  onVideoCall={handleVideoCall}
                  creatingVideoCall={creatingVideoCall}
                />
              </div>
            </Card>
          )}
        </div>

        {/* SPEED TO LEAD */}
        <SpeedToLeadSection
          leads={speedToLeads}
          onCallNow={handleCallNow}
          onVideoCall={handleVideoCall}
          onMarkContacted={handleMarkContacted}
          onAddLead={handleAddLead}
          creatingVideoCall={creatingVideoCall}
        />

        {/* CALL QUEUE */}
        <CallQueueSection
          queueItems={queueItems}
          onCallNow={handleCallNow}
          onVideoCall={handleVideoCall}
          onComplete={handleCompleteQueueItem}
          onReschedule={handleRescheduleQueueItem}
          creatingVideoCall={creatingVideoCall}
        />

        {/* SCHEDULED CALLS — Leadership assigns calls */}
        <ScheduledCallsSection userId={user?.id} />

        {/* AGENT AVAILABILITY */}
        <AgentAvailabilitySection />

        {/* VOICEMAIL INBOX */}
        <VoicemailInbox userId={user?.id} />
      </div>

      {/* MODALS */}
      <VideoCallLinkDialog
        open={showVideoLink}
        onOpenChange={setShowVideoLink}
        rallyLink={activeRallyLink}
        leadName={videoCallLead.name}
        leadEmail={videoCallLead.email}
        onSendEmail={handleSendVideoEmail}
      />

      <PhoneDialerModal
        open={showDialer}
        onOpenChange={setShowDialer}
        onCall={handlePhoneCall}
        onCallExtension={async (identity, name) => {
          try {
            await callExtension(identity, user.id, {
              userId: user.id,
              name: user.user_metadata?.full_name || user.email,
              avatarUrl: user.user_metadata?.avatar_url || '',
            });
            setActiveCall({
              isTwilio: true,
              direction: 'outbound',
              caller_name: name,
              caller_number: 'Internal',
              status: 'in_progress',
              started_at: new Date().toISOString(),
            });
            toast.success('Calling ' + name);
          } catch (err) {
            toast.error('Failed to call: ' + err.message);
          }
        }}
        twilioReady={twilioReady}
      />

      <Dialog open={showTestCall} onOpenChange={setShowTestCall}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Start Test Call</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            This will create a simulated call so you can practice. You'll be connected to a test caller.
          </p>
          <DialogFooter>
            <Button
              onClick={() => setShowTestCall(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTestCall}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Start Test Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS PANEL */}
      <Dialog open={showSmsPanel} onOpenChange={setShowSmsPanel}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Mail size={20} /> SMS Messages
            </DialogTitle>
          </DialogHeader>

          {/* Send SMS */}
          <div className="space-y-3 border-b border-slate-700 pb-4">
            <Input
              placeholder="Phone number (e.g. +19045551234)"
              value={smsTo}
              onChange={(e) => setSmsTo(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
            />
            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message..."
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white flex-1"
                rows={2}
              />
              <Button
                onClick={handleSendSms}
                disabled={sendingSms || !smsTo || !smsBody}
                className="bg-sky-600 hover:bg-sky-700 self-end"
              >
                {sendingSms ? <Loader2 className="animate-spin" size={16} /> : 'Send'}
              </Button>
            </div>
          </div>

          {/* SMS History */}
          <div className="flex-1 overflow-y-auto space-y-2 mt-2">
            {smsMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No SMS messages yet</p>
            ) : (
              smsMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-sm ${
                    msg.direction === 'inbound'
                      ? 'bg-slate-800 border border-slate-700 mr-8'
                      : 'bg-sky-900/40 border border-sky-700/30 ml-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400 text-xs">
                      {msg.direction === 'inbound' ? msg.from_number : `To: ${msg.to_number}`}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white">{msg.body}</p>
                  {msg.contact_name && (
                    <span className="text-sky-400 text-xs">{msg.contact_name}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
