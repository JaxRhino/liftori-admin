import React, { useEffect, useState } from 'react';
import { ChevronDown, Plus, Trash2, ArrowRight, Download, PhoneCall } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantId } from '../../lib/useTenantId';
import { useToast } from '../../lib/useToast';

export default function LeadHunterLists() {
  const { tenantId, tenantFilter } = useTenantId();
  const [lists, setLists] = useState([]);
  const [expandedList, setExpandedList] = useState(null);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'static'
  });
  const [moveModal, setMoveModal] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState({});

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const { data, error } = await tenantFilter(
        supabase.from('lh_lists').select('*')
      ).order('created_at', { ascending: false });

      if (error) throw error;
      setLists(data || []);
    } catch (err) {
      console.error('Error fetching lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchListMembers = async (listId) => {
    try {
      const { data, error } = await supabase
        .from('lh_list_members')
        .select(`
          *,
          lh_companies(
            id,
            name,
            website,
            industry,
            employee_count
          )
        `)
        .eq('list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(prev => ({
        ...prev,
        [listId]: data || []
      }));
    } catch (err) {
      console.error('Error fetching list members:', err);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('lh_lists')
        .insert([
          {
            name: formData.name,
            description: formData.description,
            type: formData.type,
            company_count: 0,
            contact_count: 0,
            avg_lead_score: 0,
            tenant_id: tenantId,
          }
        ])
        .select();

      if (error) throw error;
      setLists([...lists, ...data]);
      setFormData({ name: '', description: '', type: 'static' });
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating list:', err);
    }
  };

  const handleRemoveMembers = async (listId) => {
    const memberIds = Object.keys(selectedMembers).filter(k => selectedMembers[k]);
    if (memberIds.length === 0) return;

    try {
      const { error } = await tenantFilter(
        supabase.from('lh_list_members').delete().in('id', memberIds)
      );

      if (error) throw error;
      setSelectedMembers({});
      await fetchListMembers(listId);
    } catch (err) {
      console.error('Error removing members:', err);
    }
  };

  const handleMoveMembers = async (toListId) => {
    const memberIds = Object.keys(selectedMembers).filter(k => selectedMembers[k]);
    if (memberIds.length === 0) return;

    try {
      const { error } = await tenantFilter(
        supabase.from('lh_list_members').update({ list_id: toListId }).in('id', memberIds)
      );

      if (error) throw error;
      setSelectedMembers({});
      setMoveModal(null);
      if (expandedList) await fetchListMembers(expandedList);
    } catch (err) {
      console.error('Error moving members:', err);
    }
  };

  const [enrichingList, setEnrichingList] = useState(null);
  const { showToast, ToastContainer } = useToast();

  // Bulk enrich all companies in a list
  const handleEnrichList = async (listId) => {
    const listMembers = members[listId] || [];
    const companyIds = listMembers
      .filter(m => m.lh_companies?.id)
      .map(m => m.lh_companies.id);

    if (companyIds.length === 0) {
      showToast('No companies in this list to enrich', 'error');
      return;
    }

    setEnrichingList(listId);
    try {
      // Enrich in batches of 10
      for (let i = 0; i < companyIds.length; i += 10) {
        const batch = companyIds.slice(i, i + 10);
        const enrichResult = await supabase.functions.invoke('lh-enrich', {
          body: { company_ids: batch, tenant_id: tenantId }
        });
        if (enrichResult.error) throw enrichResult.error;

        const scoreResult = await supabase.functions.invoke('lh-score', {
          body: { company_ids: batch, tenant_id: tenantId }
        });
        if (scoreResult.error) throw scoreResult.error;
      }
      showToast(`Enriched & scored ${companyIds.length} companies`, 'success');
    } catch (err) {
      console.error('List enrich error:', err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setEnrichingList(null);
    }
  };

  const handleExportCSV = async (listId) => {
    try {
      const listMembers = members[listId] || [];
      const csv = [
        ['Company', 'Website', 'Industry', 'Employee Count'],
        ...listMembers.map(m => [
          m.lh_companies?.name || '',
          m.lh_companies?.website || '',
          m.lh_companies?.industry || '',
          m.lh_companies?.employee_count || ''
        ])
      ]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `list-${listId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  const [exportingToDialer, setExportingToDialer] = useState(null);

  const handleExportToDialer = async (listId, listName) => {
    const listMembers = members[listId] || [];
    if (listMembers.length === 0) {
      showToast('No companies in this list to export', 'error');
      return;
    }

    setExportingToDialer(listId);
    try {
      // Fetch contacts for these companies from lh_contacts
      const companyIds = listMembers.filter(m => m.lh_companies?.id).map(m => m.lh_companies.id);
      const { data: contacts, error: contactsErr } = await supabase
        .from('lh_contacts')
        .select('*')
        .in('company_id', companyIds)
        .not('phone', 'is', null);

      // Build contact rows — use company data if no contacts with phones
      let rows = [];
      if (contacts && contacts.length > 0) {
        rows = contacts.map((c, i) => ({
          position: i + 1,
          first_name: c.first_name || null,
          last_name: c.last_name || null,
          company: listMembers.find(m => m.lh_companies?.id === c.company_id)?.lh_companies?.name || null,
          title: c.title || null,
          phone: c.phone,
          email: c.email || null,
          industry: listMembers.find(m => m.lh_companies?.id === c.company_id)?.lh_companies?.industry || null,
          source_id: c.id,
        }));
      } else {
        // Fallback: use company phone if available
        const { data: companies } = await supabase
          .from('lh_companies')
          .select('id, name, phone, website, industry')
          .in('id', companyIds)
          .not('phone', 'is', null);
        if (companies && companies.length > 0) {
          rows = companies.map((co, i) => ({
            position: i + 1,
            company: co.name,
            phone: co.phone,
            website: co.website || null,
            industry: co.industry || null,
            source_id: co.id,
          }));
        }
      }

      if (rows.length === 0) {
        showToast('No contacts with phone numbers found in this list', 'error');
        return;
      }

      // Create call list
      const { data: callList, error: listErr } = await supabase.from('call_lists').insert({
        name: `LH: ${listName}`,
        description: `Exported from Lead Hunter list "${listName}"`,
        source: 'lead_hunter',
        total_contacts: rows.length,
        created_by: tenantId,
      }).select().single();

      if (listErr) throw listErr;

      // Insert contacts
      const contactRows = rows.map(r => ({ ...r, list_id: callList.id }));
      for (let i = 0; i < contactRows.length; i += 500) {
        const batch = contactRows.slice(i, i + 500);
        const { error } = await supabase.from('call_list_contacts').insert(batch);
        if (error) throw error;
      }

      showToast(`Exported ${rows.length} contacts to Call Center dialer`, 'success');
    } catch (err) {
      console.error('Error exporting to dialer:', err);
      showToast('Failed to export: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExportingToDialer(null);
    }
  };

  const toggleListExpand = async (listId) => {
    if (expandedList === listId) {
      setExpandedList(null);
    } else {
      setExpandedList(listId);
      if (!members[listId]) {
        await fetchListMembers(listId);
      }
    }
  };

  const selectedCount = Object.values(selectedMembers).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-gray-400">Loading lists...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Lists & Segments</h1>
            <p className="text-gray-400">Organize and manage your prospect lists</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus size={18} />
            Create List
          </button>
        </div>

        {/* Create List Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4">Create New List</h2>
              <form onSubmit={handleCreateList} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">List Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                    placeholder="e.g., Q2 Targets"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 h-24 resize-none"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">List Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="static">Static (manual additions)</option>
                    <option value="dynamic">Dynamic (filter-based)</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded transition"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Move Modal */}
        {moveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4">Move to List</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
                {lists
                  .filter(l => l.id !== moveModal)
                  .map(list => (
                    <button
                      key={list.id}
                      onClick={() => handleMoveMembers(list.id)}
                      className="w-full text-left p-3 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-white transition"
                    >
                      {list.name}
                    </button>
                  ))}
              </div>
              <button
                onClick={() => setMoveModal(null)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Lists */}
        {lists.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">No lists created yet. Create your first list to organize prospects.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus size={18} />
              Create First List
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {lists.map(list => (
              <div key={list.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
                {/* List Header */}
                <button
                  onClick={() => toggleListExpand(list.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-800/70 transition text-left"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <ChevronDown
                      size={20}
                      className={`text-gray-400 transition ${expandedList === list.id ? 'rotate-180' : ''}`}
                    />
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{list.name}</h3>
                      {list.description && <p className="text-gray-400 text-sm">{list.description}</p>}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium mr-3 ${
                          list.type === 'static' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {list.type === 'static' ? 'Static' : 'Dynamic'}
                        </span>
                      </div>
                      <div className="text-right min-w-fit">
                        <p className="text-white font-semibold">{list.company_count || 0}</p>
                        <p className="text-gray-400 text-xs">companies</p>
                      </div>
                      <div className="text-right min-w-fit">
                        <p className="text-white font-semibold">{list.contact_count || 0}</p>
                        <p className="text-gray-400 text-xs">contacts</p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* List Members - Expanded */}
                {expandedList === list.id && (
                  <div className="border-t border-slate-700/50">
                    {selectedCount > 0 && (
                      <div className="bg-sky-500/10 border-b border-slate-700/50 p-4 flex items-center justify-between">
                        <p className="text-sky-300 text-sm font-medium">{selectedCount} selected</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRemoveMembers(list.id)}
                            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 rounded text-sm transition"
                          >
                            <Trash2 size={16} />
                            Remove
                          </button>
                          <button
                            onClick={() => setMoveModal(list.id)}
                            className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1 rounded text-sm transition"
                          >
                            <ArrowRight size={16} />
                            Move
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                      {members[list.id] && members[list.id].length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">No companies in this list</p>
                      ) : (
                        members[list.id]?.map(member => (
                          <div key={member.id} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded border border-slate-600/30 hover:border-slate-600 transition">
                            <input
                              type="checkbox"
                              checked={selectedMembers[member.id] || false}
                              onChange={(e) => setSelectedMembers({
                                ...selectedMembers,
                                [member.id]: e.target.checked
                              })}
                              className="w-4 h-4 accent-sky-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="text-white text-sm font-medium">{member.lh_companies?.name}</p>
                              <p className="text-gray-400 text-xs">{member.lh_companies?.industry}</p>
                            </div>
                            <div className="text-right text-gray-400 text-xs">
                              {member.lh_companies?.employee_count && `${member.lh_companies.employee_count} employees`}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-slate-700/50 p-4 flex justify-end gap-2">
                      <button
                        onClick={() => handleEnrichList(list.id)}
                        disabled={enrichingList === list.id}
                        className="flex items-center gap-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 px-3 py-2 rounded text-sm transition disabled:opacity-50"
                      >
                        {enrichingList === list.id ? 'Enriching...' : 'Enrich All'}
                      </button>
                      <button
                        onClick={() => handleExportToDialer(list.id, list.name)}
                        disabled={exportingToDialer === list.id}
                        className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-2 rounded text-sm transition disabled:opacity-50"
                      >
                        <PhoneCall size={16} />
                        {exportingToDialer === list.id ? 'Exporting...' : 'Send to Dialer'}
                      </button>
                      <button
                        onClick={() => handleExportCSV(list.id)}
                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-gray-300 px-3 py-2 rounded text-sm transition"
                      >
                        <Download size={16} />
                        Export CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      <ToastContainer />
    </div>
  );
}
