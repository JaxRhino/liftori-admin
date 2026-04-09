import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useTenantId } from '../../lib/useTenantId';
import { useToast } from '../../lib/useToast';
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Link2 as Linkedin,
  Plus,
  Edit2,
  X,
  Check,
  Loader,
  Target,
  TrendingUp,
  DollarSign,
  Clock,
  FileText,
  Tag,
  User,
} from 'lucide-react';

export default function LeadHunterCompany() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenantId } = useTenantId();
  const { showToast, ToastContainer } = useToast();

  // State management
  const [company, setCompany] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [signals, setSignals] = useState([]);
  const [enrichmentLogs, setEnrichmentLogs] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    title: '',
    phone: '',
    linkedin_url: '',
  });

  const [showNotes, setShowNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [newSignal, setNewSignal] = useState({
    signal_type: 'website_change',
    signal_strength: 'medium',
    title: '',
    description: '',
    source_url: '',
  });

  // Fetch company and related data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch company
        const { data: companyData, error: companyError } = await supabase
          .from('lh_companies')
          .select('*')
          .eq('id', id)
          .single();

        if (companyError) throw companyError;
        setCompany(companyData);
        setEditingNotes(companyData?.notes || '');
        setTags(companyData?.tags || []);

        // Fetch contacts, signals, logs in parallel
        const [
          { data: contactsData, error: contactsError },
          { data: signalsData, error: signalsError },
          { data: logsData, error: logsError },
          { data: enrollmentsData, error: enrollmentsError },
        ] = await Promise.all([
          supabase
            .from('lh_contacts')
            .select('*')
            .eq('company_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('lh_signals')
            .select('*')
            .eq('company_id', id)
            .order('detected_at', { ascending: false }),
          supabase
            .from('lh_enrichment_log')
            .select('*')
            .eq('company_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('lh_enrollments')
            .select('*')
            .eq('company_id', id)
            .order('created_at', { ascending: false }),
        ]);

        if (contactsError) throw contactsError;
        if (signalsError) throw signalsError;
        if (logsError) throw logsError;
        if (enrollmentsError) throw enrollmentsError;

        setContacts(contactsData || []);
        setSignals(signalsData || []);
        setEnrichmentLogs(logsData || []);
        setEnrollments(enrollmentsData || []);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching company data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Score badge styling
  const getScoreBadgeStyle = (score) => {
    if (score >= 80) return { bg: 'bg-red-500', label: 'Hot' };
    if (score >= 60) return { bg: 'bg-yellow-500', label: 'Warm' };
    if (score >= 40) return { bg: 'bg-sky-500', label: 'Cool' };
    return { bg: 'bg-slate-600', label: 'Cold' };
  };

  // Email status badge
  const getEmailStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'unverified':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'invalid':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-600/20 text-slate-300 border-slate-600/30';
    }
  };

  // Save notes
  const saveNotes = async () => {
    try {
      setNotesSaving(true);
      const { error } = await supabase
        .from('lh_companies')
        .update({ notes: editingNotes })
        .eq('id', id);

      if (error) throw error;
      setCompany({ ...company, notes: editingNotes });
      setShowNotes(false);
    } catch (err) {
      showToast('Error saving notes: ' + err.message, 'error');
    } finally {
      setNotesSaving(false);
    }
  };

  // Add tag
  const addTag = async () => {
    if (!newTag.trim()) return;
    const updatedTags = [...tags, newTag.trim()];
    try {
      const { error } = await supabase
        .from('lh_companies')
        .update({ tags: updatedTags })
        .eq('id', id);

      if (error) throw error;
      setTags(updatedTags);
      setNewTag('');
    } catch (err) {
      showToast('Error adding tag: ' + err.message, 'error');
    }
  };

  // Remove tag
  const removeTag = async (tagToRemove) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    try {
      const { error } = await supabase
        .from('lh_companies')
        .update({ tags: updatedTags })
        .eq('id', id);

      if (error) throw error;
      setTags(updatedTags);
    } catch (err) {
      showToast('Error removing tag: ' + err.message, 'error');
    }
  };

  // Add contact
  const addContact = async () => {
    if (!newContact.email || !newContact.first_name) {
      showToast('Please fill in at least name and email', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('lh_contacts').insert([
        {
          ...newContact,
          company_id: id,
          email_status: 'unverified',
          tenant_id: tenantId,
        },
      ]);

      if (error) throw error;

      // Refresh contacts
      const { data } = await supabase
        .from('lh_contacts')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });

      setContacts(data || []);
      setShowAddContact(false);
      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        title: '',
        phone: '',
        linkedin_url: '',
      });
    } catch (err) {
      showToast('Error adding contact: ' + err.message, 'error');
    }
  };

  // Add signal
  const addSignal = async () => {
    if (!newSignal.title) {
      showToast('Please enter a signal title', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('lh_signals').insert([
        {
          ...newSignal,
          company_id: id,
          detected_at: new Date().toISOString(),
          tenant_id: tenantId,
        },
      ]);

      if (error) throw error;

      // Refresh signals
      const { data } = await supabase
        .from('lh_signals')
        .select('*')
        .eq('company_id', id)
        .order('detected_at', { ascending: false });

      setSignals(data || []);
      setShowAddSignal(false);
      setNewSignal({
        signal_type: 'website_change',
        signal_strength: 'medium',
        title: '',
        description: '',
        source_url: '',
      });
    } catch (err) {
      showToast('Error adding signal: ' + err.message, 'error');
    }
  };

  // Enrich & Score this company
  const [enrichingCompany, setEnrichingCompany] = useState(false);
  const handleEnrichCompany = async () => {
    if (enrichingCompany) return;
    setEnrichingCompany(true);
    try {
      // Step 1: Enrich
      const enrichResult = await supabase.functions.invoke('lh-enrich', {
        body: { company_ids: [id], tenant_id: tenantId }
      });
      if (enrichResult.error) throw enrichResult.error;

      // Step 2: Score
      const scoreResult = await supabase.functions.invoke('lh-score', {
        body: { company_ids: [id], tenant_id: tenantId }
      });
      if (scoreResult.error) throw scoreResult.error;

      // Refresh company data
      const { data: refreshed } = await supabase
        .from('lh_companies')
        .select('*')
        .eq('id', id)
        .single();
      if (refreshed) setCompany(refreshed);

      // Refresh contacts (Hunter.io may have found new ones)
      const { data: newContacts } = await supabase
        .from('lh_contacts')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (newContacts) setContacts(newContacts);

      // Refresh enrichment logs
      const { data: newLogs } = await supabase
        .from('lh_enrichment_log')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false });
      if (newLogs) setEnrichmentLogs(newLogs);
    } catch (err) {
      showToast('Enrichment error: ' + err.message, 'error');
      console.error('Enrich error:', err);
    } finally {
      setEnrichingCompany(false);
    }
  };

  // Format timestamp
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8 bg-slate-900 text-white min-h-screen">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sky-500 hover:text-sky-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-red-500">Error loading company: {error}</div>
      </div>
    );
  }

  const score = company?.overall_score || 0;
  const scoreBadge = getScoreBadgeStyle(score);
  const scoreBreakdown = company?.score_breakdown || {};

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      {/* Header Section */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sky-500 hover:text-sky-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </button>

        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{company.name}</h1>
            <div className="flex items-center gap-4 mb-4">
              {company.domain && (
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:text-sky-400 flex items-center gap-2"
                >
                  {company.domain}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {company.industry && (
                <span className="px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded-full text-sm">
                  {company.industry}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div
              className={`${scoreBadge.bg} px-6 py-3 rounded-lg text-center`}
            >
              <div className="text-3xl font-bold">{score}</div>
              <div className="text-xs uppercase tracking-wide">{scoreBadge.label}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleEnrichCompany}
            disabled={enrichingCompany}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-800 disabled:cursor-wait rounded-lg font-medium flex items-center gap-2"
          >
            {enrichingCompany ? (
              <><Loader className="w-4 h-4 animate-spin" /> Enriching &amp; Scoring...</>
            ) : (
              <><TrendingUp className="w-4 h-4" /> Enrich &amp; Score</>
            )}
          </button>
          <button
            onClick={() => navigate('/admin/lead-hunter/lists')}
            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg font-medium"
          >
            Add to List
          </button>
          <button
            onClick={() => navigate('/admin/lead-hunter/sequences')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Start Sequence
          </button>
        </div>

        {(enrichingCompany || company.enrichment_status === 'enriching') && (
          <div className="mt-4 flex items-center gap-2 text-sky-500">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Enriching &amp; scoring company data — scanning website, finding contacts, generating score...</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-700/50 mb-8">
        <div className="flex gap-8">
          {['overview', 'contacts', 'signals', 'activity', 'notes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 font-medium uppercase text-xs tracking-wider border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-sky-500 text-sky-500'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab company={company} scoreBreakdown={scoreBreakdown} />}
      {activeTab === 'contacts' && (
        <ContactsTab
          contacts={contacts}
          onAddClick={() => setShowAddContact(true)}
          getEmailStatusBadge={getEmailStatusBadge}
        />
      )}
      {activeTab === 'signals' && (
        <SignalsTab signals={signals} onAddClick={() => setShowAddSignal(true)} formatDate={formatDate} />
      )}
      {activeTab === 'activity' && (
        <ActivityTab enrichmentLogs={enrichmentLogs} enrollments={enrollments} formatDate={formatDate} />
      )}
      {activeTab === 'notes' && (
        <NotesTab
          editingNotes={editingNotes}
          onNotesChange={setEditingNotes}
          onSaveNotes={saveNotes}
          notesSaving={notesSaving}
          tags={tags}
          newTag={newTag}
          onNewTagChange={setNewTag}
          onAddTag={addTag}
          onRemoveTag={removeTag}
        />
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <AddContactModal
          contact={newContact}
          onChange={setNewContact}
          onSave={addContact}
          onClose={() => setShowAddContact(false)}
        />
      )}

      {/* Add Signal Modal */}
      {showAddSignal && (
        <AddSignalModal
          signal={newSignal}
          onChange={setNewSignal}
          onSave={addSignal}
          onClose={() => setShowAddSignal(false)}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ company, scoreBreakdown }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Firmographics */}
        <Card title="Firmographics">
          <div className="space-y-3 text-sm">
            {company.industry && (
              <div className="flex justify-between">
                <span className="text-slate-400">Industry</span>
                <span className="font-medium">{company.industry}</span>
              </div>
            )}
            {company.sic_code && (
              <div className="flex justify-between">
                <span className="text-slate-400">SIC</span>
                <span className="font-medium">{company.sic_code}</span>
              </div>
            )}
            {company.naics_code && (
              <div className="flex justify-between">
                <span className="text-slate-400">NAICS</span>
                <span className="font-medium">{company.naics_code}</span>
              </div>
            )}
            {company.employee_count && (
              <div className="flex justify-between">
                <span className="text-slate-400">Employees</span>
                <span className="font-medium">{company.employee_count}</span>
              </div>
            )}
            {company.revenue_range && (
              <div className="flex justify-between">
                <span className="text-slate-400">Revenue</span>
                <span className="font-medium">{company.revenue_range}</span>
              </div>
            )}
            {company.year_founded && (
              <div className="flex justify-between">
                <span className="text-slate-400">Founded</span>
                <span className="font-medium">{company.year_founded}</span>
              </div>
            )}
            {company.business_type && (
              <div className="flex justify-between">
                <span className="text-slate-400">Type</span>
                <span className="font-medium">{company.business_type}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Location */}
        <Card title={`Location`}>
          <div className="space-y-2 text-sm">
            {company.address && <p className="text-slate-300">{company.address}</p>}
            {(company.city || company.state || company.zip_code) && (
              <p className="text-slate-300">
                {[company.city, company.state, company.zip_code].filter(Boolean).join(', ')}
              </p>
            )}
            {company.country && <p className="text-slate-300">{company.country}</p>}
            <div className="mt-4 h-40 bg-slate-800/30 border border-slate-700/50 rounded flex items-center justify-center text-slate-400">
              Map Placeholder
            </div>
          </div>
        </Card>

        {/* Tech Stack */}
        {company.tech_stack && company.tech_stack.length > 0 && (
          <Card title="Tech Stack">
            <div className="flex flex-wrap gap-2">
              {company.tech_stack.map((tech, idx) => (
                <span key={idx} className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-sm border border-sky-500/30">
                  {tech}
                </span>
              ))}
            </div>
            {company.cms_detected && (
              <div className="mt-4 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-sm">
                <span className="text-slate-400">CMS: </span>
                <span className="font-medium">{company.cms_detected}</span>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Digital Presence */}
        <Card title="Digital Presence">
          <div className="space-y-4 text-sm">
            {company.domain && (
              <div>
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:text-sky-400 flex items-center gap-2"
                >
                  {company.domain}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {company.website_quality_score !== null && (
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Website Quality</span>
                  <span className="font-medium">{company.website_quality_score}%</span>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      company.website_quality_score >= 70
                        ? 'bg-emerald-500'
                        : company.website_quality_score >= 40
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${company.website_quality_score}%` }}
                  />
                </div>
              </div>
            )}

            {(company.google_rating || company.google_review_count) && (
              <div>
                <span className="text-slate-400">Google Rating</span>
                <p className="font-medium">
                  {company.google_rating && `${company.google_rating} ★`}
                  {company.google_review_count && ` (${company.google_review_count} reviews)`}
                </p>
              </div>
            )}

            {(company.facebook_url || company.linkedin_url || company.instagram_url || company.twitter_url) && (
              <div>
                <span className="text-slate-400 block mb-2">Social Links</span>
                <div className="flex gap-3">
                  {company.facebook_url && (
                    <a href={company.facebook_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500">
                      <User className="w-5 h-5" />
                    </a>
                  )}
                  {company.linkedin_url && (
                    <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500">
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                  {company.instagram_url && (
                    <a href={company.instagram_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500">
                      <FileText className="w-5 h-5" />
                    </a>
                  )}
                  {company.twitter_url && (
                    <a href={company.twitter_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500">
                      <FileText className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Score Breakdown */}
        <Card title="Score Breakdown">
          <div className="space-y-4">
            <ScoreBar label="ICP Fit" score={scoreBreakdown.icp_fit || 0} weight="25%" />
            <ScoreBar label="Digital Need" score={scoreBreakdown.digital_need || 0} weight="35%" />
            <ScoreBar label="Budget Signal" score={scoreBreakdown.budget_signal || 0} weight="25%" />
            <ScoreBar label="Timing Signal" score={scoreBreakdown.timing_signal || 0} weight="15%" />
          </div>
        </Card>

        {/* Enrichment Sources */}
        {company.enrichment_sources && company.enrichment_sources.length > 0 && (
          <Card title="Enrichment Sources">
            <div className="space-y-2 text-sm">
              {company.enrichment_sources.map((source, idx) => (
                <div key={idx} className="flex justify-between items-start p-2 bg-slate-800/30 rounded">
                  <div>
                    <p className="font-medium">{source.provider}</p>
                    <p className="text-slate-400 text-xs">{source.fields?.join(', ')}</p>
                  </div>
                  <p className="text-slate-400 text-xs">{source.timestamp && new Date(source.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Contacts Tab Component
function ContactsTab({ contacts, onAddClick, getEmailStatusBadge }) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">No contacts found. Enrich this company to discover decision makers.</p>
        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg font-medium flex items-center gap-2 mx-auto"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Name</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Title</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Seniority</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Phone</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">LinkedIn</th>
              <th className="px-4 py-3 text-left text-slate-400 font-medium">Outreach</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {contact.first_name} {contact.last_name}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-400">{contact.title || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{contact.seniority || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <a href={`mailto:${contact.email}`} className="text-sky-500 hover:text-sky-400">
                      {contact.email}
                    </a>
                    <span
                      className={`px-2 py-1 text-xs rounded border ${getEmailStatusBadge(contact.email_status)}`}
                    >
                      {contact.email_status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-sky-500 hover:text-sky-400">
                      {contact.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {contact.linkedin_url ? (
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-sky-500">
                      <Linkedin className="w-4 h-4" />
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{contact.outreach_status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Signals Tab Component
function SignalsTab({ signals, onAddClick, formatDate }) {
  if (signals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">No signals detected for this company.</p>
        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg font-medium flex items-center gap-2 mx-auto"
        >
          <Plus className="w-4 h-4" />
          Add Manual Signal
        </button>
      </div>
    );
  }

  const getSignalIcon = (type) => {
    switch (type) {
      case 'website_change':
        return <TrendingUp className="w-4 h-4" />;
      case 'hiring':
        return <User className="w-4 h-4" />;
      case 'funding':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getStrengthBadge = (strength) => {
    switch (strength) {
      case 'strong':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'weak':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-600/20 text-slate-300 border-slate-600/30';
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          onClick={onAddClick}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Manual Signal
        </button>
      </div>

      <div className="space-y-3">
        {signals.map((signal) => (
          <div key={signal.id} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-slate-400">{getSignalIcon(signal.signal_type)}</div>
                <div className="flex-1">
                  <h3 className="font-medium">{signal.title}</h3>
                  <p className="text-sm text-slate-400">{signal.description}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded border whitespace-nowrap ${getStrengthBadge(signal.signal_strength)}`}>
                {signal.signal_strength}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{formatDate(signal.detected_at)}</span>
              {signal.source_url && (
                <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-400 flex items-center gap-1">
                  Source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Activity Tab Component
function ActivityTab({ enrichmentLogs, enrollments, formatDate }) {
  const allActivity = [
    ...enrichmentLogs.map((log) => ({
      ...log,
      type: 'enrichment',
      timestamp: log.created_at,
    })),
    ...enrollments.map((enroll) => ({
      ...enroll,
      type: 'enrollment',
      timestamp: enroll.created_at,
    })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (allActivity.length === 0) {
    return <div className="text-center py-12 text-slate-400">No activity yet for this company.</div>;
  }

  return (
    <div className="space-y-3">
      {allActivity.map((activity, idx) => (
        <div key={idx} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
          {activity.type === 'enrichment' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-sky-500/20 text-sky-300 text-xs rounded border border-sky-500/30">
                    {activity.provider}
                  </span>
                  <span className="font-medium">{activity.action}</span>
                  {activity.success ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                </div>
                {activity.cost && <span className="text-sm text-slate-400">${activity.cost.toFixed(2)}</span>}
              </div>
              <p className="text-xs text-slate-400">{formatDate(activity.timestamp)}</p>
            </>
          ) : (
            <>
              <div className="font-medium mb-2">Enrollment Activity</div>
              <p className="text-sm text-slate-400 mb-2">{activity.sequence_name || 'Unknown Sequence'}</p>
              <p className="text-xs text-slate-400">{formatDate(activity.timestamp)}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Notes Tab Component
function NotesTab({
  editingNotes,
  onNotesChange,
  onSaveNotes,
  notesSaving,
  tags,
  newTag,
  onNewTagChange,
  onAddTag,
  onRemoveTag,
}) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <Card title="Notes">
          <textarea
            value={editingNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add notes about this company..."
            className="w-full h-32 bg-slate-800/50 border border-slate-700/50 rounded p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-sky-500/50"
          />
          <button
            onClick={onSaveNotes}
            disabled={notesSaving}
            className="mt-4 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-600 rounded-lg font-medium flex items-center gap-2"
          >
            {notesSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Notes
          </button>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Tags">
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => onNewTagChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onAddTag()}
                placeholder="Add tag..."
                className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500/50"
              />
              <button
                onClick={onAddTag}
                className="px-3 py-2 bg-sky-500 hover:bg-sky-600 rounded font-medium"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-sm border border-sky-500/30 flex items-center gap-2">
                  {tag}
                  <button
                    onClick={() => onRemoveTag(tag)}
                    className="hover:text-sky-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Owner">
          <select className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500/50">
            <option>Unassigned</option>
            <option>Ryan March</option>
            <option>Team Member 1</option>
          </select>
        </Card>
      </div>

      <ToastContainer />
    </div>
  );
}

// Card Component
function Card({ title, children }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

// Score Bar Component
function ScoreBar({ label, score, weight }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-slate-400 text-sm">{label}</span>
        <span className="text-xs text-slate-500">({weight})</span>
      </div>
      <div className="w-full bg-slate-800/50 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-sky-500 transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium mt-1 block">{score}%</span>
    </div>
  );
}

// Add Contact Modal
function AddContactModal({ contact, onChange, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Contact</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="First Name"
            value={contact.first_name}
            onChange={(e) => onChange({ ...contact, first_name: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={contact.last_name}
            onChange={(e) => onChange({ ...contact, last_name: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          <input
            type="email"
            placeholder="Email"
            value={contact.email}
            onChange={(e) => onChange({ ...contact, email: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          <input
            type="text"
            placeholder="Title"
            value={contact.title}
            onChange={(e) => onChange({ ...contact, title: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={contact.phone}
            onChange={(e) => onChange({ ...contact, phone: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
          <input
            type="url"
            placeholder="LinkedIn URL"
            value={contact.linkedin_url}
            onChange={(e) => onChange({ ...contact, linkedin_url: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg font-medium"
          >
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Signal Modal
function AddSignalModal({ signal, onChange, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Manual Signal</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <select
            value={signal.signal_type}
            onChange={(e) => onChange({ ...signal, signal_type: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500/50"
          >
            <option value="website_change">Website Change</option>
            <option value="hiring">Hiring Activity</option>
            <option value="funding">Funding Event</option>
            <option value="press">Press Mention</option>
          </select>

          <input
            type="text"
            placeholder="Signal Title"
            value={signal.title}
            onChange={(e) => onChange({ ...signal, title: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />

          <textarea
            placeholder="Description"
            value={signal.description}
            onChange={(e) => onChange({ ...signal, description: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 resize-none h-24 focus:outline-none focus:border-sky-500/50"
          />

          <select
            value={signal.signal_strength}
            onChange={(e) => onChange({ ...signal, signal_strength: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500/50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <input
            type="url"
            placeholder="Source URL (optional)"
            value={signal.source_url}
            onChange={(e) => onChange({ ...signal, source_url: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg font-medium"
          >
            Save Signal
          </button>
        </div>
      </div>
    </div>
  );
}
