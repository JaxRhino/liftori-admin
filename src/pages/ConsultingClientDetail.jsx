import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Edit,
  ChevronRight,
  Plus,
  Download,
  Calendar,
  Users,
  FileText,
  AlertCircle,
  Loader,
  Building2,
  Users2,
  Globe,
  Target,
} from 'lucide-react';
import { CompanyTab, OrgChartTab, WebSeoTab, EosTab } from '../components/consulting/ConsultingClientTabs';

const STAGES = [
  { id: 'lead', label: 'Lead', color: 'bg-blue-900/30 text-blue-300' },
  { id: 'audit', label: 'Audit', color: 'bg-indigo-900/30 text-indigo-300' },
  { id: 'plan_presentation', label: 'Plan Present.', color: 'bg-purple-900/30 text-purple-300' },
  { id: 'plan_adjustments', label: 'Plan Adjust.', color: 'bg-amber-900/30 text-amber-300' },
  { id: 'implementation', label: 'Implement', color: 'bg-orange-900/30 text-orange-300' },
  { id: 'ongoing', label: 'Ongoing', color: 'bg-emerald-900/30 text-emerald-300' },
  { id: 'completed', label: 'Completed', color: 'bg-green-900/30 text-green-300' },
];

const STAGE_COLORS = {
  lead: 'bg-blue-900/30 text-blue-300 border-blue-700/50',
  audit: 'bg-indigo-900/30 text-indigo-300 border-indigo-700/50',
  plan_presentation: 'bg-purple-900/30 text-purple-300 border-purple-700/50',
  plan_adjustments: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
  implementation: 'bg-orange-900/30 text-orange-300 border-orange-700/50',
  ongoing: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
  completed: 'bg-green-900/30 text-green-300 border-green-700/50',
};

const HEALTH_COLORS = {
  1: 'bg-red-900/40 text-red-300',
  2: 'bg-red-900/30 text-red-400',
  3: 'bg-orange-900/30 text-orange-400',
  4: 'bg-amber-900/30 text-amber-400',
  5: 'bg-yellow-900/30 text-yellow-400',
  6: 'bg-lime-900/30 text-lime-400',
  7: 'bg-emerald-900/30 text-emerald-400',
  8: 'bg-green-900/30 text-green-400',
  9: 'bg-green-900/30 text-green-300',
  10: 'bg-green-900/30 text-green-300',
};

export default function ConsultingClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [engagement, setEngagement] = useState(null);
  const [progressEntries, setProgressEntries] = useState([]);
  const [l10Meetings, setL10Meetings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressForm, setProgressForm] = useState({
    week_of: '',
    summary: '',
    wins: '',
    blockers: '',
    health_score: 5,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch engagement
      const { data: engData, error: engError } = await supabase
        .from('consulting_engagements')
        .select('*')
        .eq('id', id)
        .single();

      if (engError) throw engError;
      setEngagement(engData);

      // Fetch progress entries
      const { data: progData, error: progError } = await supabase
        .from('consulting_progress')
        .select('*')
        .eq('engagement_id', id)
        .order('week_of', { ascending: false });

      if (progError) throw progError;
      setProgressEntries(progData || []);

      // Fetch L10 meetings
      const { data: l10Data, error: l10Error } = await supabase
        .from('l10_meetings')
        .select('*')
        .eq('context_type', 'client')
        .eq('context_id', id)
        .order('date', { ascending: false });

      if (l10Error) throw l10Error;
      setL10Meetings(l10Data || []);

      // Fetch documents
      const { data: docData, error: docError } = await supabase
        .from('consulting_documents')
        .select('*')
        .eq('engagement_id', id)
        .order('created_at', { ascending: false });

      if (docError) throw docError;
      setDocuments(docData || []);
    } catch (error) {
      console.error('Error loading engagement:', error);
      toast.error('Failed to load engagement');
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (newStage) => {
    try {
      const { error } = await supabase
        .from('consulting_engagements')
        .update({ engagement_stage: newStage })
        .eq('id', id);

      if (error) throw error;

      setEngagement({ ...engagement, engagement_stage: newStage });
      setStageMenuOpen(false);
      toast.success('Stage updated');
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const { error } = await supabase.from('consulting_progress').insert([
        {
          engagement_id: id,
          week_of: progressForm.week_of,
          summary: progressForm.summary,
          wins: progressForm.wins,
          blockers: progressForm.blockers,
          health_score: progressForm.health_score,
          notes: progressForm.notes,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      toast.success('Weekly update added');
      setProgressForm({
        week_of: '',
        summary: '',
        wins: '',
        blockers: '',
        health_score: 5,
        notes: '',
      });
      setShowProgressForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding progress:', error);
      toast.error('Failed to add update');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="animate-spin text-slate-400" size={40} />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="text-slate-400" size={48} />
        <p className="text-slate-400">Engagement not found</p>
        <button
          onClick={() => navigate('/admin/consulting/clients')}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
        >
          Back to Clients
        </button>
      </div>
    );
  }

  const currentStageIndex = STAGES.findIndex((s) => s.id === engagement.engagement_stage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/consulting/clients')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-4 transition"
        >
          <ArrowLeft size={20} />
          Back to Clients
        </button>

        {!engagement.onboarding_completed && (
          <div className="mb-4 bg-gradient-to-r from-purple-600/20 to-fuchsia-600/10 border border-purple-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-purple-200">
                Onboarding in progress — step {Math.min(engagement.onboarding_step || 1, 7)} of 7
              </p>
              <p className="text-xs text-purple-300/80 mt-0.5">
                Finish the profile to unlock the full audit, SEO scan, and EOS seeding.
              </p>
            </div>
            <button
              onClick={() => navigate(`/admin/consulting/onboard/${engagement.id}`)}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition"
            >
              Resume onboarding
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{engagement.client_name}</h1>
              <p className="text-slate-400">{engagement.company_name}</p>
            </div>
            <div className={`px-4 py-2 rounded-lg font-semibold ${STAGE_COLORS[engagement.engagement_stage]} border`}>
              {STAGES.find((s) => s.id === engagement.engagement_stage)?.label}
            </div>
          </div>

          {engagement.health_score && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400">Health Score:</span>
              <div className={`px-3 py-1 rounded-lg font-semibold ${HEALTH_COLORS[Math.round(engagement.health_score)]}`}>
                {engagement.health_score.toFixed(1)}/10
              </div>
            </div>
          )}

          {/* Stage Progress Bar */}
          <div className="mb-6 pt-4 border-t border-slate-700/50">
            <div className="flex items-center gap-1">
              {STAGES.map((stage, idx) => (
                <div key={stage.id} className="flex items-center flex-1">
                  <div
                    className={`h-10 flex-1 rounded-lg transition flex items-center justify-center text-xs font-medium ${
                      idx <= currentStageIndex
                        ? STAGE_COLORS[stage.id]
                        : 'bg-slate-700/30 text-slate-500 border border-slate-700/30'
                    } border`}
                  >
                    {stage.label}
                  </div>
                  {idx < STAGES.length - 1 && <ChevronRight size={16} className="text-slate-600 mx-1" />}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setStageMenuOpen(!stageMenuOpen)}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition flex items-center gap-2"
              >
                Change Stage
                <ChevronRight size={16} />
              </button>
              {stageMenuOpen && (
                <div className="absolute top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                  {STAGES.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={() => handleStageChange(stage.id)}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-700/50 transition ${
                        stage.id === engagement.engagement_stage ? 'bg-slate-700 font-semibold' : ''
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition flex items-center gap-2">
              <Edit size={16} />
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-700/50">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'company', label: 'Company' },
            { id: 'org', label: 'Org Chart' },
            { id: 'web', label: 'Web & SEO' },
            { id: 'eos', label: 'EOS' },
            { id: 'audit', label: 'Audit' },
            { id: 'plan', label: 'Plan' },
            { id: 'progress', label: 'Progress' },
            { id: 'l10', label: 'L10 Meetings' },
            { id: 'documents', label: 'Documents' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 font-medium transition text-center ${
                activeTab === tab.id
                  ? 'bg-slate-700/50 text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Client Info */}
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-4 text-emerald-400">Client Information</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-400">Name</p>
                      <p className="font-medium">{engagement.client_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Email</p>
                      <p className="font-medium">{engagement.client_email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Phone</p>
                      <p className="font-medium">{engagement.client_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Company</p>
                      <p className="font-medium">{engagement.company_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Industry</p>
                      <p className="font-medium">{engagement.industry || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Company Size</p>
                      <p className="font-medium">{engagement.company_size || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Engagement Details */}
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-4 text-emerald-400">Engagement Details</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-400">Type</p>
                      <p className="font-medium capitalize">{engagement.engagement_type || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Stage</p>
                      <p className="font-medium">{STAGES.find((s) => s.id === engagement.engagement_stage)?.label}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Consultant</p>
                      <p className="font-medium">{engagement.consultant_name || 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Contract Value</p>
                      <p className="font-medium">${(engagement.contract_value || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Billing</p>
                      <p className="font-medium capitalize">{engagement.billing_model || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Setup */}
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-4 text-emerald-400">Setup</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Uses LABOS</span>
                      <span className={`px-2 py-1 rounded ${engagement.uses_labos ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                        {engagement.uses_labos ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Uses Own CRM</span>
                      <span className={`px-2 py-1 rounded ${engagement.uses_own_crm ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                        {engagement.uses_own_crm ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {engagement.crm_name && (
                      <div>
                        <p className="text-slate-400">CRM Name</p>
                        <p className="font-medium">{engagement.crm_name}</p>
                      </div>
                    )}
                    {engagement.tech_stack_notes && (
                      <div>
                        <p className="text-slate-400">Tech Stack</p>
                        <p className="font-medium text-xs">{engagement.tech_stack_notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Meeting Schedule */}
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-4 text-emerald-400">Meeting Schedule</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-400">Weekly Day</p>
                      <p className="font-medium">{engagement.meeting_day || 'TBD'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Weekly Time</p>
                      <p className="font-medium">{engagement.meeting_time || 'TBD'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Next Meeting</p>
                      <p className="font-medium">
                        {engagement.next_meeting_date
                          ? new Date(engagement.next_meeting_date).toLocaleDateString()
                          : 'Not scheduled'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Start Date</p>
                      <p className="font-medium">
                        {engagement.start_date ? new Date(engagement.start_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">End Date</p>
                      <p className="font-medium">
                        {engagement.end_date ? new Date(engagement.end_date).toLocaleDateString() : 'Ongoing'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              {progressEntries.length > 0 && (
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-4 text-emerald-400">Recent Activity</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {progressEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="border-l-2 border-slate-600 pl-4 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{new Date(entry.week_of).toLocaleDateString()}</p>
                          <div className={`px-2 py-0.5 rounded text-xs font-semibold ${HEALTH_COLORS[entry.health_score]}`}>
                            {entry.health_score}/10
                          </div>
                        </div>
                        <p className="text-slate-400 text-sm">{entry.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <CompanyTab engagement={engagement} onUpdate={loadData} />
          )}

          {/* Org Chart Tab */}
          {activeTab === 'org' && (
            <OrgChartTab engagement={engagement} />
          )}

          {/* Web & SEO Tab */}
          {activeTab === 'web' && (
            <WebSeoTab engagement={engagement} onUpdate={loadData} />
          )}

          {/* EOS Tab */}
          {activeTab === 'eos' && (
            <EosTab engagement={engagement} onUpdate={loadData} />
          )}

          {/* Audit Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Business Audit workspace — audit findings, assessments, and recommendations will live here.
              </p>
              <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold mb-4">Audit Notes</h3>
                <textarea
                  placeholder="Add audit notes here..."
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  rows={6}
                  defaultValue={engagement.audit_notes || ''}
                />
                <button className="mt-4 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition text-sm font-medium">
                  Save Notes
                </button>
              </div>
            </div>
          )}

          {/* Plan Tab */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
                Plan workspace — the strategic plan, adjustment history, and client-approved deliverables.
              </p>
              <div className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                <h3 className="font-semibold mb-4">Plan Notes</h3>
                <textarea
                  placeholder="Add plan notes here..."
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  rows={6}
                  defaultValue={engagement.plan_notes || ''}
                />
                <button className="mt-4 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition text-sm font-medium">
                  Save Notes
                </button>
              </div>
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <div className="space-y-6">
              <button
                onClick={() => setShowProgressForm(!showProgressForm)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition font-medium"
              >
                <Plus size={18} />
                Add Weekly Update
              </button>

              {showProgressForm && (
                <form onSubmit={handleProgressSubmit} className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Week Of</label>
                      <input
                        type="date"
                        value={progressForm.week_of}
                        onChange={(e) => setProgressForm({ ...progressForm, week_of: e.target.value })}
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Health Score</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={progressForm.health_score}
                          onChange={(e) => setProgressForm({ ...progressForm, health_score: parseInt(e.target.value) })}
                          className="flex-1"
                        />
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${HEALTH_COLORS[progressForm.health_score]}`}>
                          {progressForm.health_score}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Summary</label>
                    <input
                      type="text"
                      value={progressForm.summary}
                      onChange={(e) => setProgressForm({ ...progressForm, summary: e.target.value })}
                      placeholder="Week summary..."
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Wins</label>
                      <textarea
                        value={progressForm.wins}
                        onChange={(e) => setProgressForm({ ...progressForm, wins: e.target.value })}
                        placeholder="Key wins this week..."
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Blockers</label>
                      <textarea
                        value={progressForm.blockers}
                        onChange={(e) => setProgressForm({ ...progressForm, blockers: e.target.value })}
                        placeholder="Any blockers..."
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Additional Notes</label>
                    <textarea
                      value={progressForm.notes}
                      onChange={(e) => setProgressForm({ ...progressForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition font-medium disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : 'Save Update'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProgressForm(false)}
                      className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg transition font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {progressEntries.length === 0 ? (
                  <p className="text-slate-400 text-sm">No progress entries yet</p>
                ) : (
                  progressEntries.map((entry) => (
                    <div key={entry.id} className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{new Date(entry.week_of).toLocaleDateString()}</p>
                          <p className="text-slate-400 text-sm">{entry.summary}</p>
                        </div>
                        <div className={`px-3 py-1 rounded text-xs font-semibold ${HEALTH_COLORS[entry.health_score]}`}>
                          {entry.health_score}/10
                        </div>
                      </div>

                      {entry.wins && (
                        <div className="mb-2">
                          <p className="text-slate-400 text-xs font-medium mb-1">Wins</p>
                          <p className="text-sm text-emerald-300">{entry.wins}</p>
                        </div>
                      )}

                      {entry.blockers && (
                        <div className="mb-2">
                          <p className="text-slate-400 text-xs font-medium mb-1">Blockers</p>
                          <p className="text-sm text-orange-300">{entry.blockers}</p>
                        </div>
                      )}

                      {entry.notes && (
                        <div>
                          <p className="text-slate-400 text-xs font-medium mb-1">Notes</p>
                          <p className="text-sm text-slate-300">{entry.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* L10 Meetings Tab */}
          {activeTab === 'l10' && (
            <div className="space-y-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition font-medium">
                <Calendar size={18} />
                Schedule L10
              </button>

              <p className="text-slate-400 text-sm">
                Full L10 meeting runner coming soon — scorecard review, rock check-in, IDS, to-dos.
              </p>

              <div className="space-y-3">
                {l10Meetings.length === 0 ? (
                  <p className="text-slate-400 text-sm">No L10 meetings scheduled</p>
                ) : (
                  l10Meetings.map((meeting) => (
                    <div key={meeting.id} className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{new Date(meeting.date).toLocaleDateString()}</p>
                          <p className="text-slate-400 text-sm capitalize">{meeting.status}</p>
                        </div>
                        {meeting.rating && (
                          <div className="text-emerald-400 font-semibold">{meeting.rating}/10</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Users size={16} />
                        {meeting.attendees_count || 0} attendees
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-600/50 rounded-lg transition font-medium">
                <Plus size={18} />
                Upload Document
              </button>

              <div className="space-y-3">
                {documents.length === 0 ? (
                  <p className="text-slate-400 text-sm">No documents uploaded</p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="bg-slate-700/30 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-slate-400" />
                        <div>
                          <p className="font-semibold text-sm">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                              {doc.document_type || 'Document'}
                            </span>
                            <span className="text-slate-400 text-xs">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-slate-600/50 rounded-lg transition"
                        >
                          <Download size={18} />
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
