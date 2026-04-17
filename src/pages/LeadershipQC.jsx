/**
 * Leadership QC Dashboard — Operations
 *
 * Leadership quality control for all team roles:
 *   - Consultant  → call scorecards + drill-in
 *   - Sales       → pipeline, win rate, deal velocity
 *   - Dev         → project completion, milestones, cycle time
 *   - Tester      → assignments completed, quality
 *   - Ops         → tickets closed, SLA, time logged
 *   - All Roles   → aggregate team scorecard
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart3, Users, TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, Search, Filter, Star, Target, CheckCircle, Clock, Phone,
  XCircle, ArrowUpRight, Loader2, RefreshCw, X, DollarSign, Package,
  Wrench, ClipboardCheck, Timer, Award,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────
// Role configuration
// ──────────────────────────────────────────────────────────
const ROLES = [
  { key: 'all',        label: 'All Roles',    icon: Users,          accent: 'slate'  },
  { key: 'consultant', label: 'Consulting',   icon: Phone,          accent: 'purple' },
  { key: 'sales',      label: 'Sales',        icon: DollarSign,     accent: 'emerald'},
  { key: 'dev',        label: 'Dev / Build',  icon: Wrench,         accent: 'sky'    },
  { key: 'tester',     label: 'Testers',      icon: ClipboardCheck, accent: 'amber'  },
  { key: 'ops',        label: 'Operations',   icon: Timer,          accent: 'indigo' },
];

const ACCENT_BG = {
  slate:   'text-slate-300 bg-slate-500/15',
  purple:  'text-purple-400 bg-purple-500/15',
  emerald: 'text-emerald-400 bg-emerald-500/15',
  sky:     'text-sky-400 bg-sky-500/15',
  amber:   'text-amber-400 bg-amber-500/15',
  indigo:  'text-indigo-400 bg-indigo-500/15',
};

const SCORE_COLORS = {
  high: 'text-green-400 bg-green-500/10 border-green-500/20',
  mid:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low:  'text-red-400 bg-red-500/10 border-red-500/20',
};

function scoreLevel(val) {
  if (val == null) return 'mid';
  const n = parseFloat(val);
  if (n >= 8) return 'high';
  if (n >= 6) return 'mid';
  return 'low';
}

function pctLevel(val) {
  if (val == null) return 'mid';
  const n = parseFloat(val);
  if (n >= 80) return 'high';
  if (n >= 50) return 'mid';
  return 'low';
}

function fmtMoney(n) {
  if (n == null) return '$0';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────
export default function LeadershipQC() {
  const [role, setRole] = useState('consultant');
  const [dateRange, setDateRange] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [selectedMember, setSelectedMember] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [expandedCard, setExpandedCard] = useState(null);
  const [drillData, setDrillData] = useState(null);
  const [loadingDrill, setLoadingDrill] = useState(false);

  useEffect(() => {
    if (role === 'consultant') fetchScorecards();
    else fetchRolePerformance();
  }, [role, selectedMember, dateRange, scoreFilter]);

  // ─── Consultant drill-in (original) ────────────────────
  async function fetchScorecards() {
    setLoading(true);
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(dateRange));

      let query = supabase
        .from('call_scorecards')
        .select('*, consulting_appointments(lead_name, company_name, primary_interest, appointment_date, appointment_start, status, lead_email, engagement_tier)')
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false });

      if (selectedMember !== 'all') query = query.eq('consultant_id', selectedMember);

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];
      if (scoreFilter === 'low')     filtered = filtered.filter(s => s.overall_score != null && s.overall_score < 6);
      if (scoreFilter === 'high')    filtered = filtered.filter(s => s.overall_score != null && s.overall_score >= 8);
      if (scoreFilter === 'flagged') filtered = filtered.filter(s => s.overall_score != null && s.overall_score < 5);

      setScorecards(filtered);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['admin', 'dev', 'super_admin', 'consultant']);
      setTeamData(profiles || []);
    } catch (err) {
      console.error('Error fetching scorecards:', err);
    } finally { setLoading(false); }
  }

  // ─── Role performance aggregator ───────────────────────
  async function fetchRolePerformance() {
    setLoading(true);
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(dateRange));
      const fromIso = fromDate.toISOString();

      // Pull team members (mix profiles + team_onboarding)
      const [{ data: profiles }, { data: onboard }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, email'),
        supabase.from('team_onboarding').select('id, full_name, email, role, status').eq('status', 'complete'),
      ]);

      // Merge by email so we don't double-count
      const members = [];
      const seenEmails = new Set();
      (profiles || []).forEach(p => {
        if (p.email) seenEmails.add(p.email.toLowerCase());
        members.push({ id: p.id, full_name: p.full_name, email: p.email, role: p.role, source: 'profile' });
      });
      (onboard || []).forEach(o => {
        if (o.email && !seenEmails.has(o.email.toLowerCase())) {
          members.push({ id: o.id, full_name: o.full_name, email: o.email, role: o.role, source: 'onboard' });
        }
      });

      // Role-specific performance data
      let perf = {};
      if (role === 'sales' || role === 'all') {
        const { data: leads } = await supabase
          .from('sales_leads')
          .select('id, status, assigned_to, estimated_value, created_at, updated_at, last_contact_at')
          .gte('created_at', fromIso);
        (leads || []).forEach(l => {
          const uid = l.assigned_to || 'unassigned';
          perf[uid] ||= { leads_total: 0, leads_won: 0, leads_lost: 0, pipeline_value: 0, stale: 0 };
          perf[uid].leads_total += 1;
          if (l.status === 'won')  perf[uid].leads_won += 1;
          if (l.status === 'lost') perf[uid].leads_lost += 1;
          perf[uid].pipeline_value += Number(l.estimated_value || 0);
          if (l.last_contact_at && daysAgo(l.last_contact_at) > 7) perf[uid].stale += 1;
        });
      }

      if (role === 'dev' || role === 'all') {
        const { data: projs } = await supabase
          .from('projects')
          .select('id, status, assigned_to, progress, created_at, launched_at');
        (projs || []).forEach(p => {
          const uid = p.assigned_to || 'unassigned';
          perf[uid] ||= {};
          perf[uid].projects_total = (perf[uid].projects_total || 0) + 1;
          if (['In Build', 'QA'].includes(p.status)) perf[uid].projects_active = (perf[uid].projects_active || 0) + 1;
          if (p.status === 'Launched')               perf[uid].projects_launched = (perf[uid].projects_launched || 0) + 1;
          if (p.progress) perf[uid].progress_sum = (perf[uid].progress_sum || 0) + p.progress;
        });
      }

      if (role === 'tester' || role === 'all') {
        const { data: ta } = await supabase
          .from('tester_assignments')
          .select('id, assigned_to, status, created_at, completed_at');
        (ta || []).forEach(t => {
          const uid = t.assigned_to || 'unassigned';
          perf[uid] ||= {};
          perf[uid].tester_total = (perf[uid].tester_total || 0) + 1;
          if (t.status === 'completed')  perf[uid].tester_completed = (perf[uid].tester_completed || 0) + 1;
          if (t.status === 'in_progress') perf[uid].tester_active   = (perf[uid].tester_active || 0) + 1;
        });
      }

      if (role === 'ops' || role === 'all') {
        const { data: tickets } = await supabase
          .from('support_tickets')
          .select('id, status, assigned_to, created_at, resolved_at')
          .gte('created_at', fromIso);
        (tickets || []).forEach(t => {
          const uid = t.assigned_to || 'unassigned';
          perf[uid] ||= {};
          perf[uid].tickets_total = (perf[uid].tickets_total || 0) + 1;
          if (t.status === 'resolved' || t.status === 'closed') perf[uid].tickets_closed = (perf[uid].tickets_closed || 0) + 1;
          if (t.resolved_at && t.created_at) {
            const mins = (new Date(t.resolved_at) - new Date(t.created_at)) / 60000;
            perf[uid].resolve_sum = (perf[uid].resolve_sum || 0) + mins;
          }
        });

        // Time entries per user (hours in window)
        const { data: entries } = await supabase
          .from('team_time_entries')
          .select('user_id, duration_minutes, status')
          .gte('clock_in_at', fromIso);
        (entries || []).forEach(e => {
          const uid = e.user_id || 'unassigned';
          perf[uid] ||= {};
          perf[uid].hours_logged = (perf[uid].hours_logged || 0) + (Number(e.duration_minutes || 0) / 60);
        });
      }

      // Build row set
      let rows = members.map(m => ({ ...m, perf: perf[m.id] || {} }));

      // Filter by role (except 'all')
      if (role !== 'all') {
        rows = rows.filter(m => {
          const r = (m.role || '').toLowerCase();
          if (role === 'dev')    return r === 'dev' || r === 'developer' || r === 'admin' || r === 'super_admin';
          if (role === 'sales')  return r === 'sales' || r === 'admin' || r === 'super_admin' || r === 'sales_rep';
          if (role === 'tester') return r === 'tester';
          if (role === 'ops')    return r === 'ops' || r === 'admin' || r === 'super_admin' || r === 'pm';
          return true;
        });
      }

      // Apply search filter
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        rows = rows.filter(r => r.full_name?.toLowerCase().includes(t) || r.email?.toLowerCase().includes(t));
      }

      setTeamData(rows);
    } catch (err) {
      console.error('Role performance fetch failed:', err);
    } finally { setLoading(false); }
  }

  async function drillIntoCall(scorecard) {
    if (expandedCard === scorecard.id) {
      setExpandedCard(null); setDrillData(null); return;
    }
    setExpandedCard(scorecard.id);
    setLoadingDrill(true);
    try {
      const [transcriptRes, tasksRes] = await Promise.all([
        supabase.from('call_transcripts').select('*').eq('appointment_id', scorecard.appointment_id).maybeSingle(),
        supabase.from('call_tasks').select('*').eq('appointment_id', scorecard.appointment_id).order('created_at'),
      ]);
      setDrillData({ transcript: transcriptRes.data, tasks: tasksRes.data || [] });
    } catch (err) {
      console.error('Drill error:', err);
    } finally { setLoadingDrill(false); }
  }

  // ─── Aggregates for consultant view ────────────────────
  const totalCalls  = scorecards.length;
  const avgOverall  = totalCalls > 0 ? (scorecards.reduce((s, x) => s + (x.overall_score || 0), 0) / totalCalls).toFixed(1) : '--';
  const avgChecklist = totalCalls > 0 ? Math.round(scorecards.reduce((s, x) => s + (x.checklist_completion_pct || 0), 0) / totalCalls) : '--';
  const avgEngagement = totalCalls > 0 ? (scorecards.reduce((s, x) => s + (x.client_engagement_score || 0), 0) / totalCalls).toFixed(1) : '--';
  const flaggedCount = scorecards.filter(s => s.overall_score != null && s.overall_score < 5).length;

  const displayed = searchTerm
    ? scorecards.filter(s => {
        const a = s.consulting_appointments;
        const t = searchTerm.toLowerCase();
        return a?.lead_name?.toLowerCase().includes(t) || a?.company_name?.toLowerCase().includes(t);
      })
    : scorecards;

  // ─── Aggregates for role view ──────────────────────────
  const roleStats = useMemo(() => {
    if (role === 'consultant') return null;
    const agg = teamData.reduce((acc, m) => {
      const p = m.perf || {};
      acc.people += 1;
      acc.leads_total += p.leads_total || 0;
      acc.leads_won   += p.leads_won || 0;
      acc.pipeline    += p.pipeline_value || 0;
      acc.projects_total    += p.projects_total || 0;
      acc.projects_launched += p.projects_launched || 0;
      acc.tester_completed  += p.tester_completed || 0;
      acc.tickets_closed    += p.tickets_closed || 0;
      acc.hours_logged      += p.hours_logged || 0;
      return acc;
    }, { people: 0, leads_total: 0, leads_won: 0, pipeline: 0, projects_total: 0, projects_launched: 0, tester_completed: 0, tickets_closed: 0, hours_logged: 0 });
    return agg;
  }, [teamData, role]);

  const roleConfig = ROLES.find(r => r.key === role) || ROLES[0];
  const RoleIcon = roleConfig.icon;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className={`p-2 rounded-xl ${ACCENT_BG[roleConfig.accent]}`}>
              <BarChart3 className="w-6 h-6" />
            </div>
            Leadership QC
          </h1>
          <p className="text-sm text-gray-400 mt-1">Performance, quality, and trends across every team role.</p>
        </div>
        <button
          onClick={() => role === 'consultant' ? fetchScorecards() : fetchRolePerformance()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 hover:text-white hover:border-purple-500/30 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {ROLES.map(r => {
          const Icon = r.icon;
          const isActive = role === r.key;
          return (
            <button
              key={r.key}
              onClick={() => { setRole(r.key); setSelectedMember('all'); setExpandedCard(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                isActive
                  ? `${ACCENT_BG[r.accent]} border-transparent`
                  : 'bg-slate-800/50 border-slate-700 text-gray-400 hover:text-white hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Stat strip */}
      {role === 'consultant' ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={Phone} label="Total Calls" value={totalCalls} />
          <StatCard icon={Star} label="Avg Score" value={avgOverall} suffix="/10" level={scoreLevel(avgOverall)} />
          <StatCard icon={CheckCircle} label="Avg Checklist" value={avgChecklist} suffix="%" level={pctLevel(avgChecklist)} />
          <StatCard icon={TrendingUp} label="Avg Engagement" value={avgEngagement} suffix="/10" level={scoreLevel(avgEngagement)} />
          <StatCard icon={AlertTriangle} label="Flagged" value={flaggedCount} level={flaggedCount > 0 ? 'low' : 'high'} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={Users} label="People" value={roleStats?.people || 0} />
          {(role === 'sales' || role === 'all') && (
            <>
              <StatCard icon={DollarSign} label="Pipeline" value={fmtMoney(roleStats?.pipeline)} />
              <StatCard icon={Award} label="Leads Won" value={roleStats?.leads_won || 0} />
            </>
          )}
          {(role === 'dev' || role === 'all') && (
            <>
              <StatCard icon={Package} label="Active Builds" value={roleStats?.projects_total || 0} />
              <StatCard icon={CheckCircle} label="Launched" value={roleStats?.projects_launched || 0} level="high" />
            </>
          )}
          {role === 'tester' && (
            <StatCard icon={ClipboardCheck} label="Tests Completed" value={roleStats?.tester_completed || 0} />
          )}
          {(role === 'ops' || role === 'all') && (
            <>
              <StatCard icon={Wrench} label="Tickets Closed" value={roleStats?.tickets_closed || 0} />
              <StatCard icon={Timer} label="Hours Logged" value={Math.round(roleStats?.hours_logged || 0)} suffix="h" />
            </>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {role === 'consultant' && (
          <>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={selectedMember}
                onChange={e => setSelectedMember(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="all">All Consultants</option>
                {teamData.filter(m => m.full_name).map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={scoreFilter}
                onChange={e => setScoreFilter(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="all">All Scores</option>
                <option value="high">High (8+)</option>
                <option value="low">Low (&lt;6)</option>
                <option value="flagged">Flagged (&lt;5)</option>
              </select>
            </div>
          </>
        )}

        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={role === 'consultant' ? 'Search by lead or company…' : 'Search by name or email…'}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-purple-500 placeholder-gray-600"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : role === 'consultant' ? (
        <ConsultantList
          displayed={displayed}
          expandedCard={expandedCard}
          drillIntoCall={drillIntoCall}
          drillData={drillData}
          loadingDrill={loadingDrill}
        />
      ) : (
        <RolePerformanceList
          rows={teamData}
          role={role}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Consultant list view (original detailed drill-in)
// ──────────────────────────────────────────────────────────
function ConsultantList({ displayed, expandedCard, drillIntoCall, drillData, loadingDrill }) {
  if (displayed.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No scorecards found for these filters</p>
        <p className="text-sm text-gray-600 mt-1">Scorecards are generated after calls via the AI Summary tool</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayed.map(sc => {
        const appt = sc.consulting_appointments;
        const isExpanded = expandedCard === sc.id;
        const isFlagged = sc.overall_score != null && sc.overall_score < 5;

        return (
          <div key={sc.id} className={`rounded-2xl border transition ${isFlagged ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
            <button
              onClick={() => drillIntoCall(sc)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-800/50 rounded-2xl transition"
            >
              <div className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center shrink-0 ${SCORE_COLORS[scoreLevel(sc.overall_score)]}`}>
                <span className="text-lg font-bold">{sc.overall_score != null ? parseFloat(sc.overall_score).toFixed(1) : '--'}</span>
                <span className="text-[9px] opacity-60">/10</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-200 truncate">{appt?.lead_name || 'Unknown'}</span>
                  {isFlagged && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] font-bold text-red-400 uppercase">Flag</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {appt?.company_name || 'No company'} &middot; {appt?.primary_interest || 'General'}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  {appt?.appointment_date ? new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                </p>
              </div>

              <div className="hidden md:flex items-center gap-3">
                <MiniScore label="Checklist" value={sc.checklist_completion_pct} suffix="%" level={pctLevel(sc.checklist_completion_pct)} />
                <MiniScore label="Topics" value={sc.topic_coverage_score} suffix="/10" level={scoreLevel(sc.topic_coverage_score)} />
                <MiniScore label="Engage" value={sc.client_engagement_score} suffix="/10" level={scoreLevel(sc.client_engagement_score)} />
              </div>

              <div className="shrink-0">
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-700/50 mt-0 pt-4">
                {loadingDrill ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <ScoreBox label="Overall" value={sc.overall_score} suffix="/10" />
                        <ScoreBox label="Checklist" value={sc.checklist_completion_pct} suffix="%" isPct />
                        <ScoreBox label="Topic Coverage" value={sc.topic_coverage_score} suffix="/10" />
                        <ScoreBox label="Engagement" value={sc.client_engagement_score} suffix="/10" />
                      </div>
                      {sc.ai_strengths?.length > 0 && (
                        <InsightBlock title="Strengths" items={sc.ai_strengths} tone="green" Icon={CheckCircle} />
                      )}
                      {sc.ai_improvements?.length > 0 && (
                        <InsightBlock title="Areas to Improve" items={sc.ai_improvements} tone="orange" Icon={Target} />
                      )}
                      {sc.ai_next_meeting_prep?.length > 0 && (
                        <InsightBlock title="Next Meeting Prep" items={sc.ai_next_meeting_prep} tone="sky" Icon={Calendar} />
                      )}
                    </div>

                    <div className="space-y-3">
                      {drillData?.transcript?.ai_summary && (
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                          <h5 className="text-xs font-semibold text-gray-400 mb-1.5">AI Summary</h5>
                          <p className="text-sm text-gray-300 leading-relaxed">{drillData.transcript.ai_summary}</p>
                        </div>
                      )}
                      {drillData?.tasks?.length > 0 && (
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                          <h5 className="text-xs font-semibold text-gray-400 mb-1.5">Call Tasks ({drillData.tasks.length})</h5>
                          <div className="space-y-1">
                            {drillData.tasks.map(task => (
                              <div key={task.id} className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${task.is_completed ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
                                  {task.is_completed && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className={`text-xs flex-1 ${task.is_completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                  {task.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!drillData?.transcript && !drillData?.tasks?.length && (
                        <div className="text-center py-6">
                          <p className="text-sm text-gray-500">No transcript or tasks recorded for this call</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Role performance list view
// ──────────────────────────────────────────────────────────
function RolePerformanceList({ rows, role }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No team members match this filter</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(m => {
        const p = m.perf || {};
        const winRate = p.leads_total ? Math.round((p.leads_won / p.leads_total) * 100) : null;
        const resolveAvg = p.tickets_closed && p.resolve_sum ? Math.round(p.resolve_sum / p.tickets_closed) : null;
        const avgProgress = p.projects_total && p.progress_sum ? Math.round(p.progress_sum / p.projects_total) : null;

        return (
          <div key={m.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
            <div className="flex items-start gap-4">
              {/* Avatar / initial */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-sky-500/30 flex items-center justify-center text-lg font-bold text-white shrink-0">
                {(m.full_name || m.email || '?').charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-200">{m.full_name || m.email}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-gray-300 rounded uppercase tracking-wider">
                    {m.role || 'unassigned'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{m.email || '—'}</p>

                {/* Metrics row */}
                <div className="flex flex-wrap gap-3 mt-3">
                  {(role === 'sales' || role === 'all') && p.leads_total != null && (
                    <>
                      <Metric label="Leads" value={p.leads_total} />
                      <Metric label="Won" value={p.leads_won || 0} level="high" />
                      <Metric label="Win Rate" value={winRate != null ? `${winRate}%` : '--'} level={pctLevel(winRate)} />
                      <Metric label="Pipeline" value={fmtMoney(p.pipeline_value)} />
                      {p.stale > 0 && <Metric label="Stale" value={p.stale} level="low" />}
                    </>
                  )}
                  {(role === 'dev' || role === 'all') && p.projects_total != null && (
                    <>
                      <Metric label="Projects" value={p.projects_total} />
                      <Metric label="Active" value={p.projects_active || 0} />
                      <Metric label="Launched" value={p.projects_launched || 0} level="high" />
                      {avgProgress != null && <Metric label="Avg %" value={`${avgProgress}%`} level={pctLevel(avgProgress)} />}
                    </>
                  )}
                  {role === 'tester' && p.tester_total != null && (
                    <>
                      <Metric label="Assigned" value={p.tester_total} />
                      <Metric label="Completed" value={p.tester_completed || 0} level="high" />
                      <Metric label="In Progress" value={p.tester_active || 0} />
                    </>
                  )}
                  {(role === 'ops' || role === 'all') && p.tickets_total != null && (
                    <>
                      <Metric label="Tickets" value={p.tickets_total} />
                      <Metric label="Closed" value={p.tickets_closed || 0} level="high" />
                      {resolveAvg != null && <Metric label="Avg Resolve" value={`${Math.round(resolveAvg)}m`} />}
                    </>
                  )}
                  {(role === 'ops' || role === 'all') && p.hours_logged != null && (
                    <Metric label="Hours" value={`${Math.round(p.hours_logged)}h`} />
                  )}
                  {Object.keys(p).length === 0 && (
                    <span className="text-xs text-gray-600 italic">No activity in the selected window</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, suffix = '', level }) {
  const colorClass = level ? SCORE_COLORS[level] : 'text-gray-200 bg-slate-800/50 border-slate-700/50';
  return (
    <div className={`border rounded-2xl p-4 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}{suffix}</p>
    </div>
  );
}

function MiniScore({ label, value, suffix, level }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${SCORE_COLORS[level]?.split(' ')[0] || 'text-gray-400'}`}>
        {value != null ? (suffix === '%' ? Math.round(value) : parseFloat(value).toFixed(1)) : '--'}{value != null ? suffix : ''}
      </p>
      <p className="text-[10px] text-gray-600">{label}</p>
    </div>
  );
}

function ScoreBox({ label, value, suffix, isPct = false }) {
  const level = isPct ? pctLevel(value) : scoreLevel(value);
  const display = value != null ? (isPct ? Math.round(value) : parseFloat(value).toFixed(1)) : '--';
  return (
    <div className={`border rounded-xl p-2.5 text-center ${SCORE_COLORS[level]}`}>
      <p className="text-xs opacity-70 mb-0.5">{label}</p>
      <p className="text-lg font-bold">{display}{value != null ? suffix : ''}</p>
    </div>
  );
}

function InsightBlock({ title, items, tone, Icon }) {
  const toneMap = {
    green:  'bg-green-500/5 border-green-500/20 text-green-400',
    orange: 'bg-orange-500/5 border-orange-500/20 text-orange-400',
    sky:    'bg-sky-500/5 border-sky-500/20 text-sky-400',
    purple: 'bg-purple-500/5 border-purple-500/20 text-purple-400',
  };
  return (
    <div className={`border rounded-xl p-3 ${toneMap[tone] || toneMap.sky}`}>
      <h5 className="text-xs font-semibold mb-1.5">{title}</h5>
      {items.map((s, i) => (
        <p key={i} className="text-xs text-gray-300 mb-1 flex items-start gap-1.5">
          <Icon className="w-3 h-3 shrink-0 mt-0.5" />{s}
        </p>
      ))}
    </div>
  );
}

function Metric({ label, value, level }) {
  const color = level ? SCORE_COLORS[level] : 'text-gray-200 bg-slate-800/70 border-slate-700/50';
  return (
    <div className={`border rounded-lg px-2.5 py-1.5 ${color}`}>
      <div className="text-[10px] opacity-70 leading-none mb-0.5">{label}</div>
      <div className="text-sm font-semibold leading-tight">{value}</div>
    </div>
  );
}
