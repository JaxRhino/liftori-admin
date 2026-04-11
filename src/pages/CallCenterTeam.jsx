import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchAgents,
  setAgentStatus as updateAgentStatusDB,
  heartbeatAgent,
  markStaleAgentsOffline,
} from '../lib/callCenterService';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Users,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Shield,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// CALL CENTER TEAM PAGE
// Agent roster, availability overview, status management
// ═══════════════════════════════════════════════════════════════

export default function CallCenterTeam() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Call Center Team</h1>
            <p className="text-gray-400 text-sm">Agent roster, status, and availability</p>
          </div>
        </div>

        <div className="space-y-6">
          <AgentRosterSection />
          <AgentAvailabilitySection />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT ROSTER
// ═══════════════════════════════════════════════════════════════

function AgentRosterSection() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllAgents = async (runStaleCheck = false) => {
    try {
      if (runStaleCheck) await markStaleAgentsOffline(10);

      const { data, error } = await supabase
        .from('cc_agents')
        .select('*, profile:profiles!cc_agents_user_id_fkey(id, full_name, avatar_url, email, role, title)')
        .order('status');
      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAgents(true);

    const channel = supabase
      .channel('cc-team-roster')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cc_agents' }, () => {
        fetchAllAgents(false);
      })
      .subscribe();

    const poll = setInterval(() => fetchAllAgents(false), 30000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, []);

  const available = agents.filter(a => a.status === 'available');
  const busy = agents.filter(a => a.status === 'on_call' || a.status === 'busy');
  const offline = agents.filter(a => a.status === 'offline' || (!['available', 'on_call', 'busy'].includes(a.status)));

  const getStatusColor = (status) => {
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

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <p className="text-gray-400 text-center">Loading roster...</p>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-sky-400" />
          <div>
            <h2 className="text-white text-lg font-bold">Agent Roster</h2>
            <p className="text-gray-400 text-sm">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
          </div>
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
      </div>

      <div className="p-6">
        {agents.length === 0 ? (
          <div className="text-center py-8">
            <UserPlus size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No agents registered yet</p>
            <p className="text-gray-500 text-sm mt-1">Agents are created when team members visit the Call Center</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...available, ...busy, ...offline].map(agent => {
              const name = agent.profile?.full_name || agent.display_name || 'Unknown';
              const avatar = agent.profile?.avatar_url;
              const title = agent.profile?.title;
              const role = agent.profile?.role;
              const roleLabel = role === 'super_admin' ? 'Admin' : role === 'sales_director' ? 'Sales Dir.' : role === 'call_agent' ? 'Agent' : role || '';
              const subtitle = title || roleLabel;

              return (
                <div key={agent.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 flex items-start gap-3">
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-sm text-gray-300 font-bold">
                      {name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">{name}</span>
                      <Circle size={8} className={`${getStatusColor(agent.status)} fill-current flex-shrink-0`} />
                    </div>
                    {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
                    <p className={`text-xs mt-1 ${getStatusColor(agent.status)}`}>{getStatusLabel(agent.status)}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>Calls today: {agent.calls_today || 0}</span>
                      {agent.avg_call_duration > 0 && <span>Avg: {Math.round(agent.avg_call_duration / 60)}min</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT AVAILABILITY SCHEDULE
// ═══════════════════════════════════════════════════════════════

function AgentAvailabilitySection() {
  const [availability, setAvailability] = useState([]);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    loadAvailability();
  }, []);

  async function loadAvailability() {
    try {
      const [availRes, profilesRes] = await Promise.all([
        supabase.from('team_availability').select('*').eq('is_active', true).order('day_of_week').order('start_time'),
        supabase.from('profiles').select('id, full_name, email, avatar_url, role').not('role', 'eq', 'customer'),
      ]);
      if (availRes.error) throw availRes.error;
      setAvailability(availRes.data || []);
      setTeamProfiles(profilesRes.data || []);
    } catch (err) {
      console.error('Error loading availability:', err);
    } finally {
      setLoading(false);
    }
  }

  const agentMap = new Map();
  for (const p of teamProfiles) {
    agentMap.set(p.id, { name: p.full_name || p.email || 'Unknown', avatar: p.avatar_url, role: p.role, slots: [] });
  }
  for (const slot of availability) {
    const agent = agentMap.get(slot.user_id);
    if (agent) agent.slots.push(slot);
  }
  const activeCount = [...agentMap.values()].filter(a => a.slots.length > 0).length;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Clock className="text-emerald-400" size={20} />
          <div>
            <h2 className="text-white text-lg font-bold">Weekly Availability</h2>
            <p className="text-gray-400 text-sm">
              {activeCount > 0
                ? `${activeCount} team member${activeCount !== 1 ? 's' : ''} with scheduled hours`
                : 'No availability set \u2014 configure in Operations > Availability'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        {loading ? (
          <p className="text-gray-400 text-center py-6">Loading availability...</p>
        ) : activeCount === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-400">No team members have set their availability yet</p>
            <p className="text-gray-500 text-sm mt-1">Go to Operations &gt; Availability to set weekly hours</p>
          </div>
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
              {[...agentMap.entries()].filter(([, a]) => a.slots.length > 0).map(([uid, agent]) => (
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
                    const daySlots = agent.slots.filter(s => s.day_of_week === dayIdx);
                    const isOn = daySlots.length > 0;
                    const timeStr = isOn
                      ? daySlots.map(s => `${s.start_time?.slice(0,5)}-${s.end_time?.slice(0,5)}`).join(', ')
                      : '';
                    return (
                      <td key={dayIdx} className="text-center px-1 py-3">
                        <span className={`rounded px-2 py-1 text-xs font-medium ${
                          isOn
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-gray-700/30 text-gray-500 border border-gray-700'
                        }`}>
                          {isOn ? timeStr : 'Off'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
