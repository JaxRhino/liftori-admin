/**
 * EOS L10 Meetings Hub — Run structured meetings for Liftori and consulting clients
 *
 * Scaffold for Level 10 meeting management system with support for:
 * - Internal Liftori team meetings
 * - Per-client consulting meetings
 * - Meeting recordings, agendas, and outcomes
 * - Rock (quarterly goal) management
 * - To-Do tracking
 * - Issue identification and resolution
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Calendar, Target, CheckSquare, AlertTriangle, Plus, Users,
  Building2, Clock, ChevronRight, Loader2, Star, ArrowRight,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const TABS = {
  INTERNAL: 'internal',
  CLIENTS: 'clients'
};

const PRIORITY_COLORS = {
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  high: 'bg-red-500/20 text-red-300 border-red-500/30'
};

const STATUS_COLORS = {
  not_started: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  blocked: 'bg-red-500/20 text-red-300 border-red-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
};

function RockDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    owner_id: '',
    quarter: 'Q2 2026',
    status: 'not_started'
  });
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    fetchProfiles();
  }, [open]);

  async function fetchProfiles() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (data) setProfiles(data);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.owner_id) {
      toast.error('Title and owner required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('eos_rocks')
        .insert({
          title: form.title.trim(),
          owner_id: form.owner_id,
          quarter: form.quarter,
          status: form.status,
          context_type: 'internal'
        });
      if (error) throw error;
      toast.success('Rock created');
      setForm({ title: '', owner_id: '', quarter: 'Q2 2026', status: 'not_started' });
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Add Rock
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Rock title *"
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
            autoFocus
          />
          <select
            value={form.owner_id}
            onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Select owner *</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <select
            value={form.quarter}
            onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))}
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="Q1 2026">Q1 2026</option>
            <option value="Q2 2026">Q2 2026</option>
            <option value="Q3 2026">Q3 2026</option>
            <option value="Q4 2026">Q4 2026</option>
          </select>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
            <option value="paused">Paused</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-amber-500/20 border border-amber-500/50 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Rock'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700/30 border border-slate-600/50 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodoDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    assigned_to: '',
    due_date: ''
  });
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    fetchProfiles();
  }, [open]);

  async function fetchProfiles() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (data) setProfiles(data);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('eos_todos')
        .insert({
          title: form.title.trim(),
          assigned_to: form.assigned_to || null,
          due_date: form.due_date || null,
          status: 'not_started',
          context_type: 'internal'
        });
      if (error) throw error;
      toast.success('To-Do created');
      setForm({ title: '', assigned_to: '', due_date: '' });
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400" />
            Add To-Do
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="To-Do title *"
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            autoFocus
          />
          <select
            value={form.assigned_to}
            onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="">Assign to (optional)</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
          <input
            type="date"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create To-Do'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700/30 border border-slate-600/50 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueDialog({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    priority: 'medium'
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('eos_issues')
        .insert({
          title: form.title.trim(),
          priority: form.priority,
          status: 'not_started',
          context_type: 'internal'
        });
      if (error) throw error;
      toast.success('Issue created');
      setForm({ title: '', priority: 'medium' });
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Add Issue
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Issue title *"
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-red-500"
            autoFocus
          />
          <select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            className="w-full bg-slate-700/30 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Issue'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700/30 border border-slate-600/50 text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EOSL10Hub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(TABS.INTERNAL);
  const [meetings, setMeetings] = useState([]);
  const [rocks, setRocks] = useState([]);
  const [todos, setTodos] = useState([]);
  const [issues, setIssues] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showRockDialog, setShowRockDialog] = useState(false);
  const [showTodoDialog, setShowTodoDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === TABS.INTERNAL) {
        const [meetRes, rockRes, todoRes, issueRes] = await Promise.all([
          supabase
            .from('l10_meetings')
            .select('*')
            .eq('context_type', 'internal')
            .order('scheduled_date', { ascending: true }),
          supabase
            .from('eos_rocks')
            .select('*')
            .eq('context_type', 'internal')
            .order('created_at', { ascending: false }),
          supabase
            .from('eos_todos')
            .select('*')
            .eq('context_type', 'internal')
            .order('due_date', { ascending: true }),
          supabase
            .from('eos_issues')
            .select('*')
            .eq('context_type', 'internal')
            .order('created_at', { ascending: false })
        ]);

        if (meetRes.error) throw meetRes.error;
        if (rockRes.error) throw rockRes.error;
        if (todoRes.error) throw todoRes.error;
        if (issueRes.error) throw issueRes.error;

        setMeetings(meetRes.data || []);
        setRocks(rockRes.data || []);
        setTodos(todoRes.data || []);
        setIssues(issueRes.data || []);
      } else {
        const [meetRes, clientRes] = await Promise.all([
          supabase
            .from('l10_meetings')
            .select('*')
            .eq('context_type', 'client')
            .order('scheduled_date', { ascending: true }),
          supabase
            .from('consulting_engagements')
            .select('id, company_name, client_contact_email')
            .order('company_name', { ascending: true })
        ]);

        if (meetRes.error) throw meetRes.error;
        if (clientRes.error) throw clientRes.error;

        setMeetings(meetRes.data || []);
        setClients(clientRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const upcomingCount = useMemo(() => {
    const now = new Date();
    return meetings.filter(m => new Date(m.scheduled_date) > now).length;
  }, [meetings]);

  const openRocksCount = useMemo(() => {
    return rocks.filter(r => r.status !== 'completed').length;
  }, [rocks]);

  const openTodosCount = useMemo(() => {
    return todos.filter(t => t.status !== 'completed').length;
  }, [todos]);

  const openIssuesCount = useMemo(() => {
    return issues.filter(i => i.status !== 'completed').length;
  }, [issues]);

  const clientMeetingsByClient = useMemo(() => {
    const grouped = {};
    meetings.forEach(m => {
      if (!grouped[m.client_id]) {
        grouped[m.client_id] = [];
      }
      grouped[m.client_id].push(m);
    });
    return grouped;
  }, [meetings]);

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-blue-400" />
            EOS / L10 Meetings
          </h1>
          <p className="text-slate-400">Run structured Level 10 meetings for your team and consulting clients</p>
        </div>

        {/* Context Toggle */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab(TABS.INTERNAL)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === TABS.INTERNAL
                ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Liftori Internal
          </button>
          <button
            onClick={() => setActiveTab(TABS.CLIENTS)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === TABS.CLIENTS
                ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4 inline-block mr-2" />
            Client Meetings
          </button>
        </div>

        {/* Internal Tab */}
        {activeTab === TABS.INTERNAL && (
          <div className="space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Upcoming Meetings</p>
                    <p className="text-3xl font-bold text-white mt-1">{upcomingCount}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-400 opacity-50" />
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Open To-Dos</p>
                    <p className="text-3xl font-bold text-white mt-1">{openTodosCount}</p>
                  </div>
                  <CheckSquare className="w-8 h-8 text-emerald-400 opacity-50" />
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Active Rocks</p>
                    <p className="text-3xl font-bold text-white mt-1">{openRocksCount}</p>
                  </div>
                  <Target className="w-8 h-8 text-amber-400 opacity-50" />
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Open Issues</p>
                    <p className="text-3xl font-bold text-white mt-1">{openIssuesCount}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400 opacity-50" />
                </div>
              </div>
            </div>

            {/* Upcoming Meetings */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Upcoming Meetings
                </h2>
                <button className="bg-blue-500/20 border border-blue-500/50 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Schedule L10
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              ) : meetings.length === 0 ? (
                <p className="text-slate-500 py-8 text-center">No upcoming meetings scheduled</p>
              ) : (
                <div className="space-y-3">
                  {meetings.slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-slate-500" />
                        <div>
                          <p className="text-white font-medium">{m.title || 'L10 Meeting'}</p>
                          <p className="text-slate-400 text-sm">
                            {new Date(m.scheduled_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rocks */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  Rocks (Quarterly Goals)
                </h2>
                <button
                  onClick={() => setShowRockDialog(true)}
                  className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Rock
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              ) : rocks.length === 0 ? (
                <p className="text-slate-500 py-8 text-center">No rocks yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rocks.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <Star className="w-5 h-5 text-amber-400" />
                        <div className="flex-1">
                          <p className="text-white font-medium">{r.title}</p>
                          <p className="text-slate-400 text-xs">{r.quarter}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[r.status] || STATUS_COLORS.not_started}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* To-Dos */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-emerald-400" />
                  To-Dos
                </h2>
                <button
                  onClick={() => setShowTodoDialog(true)}
                  className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add To-Do
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              ) : todos.length === 0 ? (
                <p className="text-slate-500 py-8 text-center">No to-dos yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {todos.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <CheckSquare className="w-5 h-5 text-emerald-400" />
                        <div className="flex-1">
                          <p className="text-white font-medium">{t.title}</p>
                          <p className="text-slate-400 text-xs">
                            {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[t.status] || STATUS_COLORS.not_started}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Issues */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Issues
                </h2>
                <button
                  onClick={() => setShowIssueDialog(true)}
                  className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Issue
                </button>
              </div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                </div>
              ) : issues.length === 0 ? (
                <p className="text-slate-500 py-8 text-center">No issues yet</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {issues.map(i => (
                    <div key={i.id} className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <p className="text-white font-medium flex-1">{i.title}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded border ${PRIORITY_COLORS[i.priority] || PRIORITY_COLORS.medium}`}>
                        {i.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === TABS.CLIENTS && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
              </div>
            ) : clients.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No client engagements yet</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {clients.map(client => {
                  const clientMeetings = clientMeetingsByClient[client.id] || [];
                  const nextMeeting = clientMeetings.sort(
                    (a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)
                  )[0];
                  const lastMeeting = clientMeetings.sort(
                    (a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date)
                  )[0];

                  return (
                    <div key={client.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-400" />
                            {client.company_name}
                          </h3>
                          <p className="text-slate-400 text-sm mt-1">{client.client_contact_email}</p>
                        </div>
                        <button className="bg-blue-500/20 border border-blue-500/50 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center gap-2 text-sm">
                          <ArrowRight className="w-4 h-4" />
                          View Details
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Next Meeting</p>
                          <p className="text-white font-medium">
                            {nextMeeting
                              ? new Date(nextMeeting.scheduled_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'Not scheduled'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Total Meetings</p>
                          <p className="text-white font-medium">{clientMeetings.length}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Last Rating</p>
                          <p className="text-white font-medium flex items-center gap-1">
                            {lastMeeting?.rating ? (
                              <>
                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                {lastMeeting.rating}
                              </>
                            ) : (
                              'No rating'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RockDialog open={showRockDialog} onClose={() => setShowRockDialog(false)} onSave={() => {
        setShowRockDialog(false);
        fetchData();
      }} />
      <TodoDialog open={showTodoDialog} onClose={() => setShowTodoDialog(false)} onSave={() => {
        setShowTodoDialog(false);
        fetchData();
      }} />
      <IssueDialog open={showIssueDialog} onClose={() => setShowIssueDialog(false)} onSave={() => {
        setShowIssueDialog(false);
        fetchData();
      }} />
    </div>
  );
}
