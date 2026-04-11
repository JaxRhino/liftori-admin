import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Bot, Phone, PhoneIncoming, CheckCircle, Activity, Headphones,
  Timer, Play, Pause, Zap, Volume2, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

// CF Worker base URL for AI Call Center
const AI_WORKER_URL = import.meta.env.VITE_AI_CALL_CENTER_URL || 'https://liftori-call-center.rhinomarch78.workers.dev';

const formatDuration = (secs) => {
  if (!secs) return '0:00';
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return `${mins}:${String(s).padStart(2, '0')}`;
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const STATUS_STYLES = {
  'ringing': { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30', label: 'Ringing', pulse: true },
  'in-progress': { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30', label: 'In Progress', pulse: true },
  'completed': { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30', label: 'Completed', pulse: false },
  'no-answer': { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', label: 'No Answer', pulse: false },
  'busy': { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30', label: 'Busy', pulse: false },
  'failed': { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', label: 'Failed', pulse: false },
};

export default function AICallCenterDashboard() {
  const [stats, setStats] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCalls, setExpandedCalls] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, callsRes] = await Promise.all([
        fetch(`${AI_WORKER_URL}/api/ai-stats`).then(r => r.json()).catch(() => null),
        fetch(`${AI_WORKER_URL}/api/ai-calls?limit=20`).then(r => r.json()).catch(() => ({ calls: [] })),
      ]);
      if (statsRes) setStats(statsRes);
      if (callsRes?.calls) setCalls(callsRes.calls);
    } catch (e) {
      console.error('Failed to fetch AI call center data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePlayRecording = (call) => {
    if (playingAudio === call.call_sid) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(call.recording_url);
    audio.onended = () => setPlayingAudio(null);
    audio.play().catch(() => toast.error('Could not play recording'));
    audioRef.current = audio;
    setPlayingAudio(call.call_sid);
  };

  const todayStats = stats?.today || {};
  const agents = stats?.agents || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-sky-500/20 to-purple-500/20">
            <Bot className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h2 className="text-white text-lg font-bold">AI Call Center</h2>
            <p className="text-gray-400 text-xs">AI agents handling inbound calls, recordings, and outcomes</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1 border-slate-600">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-slate-800/50 border-sky-500/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-sky-400">AI Calls Today</p>
              <p className="text-2xl font-bold text-sky-500">{todayStats.total_calls || 0}</p>
            </div>
            <PhoneIncoming className="h-6 w-6 text-sky-500/40" />
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-green-500/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-400">Completed</p>
              <p className="text-2xl font-bold text-green-500">{todayStats.completed_calls || 0}</p>
            </div>
            <CheckCircle className="h-6 w-6 text-green-500/40" />
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-orange-500/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-400">Avg Duration</p>
              <p className="text-2xl font-bold text-orange-500">{formatDuration(todayStats.avg_duration)}</p>
            </div>
            <Timer className="h-6 w-6 text-orange-500/40" />
          </div>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-400">Recordings</p>
              <p className="text-2xl font-bold text-purple-500">{todayStats.with_recordings || 0}</p>
            </div>
            <Headphones className="h-6 w-6 text-purple-500/40" />
          </div>
        </Card>

        <Card className={`bg-slate-800/50 p-3 ${todayStats.active_calls > 0 ? 'border-yellow-500/30' : 'border-slate-700'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Active Now</p>
              <p className={`text-2xl font-bold ${todayStats.active_calls > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
                {todayStats.active_calls || 0}
              </p>
            </div>
            <Activity className={`h-6 w-6 ${todayStats.active_calls > 0 ? 'text-yellow-500/60 animate-pulse' : 'text-gray-600'}`} />
          </div>
        </Card>
      </div>

      {/* AI Agents */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="bg-gradient-to-br from-sky-500/5 to-purple-500/5 border-sky-500/20 p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 bg-green-500 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm">{agent.name}</h4>
                  <p className="text-gray-400 text-xs capitalize">{agent.role} Agent</p>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Active</Badge>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {agent.phone_number || 'No number'}</span>
                <span className="flex items-center gap-1"><Volume2 className="h-3 w-3" /> {agent.voice_name || 'Default'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Call History */}
      <Card className="bg-slate-800/50 border-slate-700">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Recent AI Calls
            {calls.length > 0 && <Badge className="bg-slate-700 text-gray-300 text-xs">{calls.length}</Badge>}
          </h3>
          {calls.length > 5 && (
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-gray-400" onClick={() => setExpandedCalls(!expandedCalls)}>
              {expandedCalls ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expandedCalls ? 'Show Less' : `Show All (${calls.length})`}
            </Button>
          )}
        </div>
        <div>
          {calls.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PhoneIncoming className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No AI calls yet today</p>
              <p className="text-xs mt-1">Calls handled by Ava will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {(expandedCalls ? calls : calls.slice(0, 5)).map((call) => {
                const style = STATUS_STYLES[call.status] || STATUS_STYLES['completed'];
                return (
                  <div key={call.id || call.call_sid} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-700/30 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${style.text.replace('text-', 'bg-')} ${style.pulse ? 'animate-pulse' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{call.from_number || 'Unknown'}</span>
                        <Badge className={`text-[10px] ${style.bg} ${style.text} border ${style.border}`}>{style.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{formatTime(call.created_at)}</span>
                        {call.duration > 0 && (
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {formatDuration(call.duration)}</span>
                        )}
                        {call.summary && <span className="truncate max-w-[200px] text-gray-400">{call.summary}</span>}
                      </div>
                    </div>
                    {call.outcome && (
                      <Badge className="bg-slate-700 text-gray-300 text-xs capitalize">{call.outcome.replace(/_/g, ' ')}</Badge>
                    )}
                    {call.recording_url && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePlayRecording(call)}>
                        {playingAudio === call.call_sid
                          ? <Pause className="h-4 w-4 text-sky-500" />
                          : <Play className="h-4 w-4 text-sky-500" />
                        }
                      </Button>
                    )}
                    <span className="text-xs text-gray-600 whitespace-nowrap">{timeAgo(call.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
