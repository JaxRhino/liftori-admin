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
import { LIFTORI_FOUNDERS, isFounder, listAssignments, createAssignment, updateAssignment } from '../lib/testerProgramService';
import { fetchEnrollments, fetchEntries, fetchLogs, formatDuration, liveDuration } from '../lib/timeTrackingService';
import {
  Shield, Users, Briefcase, Phone, BarChart3, MessageSquare,
  TrendingUp, AlertTriangle, Star, Clock, Activity, DollarSign,
  UserCheck, Calendar, Target, Zap, ChevronRight, RefreshCw,
  Loader2, Building2, Headphones, FileText, CheckCircle,
  ArrowUpRight, ArrowDownRight, Sparkles, ClipboardList, Bug, X, Plus
} from 'lucide-react';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [topScorecards, setTopScorecards] = useState([]);
  const [flaggedCalls, setFlaggedCalls] = useState([]);
  const [isFounderUser, setIsFounderUser] = useState(false);
  // Tester program data
  const [testerEnrollments, setTesterEnrollments] = useState([]);
  const [testerSessions, setTesterSessions] = useState([]);
  const [testerLogs, setTesterLogs] = useState([]);
  const [testerAssignments, setTesterAssignments] = useState([]);
  const [profilesLookup, setProfilesLookup] = useState({});
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [user, profile]);

  function checkAccess() {
    if (!user) return;
    const founder = isFounder({ email: user.email, personal_email: profile?.personal_email });
    setIsFounderUser(founder);
    if (founder) {
      loadDashboard();
      loadTesterProgram();
    } else {
      setLoading(false);
    }
  }

  async function loadTesterProgram() {
    try {
      const [enr, sessions, logs, assigns] = await Promise.all([
        fetchEnrollments({ activeOnly: true }),
        fetchEntries({ limit: 200 }),
        fetchLogs({ limit: 100 }),
        listAssignments({ limit: 100 }),
      ]);
      setTesterEnrollments(enr);
      setTesterSessions(sessions);
      setTesterLogs(logs);
      setTesterAssignments(assigns);
      // Build profile lookup for any user_ids referenced
      const ids = new Set();
      enr.forEach((e) => ids.add(e.user_id));
      sessions.forEach((s) => ids.add(s.user_id));
      logs.forEach((l) => ids.add(l.user_id));
      assigns.forEach((a) => { if (a.assigned_to) ids.add(a.assigned_to) });
      if (ids.size > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', Array.from(ids));
        const lookup = {};
        for (const r of data || []) lookup[r.id] = r;
        setProfilesLookup(lookup);
      }
    } catch (e) {
      console.error('Tester program load failed', e);
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

  if (!isFounderUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Shield className="w-16 h-16 text-red-400" />
        <h2 className="text-xl font-bold">Founder Access Only</h2>
        <p className="text-gray-400">This dashboard is restricted to Liftori founders.</p>
      </div>
    );
  }

  // Derive tester data
  const activeTesterSessions = testerSessions.filter((s) => s.status === 'active');
  const recentTesterLogs = testerLogs.slice(0, 10);
  const openCriticalLogs = testerLogs.filter((l) => l.severity === 'critical' && !['fixed', 'closed', 'wontfix'].includes(l.status));
  const openAssignmentsByUser = testerEnrollments.map((e) => ({
    user: profilesLookup[e.user_id],
    enrollment: e,
    open: testerAssignments.filter((a) => a.assigned_to === e.user_id && ['assigned', 'in_progress'].includes(a.status)).length,
    completed: testerAssignments.filter((a) => a.assigned_to === e.user_id && a.status === 'completed').length,
  }));

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

      {/* ═════════════════════════════════════════════════════ */}
      {/* TESTER PROGRAM — founder-only oversight + management   */}
      {/* ═════════════════════════════════════════════════════ */}
      <div className="border-t border-slate-800 pt-6 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-bold text-white">Tester Program</h2>
            <span className="text-xs text-gray-500">{testerEnrollments.length} active</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAssignModal(true)}
              className="text-xs px-3 py-1.5 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-300 rounded-md font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Assign work
            </button>
            <button onClick={() => navigate('/admin/testing')} className="text-xs px-3 py-1.5 bg-slate-800 border border-slate-700 text-gray-300 rounded-md font-medium">
              Full dashboard →
            </button>
          </div>
        </div>

        {/* Tester KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <MetricCard icon={Users} label="Active Testers" value={testerEnrollments.length} sub="enrolled" color="purple" />
          <MetricCard icon={Activity} label="Clocked In Now" value={activeTesterSessions.length} sub="live sessions" color={activeTesterSessions.length > 0 ? 'green' : 'default'} />
          <MetricCard icon={Bug} label="Open Logs" value={testerLogs.filter(l => ['open', 'triaged', 'in_progress'].includes(l.status)).length} sub="awaiting fix" color="orange" />
          <MetricCard icon={AlertTriangle} label="Critical Open" value={openCriticalLogs.length} sub="urgent" color={openCriticalLogs.length > 0 ? 'red' : 'green'} />
          <MetricCard icon={ClipboardList} label="Open Assignments" value={testerAssignments.filter(a => ['assigned', 'in_progress'].includes(a.status)).length} sub={`${testerAssignments.filter(a => a.status === 'completed').length} done`} color="sky" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live Tester Activity */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <SectionHeader icon={Activity} title="Live Activity" />
            <div className="space-y-2 mt-3">
              {testerEnrollments.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No enrolled testers yet</p>
              ) : openAssignmentsByUser.map(({ user: u, enrollment: e, open, completed }) => {
                const session = activeTesterSessions.find((s) => s.user_id === e.user_id);
                return (
                  <div key={e.id} className="bg-slate-900/40 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${session ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30' : 'bg-slate-700 text-gray-400'}`}>
                        {(u?.full_name || u?.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{u?.full_name || u?.email || 'Tester'}</div>
                        <div className="text-[10px] text-gray-500">
                          {session
                            ? <span className="text-emerald-400">● Active {formatDuration(liveDuration(session.clock_in_at))}</span>
                            : <span>○ Off the clock</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 ml-9">
                      <span>{open} open</span>
                      <span>·</span>
                      <span>{completed} done</span>
                      <span>·</span>
                      <span>{(Number(e.commission_rate) * 100).toFixed(1)}% / {e.min_hours_per_week}hr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Submissions */}
          <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <SectionHeader icon={Bug} title="Recent Submissions" />
              <button onClick={() => navigate('/admin/testing')} className="text-xs text-purple-400 hover:text-purple-300">View all in Testing →</button>
            </div>
            <div className="mt-3 divide-y divide-slate-700/40">
              {recentTesterLogs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No submissions yet</p>
              ) : recentTesterLogs.map((l) => (
                <TesterLogRow
                  key={l.id}
                  log={l}
                  user={profilesLookup[l.user_id]}
                  onChangeStatus={async (s) => {
                    await supabase.from('team_work_logs').update({ status: s, updated_at: new Date().toISOString() }).eq('id', l.id);
                    loadTesterProgram();
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <AssignWorkModal
          assignedBy={user?.id}
          enrollments={testerEnrollments}
          profilesLookup={profilesLookup}
          onClose={() => setShowAssignModal(false)}
          onCreated={() => { setShowAssignModal(false); loadTesterProgram(); }}
        />
      )}
    </div>
  );
}

// ─── Tester sub-components ───────────────────────────────
function TesterLogRow({ log, user, onChangeStatus }) {
  const [expanded, setExpanded] = useState(false);
  const sevColor = {
    critical: 'text-rose-400 bg-rose-500/15',
    high: 'text-orange-400 bg-orange-500/15',
    medium: 'text-amber-400 bg-amber-500/15',
    low: 'text-sky-400 bg-sky-500/15',
    info: 'text-slate-400 bg-slate-500/15',
  }[log.severity] || 'text-slate-400 bg-slate-500/15';
  return (
    <>
      <div className="py-2 flex items-center gap-2 cursor-pointer hover:bg-slate-800/40 px-2 -mx-2 rounded" onClick={() => setExpanded((x) => !x)}>
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${sevColor}`}>{log.severity}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{log.title}</div>
          <div className="text-[10px] text-gray-500 flex items-center gap-2">
            <span>{user?.full_name || user?.email?.split('@')[0] || 'tester'}</span>
            {log.screen_path && <span className="font-mono">{log.screen_path}</span>}
            <span>·</span>
            <span>{new Date(log.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <select
          value={log.status}
          onChange={(e) => { e.stopPropagation(); onChangeStatus(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className={`text-[10px] font-semibold uppercase rounded px-1.5 py-0.5 border-0 focus:outline-none ${
            log.status === 'fixed' ? 'bg-emerald-500/15 text-emerald-300' :
            log.status === 'open' ? 'bg-rose-500/15 text-rose-300' :
            'bg-slate-500/15 text-slate-400'
          }`}
        >
          {['open', 'triaged', 'in_progress', 'fixed', 'wontfix', 'cannot_reproduce', 'duplicate', 'closed'].map((s) => (
            <option key={s} value={s} className="bg-slate-900 text-white">{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>
      {expanded && (
        <div className="bg-slate-900/40 rounded p-3 mb-2 text-xs text-gray-300 space-y-2">
          {log.description && <div><span className="text-gray-500 uppercase text-[10px] font-bold">Desc:</span> {log.description}</div>}
          {log.steps_to_reproduce && <div><span className="text-gray-500 uppercase text-[10px] font-bold">Steps:</span><pre className="whitespace-pre-wrap font-mono text-[11px] mt-1">{log.steps_to_reproduce}</pre></div>}
          {log.expected_result && <div><span className="text-gray-500 uppercase text-[10px] font-bold">Expected:</span> {log.expected_result}</div>}
          {log.actual_result && <div><span className="text-gray-500 uppercase text-[10px] font-bold">Actual:</span> {log.actual_result}</div>}
        </div>
      )}
    </>
  );
}

function AssignWorkModal({ assignedBy, enrollments, profilesLookup, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [screenPath, setScreenPath] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState(enrollments[0]?.user_id || '');
  const [dueDate, setDueDate] = useState('');
  const [estMinutes, setEstMinutes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !assignedTo) {
      alert('Title + assignee required');
      return;
    }
    setBusy(true);
    try {
      await createAssignment({
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        screenPath: screenPath.trim() || null,
        priority,
        dueDate: dueDate || null,
        estimatedMinutes: estMinutes ? Number(estMinutes) : null,
        assignedTo,
        assignedBy,
      });
      onCreated?.();
    } catch (err) {
      console.error(err);
      alert('Save failed: ' + (err?.message || 'unknown'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center overflow-auto py-10 px-4">
      <form onSubmit={submit} className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Assign work to a tester</h2>
            <p className="text-xs text-gray-500 mt-0.5">They'll see this on their dashboard.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500">Assign to *</label>
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white">
              {enrollments.length === 0 && <option value="">No active testers</option>}
              {enrollments.map((e) => (
                <option key={e.user_id} value={e.user_id}>
                  {profilesLookup[e.user_id]?.full_name || profilesLookup[e.user_id]?.email || e.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white" placeholder="e.g., Test mobile responsive on Ops dashboard" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-500">Instructions (specific test steps)</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono" placeholder={'1. Open page on mobile (375x667)\n2. Try to add a work order\n3. Verify form submits without errors'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Screen path</label>
              <input value={screenPath} onChange={(e) => setScreenPath(e.target.value)} placeholder="/admin/ops/work-orders" className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white">
                {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500">Estimated minutes</label>
              <input type="number" min="0" value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit" disabled={busy || !assignedTo} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {busy ? 'Assigning…' : 'Assign work'}
          </button>
        </div>
      </form>
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
