/**
 * Leadership QC Dashboard — Operations
 *
 * Quality control for consulting calls:
 * - View all consultant scorecards + metrics
 * - Filter by consultant, date range, score range
 * - Drill into individual call reviews (transcript, scorecard, tasks)
 * - Aggregate performance trends
 * - Training flags for low-scoring calls
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart3, Users, TrendingUp, AlertTriangle, Eye, ChevronDown,
  ChevronUp, Calendar, Search, Filter, Star, Target, CheckCircle,
  Clock, Phone, XCircle, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, RefreshCw, X
} from 'lucide-react';

const SCORE_COLORS = {
  high: 'text-green-400 bg-green-500/10 border-green-500/20',
  mid: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-red-400 bg-red-500/10 border-red-500/20',
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

export default function LeadershipQC() {
  const [loading, setLoading] = useState(true);
  const [scorecards, setScorecards] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [selectedConsultant, setSelectedConsultant] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState(null);
  const [drillData, setDrillData] = useState(null);
  const [loadingDrill, setLoadingDrill] = useState(false);

  useEffect(() => {
    fetchScorecards();
  }, [selectedConsultant, dateRange, scoreFilter]);

  async function fetchScorecards() {
    setLoading(true);
    try {
      // Date filter
      const now = new Date();
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - parseInt(dateRange));

      let query = supabase
        .from('call_scorecards')
        .select('*, consulting_appointments(lead_name, company_name, primary_interest, appointment_date, appointment_start, status, lead_email, engagement_tier)')
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false });

      if (selectedConsultant !== 'all') {
        query = query.eq('consultant_id', selectedConsultant);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      // Score filter
      if (scoreFilter === 'low') {
        filtered = filtered.filter(s => s.overall_score != null && s.overall_score < 6);
      } else if (scoreFilter === 'high') {
        filtered = filtered.filter(s => s.overall_score != null && s.overall_score >= 8);
      } else if (scoreFilter === 'flagged') {
        filtered = filtered.filter(s => s.overall_score != null && s.overall_score < 5);
      }

      setScorecards(filtered);

      // Get unique consultants for the filter
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['admin', 'consultant']);
      setConsultants(profiles || []);
    } catch (err) {
      console.error('Error fetching scorecards:', err);
    } finally {
      setLoading(false);
    }
  }

  // Drill into a specific call
  async function drillIntoCall(scorecard) {
    if (expandedCard === scorecard.id) {
      setExpandedCard(null);
      setDrillData(null);
      return;
    }
    setExpandedCard(scorecard.id);
    setLoadingDrill(true);
    try {
      // Fetch transcript + tasks for this appointment
      const [transcriptRes, tasksRes] = await Promise.all([
        supabase.from('call_transcripts').select('*').eq('appointment_id', scorecard.appointment_id).maybeSingle(),
        supabase.from('call_tasks').select('*').eq('appointment_id', scorecard.appointment_id).order('created_at'),
      ]);
      setDrillData({
        transcript: transcriptRes.data,
        tasks: tasksRes.data || [],
      });
    } catch (err) {
      console.error('Drill error:', err);
    } finally {
      setLoadingDrill(false);
    }
  }

  // Compute aggregate stats
  const totalCalls = scorecards.length;
  const avgOverall = totalCalls > 0
    ? (scorecards.reduce((sum, s) => sum + (s.overall_score || 0), 0) / totalCalls).toFixed(1)
    : '--';
  const avgChecklist = totalCalls > 0
    ? Math.round(scorecards.reduce((sum, s) => sum + (s.checklist_completion_pct || 0), 0) / totalCalls)
    : '--';
  const avgEngagement = totalCalls > 0
    ? (scorecards.reduce((sum, s) => sum + (s.client_engagement_score || 0), 0) / totalCalls).toFixed(1)
    : '--';
  const flaggedCount = scorecards.filter(s => s.overall_score != null && s.overall_score < 5).length;

  // Search filter
  const displayed = searchTerm
    ? scorecards.filter(s => {
        const appt = s.consulting_appointments;
        const term = searchTerm.toLowerCase();
        return (appt?.lead_name?.toLowerCase().includes(term)) ||
               (appt?.company_name?.toLowerCase().includes(term));
      })
    : scorecards;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-purple-500/15 rounded-xl">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            Leadership QC
          </h1>
          <p className="text-sm text-gray-400 mt-1">Consultant performance, call quality, and training insights</p>
        </div>
        <button
          onClick={fetchScorecards}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 hover:text-white hover:border-purple-500/30 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard icon={Phone} label="Total Calls" value={totalCalls} />
        <StatCard icon={Star} label="Avg Score" value={avgOverall} suffix="/10" level={scoreLevel(avgOverall)} />
        <StatCard icon={CheckCircle} label="Avg Checklist" value={avgChecklist} suffix="%" level={pctLevel(avgChecklist)} />
        <StatCard icon={TrendingUp} label="Avg Engagement" value={avgEngagement} suffix="/10" level={scoreLevel(avgEngagement)} />
        <StatCard icon={AlertTriangle} label="Flagged" value={flaggedCount} level={flaggedCount > 0 ? 'low' : 'high'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Consultant */}
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={selectedConsultant}
            onChange={e => setSelectedConsultant(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
          >
            <option value="all">All Consultants</option>
            {consultants.map(c => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
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

        {/* Score filter */}
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

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by lead or company..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-purple-500 placeholder-gray-600"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scorecards Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No scorecards found for these filters</p>
          <p className="text-sm text-gray-600 mt-1">Scorecards are generated after calls via the AI Summary tool</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(sc => {
            const appt = sc.consulting_appointments;
            const isExpanded = expandedCard === sc.id;
            const isFlagged = sc.overall_score != null && sc.overall_score < 5;

            return (
              <div key={sc.id} className={`rounded-2xl border transition ${isFlagged ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                {/* Row */}
                <button
                  onClick={() => drillIntoCall(sc)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-800/50 rounded-2xl transition"
                >
                  {/* Overall Score */}
                  <div className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center shrink-0 ${SCORE_COLORS[scoreLevel(sc.overall_score)]}`}>
                    <span className="text-lg font-bold">{sc.overall_score != null ? parseFloat(sc.overall_score).toFixed(1) : '--'}</span>
                    <span className="text-[9px] opacity-60">/10</span>
                  </div>

                  {/* Lead info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200 truncate">{appt?.lead_name || 'Unknown'}</span>
                      {isFlagged && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] font-bold text-red-400 uppercase">Flag</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {appt?.company_name || 'No company'} &middot; {appt?.primary_interest || 'General'} &middot; {appt?.engagement_tier || 'discovery'}
                    </p>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {appt?.appointment_date ? new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                    </p>
                  </div>

                  {/* Mini scores */}
                  <div className="hidden md:flex items-center gap-3">
                    <MiniScore label="Checklist" value={sc.checklist_completion_pct} suffix="%" level={pctLevel(sc.checklist_completion_pct)} />
                    <MiniScore label="Topics" value={sc.topic_coverage_score} suffix="/10" level={scoreLevel(sc.topic_coverage_score)} />
                    <MiniScore label="Engage" value={sc.client_engagement_score} suffix="/10" level={scoreLevel(sc.client_engagement_score)} />
                  </div>

                  {/* Expand icon */}
                  <div className="shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700/50 mt-0 pt-4">
                    {loadingDrill ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Left — Scores & AI insights */}
                        <div className="space-y-3">
                          {/* All scores */}
                          <div className="grid grid-cols-2 gap-2">
                            <ScoreBox label="Overall" value={sc.overall_score} suffix="/10" />
                            <ScoreBox label="Checklist" value={sc.checklist_completion_pct} suffix="%" isPct />
                            <ScoreBox label="Topic Coverage" value={sc.topic_coverage_score} suffix="/10" />
                            <ScoreBox label="Engagement" value={sc.client_engagement_score} suffix="/10" />
                            <ScoreBox label="Call Duration" value={sc.call_duration_score} suffix="/10" />
                          </div>

                          {/* Strengths */}
                          {sc.ai_strengths?.length > 0 && (
                            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-green-400 mb-1.5">Strengths</h5>
                              {sc.ai_strengths.map((s, i) => (
                                <p key={i} className="text-xs text-gray-300 mb-1 flex items-start gap-1.5">
                                  <CheckCircle className="w-3 h-3 shrink-0 mt-0.5 text-green-500" />{s}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Improvements */}
                          {sc.ai_improvements?.length > 0 && (
                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-orange-400 mb-1.5">Areas to Improve</h5>
                              {sc.ai_improvements.map((s, i) => (
                                <p key={i} className="text-xs text-gray-300 mb-1 flex items-start gap-1.5">
                                  <Target className="w-3 h-3 shrink-0 mt-0.5 text-orange-500" />{s}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Next meeting prep */}
                          {sc.ai_next_meeting_prep?.length > 0 && (
                            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-sky-400 mb-1.5">Next Meeting Prep</h5>
                              {sc.ai_next_meeting_prep.map((s, i) => (
                                <p key={i} className="text-xs text-gray-300 mb-1 flex items-start gap-1.5">
                                  <Calendar className="w-3 h-3 shrink-0 mt-0.5 text-sky-500" />{s}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Upsell */}
                          {sc.ai_upsell_opportunities?.length > 0 && (
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-purple-400 mb-1.5">Upsell Opportunities</h5>
                              {sc.ai_upsell_opportunities.map((s, i) => (
                                <p key={i} className="text-xs text-gray-300 mb-1 flex items-start gap-1.5">
                                  <ArrowUpRight className="w-3 h-3 shrink-0 mt-0.5 text-purple-500" />{s}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right — Transcript + Tasks */}
                        <div className="space-y-3">
                          {/* AI Summary */}
                          {drillData?.transcript?.ai_summary && (
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-gray-400 mb-1.5">AI Summary</h5>
                              <p className="text-sm text-gray-300 leading-relaxed">{drillData.transcript.ai_summary}</p>
                            </div>
                          )}

                          {/* Transcript excerpt */}
                          {drillData?.transcript?.transcript_text && (
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-gray-400 mb-1.5">Transcript</h5>
                              <div className="max-h-48 overflow-y-auto text-xs text-gray-400 font-mono whitespace-pre-wrap">
                                {drillData.transcript.transcript_text}
                              </div>
                              <p className="text-[10px] text-gray-600 mt-2">
                                {drillData.transcript.word_count || 0} words &middot; {drillData.transcript.transcription_mode || 'speech_api'}
                              </p>
                            </div>
                          )}

                          {/* Tasks */}
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
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.assigned_to === 'client' ? 'bg-sky-500/10 text-sky-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                      {task.assigned_to}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Client health */}
                          {sc.ai_client_health_signals?.length > 0 && (
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                              <h5 className="text-xs font-semibold text-gray-400 mb-1.5">Client Health Signals</h5>
                              {sc.ai_client_health_signals.map((s, i) => (
                                <p key={i} className="text-xs text-gray-300 mb-1">{s}</p>
                              ))}
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
      )}
    </div>
  );
}

// --- Sub-components ---

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
  const display = value != null
    ? (isPct ? Math.round(value) : parseFloat(value).toFixed(1))
    : '--';
  return (
    <div className={`border rounded-xl p-2.5 text-center ${SCORE_COLORS[level]}`}>
      <p className="text-xs opacity-70 mb-0.5">{label}</p>
      <p className="text-lg font-bold">{display}{value != null ? suffix : ''}</p>
    </div>
  );
}
