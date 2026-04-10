import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
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
  setAgentStatus,
  fetchAgent,
  fetchCallCenterDashboard,
} from '../lib/callCenterService';
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
          onClick={() => setIsMuted(!isMuted)}
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
// PHONE DIALER MODAL
// ═══════════════════════════════════════════════════════════════

function PhoneDialerModal({ open, onOpenChange, onCall }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recentCalls] = useState([
    { number: '+1 (555) 123-4567', name: 'John Smith' },
    { number: '+1 (555) 234-5678', name: 'Jane Doe' },
  ]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Phone Dialer</DialogTitle>
        </DialogHeader>

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
            <Button
              onClick={handleBackspace}
              variant="outline"
              className="flex-1"
            >
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

          {recentCalls.length > 0 && (
            <div>
              <p className="text-gray-400 text-sm font-medium mb-2">Recent Calls</p>
              <div className="space-y-1">
                {recentCalls.map((call, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPhoneNumber(call.number);
                      onCall(call.number);
                      setPhoneNumber('');
                      onOpenChange(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-gray-300 text-sm"
                  >
                    {call.name}
                    <br />
                    <span className="text-gray-500 text-xs font-mono">{call.number}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
          await setAgentStatus(user.id, 'offline');
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
  }, [user]);

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
      await setAgentStatus(user.id, newStatus);
      setAgentStatus(newStatus);
      toast.success(newStatus === 'available' ? 'You are now available' : 'You are now offline');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleAcceptCall = async (call) => {
    try {
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
      await updateCall(call.id, { status: 'missed' });
      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
      toast.success('Call rejected');
    } catch (err) {
      toast.error('Failed to reject call');
    }
  };

  const handleEndCall = async () => {
    setActiveCall(null);
    await loadDashboardData();
  };

  const handleCallNow = async (lead) => {
    try {
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
    } catch (err) {
      toast.error('Failed to start call');
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
    } catch (err) {
      toast.error('Failed to start call');
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
              {agentStatus}
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

            <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30">
              {incomingCalls.length} Incoming
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
    </div>
  );
}
