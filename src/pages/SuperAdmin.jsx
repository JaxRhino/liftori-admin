/**
 * Super Admin Dashboard — God-View Command Center
 *
 * Ryan March = super_admin — full visibility across the entire platform:
 * - Platform health: users, projects, revenue pipeline
 * - Sales pulse: leads, appointments, call center activity
 * - Consulting: scorecard averages, flagged calls, top performers
 * - Team: active users, roles, recent logins
 * - System: recent activity, chat volume, support tickets
 * - Quick actions: navigate to any section instantly
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Shield, Users, Briefcase, Phone, BarChart3, MessageSquare,
  TrendingUp, AlertTriangle, Star, Clock, Activity, DollarSign,
  UserCheck, Calendar, Target, Zap, ChevronRight, RefreshCw,
  Loader2, Building2, Headphones, FileText, CheckCircle,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [topScorecards, setTopScorecards] = useState([]);
  const [flaggedCalls, setFlaggedCalls] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [user]);

  async function checkAccess() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (['super_admin', 'admin'].includes(data?.role)) {
      setIsSuperAdmin(true);
      loadDashboard();
    } else {
      setIsSuperAdmin(false);
      setLoading(false);
    }
  }

  async function loadDashboard() {
    setLoading(true);
    try {
      const [
        usersRes, projectsRes, apptsRes, scorecardsRes,
        callsRes, speedRes, queueRes, messagesRes, ticketsRes
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role, created_at'),
        supabase.from('projects').select('id, name, status, tier, created_at'),
        supabase.from('consulting_appointments').select('*').order('created_at', { ascending: false }),
        supabase.from('call_scorecards').select('*, consulting_appointments(lead_name, company_name, primary_interest)').order('created_at', { ascending: false }),
        supabase.from('cc_calls').select('id, direction, status, from_name, duration_seconds, created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('cc_speed_to_lead').select('id, lead_name, status, received_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('cc_queue').select('id, contact_name, queue_type, status, scheduled_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('chat_messages').select('id, sender_name, content, created_at', { count: 'exact', head: false }).order('created_at', { ascending: false }).limit(5),
        supabase.from('support_tickets').select('id, subject, status, priority, created_at', { count: 'exact', head: false }).order('created_at', { ascending: false }).limit(5),
      ]);

      const users = usersRes.data || [];
      const projects = projectsRes.data || [];
      const appts = apptsRes.data || [];
      const scorecards = scorecardsRes.data || [];
      const calls = callsRes.data || [];
      const speedLeads = speedRes.data || [];
      const queueItems = queueRes.data || [];
      const messages = messagesRes.data || [];
      const tickets = ticketsRes.data || [];

      // Compute aggregate stats
      const totalRevenuePipeline = appts.reduce((sum, a) => sum + (parseFloat(a.estimated_value) || 0), 0);
      const avgScore = scorecards.length > 0
        ? (scorecards.reduce((s, c) => s + (parseFloat(c.overall_score) || 0), 0) / scorecards.length)
        : 0;
      const flagged = scorecards.filter(s => s.overall_score != null && parseFloat(s.overall_score) < 5);
      const completedAppts = appts.filter(a => a.status === 'completed').length;
      const scheduledAppts = appts.filter(a => a.status === 'scheduled').length;

      // Today's activity
      const today = new Date().toISOString().split('T')[0];
      const todayCalls = calls.filter(c => c.created_at?.startsWith(today)).length;
      const todayMessages = messages.filter(m => m.created_at?.startsWith(today)).length;

      setStats({
        totalUsers: users.length,
        admins: users.filter(u => ['admin', 'dev', 'super_admin'].includes(u.role)).length,
        customers: users.filter(u => u.role === 'customer').length,
        totalProjects: projects.length,
        activeProjects: projects.filter(p => ['In Build', 'Active', 'In Progress'].includes(p.status)).length,
        totalAppointments: appts.length,
        scheduledAppts,
        completedAppts,
        totalCalls: calls.length,
        todayCalls,
        speedLeadsNew: speedLeads.filter(l => l.status === 'new').length,
        queuePending: queueItems.filter(q => q.status === 'pending').length,
        totalMessages: messagesRes.count || messages.length,
        todayMessages,
        totalTickets: ticketsRes.count || tickets.length,
        openTickets: tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length,
        avgScore: avgScore.toFixed(1),
        flaggedCount: flagged.length,
        totalScorecards: scorecards.length,
        revenuePipeline: totalRevenuePipeline,
      });

      setRecentAppointments(appts.slice(0, 5));
      setTopScorecards(scorecards.slice(0, 3));
      setFlaggedCalls(flagged);

      // Build recent activity feed from multiple sources
      const feed = [];
      appts.slice(0, 3).forEach(a => feed.push({
        type: 'appointment', text: `${a.lead_name} — ${a.status}`, sub: a.company_name || 'Consulting', time: a.created_at, icon: Calendar
      }));
      calls.slice(0, 3).forEach(c => feed.push({
        type: 'call', text: `${c.from_name || 'Unknown'} — ${c.direction}`, sub: c.status, time: c.created_at, icon: Phone
      }));
      messages.slice(0, 3).forEach(m => feed.push({
        type: 'message', text: `${m.sender_name || 'System'}`, sub: (m.content || '').substring(0, 60), time: m.created_at, icon: MessageSquare
      }));
      feed.sort((a, b) => new Date(b.time) - new Date(a.time));
      setRecentActivity(feed.slice(0, 8));

    } catch (err) {
      console.error('Super Admin load error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Shield className="w-16 h-16 text-red-400" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-gray-400">Super Admin access required</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30 rounded-2xl">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Command Center</h1>
            <p className="text-sm text-gray-400">Super Admin &middot; Full Platform Visibility</p>
          </div>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 hover:text-white hover:border-purple-500/30 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Top Stat Row — Key Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard icon={Users} label="Total Users" value={stats.totalUsers} sub={`${stats.admins} admin, ${stats.customers} customers`} />
        <MetricCard icon={Briefcase} label="Projects" value={stats.totalProjects} sub={`${stats.activeProjects} active`} color="sky" />
        <MetricCard icon={DollarSign} label="Pipeline" value={`$${(stats.revenuePipeline || 0).toLocaleString()}`} sub="estimated value" color="green" />
        <MetricCard icon={Calendar} label="Appointments" value={stats.totalAppointments} sub={`${stats.scheduledAppts} scheduled`} color="purple" />
        <MetricCard icon={Star} label="Avg Score" value={stats.avgScore} sub={`${stats.totalScorecards} reviewed`} color={parseFloat(stats.avgScore) >= 7 ? 'green' : 'orange'} />
        <MetricCard icon={AlertTriangle} label="Flagged" value={stats.flaggedCount} sub="calls under 5/10" color={stats.flaggedCount > 0 ? 'red' : 'green'} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column 1 — Sales & Call Center */}
        <div className="space-y-4">
          <SectionHeader icon={Phone} title="Sales Pulse" />

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Calls Today" value={stats.todayCalls} icon={Headphones} />
            <MiniStat label="Speed Leads" value={stats.speedLeadsNew} icon={Zap} badge="new" />
            <MiniStat label="Queue" value={stats.queuePending} icon={Clock} badge="pending" />
            <MiniStat label="Messages Today" value={stats.todayMessages} icon={MessageSquare} />
          </div>

          {/* Recent Appointments */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Appointments</h4>
              <button onClick={() => navigate('/admin/consulting')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {recentAppointments.length > 0 ? recentAppointments.map(appt => (
                <div key={appt.id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{appt.lead_name}</p>
                    <p className="text-[11px] text-gray-500">{appt.company_name || 'Consulting'} &middot; {appt.appointment_date}</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              )) : (
                <p className="text-xs text-gray-600 text-center py-3">No appointments</p>
              )}
            </div>
          </div>

          {/* Quick Nav */}
          <div className="space-y-1.5">
            <QuickLink label="Call Center" path="/admin/call-center" icon={Phone} onClick={navigate} />
            <QuickLink label="Lead Hunter" path="/admin/lead-hunter" icon={Target} onClick={navigate} />
            <QuickLink label="CRM Pipeline" path="/admin/customers" icon={Users} onClick={navigate} />
          </div>
        </div>

        {/* Column 2 — Consulting QC */}
        <div className="space-y-4">
          <SectionHeader icon={BarChart3} title="Consulting QC" />

          {/* Top Scorecards */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Latest Scorecards</h4>
              <button onClick={() => navigate('/admin/leadership-qc')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                QC Dashboard <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {topScorecards.length > 0 ? topScorecards.map(sc => {
                const score = parseFloat(sc.overall_score);
                const isFlagged = score < 5;
                const appt = sc.consulting_appointments;
                return (
                  <div key={sc.id} className={`flex items-center gap-3 py-2 px-3 rounded-xl border ${isFlagged ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/30 bg-slate-800/20'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border ${
                      score >= 8 ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                      score >= 6 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                      'text-red-400 bg-red-500/10 border-red-500/20'
                    }`}>
                      {score.toFixed(1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{appt?.lead_name || 'Unknown'}</p>
                      <p className="text-[11px] text-gray-500">{appt?.company_name || ''} &middot; {appt?.primary_interest || 'general'}</p>
                    </div>
                    {isFlagged && <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[9px] font-bold text-red-400">FLAG</span>}
                  </div>
                );
              }) : (
                <p className="text-xs text-gray-600 text-center py-3">No scorecards yet</p>
              )}
            </div>
          </div>

          {/* Flagged Calls */}
          {flaggedCalls.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Flagged Calls ({flaggedCalls.length})
              </h4>
              <div className="space-y-1.5">
                {flaggedCalls.map(sc => (
                  <div key={sc.id} className="flex items-center justify-between">
                    <p className="text-xs text-gray-300">{sc.consulting_appointments?.lead_name || 'Unknown'}</p>
                    <span className="text-xs font-bold text-red-400">{parseFloat(sc.overall_score).toFixed(1)}/10</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/admin/leadership-qc')} className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-0.5">
                Review in QC <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick Nav */}
          <div className="space-y-1.5">
            <QuickLink label="Leadership QC" path="/admin/leadership-qc" icon={BarChart3} onClick={navigate} />
            <QuickLink label="Consulting Appointments" path="/admin/consulting" icon={Calendar} onClick={navigate} />
            <QuickLink label="EOS Dashboard" path="/admin/eos" icon={Target} onClick={navigate} />
          </div>
        </div>

        {/* Column 3 — Activity & System */}
        <div className="space-y-4">
          <SectionHeader icon={Activity} title="Platform Activity" />

          {/* Live Feed */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h4>
            <div className="space-y-2">
              {recentActivity.length > 0 ? recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 py-1">
                  <div className="mt-0.5 p-1 bg-slate-800 rounded-lg shrink-0">
                    <item.icon className="w-3 h-3 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{item.text}</p>
                    <p className="text-[10px] text-gray-600 truncate">{item.sub}</p>
                  </div>
                  <span className="text-[10px] text-gray-600 whitespace-nowrap shrink-0">
                    {timeAgo(item.time)}
                  </span>
                </div>
              )) : (
                <p className="text-xs text-gray-600 text-center py-3">No recent activity</p>
              )}
            </div>
          </div>

          {/* System Health */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">System Health</h4>
            <div className="space-y-2">
              <HealthRow label="Chat Messages" value={stats.totalMessages} />
              <HealthRow label="Support Tickets" value={stats.totalTickets} sub={stats.openTickets > 0 ? `${stats.openTickets} open` : 'none open'} />
              <HealthRow label="Call Scorecards" value={stats.totalScorecards} />
              <HealthRow label="Speed-to-Lead" value={stats.speedLeadsNew} sub="new leads" />
            </div>
          </div>

          {/* Platform Users */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User Breakdown</h4>
              <button onClick={() => navigate('/admin/team')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                Team <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><Shield className="w-3 h-3 text-purple-400" /> Super Admin</span>
                <span className="text-xs font-bold text-purple-400">1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><UserCheck className="w-3 h-3 text-sky-400" /> Admins</span>
                <span className="text-xs font-bold text-sky-400">{stats.admins - 1}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><Users className="w-3 h-3 text-gray-500" /> Customers</span>
                <span className="text-xs font-bold text-gray-300">{stats.customers}</span>
              </div>
            </div>
          </div>

          {/* Quick Nav */}
          <div className="space-y-1.5">
            <QuickLink label="Operations" path="/admin/ops-dashboard" icon={Activity} onClick={navigate} />
            <QuickLink label="Finance" path="/admin/finance" icon={DollarSign} onClick={navigate} />
            <QuickLink label="Settings" path="/admin/settings" icon={FileText} onClick={navigate} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function MetricCard({ icon: Icon, label, value, sub, color = 'default' }) {
  const colors = {
    default: 'border-slate-700/50 bg-slate-800/30',
    purple: 'border-purple-500/20 bg-purple-500/5',
    green: 'border-green-500/20 bg-green-500/5',
    sky: 'border-sky-500/20 bg-sky-500/5',
    orange: 'border-orange-500/20 bg-orange-500/5',
    red: 'border-red-500/20 bg-red-500/5',
  };
  const iconColors = {
    default: 'text-gray-400', purple: 'text-purple-400', green: 'text-green-400',
    sky: 'text-sky-400', orange: 'text-orange-400', red: 'text-red-400',
  };
  return (
    <div className={`border rounded-2xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${iconColors[color]}`} />
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, badge }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 flex items-center gap-2.5">
      <Icon className="w-4 h-4 text-gray-500 shrink-0" />
      <div>
        <p className="text-lg font-bold text-gray-200">{value}</p>
        <p className="text-[10px] text-gray-500">{label} {badge && <span className="text-purple-400">{badge}</span>}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-purple-400" />
      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">{title}</h3>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    scheduled: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    in_progress: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    no_show: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${styles[status] || styles.scheduled}`}>
      {(status || 'scheduled').replace('_', ' ')}
    </span>
  );
}

function QuickLink({ label, path, icon: Icon, onClick }) {
  return (
    <button
      onClick={() => onClick(path)}
      className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-800/20 border border-slate-700/30 rounded-xl text-sm text-gray-400 hover:text-white hover:border-purple-500/30 hover:bg-slate-800/50 transition group"
    >
      <Icon className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition" />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
    </button>
  );
}

function HealthRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-xs font-bold text-gray-300">{value}</span>
        {sub && <span className="text-[10px] text-gray-600 ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
