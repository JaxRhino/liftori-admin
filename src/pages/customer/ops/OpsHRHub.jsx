import React, { useState, useEffect } from 'react';
import { useOrg } from '../../../lib/OrgContext';
import { fetchApplicants, createApplicant, updateApplicant, deleteApplicant } from '../../../lib/customerOpsService';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Star,
  FileText,
  Briefcase,
  Mail,
  Phone,
  Brain,
  BarChart3,
  X,
  Plus,
  Edit2,
  Trash2,
  ArrowRight,
  Eye,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Check,
  AlertCircle,
  Calendar,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── CONSTANTS ─────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'applied', name: 'Applied', color: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'screening', name: 'Screening', color: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { id: 'interview', name: 'Interview', color: 'bg-purple-500', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'offer', name: 'Offer', color: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'hired', name: 'Hired', color: 'bg-green-500', badge: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { id: 'rejected', name: 'Rejected', color: 'bg-red-500', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const SOURCE_OPTIONS = ['direct', 'referral', 'indeed', 'linkedin', 'craigslist', 'website', 'facebook', 'other'];

const SOURCE_LABELS = {
  direct: 'Direct',
  referral: 'Referral',
  indeed: 'Indeed',
  linkedin: 'LinkedIn',
  craigslist: 'Craigslist',
  website: 'Website',
  facebook: 'Facebook',
  other: 'Other',
};

// ─── HELPER FUNCTIONS ──────────────────────────────
function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

function getAvatarColor(index) {
  const colors = [
    'bg-sky-500',
    'bg-emerald-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-violet-500',
    'bg-indigo-500',
  ];
  return colors[index % colors.length];
}

function getAIScoreColor(score) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getAIScoreBgColor(score) {
  if (score >= 80) return 'bg-green-500/20 border-green-500/30';
  if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
  if (score >= 40) return 'bg-orange-500/20 border-orange-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── STATS CARD ────────────────────────────────────
function StatsCard({ label, value, icon: Icon, color = 'sky' }) {
  const colorClasses = {
    sky: 'text-sky-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
  };
  return (
    <Card className="bg-navy-800 border-white/10">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{label}</p>
          <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        </div>
        <p className="text-white text-3xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

// ─── AI SCORE RING ────────────────────────────────
function AIScoreRing({ score }) {
  if (!score && score !== 0) return null;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="3"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={getAIScoreColor(score)}
          strokeLinecap="round"
        />
        <text x="24" y="24" textAnchor="middle" dy="0.3em" className="text-white text-xs font-bold" fontSize="14">
          {score}
        </text>
      </svg>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-white">AI Score</span>
        <span className={`text-xs font-bold ${getAIScoreColor(score)}`}>
          {score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Weak'}
        </span>
      </div>
    </div>
  );
}

// ─── APPLICANT CARD ────────────────────────────────
function ApplicantCard({ applicant, index, onView, onMove }) {
  const stageObj = PIPELINE_STAGES.find(s => s.id === applicant.stage);
  const sourceLabel = SOURCE_LABELS[applicant.source] || 'Other';

  return (
    <div className="bg-navy-900/50 border border-white/5 rounded-lg p-4 mb-3 hover:bg-navy-900/80 transition">
      {/* Header: Avatar + Name + Position */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <Avatar className={`w-10 h-10 ${getAvatarColor(index)}`}>
            <AvatarFallback className="text-white text-xs font-bold">
              {getInitials(applicant.first_name, applicant.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">
              {applicant.first_name} {applicant.last_name}
            </p>
            <p className="text-white/60 text-xs mt-1">{applicant.position}</p>
          </div>
        </div>
      </div>

      {/* Source Badge + Date */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
          {sourceLabel}
        </Badge>
        <span className="text-white/50 text-xs">{formatDate(applicant.created_at)}</span>
      </div>

      {/* AI Score Ring */}
      {applicant.ai_score && (
        <div className="mb-3">
          <AIScoreRing score={applicant.ai_score} />
        </div>
      )}

      {/* Tags */}
      {applicant.tags && applicant.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {applicant.tags.slice(0, 2).map((tag, idx) => (
            <Badge key={idx} className="bg-white/5 text-white/70 border-white/10 text-xs">
              {tag}
            </Badge>
          ))}
          {applicant.tags.length > 2 && (
            <Badge className="bg-white/5 text-white/70 border-white/10 text-xs">
              +{applicant.tags.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-3 border-t border-white/5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-white/10 text-white/70 hover:text-white hover:border-white/30 h-8"
          onClick={() => onView(applicant)}
        >
          <Eye className="w-3 h-3 mr-1" />
          View
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-white/10 text-sky-400 hover:text-sky-300 hover:border-sky-500/30 h-8"
          onClick={() => onMove(applicant)}
        >
          <ArrowRight className="w-3 h-3 mr-1" />
          Move
        </Button>
      </div>
    </div>
  );
}

// ─── PIPELINE COLUMN ──────────────────────────────
function PipelineColumn({ stage, applicants, onView, onMove }) {
  return (
    <div className="bg-navy-900/30 border border-white/5 rounded-lg p-4 flex-1 min-w-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
          <span className="text-white font-semibold text-sm">{stage.name}</span>
        </div>
        <Badge className="bg-white/10 text-white/70 text-xs">{applicants.length}</Badge>
      </div>

      {/* Cards */}
      <div className="space-y-0">
        {applicants.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">
            No applicants
          </div>
        ) : (
          applicants.map((app, idx) => (
            <ApplicantCard
              key={app.id}
              applicant={app}
              index={idx}
              onView={onView}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── TABLE VIEW ────────────────────────────────────
function TableView({ applicants, onView, onMove, onDelete }) {
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = [...applicants].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (sortBy === 'name') {
      aVal = `${a.first_name} ${a.last_name}`;
      bVal = `${b.first_name} ${b.last_name}`;
    }
    if (!aVal) return 1;
    if (!bVal) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? (
      <ChevronDown className="w-3 h-3 rotate-180" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  return (
    <div className="bg-navy-900/30 border border-white/10 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-navy-900/50">
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => toggleSort('name')}
                  className="flex items-center gap-2 font-semibold text-white/70 text-xs uppercase tracking-wider hover:text-white"
                >
                  Name <SortIcon col="name" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => toggleSort('position')}
                  className="flex items-center gap-2 font-semibold text-white/70 text-xs uppercase tracking-wider hover:text-white"
                >
                  Position <SortIcon col="position" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => toggleSort('stage')}
                  className="flex items-center gap-2 font-semibold text-white/70 text-xs uppercase tracking-wider hover:text-white"
                >
                  Stage <SortIcon col="stage" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => toggleSort('source')}
                  className="flex items-center gap-2 font-semibold text-white/70 text-xs uppercase tracking-wider hover:text-white"
                >
                  Source <SortIcon col="source" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-white/70 text-xs uppercase tracking-wider">
                AI Score
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => toggleSort('created_at')}
                  className="flex items-center gap-2 font-semibold text-white/70 text-xs uppercase tracking-wider hover:text-white"
                >
                  Applied <SortIcon col="created_at" />
                </button>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-white/70 text-xs uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app) => {
              const stageObj = PIPELINE_STAGES.find(s => s.id === app.stage);
              return (
                <tr key={app.id} className="border-b border-white/5 hover:bg-navy-900/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className={`w-8 h-8 ${getAvatarColor(0)}`}>
                        <AvatarFallback className="text-white text-xs font-bold">
                          {getInitials(app.first_name, app.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white text-sm">{app.first_name} {app.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm">{app.position}</td>
                  <td className="px-4 py-3">
                    <Badge className={stageObj?.badge || ''}>
                      {stageObj?.name}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm">
                    {SOURCE_LABELS[app.source] || 'Other'}
                  </td>
                  <td className="px-4 py-3">
                    {app.ai_score ? (
                      <span className={`text-sm font-bold ${getAIScoreColor(app.ai_score)}`}>
                        {app.ai_score}
                      </span>
                    ) : (
                      <span className="text-white/40 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm">{formatDate(app.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-white/70 hover:text-white hover:border-white/30 h-7 w-7 p-0"
                        onClick={() => onView(app)}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-sky-400 hover:text-sky-300 hover:border-sky-500/30 h-7 w-7 p-0"
                        onClick={() => onMove(app)}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-rose-400 hover:text-rose-300 hover:border-rose-500/30 h-7 w-7 p-0"
                        onClick={() => onDelete(app)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ADD APPLICANT DIALOG ──────────────────────────
function AddApplicantDialog({ open, onOpenChange, onSubmit, loading }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    source: 'direct',
    referred_by: '',
    resume_text: '',
    cover_letter: '',
    notes: '',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const handleSubmit = async () => {
    if (!form.first_name.trim() || !form.email.trim()) {
      toast.error('First name and email required');
      return;
    }
    await onSubmit(form);
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      source: 'direct',
      referred_by: '',
      resume_text: '',
      cover_letter: '',
      notes: '',
      tags: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-800 border-white/10 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-sky-400" />
            Add New Applicant
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">First Name</label>
              <Input
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="John"
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Last Name</label>
              <Input
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Doe"
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Email</label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@example.com"
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Phone</label>
              <Input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Position & Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Position Applied For</label>
              <Input
                name="position"
                value={form.position}
                onChange={handleChange}
                placeholder="Roofing Technician"
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Department</label>
              <Input
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="Operations"
                className="bg-navy-900 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Source</label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                className="w-full bg-navy-900 border border-white/10 rounded px-3 py-2 text-white text-sm"
              >
                {SOURCE_OPTIONS.map(src => (
                  <option key={src} value={src}>{SOURCE_LABELS[src]}</option>
                ))}
              </select>
            </div>
            {form.source === 'referral' && (
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Referred By</label>
                <Input
                  name="referred_by"
                  value={form.referred_by}
                  onChange={handleChange}
                  placeholder="Name of referrer"
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>
            )}
          </div>

          {/* Resume */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2">Resume (Paste Text)</label>
            <Textarea
              name="resume_text"
              value={form.resume_text}
              onChange={handleChange}
              placeholder="Paste resume content here..."
              className="bg-navy-900 border-white/10 text-white min-h-24"
            />
          </div>

          {/* Cover Letter */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2">Cover Letter (Optional)</label>
            <Textarea
              name="cover_letter"
              value={form.cover_letter}
              onChange={handleChange}
              placeholder="Paste cover letter content here..."
              className="bg-navy-900 border-white/10 text-white min-h-16"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2">Notes</label>
            <Textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Internal notes..."
              className="bg-navy-900 border-white/10 text-white min-h-16"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-2">Tags</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag and press Enter"
                className="bg-navy-900 border-white/10 text-white flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddTag}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map(tag => (
                  <Badge
                    key={tag}
                    className="bg-sky-500/20 text-sky-300 border-sky-500/30 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-white/10"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            {loading ? 'Adding...' : 'Add Applicant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── APPLICANT DETAIL DIALOG ──────────────────────
function ApplicantDetailDialog({ applicant, open, onOpenChange, onUpdate, onDelete, loading }) {
  const [stage, setStage] = useState(applicant?.stage || 'applied');
  const [interview, setInterview] = useState({
    scheduled_date: applicant?.interview_scheduled_date || '',
    notes: applicant?.interview_notes || '',
    rating: applicant?.interview_rating || 0,
    scorecard: applicant?.interview_scorecard || {
      communication: 0,
      experience: 0,
      culture_fit: 0,
      technical: 0,
      overall: 0,
    },
  });
  const [notes, setNotes] = useState(applicant?.notes || '');
  const [tags, setTags] = useState(applicant?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const stageObj = PIPELINE_STAGES.find(s => s.id === stage);
  const sourceLabel = SOURCE_LABELS[applicant?.source] || 'Other';

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleMoveStage = async (newStage) => {
    await onUpdate({ stage: newStage });
    setStage(newStage);
  };

  const handleSaveInterview = async () => {
    await onUpdate({
      interview_scheduled_date: interview.scheduled_date,
      interview_notes: interview.notes,
      interview_rating: interview.rating,
      interview_scorecard: interview.scorecard,
    });
  };

  const handleSaveNotes = async () => {
    await onUpdate({ notes });
  };

  const handleSaveTags = async () => {
    await onUpdate({ tags });
  };

  const handleRunAIAnalysis = () => {
    toast.info('AI analysis coming soon! This feature will automatically score resumes and interviews.');
  };

  if (!applicant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-800 border-white/10 max-w-4xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="pb-4 border-b border-white/10 sticky top-0 bg-navy-800">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Avatar className={`w-12 h-12 ${getAvatarColor(0)}`}>
                <AvatarFallback className="text-white font-bold">
                  {getInitials(applicant.first_name, applicant.last_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {applicant.first_name} {applicant.last_name}
                </h2>
                <p className="text-white/60 text-sm mt-1">{applicant.position}</p>
                <div className="flex gap-2 mt-2">
                  <Badge className={stageObj?.badge}>
                    {stageObj?.name}
                  </Badge>
                  <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30">
                    {sourceLabel}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 h-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Contact Info */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                <span className="text-white text-sm">{applicant.email}</span>
              </div>
              {applicant.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-sky-400" />
                  <span className="text-white text-sm">{applicant.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis Section */}
          <Card className="bg-navy-900/50 border-sky-500/30 p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">AI Analysis</h3>
              </div>
              <Button
                size="sm"
                onClick={handleRunAIAnalysis}
                className="bg-sky-600 hover:bg-sky-700 text-white"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Run Analysis
              </Button>
            </div>

            {applicant.ai_score ? (
              <div className="space-y-4">
                <AIScoreRing score={applicant.ai_score} />
                {applicant.ai_analysis && (
                  <div className="space-y-3">
                    {applicant.ai_analysis.strengths && (
                      <div>
                        <p className="text-xs font-semibold text-white/70 mb-1">Strengths</p>
                        <p className="text-white/80 text-sm">{applicant.ai_analysis.strengths}</p>
                      </div>
                    )}
                    {applicant.ai_analysis.concerns && (
                      <div>
                        <p className="text-xs font-semibold text-white/70 mb-1">Concerns</p>
                        <p className="text-white/80 text-sm">{applicant.ai_analysis.concerns}</p>
                      </div>
                    )}
                    {applicant.ai_analysis.recommendations && (
                      <div>
                        <p className="text-xs font-semibold text-white/70 mb-1">Recommendations</p>
                        <p className="text-white/80 text-sm">{applicant.ai_analysis.recommendations}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-white/40">
                <p className="text-sm">No AI analysis yet. Click "Run Analysis" to generate insights.</p>
              </div>
            )}
          </Card>

          {/* Interview Section */}
          <Card className="bg-navy-900/50 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Interview
            </h3>

            <div className="space-y-4">
              {/* Scheduled Date */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Scheduled Date</label>
                <Input
                  type="datetime-local"
                  value={interview.scheduled_date}
                  onChange={(e) => setInterview(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="bg-navy-900 border-white/10 text-white"
                />
              </div>

              {/* Interview Notes */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Interview Notes</label>
                <Textarea
                  value={interview.notes}
                  onChange={(e) => setInterview(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes from the interview..."
                  className="bg-navy-900 border-white/10 text-white min-h-20"
                />
              </div>

              {/* Interview Rating */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Overall Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      onClick={() => setInterview(prev => ({ ...prev, rating }))}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          rating <= interview.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Interview Scorecard */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-3">Interview Scorecard</label>
                <div className="space-y-2">
                  {['communication', 'experience', 'culture_fit', 'technical', 'overall'].map(criterion => (
                    <div key={criterion} className="flex items-center justify-between">
                      <label className="text-xs text-white/70 capitalize">
                        {criterion.replace('_', ' ')}
                      </label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            onClick={() =>
                              setInterview(prev => ({
                                ...prev,
                                scorecard: {
                                  ...prev.scorecard,
                                  [criterion]: score,
                                },
                              }))
                            }
                            className={`w-6 h-6 rounded text-xs font-bold transition ${
                              score <= (interview.scorecard[criterion] || 0)
                                ? 'bg-sky-500 text-white'
                                : 'bg-white/10 text-white/40 hover:bg-white/20'
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSaveInterview}
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white"
              >
                <Save className="w-3 h-3 mr-1" />
                Save Interview
              </Button>
            </div>
          </Card>

          {/* Notes Section */}
          <Card className="bg-navy-900/50 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes..."
              className="bg-navy-900 border-white/10 text-white min-h-20 mb-3"
            />
            <Button
              onClick={handleSaveNotes}
              disabled={loading}
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Save Notes
            </Button>
          </Card>

          {/* Tags Section */}
          <Card className="bg-navy-900/50 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Tags</h3>
            <div className="flex gap-2 mb-3">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag..."
                className="bg-navy-900 border-white/10 text-white flex-1"
              />
              <Button size="sm" onClick={handleAddTag} className="bg-sky-600 hover:bg-sky-700 text-white">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map(tag => (
                  <Badge
                    key={tag}
                    className="bg-sky-500/20 text-sky-300 border-sky-500/30 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
            <Button
              onClick={handleSaveTags}
              disabled={loading}
              size="sm"
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Save Tags
            </Button>
          </Card>

          {/* Stage Actions */}
          <Card className="bg-navy-900/50 border-white/10 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Move Applicant</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {PIPELINE_STAGES.map(s => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={stage === s.id ? 'default' : 'outline'}
                  onClick={() => handleMoveStage(s.id)}
                  className={
                    stage === s.id
                      ? `${s.color} text-white`
                      : 'border-white/10 text-white/70 hover:text-white'
                  }
                >
                  {s.name}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full border-rose-500/30 text-rose-400 hover:text-rose-300"
              onClick={() => onDelete(applicant)}
              disabled={loading}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete Applicant
            </Button>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Save icon for interview section
function Save(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────
export default function OpsHRHub() {
  const { currentOrg } = useOrg();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' or 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState(null);
  const [filterPosition, setFilterPosition] = useState(null);
  const [filterSource, setFilterSource] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedForMove, setSelectedForMove] = useState(null);

  // Load applicants
  useEffect(() => {
    if (!currentOrg?.id) return;
    loadApplicants();
  }, [currentOrg?.id]);

  const loadApplicants = async () => {
    try {
      setLoading(true);
      const data = await fetchApplicants(currentOrg.id);
      setApplicants(data || []);
    } catch (error) {
      console.error('Error loading applicants:', error);
      toast.error('Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

  // Filter applicants
  const filtered = applicants.filter(app => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !`${app.first_name} ${app.last_name}`.toLowerCase().includes(search) &&
        !app.email?.toLowerCase().includes(search) &&
        !app.position?.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (filterStage && app.stage !== filterStage) return false;
    if (filterPosition && app.position !== filterPosition) return false;
    if (filterSource && app.source !== filterSource) return false;
    return true;
  });

  // Stats
  const totalApplicants = applicants.length;
  const activePipeline = applicants.filter(a => !['hired', 'rejected', 'withdrawn'].includes(a.stage)).length;
  const interviewsScheduled = applicants.filter(a => a.interview_scheduled_date).length;
  const uniquePositions = new Set(applicants.map(a => a.position)).size;
  const hiredThisMonth = applicants.filter(a => {
    if (a.stage !== 'hired') return false;
    const hiredDate = new Date(a.updated_at);
    const now = new Date();
    return hiredDate.getMonth() === now.getMonth() && hiredDate.getFullYear() === now.getFullYear();
  }).length;

  // Handlers
  const handleAddApplicant = async (form) => {
    try {
      setLoading(true);
      const newApp = await createApplicant({
        ...form,
        org_id: currentOrg.id,
        stage: 'applied',
      });
      setApplicants([newApp, ...applicants]);
      setShowAddDialog(false);
      toast.success('Applicant added successfully');
    } catch (error) {
      console.error('Error adding applicant:', error);
      toast.error('Failed to add applicant');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApplicant = async (updates) => {
    if (!selectedApplicant) return;
    try {
      setLoading(true);
      const updated = await updateApplicant(selectedApplicant.id, updates);
      setApplicants(applicants.map(a => a.id === updated.id ? updated : a));
      setSelectedApplicant(updated);
      toast.success('Applicant updated');
    } catch (error) {
      console.error('Error updating applicant:', error);
      toast.error('Failed to update applicant');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApplicant = async (app) => {
    if (!confirm(`Delete ${app.first_name} ${app.last_name}? This cannot be undone.`)) return;
    try {
      setLoading(true);
      await deleteApplicant(app.id);
      setApplicants(applicants.filter(a => a.id !== app.id));
      setShowDetailDialog(false);
      toast.success('Applicant deleted');
    } catch (error) {
      console.error('Error deleting applicant:', error);
      toast.error('Failed to delete applicant');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveApplicant = (app) => {
    setSelectedForMove(app);
    setSelectedApplicant(app);
    setShowDetailDialog(true);
  };

  const handleViewApplicant = (app) => {
    setSelectedApplicant(app);
    setShowDetailDialog(true);
  };

  // Group by stage for pipeline
  const groupedByStage = PIPELINE_STAGES.map(stage => ({
    ...stage,
    applicants: filtered.filter(a => a.stage === stage.id),
  }));

  const positionOptions = Array.from(new Set(applicants.map(a => a.position).filter(Boolean)));
  const sourceOptions = Array.from(new Set(applicants.map(a => a.source).filter(Boolean)));

  return (
    <div className="min-h-screen bg-navy-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Users className="w-8 h-8 text-sky-500" />
          HR Hub
        </h1>
        <p className="text-white/60 mt-2">Manage applicants and build your team</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <StatsCard label="Total Applicants" value={totalApplicants} icon={Users} color="sky" />
        <StatsCard label="Active Pipeline" value={activePipeline} icon={Briefcase} color="purple" />
        <StatsCard label="Interviews Scheduled" value={interviewsScheduled} icon={Calendar} color="amber" />
        <StatsCard label="Open Positions" value={uniquePositions} icon={FileText} color="emerald" />
        <StatsCard label="Hired This Month" value={hiredThisMonth} icon={Check} color="green" />
      </div>

      {/* Toolbar */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search by name, email, or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-navy-800 border-white/10 text-white"
              />
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 bg-navy-800 border border-white/10 rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === 'pipeline' ? 'default' : 'outline'}
              onClick={() => setViewMode('pipeline')}
              className={
                viewMode === 'pipeline'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white'
                  : 'border-0 text-white/70 hover:text-white'
              }
            >
              Pipeline
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'outline'}
              onClick={() => setViewMode('table')}
              className={
                viewMode === 'table'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white'
                  : 'border-0 text-white/70 hover:text-white'
              }
            >
              Table
            </Button>
          </div>

          {/* Add Button */}
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Applicant
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStage || ''}
            onChange={(e) => setFilterStage(e.target.value || null)}
            className="bg-navy-800 border border-white/10 rounded px-3 py-2 text-white text-sm"
          >
            <option value="">All Stages</option>
            {PIPELINE_STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={filterPosition || ''}
            onChange={(e) => setFilterPosition(e.target.value || null)}
            className="bg-navy-800 border border-white/10 rounded px-3 py-2 text-white text-sm"
          >
            <option value="">All Positions</option>
            {positionOptions.map(pos => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>

          <select
            value={filterSource || ''}
            onChange={(e) => setFilterSource(e.target.value || null)}
            className="bg-navy-800 border border-white/10 rounded px-3 py-2 text-white text-sm"
          >
            <option value="">All Sources</option>
            {sourceOptions.map(src => (
              <option key={src} value={src}>{SOURCE_LABELS[src] || src}</option>
            ))}
          </select>

          {(filterStage || filterPosition || filterSource) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFilterStage(null);
                setFilterPosition(null);
                setFilterSource(null);
              }}
              className="border-white/10 text-white/70 hover:text-white"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="bg-navy-800 border-white/10 p-8 text-center">
          <p className="text-white/60">Loading applicants...</p>
        </Card>
      ) : viewMode === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {groupedByStage.map(stage => (
            stage.id !== 'rejected' || stage.applicants.length > 0 ? (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                applicants={stage.applicants}
                onView={handleViewApplicant}
                onMove={handleMoveApplicant}
              />
            ) : null
          ))}
        </div>
      ) : (
        <TableView
          applicants={filtered}
          onView={handleViewApplicant}
          onMove={handleMoveApplicant}
          onDelete={handleDeleteApplicant}
        />
      )}

      {/* Empty State */}
      {filtered.length === 0 && !loading && (
        <Card className="bg-navy-800/50 border-white/10 p-12 text-center">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 mb-4">No applicants found</p>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Applicant
          </Button>
        </Card>
      )}

      {/* Position Summary */}
      {applicants.length > 0 && (
        <Card className="bg-navy-800 border-white/10 mt-8 p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Positions Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {positionOptions.map(pos => {
              const count = applicants.filter(a => a.position === pos).length;
              return (
                <div key={pos} className="bg-navy-900/50 border border-white/5 rounded p-3">
                  <p className="text-white/70 text-xs mb-1 truncate">{pos}</p>
                  <p className="text-white text-xl font-bold">{count}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <AddApplicantDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleAddApplicant}
        loading={loading}
      />

      {selectedApplicant && (
        <ApplicantDetailDialog
          applicant={selectedApplicant}
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          onUpdate={handleUpdateApplicant}
          onDelete={handleDeleteApplicant}
          loading={loading}
        />
      )}
    </div>
  );
}
