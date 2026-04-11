import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Upload, List, Phone, Users, Trash2, Play, Pause, Archive,
  ChevronDown, ChevronUp, Search, Plus, FileText, Download,
  CheckCircle2, XCircle, Clock, MoreVertical, PhoneCall, X
} from 'lucide-react';

const DISPOSITIONS = [
  { value: 'connected', label: 'Connected', color: 'bg-emerald-500' },
  { value: 'voicemail', label: 'Voicemail', color: 'bg-amber-500' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-gray-500' },
  { value: 'busy', label: 'Busy', color: 'bg-orange-500' },
  { value: 'wrong_number', label: 'Wrong Number', color: 'bg-red-500' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-red-400' },
  { value: 'callback', label: 'Callback', color: 'bg-sky-500' },
  { value: 'qualified', label: 'Qualified Lead', color: 'bg-emerald-400' },
];

function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  return {
    success: (msg) => setToast({ msg, type: 'success' }),
    error: (msg) => setToast({ msg, type: 'error' }),
    info: (msg) => setToast({ msg, type: 'info' }),
    el: toast ? (
      <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
        toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-sky-600'
      }`}>{toast.msg}</div>
    ) : null,
  };
}

export default function CallLists() {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [lists, setLists] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedList, setExpandedList] = useState(null);
  const [contacts, setContacts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', description: '', assigned_to: '' });
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(1); // 1=file, 2=map, 3=confirm

  // Contact detail
  const [contactMenuId, setContactMenuId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [listsRes, agentsRes] = await Promise.all([
        supabase.from('call_lists').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, role').not('role', 'eq', 'customer'),
      ]);
      if (listsRes.error) throw listsRes.error;
      setLists(listsRes.data || []);
      setAgents(agentsRes.data || []);
    } catch (err) {
      console.error('Error fetching lists:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchContacts(listId) {
    try {
      const { data, error } = await supabase
        .from('call_list_contacts')
        .select('*')
        .eq('list_id', listId)
        .order('position', { ascending: true });
      if (error) throw error;
      setContacts(prev => ({ ...prev, [listId]: data || [] }));
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  }

  function toggleExpand(listId) {
    if (expandedList === listId) {
      setExpandedList(null);
    } else {
      setExpandedList(listId);
      if (!contacts[listId]) fetchContacts(listId);
    }
  }

  // ─── CSV Parsing ───
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1).map(line => {
        const vals = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      }).filter(row => Object.values(row).some(v => v.trim()));

      setCsvHeaders(headers);
      setCsvData(rows);

      // Auto-map common field names
      const autoMap = {};
      const mappings = {
        phone: ['phone', 'phone number', 'phone_number', 'mobile', 'cell', 'telephone', 'direct phone', 'direct_phone'],
        first_name: ['first name', 'first_name', 'firstname', 'first'],
        last_name: ['last name', 'last_name', 'lastname', 'last', 'surname'],
        email: ['email', 'email address', 'email_address', 'e-mail'],
        company: ['company', 'company name', 'company_name', 'organization', 'org'],
        title: ['title', 'job title', 'job_title', 'position', 'role'],
        industry: ['industry', 'sector'],
        city: ['city', 'location city'],
        state: ['state', 'region', 'province', 'location state'],
        website: ['website', 'url', 'company website', 'domain'],
      };

      headers.forEach(h => {
        const lower = h.toLowerCase().trim();
        for (const [field, aliases] of Object.entries(mappings)) {
          if (aliases.includes(lower) && !autoMap[field]) {
            autoMap[field] = h;
          }
        }
      });

      setFieldMapping(autoMap);
      if (!uploadForm.name) {
        setUploadForm(prev => ({ ...prev, name: file.name.replace(/\.csv$/i, '') }));
      }
      setUploadStep(2);
    };
    reader.readAsText(file);
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  // ─── Upload CSV to DB ───
  async function handleUpload() {
    if (!csvData || csvData.length === 0) return;
    if (!fieldMapping.phone) {
      toast.error('Phone field is required — map a column to Phone');
      return;
    }
    if (!uploadForm.name.trim()) {
      toast.error('Give the list a name');
      return;
    }

    setUploading(true);
    try {
      // Create the list
      const { data: listData, error: listErr } = await supabase.from('call_lists').insert({
        name: uploadForm.name.trim(),
        description: uploadForm.description.trim() || null,
        source: 'csv_upload',
        assigned_to: uploadForm.assigned_to || null,
        total_contacts: csvData.length,
        created_by: user?.id,
      }).select().single();

      if (listErr) throw listErr;

      // Insert contacts in batches of 500
      const contactRows = csvData.map((row, i) => ({
        list_id: listData.id,
        position: i + 1,
        first_name: row[fieldMapping.first_name] || null,
        last_name: row[fieldMapping.last_name] || null,
        company: row[fieldMapping.company] || null,
        title: row[fieldMapping.title] || null,
        phone: row[fieldMapping.phone] || '',
        email: row[fieldMapping.email] || null,
        website: row[fieldMapping.website] || null,
        industry: row[fieldMapping.industry] || null,
        city: row[fieldMapping.city] || null,
        state: row[fieldMapping.state] || null,
        raw_data: row,
      })).filter(c => c.phone.trim());

      for (let i = 0; i < contactRows.length; i += 500) {
        const batch = contactRows.slice(i, i + 500);
        const { error } = await supabase.from('call_list_contacts').insert(batch);
        if (error) throw error;
      }

      // Update count in case some rows were filtered
      if (contactRows.length !== csvData.length) {
        await supabase.from('call_lists').update({ total_contacts: contactRows.length }).eq('id', listData.id);
      }

      toast.success(`Uploaded ${contactRows.length} contacts to "${uploadForm.name.trim()}"`);
      resetUpload();
      fetchAll();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }

  function resetUpload() {
    setShowUploadModal(false);
    setUploadStep(1);
    setCsvData(null);
    setCsvHeaders([]);
    setFieldMapping({});
    setUploadForm({ name: '', description: '', assigned_to: '' });
    if (fileRef.current) fileRef.current.value = '';
  }

  // ─── List Actions ───
  async function handleUpdateListStatus(listId, status) {
    try {
      const { error } = await supabase.from('call_lists')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', listId);
      if (error) throw error;
      toast.success(`List ${status}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed to update list');
    }
  }

  async function handleDeleteList(listId, name) {
    if (!window.confirm(`Delete "${name}" and all its contacts?`)) return;
    try {
      const { error } = await supabase.from('call_lists').delete().eq('id', listId);
      if (error) throw error;
      toast.success('List deleted');
      if (expandedList === listId) setExpandedList(null);
      fetchAll();
    } catch (err) {
      toast.error('Failed to delete list');
    }
  }

  async function handleAssignList(listId, userId) {
    try {
      const { error } = await supabase.from('call_lists')
        .update({ assigned_to: userId || null, updated_at: new Date().toISOString() })
        .eq('id', listId);
      if (error) throw error;
      toast.success('List assigned');
      fetchAll();
    } catch (err) {
      toast.error('Failed to assign');
    }
  }

  // ─── Contact Actions ───
  async function handleUpdateContact(contactId, listId, updates) {
    try {
      const { error } = await supabase.from('call_list_contacts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (error) throw error;
      fetchContacts(listId);
      updateListStats(listId);
    } catch (err) {
      toast.error('Failed to update contact');
    }
  }

  async function updateListStats(listId) {
    try {
      const { data } = await supabase.from('call_list_contacts')
        .select('status, disposition')
        .eq('list_id', listId);
      if (!data) return;
      const contacted = data.filter(c => c.status === 'completed').length;
      const connected = data.filter(c => c.disposition === 'connected' || c.disposition === 'qualified').length;
      await supabase.from('call_lists').update({ contacted, connected, updated_at: new Date().toISOString() }).eq('id', listId);
      fetchAll();
    } catch (err) { /* silent */ }
  }

  // ─── Helpers ───
  function getAgent(id) { return agents.find(a => a.id === id); }
  function getStatusColor(s) {
    if (s === 'active') return 'bg-emerald-500/20 text-emerald-400';
    if (s === 'paused') return 'bg-amber-500/20 text-amber-400';
    if (s === 'completed') return 'bg-sky-500/20 text-sky-400';
    return 'bg-gray-500/20 text-gray-400';
  }
  function getContactStatusIcon(s) {
    if (s === 'completed') return <CheckCircle2 size={14} className="text-emerald-400" />;
    if (s === 'skipped') return <XCircle size={14} className="text-gray-500" />;
    if (s === 'callback') return <Clock size={14} className="text-sky-400" />;
    return <Phone size={14} className="text-gray-500" />;
  }

  const filteredLists = searchQuery
    ? lists.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : lists;

  if (loading) return <div className="p-6 text-gray-400">Loading call lists...</div>;

  return (
    <div className="p-6 max-w-6xl">
      {toast.el}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Call Lists</h1>
          <p className="text-gray-400 text-sm mt-1">Upload CSVs, manage contact lists, and assign to agents for the dialer</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Upload size={16} />
          Upload CSV
        </button>
      </div>

      {/* Search */}
      {lists.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search lists..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      )}

      {/* Lists */}
      {filteredLists.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-12 text-center">
          <FileText size={48} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 text-lg font-medium">No call lists yet</p>
          <p className="text-gray-500 text-sm mt-1 mb-4">Upload a CSV from ZoomInfo or any B2B contact source to get started</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Upload size={16} />
            Upload Your First List
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLists.map(list => {
            const isExpanded = expandedList === list.id;
            const assigned = getAgent(list.assigned_to);
            const pct = list.total_contacts > 0 ? Math.round((list.contacted / list.total_contacts) * 100) : 0;
            const listContacts = contacts[list.id] || [];

            return (
              <div key={list.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
                {/* List Header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-700/20 transition"
                  onClick={() => toggleExpand(list.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                      <List size={20} className="text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold truncate">{list.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getStatusColor(list.status)}`}>{list.status}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-gray-400">{list.source === 'csv_upload' ? 'CSV' : list.source === 'lead_hunter' ? 'Lead Hunter' : 'Manual'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-gray-500 text-xs">{list.total_contacts} contacts</span>
                        <span className="text-gray-500 text-xs">{list.contacted}/{list.total_contacts} called ({pct}%)</span>
                        {list.connected > 0 && <span className="text-emerald-400 text-xs">{list.connected} connected</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Assigned Agent */}
                    <select
                      value={list.assigned_to || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); handleAssignList(list.id, e.target.value); }}
                      className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 max-w-[140px]"
                    >
                      <option value="">Unassigned</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                    </select>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {list.status === 'active' && (
                        <button onClick={e => { e.stopPropagation(); handleUpdateListStatus(list.id, 'paused'); }} className="text-gray-400 hover:text-amber-400 p-1 rounded transition" title="Pause">
                          <Pause size={14} />
                        </button>
                      )}
                      {list.status === 'paused' && (
                        <button onClick={e => { e.stopPropagation(); handleUpdateListStatus(list.id, 'active'); }} className="text-gray-400 hover:text-emerald-400 p-1 rounded transition" title="Resume">
                          <Play size={14} />
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); handleUpdateListStatus(list.id, 'archived'); }} className="text-gray-400 hover:text-gray-300 p-1 rounded transition" title="Archive">
                        <Archive size={14} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteList(list.id, list.name); }} className="text-gray-400 hover:text-red-400 p-1 rounded transition" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded: Contact List */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50">
                    {!contacts[list.id] ? (
                      <div className="p-6 text-center text-gray-400 text-sm">Loading contacts...</div>
                    ) : listContacts.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">No contacts in this list</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700/50">
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">#</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">Name</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">Company</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">Phone</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">Status</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">Disposition</th>
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {listContacts.map(c => {
                              const disp = DISPOSITIONS.find(d => d.value === c.disposition);
                              return (
                                <tr key={c.id} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition">
                                  <td className="px-4 py-2 text-gray-500">{c.position}</td>
                                  <td className="px-4 py-2">
                                    <span className="text-white">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</span>
                                    {c.title && <span className="text-gray-500 text-xs ml-1">({c.title})</span>}
                                  </td>
                                  <td className="px-4 py-2 text-gray-300">{c.company || '—'}</td>
                                  <td className="px-4 py-2">
                                    <span className="text-sky-400 font-mono text-xs">{c.phone}</span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-1">
                                      {getContactStatusIcon(c.status)}
                                      <span className="text-gray-400 text-xs capitalize">{c.status}</span>
                                      {c.attempt_count > 0 && <span className="text-gray-600 text-[10px]">({c.attempt_count}x)</span>}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    {disp ? (
                                      <span className={`text-xs px-2 py-0.5 rounded-full text-white ${disp.color}`}>{disp.label}</span>
                                    ) : <span className="text-gray-600">—</span>}
                                  </td>
                                  <td className="px-4 py-2 text-gray-400 text-xs max-w-[200px] truncate">{c.notes || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ UPLOAD CSV MODAL ═══ */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={resetUpload}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {uploadStep === 1 && 'Upload CSV'}
                {uploadStep === 2 && 'Map Fields'}
                {uploadStep === 3 && 'Confirm Upload'}
              </h2>
              <button onClick={resetUpload} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            {/* Step 1: File + Details */}
            {uploadStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">List Name</label>
                  <input
                    type="text"
                    value={uploadForm.name}
                    onChange={e => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. ZoomInfo Q2 Prospects"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={uploadForm.description}
                    onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Where the list came from, target segment, etc."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1">Assign To</label>
                  <select
                    value={uploadForm.assigned_to}
                    onChange={e => setUploadForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">CSV File</label>
                  <div
                    className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-sky-500/50 transition"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={32} className="mx-auto mb-2 text-gray-500" />
                    <p className="text-gray-400 text-sm">Click to select a CSV file</p>
                    <p className="text-gray-500 text-xs mt-1">Supports ZoomInfo, Apollo, LinkedIn exports, or any CSV with phone numbers</p>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Field Mapping */}
            {uploadStep === 2 && csvHeaders.length > 0 && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">Found <span className="text-white font-medium">{csvData.length}</span> rows with <span className="text-white font-medium">{csvHeaders.length}</span> columns. Map your CSV columns to contact fields:</p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'phone', label: 'Phone *', required: true },
                    { key: 'first_name', label: 'First Name' },
                    { key: 'last_name', label: 'Last Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'company', label: 'Company' },
                    { key: 'title', label: 'Job Title' },
                    { key: 'industry', label: 'Industry' },
                    { key: 'city', label: 'City' },
                    { key: 'state', label: 'State' },
                    { key: 'website', label: 'Website' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className={`text-xs mb-1 block ${field.required ? 'text-sky-400 font-medium' : 'text-gray-400'}`}>
                        {field.label}
                      </label>
                      <select
                        value={fieldMapping[field.key] || ''}
                        onChange={e => setFieldMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className={`w-full bg-slate-700 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 ${
                          field.required && !fieldMapping[field.key] ? 'border-red-500/50' : 'border-slate-600'
                        }`}
                      >
                        <option value="">— Skip —</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className="bg-slate-900/50 rounded-lg p-3 mt-2">
                  <p className="text-gray-400 text-xs font-medium mb-2">Preview (first 3 rows):</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          {Object.entries(fieldMapping).filter(([,v]) => v).map(([field]) => (
                            <th key={field} className="text-left px-2 py-1 text-gray-500 capitalize">{field.replace('_', ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-slate-700/30">
                            {Object.entries(fieldMapping).filter(([,v]) => v).map(([field, col]) => (
                              <td key={field} className="px-2 py-1 text-gray-300 truncate max-w-[150px]">{row[col] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setUploadStep(1); setCsvData(null); setCsvHeaders([]); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition">
                    Back
                  </button>
                  <button
                    onClick={() => { if (!fieldMapping.phone) { toast.error('Phone is required'); return; } setUploadStep(3); }}
                    className="flex-1 bg-sky-500 hover:bg-sky-600 text-white py-2 rounded-lg text-sm font-medium transition"
                  >
                    Next: Confirm
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {uploadStep === 3 && (
              <div className="space-y-4">
                <div className="bg-slate-700/30 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-400">List Name</span><span className="text-white font-medium">{uploadForm.name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Contacts</span><span className="text-white font-medium">{csvData.length}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Fields Mapped</span><span className="text-white font-medium">{Object.values(fieldMapping).filter(Boolean).length}</span></div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Assigned To</span>
                    <span className="text-white font-medium">{uploadForm.assigned_to ? (getAgent(uploadForm.assigned_to)?.full_name || 'Agent') : 'Unassigned'}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setUploadStep(2)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded-lg text-sm font-medium transition">
                    Back
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                  >
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : `Upload ${csvData.length} Contacts`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
