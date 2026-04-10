import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  Users, UserPlus, Search, Filter, ChevronRight, ChevronDown, Star,
  FileText, Upload, ExternalLink, Briefcase, Mail, Phone, MapPin,
  Clock, Brain, MessageSquare, BarChart3, X, Plus, Edit2, Trash2,
  ArrowRight, GripVertical, Eye, Download, Sparkles, Check, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Stage Configuration ─────────────────────────────────────
const STAGES = [
  { key: 'applied', label: 'Applied', color: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800', icon: '📥' },
  { key: 'screening', label: 'Screening', color: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', icon: '🔍' },
  { key: 'interview', label: 'Interview', color: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800', icon: '🎤' },
  { key: 'offer', label: 'Offer', color: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', icon: '📋' },
  { key: 'hired', label: 'Hired', color: 'bg-green-500', badge: 'bg-green-100 text-green-800', icon: '✅' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-500', badge: 'bg-red-100 text-red-800', icon: '❌' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));

// ─── Score Display ───────────────────────────────────────────
function ScoreStars({ value, max = 5 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// ─── AI Score Ring ───────────────────────────────────────────
function AIScoreRing({ score }) {
  if (score == null) return null;
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : score >= 40 ? 'text-orange-400' : 'text-red-400';
  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      <Brain className="h-4 w-4" />
      <span className="text-sm font-bold">{Math.round(score)}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function HRHub() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applicants, setApplicants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [viewMode, setViewMode] = useState('pipeline'); // pipeline | table
  const [showRejected, setShowRejected] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState('pipeline'); // pipeline | referrals

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState(null);

  // Referral state
  const [referrals, setReferrals] = useState([]);
  const [myReferral, setMyReferral] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form state
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', position: '', source: '',
    portfolio_url: '', linkedin_url: '', salary_expectation: '', availability: ''
  });

  // Detail panel state
  const [notes, setNotes] = useState([]);
  const [scores, setScores] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [scoreForm, setScoreForm] = useState({
    technical_skills: 3, communication: 3, experience: 3, culture_fit: 3, overall: 3, notes: ''
  });
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchApplicants();
    fetchReferrals();
  }, []);

  async function fetchApplicants() {
    try {
      const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApplicants(data || []);
    } catch (err) {
      console.error('Error fetching applicants:', err);
      toast.error('Failed to load applicants');
    } finally {
      setLoading(false);
    }
  }

  // ─── Referrals ───────────────────────────────────────────────
  async function fetchReferrals() {
    try {
      const { data } = await supabase
        .from('hiring_referrals')
        .select('*')
        .order('total_referrals', { ascending: false });
      setReferrals(data || []);

      // Find current user's referral link
      const mine = (data || []).find(r => r.user_id === user.id);
      setMyReferral(mine || null);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    }
  }

  async function generateMyReferralLink() {
    const code = (profile?.full_name || 'team')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12) + '-' + Math.random().toString(36).slice(2, 6);

    try {
      const { data, error } = await supabase.from('hiring_referrals').insert({
        user_id: user.id,
        user_name: profile?.full_name || user.email,
        referral_code: code,
        bonus_percent: 5.00,
        bonus_duration_days: 90,
      }).select().single();
      if (error) throw error;
      setMyReferral(data);
      fetchReferrals();
      toast.success('Your referral link is ready!');
    } catch (err) {
      console.error('Error generating referral:', err);
      toast.error('Failed to generate referral link');
    }
  }

  function copyReferralLink() {
    if (!myReferral) return;
    const link = `${window.location.origin}/apply?ref=${myReferral.referral_code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Referral link copied!');
  }

  // ─── Add Applicant ──────────────────────────────────────────
  async function handleAddApplicant(e) {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.position) {
      toast.error('Name, email, and position are required');
      return;
    }
    try {
      const { error } = await supabase.from('applicants').insert({
        ...form,
        stage: 'applied',
        created_by: user.id
      });
      if (error) throw error;
      toast.success(`${form.full_name} added to pipeline`);
      setForm({ full_name: '', email: '', phone: '', position: '', source: '', portfolio_url: '', linkedin_url: '', salary_expectation: '', availability: '' });
      setAddDialogOpen(false);
      fetchApplicants();
    } catch (err) {
      console.error('Error adding applicant:', err);
      toast.error('Failed to add applicant');
    }
  }

  // ─── Move Stage ─────────────────────────────────────────────
  async function moveStage(applicantId, newStage) {
    try {
      const { error } = await supabase
        .from('applicants')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', applicantId);
      if (error) throw error;
      setApplicants(prev => prev.map(a => a.id === applicantId ? { ...a, stage: newStage } : a));
      if (selectedApplicant?.id === applicantId) {
        setSelectedApplicant(prev => ({ ...prev, stage: newStage }));
      }
      toast.success(`Moved to ${STAGE_MAP[newStage]?.label}`);
    } catch (err) {
      console.error('Error moving stage:', err);
      toast.error('Failed to update stage');
    }
  }

  // ─── Resume Upload ──────────────────────────────────────────
  async function handleResumeUpload(applicantId, file) {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `resumes/${applicantId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-files')
        .upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from('applicants')
        .update({ resume_url: urlData.publicUrl })
        .eq('id', applicantId);
      if (updateErr) throw updateErr;

      setApplicants(prev => prev.map(a => a.id === applicantId ? { ...a, resume_url: urlData.publicUrl } : a));
      if (selectedApplicant?.id === applicantId) {
        setSelectedApplicant(prev => ({ ...prev, resume_url: urlData.publicUrl }));
      }
      toast.success('Resume uploaded');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  }

  // ─── Notes ──────────────────────────────────────────────────
  async function fetchNotes(applicantId) {
    const { data } = await supabase
      .from('applicant_notes')
      .select('*')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false });
    setNotes(data || []);
  }

  async function addNote() {
    if (!newNote.trim() || !selectedApplicant) return;
    try {
      const { error } = await supabase.from('applicant_notes').insert({
        applicant_id: selectedApplicant.id,
        user_id: user.id,
        user_name: profile?.full_name || user.email,
        content: newNote.trim()
      });
      if (error) throw error;
      setNewNote('');
      fetchNotes(selectedApplicant.id);
      toast.success('Note added');
    } catch (err) {
      toast.error('Failed to add note');
    }
  }

  // ─── Scores ─────────────────────────────────────────────────
  async function fetchScores(applicantId) {
    const { data } = await supabase
      .from('applicant_scores')
      .select('*')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false });
    setScores(data || []);
  }

  async function submitScore() {
    if (!selectedApplicant) return;
    try {
      const { error } = await supabase.from('applicant_scores').upsert({
        applicant_id: selectedApplicant.id,
        reviewer_id: user.id,
        reviewer_name: profile?.full_name || user.email,
        ...scoreForm
      }, { onConflict: 'applicant_id,reviewer_id' });
      if (error) throw error;
      setScoreDialogOpen(false);
      fetchScores(selectedApplicant.id);
      toast.success('Score submitted');
    } catch (err) {
      console.error('Score error:', err);
      toast.error('Failed to submit score');
    }
  }

  // ─── AI Score (Stub) ───────────────────────────────────────
  async function runAIScore(applicant) {
    // For now, generate a mock score based on available data
    const hasResume = applicant.resume_url ? 20 : 0;
    const hasPortfolio = applicant.portfolio_url ? 15 : 0;
    const hasLinkedin = applicant.linkedin_url ? 10 : 0;
    const hasSalary = applicant.salary_expectation ? 5 : 0;
    const base = 30 + Math.random() * 20; // 30-50 base
    const score = Math.min(100, Math.round(base + hasResume + hasPortfolio + hasLinkedin + hasSalary));

    const summaryParts = [];
    if (applicant.resume_url) summaryParts.push('Resume on file');
    if (applicant.portfolio_url) summaryParts.push('Portfolio provided');
    if (applicant.linkedin_url) summaryParts.push('LinkedIn profile linked');
    if (!applicant.resume_url) summaryParts.push('No resume uploaded — request one');
    const summary = `AI Assessment: ${summaryParts.join('. ')}. Overall profile completeness: ${score >= 70 ? 'Strong' : score >= 50 ? 'Moderate' : 'Needs more info'}.`;

    try {
      const { error } = await supabase
        .from('applicants')
        .update({ ai_score: score, ai_summary: summary, ai_scored_at: new Date().toISOString() })
        .eq('id', applicant.id);
      if (error) throw error;

      setApplicants(prev => prev.map(a => a.id === applicant.id ? { ...a, ai_score: score, ai_summary: summary } : a));
      if (selectedApplicant?.id === applicant.id) {
        setSelectedApplicant(prev => ({ ...prev, ai_score: score, ai_summary: summary }));
      }
      toast.success(`AI scored ${applicant.full_name}: ${score}/100`);
    } catch (err) {
      toast.error('Failed to run AI score');
    }
  }

  // ─── Delete ─────────────────────────────────────────────────
  async function deleteApplicant(id) {
    if (!confirm('Remove this applicant permanently?')) return;
    try {
      const { error } = await supabase.from('applicants').delete().eq('id', id);
      if (error) throw error;
      setApplicants(prev => prev.filter(a => a.id !== id));
      if (selectedApplicant?.id === id) {
        setSelectedApplicant(null);
        setDetailOpen(false);
      }
      toast.success('Applicant removed');
    } catch (err) {
      toast.error('Failed to remove applicant');
    }
  }

  // ─── Open Detail ────────────────────────────────────────────
  function openDetail(applicant) {
    setSelectedApplicant(applicant);
    setDetailOpen(true);
    fetchNotes(applicant.id);
    fetchScores(applicant.id);
  }

  // ─── Filtering ──────────────────────────────────────────────
  const positions = [...new Set(applicants.map(a => a.position).filter(Boolean))];

  const filtered = applicants.filter(a => {
    if (searchQuery && !a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterPosition && a.position !== filterPosition) return false;
    if (!showRejected && a.stage === 'rejected') return false;
    return true;
  });

  // Group by stage for pipeline view
  const pipeline = {};
  STAGES.forEach(s => { pipeline[s.key] = []; });
  filtered.forEach(a => {
    if (pipeline[a.stage]) pipeline[a.stage].push(a);
  });

  // ─── Stats ──────────────────────────────────────────────────
  const stats = {
    total: applicants.length,
    active: applicants.filter(a => !['hired', 'rejected'].includes(a.stage)).length,
    hired: applicants.filter(a => a.stage === 'hired').length,
    thisWeek: applicants.filter(a => {
      const d = new Date(a.created_at);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }).length,
  };

  if (loading) return <div className="p-6 text-gray-400">Loading HR Hub...</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-sky-400" />
            HR Hub
          </h1>
          <p className="text-sm text-gray-400 mt-1">Applicant tracking and team management</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="bg-sky-500 hover:bg-sky-600 text-white gap-2">
          <UserPlus className="h-4 w-4" />
          Add Applicant
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Applicants', value: stats.total, icon: Users, color: 'text-sky-400' },
          { label: 'Active Pipeline', value: stats.active, icon: ArrowRight, color: 'text-yellow-400' },
          { label: 'Hired', value: stats.hired, icon: Check, color: 'text-green-400' },
          { label: 'This Week', value: stats.thisWeek, icon: Clock, color: 'text-purple-400' },
        ].map(stat => (
          <Card key={stat.label} className="bg-navy-800/50 border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-white mt-1">{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-navy-800/50 border border-white/10 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'pipeline' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Users className="h-4 w-4 inline mr-2" />Applicant Pipeline
        </button>
        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'referrals' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <ExternalLink className="h-4 w-4 inline mr-2" />Referral Program
        </button>
      </div>

      {/* ─── REFERRALS TAB ─────────────────────────────────────── */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          {/* My Referral Link */}
          <Card className="bg-navy-800/50 border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Your Referral Link</h3>
            <p className="text-sm text-gray-400 mb-4">
              Share your unique link with potential hires. When someone you refer gets hired,
              you earn <span className="text-sky-400 font-bold">5% bonus</span> on all sales they bring in during their first <span className="text-sky-400 font-bold">90 days</span>.
            </p>
            {myReferral ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-navy-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-sky-400 font-mono truncate">
                    {window.location.origin}/apply?ref={myReferral.referral_code}
                  </div>
                  <Button onClick={copyReferralLink} className={copiedLink ? 'bg-green-500' : 'bg-sky-500 hover:bg-sky-600'}>
                    {copiedLink ? <><Check className="h-4 w-4 mr-1" /> Copied</> : 'Copy Link'}
                  </Button>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-gray-400">Referrals: <span className="text-white font-medium">{myReferral.total_referrals}</span></div>
                  <div className="text-gray-400">Hired: <span className="text-green-400 font-medium">{myReferral.total_hired}</span></div>
                  <div className="text-gray-400">Bonus Rate: <span className="text-sky-400 font-medium">{myReferral.bonus_percent}%</span></div>
                  <div className="text-gray-400">Window: <span className="text-sky-400 font-medium">{myReferral.bonus_duration_days} days</span></div>
                </div>
              </div>
            ) : (
              <Button onClick={generateMyReferralLink} className="bg-sky-500 hover:bg-sky-600 gap-2">
                <ExternalLink className="h-4 w-4" />
                Generate My Referral Link
              </Button>
            )}
          </Card>

          {/* How It Works */}
          <Card className="bg-navy-800/50 border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: '1', title: 'Share Link', desc: 'Send your unique referral link to someone who would be great at Liftori', icon: '🔗' },
                { step: '2', title: 'They Apply', desc: 'They fill out the application — your name is automatically attached', icon: '📝' },
                { step: '3', title: 'They Get Hired', desc: 'We review, interview, and extend an offer. You get credited.', icon: '🤝' },
                { step: '4', title: 'Earn Bonus', desc: '5% of all sales they bring in during their first 90 days goes to you', icon: '💰' },
              ].map(s => (
                <div key={s.step} className="text-center space-y-2">
                  <div className="text-3xl">{s.icon}</div>
                  <div className="text-sm font-semibold text-white">{s.title}</div>
                  <div className="text-xs text-gray-400">{s.desc}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* All Referrals (Admin View) */}
          {referrals.length > 0 && (
            <Card className="bg-navy-800/50 border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Team Referral Leaderboard</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Team Member</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Code</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Referrals</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Hired</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Bonus %</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-white">{r.user_name}</td>
                      <td className="px-4 py-3 text-sm text-sky-400 font-mono">{r.referral_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{r.total_referrals}</td>
                      <td className="px-4 py-3 text-sm text-green-400">{r.total_hired}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{r.bonus_percent}%</td>
                      <td className="px-4 py-3">
                        <Badge className={r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ─── PIPELINE TAB ──────────────────────────────────────── */}
      {activeTab === 'pipeline' && <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search applicants..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-navy-800/50 border-white/10 text-white"
          />
        </div>
        {positions.length > 0 && (
          <select
            value={filterPosition}
            onChange={e => setFilterPosition(e.target.value)}
            className="px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300"
          >
            <option value="">All Positions</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2 bg-navy-800/50 border border-white/10 rounded-md p-1">
          <button
            onClick={() => setViewMode('pipeline')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'pipeline' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Pipeline
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Table
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showRejected} onChange={e => setShowRejected(e.target.checked)} className="rounded" />
          Show rejected
        </label>
      </div>

      {/* Pipeline View */}
      {viewMode === 'pipeline' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter(s => showRejected || s.key !== 'rejected').map(stage => (
            <div key={stage.key} className="min-w-[280px] flex-shrink-0">
              {/* Stage Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-sm font-semibold text-white">{stage.icon} {stage.label}</span>
                <Badge variant="outline" className="ml-auto text-xs border-white/20 text-gray-400">
                  {pipeline[stage.key]?.length || 0}
                </Badge>
              </div>
              {/* Cards */}
              <div className="space-y-2">
                {(pipeline[stage.key] || []).map(applicant => (
                  <Card
                    key={applicant.id}
                    className="bg-navy-800/60 border-white/10 p-3 cursor-pointer hover:border-sky-500/50 transition-colors group"
                    onClick={() => openDetail(applicant)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-sky-500/20 text-sky-400 text-xs">
                            {applicant.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-white">{applicant.full_name}</div>
                          <div className="text-xs text-gray-400">{applicant.position}</div>
                        </div>
                      </div>
                      <AIScoreRing score={applicant.ai_score} />
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      {applicant.resume_url && <FileText className="h-3 w-3 text-sky-400" title="Resume on file" />}
                      {applicant.linkedin_url && <ExternalLink className="h-3 w-3 text-blue-400" title="LinkedIn" />}
                      {applicant.source && <span className="text-gray-500">{applicant.source}</span>}
                      <span className="ml-auto">{new Date(applicant.created_at).toLocaleDateString()}</span>
                    </div>
                    {/* Quick stage move buttons */}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {STAGES.filter(s => s.key !== applicant.stage && s.key !== 'rejected').map(s => (
                        <button
                          key={s.key}
                          onClick={e => { e.stopPropagation(); moveStage(applicant.id, s.key); }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${s.badge} hover:opacity-80 transition-opacity`}
                          title={`Move to ${s.label}`}
                        >
                          {s.icon}
                        </button>
                      ))}
                    </div>
                  </Card>
                ))}
                {(pipeline[stage.key]?.length || 0) === 0 && (
                  <div className="text-xs text-gray-600 text-center py-8 border border-dashed border-white/10 rounded-lg">
                    No applicants
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="bg-navy-800/50 border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Position</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Stage</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">AI Score</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Source</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Applied</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => openDetail(a)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-sky-500/20 text-sky-400 text-[10px]">
                            {a.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm text-white">{a.full_name}</div>
                          <div className="text-xs text-gray-500">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{a.position}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${STAGE_MAP[a.stage]?.badge}`}>{STAGE_MAP[a.stage]?.label}</Badge>
                    </td>
                    <td className="px-4 py-3"><AIScoreRing score={a.ai_score} /></td>
                    <td className="px-4 py-3 text-sm text-gray-400">{a.source || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); runAIScore(a); }}>
                          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={e => { e.stopPropagation(); deleteApplicant(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No applicants found. Add your first applicant to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      </>}

      {/* ─── Add Applicant Dialog ───────────────────────────────── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-sky-400" />
              Add Applicant
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddApplicant} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Full Name *</label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="John Smith" required />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="john@email.com" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Phone</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Position *</label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Frontend Developer" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Source</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className="w-full px-3 py-2 rounded-md bg-navy-800/50 border border-white/10 text-sm text-gray-300">
                  <option value="">Select source</option>
                  <option value="Referral">Referral</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Website">Website</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Cold Outreach">Cold Outreach</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Salary Expectation</label>
                <Input value={form.salary_expectation} onChange={e => setForm(f => ({ ...f, salary_expectation: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="$80k-$100k" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">LinkedIn</label>
                <Input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="linkedin.com/in/..." />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Portfolio URL</label>
                <Input value={form.portfolio_url} onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="portfolio.com" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Availability</label>
              <Input value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value }))} className="bg-navy-800/50 border-white/10" placeholder="Available immediately, 2 weeks notice, etc." />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600">Add to Pipeline</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Applicant Detail Panel ─────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedApplicant && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-sky-500/20 text-sky-400">
                      {selectedApplicant.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-lg">{selectedApplicant.full_name}</div>
                    <div className="text-sm text-gray-400 font-normal">{selectedApplicant.position}</div>
                  </div>
                  <Badge className={`ml-auto ${STAGE_MAP[selectedApplicant.stage]?.badge}`}>
                    {STAGE_MAP[selectedApplicant.stage]?.icon} {STAGE_MAP[selectedApplicant.stage]?.label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {/* Left: Info + AI */}
                <div className="md:col-span-2 space-y-4">
                  {/* Contact Info */}
                  <Card className="bg-navy-800/30 border-white/10 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Contact & Details</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Mail className="h-3.5 w-3.5 text-gray-500" />
                        {selectedApplicant.email}
                      </div>
                      {selectedApplicant.phone && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <Phone className="h-3.5 w-3.5 text-gray-500" />
                          {selectedApplicant.phone}
                        </div>
                      )}
                      {selectedApplicant.source && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <Briefcase className="h-3.5 w-3.5 text-gray-500" />
                          Source: {selectedApplicant.source}
                        </div>
                      )}
                      {selectedApplicant.salary_expectation && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <BarChart3 className="h-3.5 w-3.5 text-gray-500" />
                          {selectedApplicant.salary_expectation}
                        </div>
                      )}
                      {selectedApplicant.availability && (
                        <div className="flex items-center gap-2 text-gray-300 col-span-2">
                          <Clock className="h-3.5 w-3.5 text-gray-500" />
                          {selectedApplicant.availability}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {selectedApplicant.linkedin_url && (
                        <a href={selectedApplicant.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> LinkedIn
                        </a>
                      )}
                      {selectedApplicant.portfolio_url && (
                        <a href={selectedApplicant.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Portfolio
                        </a>
                      )}
                    </div>
                  </Card>

                  {/* Resume */}
                  <Card className="bg-navy-800/30 border-white/10 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-sky-400" /> Resume
                    </h3>
                    {selectedApplicant.resume_url ? (
                      <div className="flex items-center gap-3">
                        <Badge className="bg-green-100 text-green-800 text-xs">Uploaded</Badge>
                        <a href={selectedApplicant.resume_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                          <Eye className="h-3 w-3" /> View
                        </a>
                        <a href={selectedApplicant.resume_url} download className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">No resume</Badge>
                        <label className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1">
                          <Upload className="h-3 w-3" /> Upload
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => {
                            if (e.target.files[0]) handleResumeUpload(selectedApplicant.id, e.target.files[0]);
                          }} />
                        </label>
                      </div>
                    )}
                  </Card>

                  {/* AI Assessment */}
                  <Card className="bg-navy-800/30 border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-sky-400" /> AI Assessment
                      </h3>
                      <Button size="sm" variant="ghost" className="text-xs text-sky-400" onClick={() => runAIScore(selectedApplicant)}>
                        <Brain className="h-3.5 w-3.5 mr-1" />
                        {selectedApplicant.ai_score != null ? 'Re-score' : 'Run AI Score'}
                      </Button>
                    </div>
                    {selectedApplicant.ai_score != null ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className={`text-3xl font-bold ${selectedApplicant.ai_score >= 80 ? 'text-green-400' : selectedApplicant.ai_score >= 60 ? 'text-yellow-400' : selectedApplicant.ai_score >= 40 ? 'text-orange-400' : 'text-red-400'}`}>
                            {Math.round(selectedApplicant.ai_score)}/100
                          </div>
                          <div className="flex-1 bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${selectedApplicant.ai_score >= 80 ? 'bg-green-400' : selectedApplicant.ai_score >= 60 ? 'bg-yellow-400' : selectedApplicant.ai_score >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                              style={{ width: `${selectedApplicant.ai_score}%` }}
                            />
                          </div>
                        </div>
                        {selectedApplicant.ai_summary && (
                          <p className="text-xs text-gray-400">{selectedApplicant.ai_summary}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Click "Run AI Score" to generate an assessment.</p>
                    )}
                  </Card>

                  {/* Notes */}
                  <Card className="bg-navy-800/30 border-white/10 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-sky-400" /> Notes ({notes.length})
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                      {notes.map(note => (
                        <div key={note.id} className="bg-navy-900/50 rounded p-2">
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                            <span className="font-medium text-gray-300">{note.user_name}</span>
                            <span>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-300">{note.content}</p>
                        </div>
                      ))}
                      {notes.length === 0 && <p className="text-xs text-gray-500">No notes yet.</p>}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Add a note..."
                        className="bg-navy-900/50 border-white/10 text-sm"
                        onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
                      />
                      <Button size="sm" onClick={addNote} className="bg-sky-500 hover:bg-sky-600">Add</Button>
                    </div>
                  </Card>
                </div>

                {/* Right: Stage Actions + Scorecard */}
                <div className="space-y-4">
                  {/* Stage Actions */}
                  <Card className="bg-navy-800/30 border-white/10 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Move Stage</h3>
                    <div className="space-y-1.5">
                      {STAGES.map(s => (
                        <button
                          key={s.key}
                          onClick={() => moveStage(selectedApplicant.id, s.key)}
                          disabled={selectedApplicant.stage === s.key}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                            selectedApplicant.stage === s.key
                              ? 'bg-sky-500/20 text-sky-400 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${s.color}`} />
                          {s.icon} {s.label}
                          {selectedApplicant.stage === s.key && <Check className="h-3 w-3 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </Card>

                  {/* Scorecard Summary */}
                  <Card className="bg-navy-800/30 border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Scorecards ({scores.length})</h3>
                      <Button size="sm" variant="ghost" className="text-xs text-sky-400" onClick={() => setScoreDialogOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Score
                      </Button>
                    </div>
                    {scores.length > 0 ? (
                      <div className="space-y-3">
                        {scores.map(s => (
                          <div key={s.id} className="bg-navy-900/50 rounded p-2 space-y-1">
                            <div className="text-xs font-medium text-gray-300">{s.reviewer_name}</div>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Technical</span>
                                <ScoreStars value={s.technical_skills} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Comm</span>
                                <ScoreStars value={s.communication} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Experience</span>
                                <ScoreStars value={s.experience} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Culture</span>
                                <ScoreStars value={s.culture_fit} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                              <span className="text-xs text-gray-500">Overall</span>
                              <ScoreStars value={s.overall} />
                            </div>
                            {s.notes && <p className="text-xs text-gray-500 mt-1">{s.notes}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No scores yet. Be the first to review.</p>
                    )}
                  </Card>

                  {/* Danger Zone */}
                  <Card className="bg-navy-800/30 border-red-500/20 p-4">
                    <Button
                      variant="ghost"
                      className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                      onClick={() => deleteApplicant(selectedApplicant.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Applicant
                    </Button>
                  </Card>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Score Dialog ───────────────────────────────────────── */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="bg-[#0B1120] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-sky-400" />
              Score {selectedApplicant?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {[
              { key: 'technical_skills', label: 'Technical Skills' },
              { key: 'communication', label: 'Communication' },
              { key: 'experience', label: 'Experience' },
              { key: 'culture_fit', label: 'Culture Fit' },
              { key: 'overall', label: 'Overall' },
            ].map(field => (
              <div key={field.key} className="flex items-center justify-between">
                <label className="text-sm text-gray-300">{field.label}</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      onClick={() => setScoreForm(f => ({ ...f, [field.key]: v }))}
                      className="p-0.5"
                    >
                      <Star className={`h-5 w-5 transition-colors ${v <= scoreForm[field.key] ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <Textarea
                value={scoreForm.notes}
                onChange={e => setScoreForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-navy-800/50 border-white/10"
                placeholder="Additional observations..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScoreDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitScore} className="bg-sky-500 hover:bg-sky-600">Submit Score</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
