import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Play, Pause, Archive, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenantId } from '../../lib/useTenantId';

export default function LeadHunterSequences() {
  const { tenantId, tenantFilter } = useTenantId();
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  const [expandedSequence, setExpandedSequence] = useState(null);
  const [enrollments, setEnrollments] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'draft',
    steps: [{ id: 1, channel: 'email', delay_days: 0, delay_hours: 0, subject: '', body: '', ai_personalize: false, send_window_start: '09:00', send_window_end: '17:00' }],
    max_contacts_per_day: 50,
    stop_on_reply: true,
    stop_on_meeting: true
  });
  const [stepIdCounter, setStepIdCounter] = useState(2);

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    try {
      setLoading(true);
      const { data, error } = await tenantFilter(
        supabase.from('lh_sequences').select('*')
      ).order('created_at', { ascending: false });

      if (error) throw error;
      setSequences(data || []);
    } catch (err) {
      console.error('Error fetching sequences:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrollments = async (sequenceId) => {
    try {
      const { data, error } = await supabase
        .from('lh_enrollments')
        .select(`
          id,
          status,
          current_step,
          next_step_at,
          lh_companies(name, website)
        `)
        .eq('sequence_id', sequenceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnrollments(prev => ({
        ...prev,
        [sequenceId]: data || []
      }));
    } catch (err) {
      console.error('Error fetching enrollments:', err);
    }
  };

  const handleCreateSequence = async (e) => {
    e.preventDefault();
    try {
      const sequenceData = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        steps: formData.steps.map(({ id, ...step }) => step),
        max_contacts_per_day: formData.max_contacts_per_day,
        stop_on_reply: formData.stop_on_reply,
        stop_on_meeting: formData.stop_on_meeting,
        total_enrolled: 0,
        total_replied: 0,
        reply_rate: 0,
        total_meetings: 0,
        tenant_id: tenantId,
      };

      const { data, error } = await supabase
        .from('lh_sequences')
        .insert([sequenceData])
        .select();

      if (error) throw error;
      setSequences([...data, ...sequences]);
      resetForm();
      setShowCreateModal(false);
    } catch (err) {
      console.error('Error creating sequence:', err);
    }
  };

  const handleUpdateSequence = async (e) => {
    e.preventDefault();
    try {
      const sequenceData = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        steps: formData.steps.map(({ id, ...step }) => step),
        max_contacts_per_day: formData.max_contacts_per_day,
        stop_on_reply: formData.stop_on_reply,
        stop_on_meeting: formData.stop_on_meeting
      };

      const { data, error } = await supabase
        .from('lh_sequences')
        .update(sequenceData)
        .eq('id', editingSequence.id)
        .select();

      if (error) throw error;
      setSequences(sequences.map(s => s.id === editingSequence.id ? data[0] : s));
      resetForm();
      setEditingSequence(null);
    } catch (err) {
      console.error('Error updating sequence:', err);
    }
  };

  const handleAddStep = () => {
    setFormData({
      ...formData,
      steps: [
        ...formData.steps,
        { id: stepIdCounter, channel: 'email', delay_days: 0, delay_hours: 0, subject: '', body: '', ai_personalize: false, send_window_start: '09:00', send_window_end: '17:00' }
      ]
    });
    setStepIdCounter(stepIdCounter + 1);
  };

  const handleRemoveStep = (stepId) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter(s => s.id !== stepId)
    });
  };

  const handleUpdateStep = (stepId, field, value) => {
    setFormData({
      ...formData,
      steps: formData.steps.map(s => s.id === stepId ? { ...s, [field]: value } : s)
    });
  };

  const handleStatusChange = async (sequenceId, newStatus) => {
    try {
      const { error } = await supabase
        .from('lh_sequences')
        .update({ status: newStatus })
        .eq('id', sequenceId);

      if (error) throw error;
      setSequences(sequences.map(s => s.id === sequenceId ? { ...s, status: newStatus } : s));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteSequence = async (sequenceId) => {
    if (!confirm('Are you sure? This will delete the sequence and all enrollments.')) return;
    try {
      const { error } = await supabase
        .from('lh_sequences')
        .delete()
        .eq('id', sequenceId);

      if (error) throw error;
      setSequences(sequences.filter(s => s.id !== sequenceId));
    } catch (err) {
      console.error('Error deleting sequence:', err);
    }
  };

  const [processing, setProcessing] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Process all due steps in a sequence via edge function
  const handleProcessSequence = async (sequenceId) => {
    if (processing) return;
    setProcessing(sequenceId);
    try {
      const response = await supabase.functions.invoke('lh-outreach', {
        body: { action: 'process_sequence', sequence_id: sequenceId, tenant_id: tenantId }
      });
      if (response.error) throw response.error;
      const result = response.data;
      showToast(`Processed ${result.processed} enrollment(s), ${result.skipped} waiting on delay`, 'success');
      // Refresh enrollments for this sequence
      await fetchEnrollments(sequenceId);
    } catch (err) {
      console.error('Process sequence error:', err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Execute next step for a single enrollment
  const handleExecuteStep = async (enrollmentId, sequenceId) => {
    try {
      const response = await supabase.functions.invoke('lh-outreach', {
        body: { action: 'execute_step', enrollment_id: enrollmentId, tenant_id: tenantId }
      });
      if (response.error) throw response.error;
      const result = response.data;
      showToast(`Step ${result.step_number}/${result.total_steps} (${result.channel}): ${result.mode || 'executed'}`, 'success');
      await fetchEnrollments(sequenceId);
    } catch (err) {
      console.error('Execute step error:', err);
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // Unenroll a contact from sequence
  const handleUnenroll = async (enrollmentId, sequenceId) => {
    try {
      const response = await supabase.functions.invoke('lh-outreach', {
        body: { action: 'unenroll', enrollment_id: enrollmentId, tenant_id: tenantId }
      });
      if (response.error) throw response.error;
      showToast('Contact unenrolled', 'success');
      await fetchEnrollments(sequenceId);
    } catch (err) {
      console.error('Unenroll error:', err);
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'draft',
      steps: [{ id: 1, channel: 'email', delay_days: 0, delay_hours: 0, subject: '', body: '', ai_personalize: false, send_window_start: '09:00', send_window_end: '17:00' }],
      max_contacts_per_day: 50,
      stop_on_reply: true,
      stop_on_meeting: true
    });
    setStepIdCounter(2);
  };

  const toggleSequenceExpand = async (sequenceId) => {
    if (expandedSequence === sequenceId) {
      setExpandedSequence(null);
    } else {
      setExpandedSequence(sequenceId);
      if (!enrollments[sequenceId]) {
        await fetchEnrollments(sequenceId);
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-500/20 text-gray-300',
      active: 'bg-green-500/20 text-green-300',
      paused: 'bg-yellow-500/20 text-yellow-300',
      completed: 'bg-blue-500/20 text-blue-300',
      archived: 'bg-slate-600/20 text-slate-400'
    };
    return colors[status] || colors.draft;
  };

  const openEditModal = (sequence) => {
    setEditingSequence(sequence);
    setFormData({
      name: sequence.name,
      description: sequence.description,
      status: sequence.status,
      steps: sequence.steps.map((step, idx) => ({ ...step, id: idx })),
      max_contacts_per_day: sequence.max_contacts_per_day,
      stop_on_reply: sequence.stop_on_reply,
      stop_on_meeting: sequence.stop_on_meeting
    });
    setStepIdCounter((sequence.steps?.length || 0) + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-gray-400">Loading sequences...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Outreach Sequences</h1>
            <p className="text-gray-400">Create and manage multi-step outreach campaigns</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingSequence(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition"
          >
            <Plus size={18} />
            Create Sequence
          </button>
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || editingSequence) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-slate-800 rounded-lg border border-slate-700/50 w-full max-w-2xl">
              <div className="sticky top-0 bg-slate-800 border-b border-slate-700/50 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingSequence ? 'Edit Sequence' : 'Create New Sequence'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSequence(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={editingSequence ? handleUpdateSequence : handleCreateSequence} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-white font-semibold">Sequence Details</h3>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Sequence Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500"
                      placeholder="e.g., Cold Outreach Q2"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 h-20 resize-none"
                      placeholder="Optional description"
                    />
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-semibold">Outreach Steps</h3>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="flex items-center gap-1 text-sky-400 hover:text-sky-300 text-sm"
                    >
                      <Plus size={16} />
                      Add Step
                    </button>
                  </div>

                  {formData.steps.map((step, idx) => (
                    <div key={step.id} className="bg-slate-700/30 border border-slate-600/30 rounded p-4 space-y-3">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-gray-300 text-sm font-medium">Step {idx + 1}</p>
                        {formData.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(step.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">Channel</label>
                          <select
                            value={step.channel}
                            onChange={(e) => handleUpdateStep(step.id, 'channel', e.target.value)}
                            className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-sky-500"
                          >
                            <option value="email">Email</option>
                            <option value="sms">SMS</option>
                            <option value="linkedin_message">LinkedIn Message</option>
                            <option value="task">Task</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">Delay (days)</label>
                          <input
                            type="number"
                            min="0"
                            value={step.delay_days}
                            onChange={(e) => handleUpdateStep(step.id, 'delay_days', parseInt(e.target.value))}
                            className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">Delay (hours)</label>
                          <input
                            type="number"
                            min="0"
                            max="23"
                            value={step.delay_hours}
                            onChange={(e) => handleUpdateStep(step.id, 'delay_hours', parseInt(e.target.value))}
                            className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      {step.channel === 'email' && (
                        <>
                          <div>
                            <label className="block text-gray-300 text-xs font-medium mb-1">Subject Line</label>
                            <input
                              type="text"
                              value={step.subject}
                              onChange={(e) => handleUpdateStep(step.id, 'subject', e.target.value)}
                              className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-sky-500"
                              placeholder="{{first_name}}, let's talk about {{company_name}}"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-gray-300 text-xs font-medium mb-1">
                          {step.channel === 'email' ? 'Email Body' : 'Message Body'}
                        </label>
                        <textarea
                          value={step.body}
                          onChange={(e) => handleUpdateStep(step.id, 'body', e.target.value)}
                          className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-sky-500 h-24 resize-none font-mono text-xs"
                          placeholder="Available variables: {{first_name}}, {{company_name}}, {{title}}, {{industry}}"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={step.ai_personalize}
                            onChange={(e) => handleUpdateStep(step.id, 'ai_personalize', e.target.checked)}
                            className="w-4 h-4 accent-sky-500"
                          />
                          <span className="text-gray-300 text-sm">AI Personalize</span>
                        </label>
                        <div>
                          <label className="block text-gray-300 text-xs font-medium mb-1">Send Window</label>
                          <div className="flex gap-2">
                            <input
                              type="time"
                              value={step.send_window_start}
                              onChange={(e) => handleUpdateStep(step.id, 'send_window_start', e.target.value)}
                              className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-sky-500"
                            />
                            <span className="text-gray-400 text-xs flex items-center">to</span>
                            <input
                              type="time"
                              value={step.send_window_end}
                              onChange={(e) => handleUpdateStep(step.id, 'send_window_end', e.target.value)}
                              className="flex-1 bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Settings */}
                <div className="space-y-4 border-t border-slate-700/50 pt-6">
                  <h3 className="text-white font-semibold">Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-2">Max Contacts/Day</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.max_contacts_per_day}
                        onChange={(e) => setFormData({ ...formData, max_contacts_per_day: parseInt(e.target.value) })}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.stop_on_reply}
                      onChange={(e) => setFormData({ ...formData, stop_on_reply: e.target.checked })}
                      className="w-4 h-4 accent-sky-500"
                    />
                    <span className="text-gray-300 text-sm">Stop sequence when recipient replies</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.stop_on_meeting}
                      onChange={(e) => setFormData({ ...formData, stop_on_meeting: e.target.checked })}
                      className="w-4 h-4 accent-sky-500"
                    />
                    <span className="text-gray-300 text-sm">Stop sequence when meeting is scheduled</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 border-t border-slate-700/50 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingSequence(null);
                      resetForm();
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded transition"
                  >
                    {editingSequence ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sequences Grid */}
        {sequences.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">No sequences created yet. Build your first outreach sequence.</p>
            <button
              onClick={() => {
                resetForm();
                setEditingSequence(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus size={18} />
              Create First Sequence
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sequences.map(sequence => (
              <div key={sequence.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden flex flex-col">
                {/* Card Header */}
                <div
                  onClick={() => toggleSequenceExpand(sequence.id)}
                  className="p-4 hover:bg-slate-800/70 transition cursor-pointer flex-1"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{sequence.name}</h3>
                      {sequence.description && <p className="text-gray-400 text-sm mt-1">{sequence.description}</p>}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(sequence.status)}`}>
                      {sequence.status.charAt(0).toUpperCase() + sequence.status.slice(1)}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <p className="text-white text-sm font-semibold">{sequence.total_enrolled || 0}</p>
                      <p className="text-gray-400 text-xs">Enrolled</p>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{sequence.total_replied || 0}</p>
                      <p className="text-gray-400 text-xs">Replied</p>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{sequence.reply_rate || 0}%</p>
                      <p className="text-gray-400 text-xs">Reply Rate</p>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{sequence.total_meetings || 0}</p>
                      <p className="text-gray-400 text-xs">Meetings</p>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="border-t border-slate-700/50 p-3 flex gap-2 bg-slate-800/30">
                  {sequence.status === 'draft' && (
                    <button
                      onClick={() => handleStatusChange(sequence.id, 'active')}
                      className="flex-1 flex items-center justify-center gap-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 py-2 rounded text-sm transition"
                    >
                      <Play size={14} />
                      Activate
                    </button>
                  )}
                  {sequence.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleProcessSequence(sequence.id)}
                        disabled={processing === sequence.id}
                        className="flex-1 flex items-center justify-center gap-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 py-2 rounded text-sm transition disabled:opacity-50"
                      >
                        <Play size={14} />
                        {processing === sequence.id ? 'Processing...' : 'Run Now'}
                      </button>
                      <button
                        onClick={() => handleStatusChange(sequence.id, 'paused')}
                        className="flex-1 flex items-center justify-center gap-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 py-2 rounded text-sm transition"
                      >
                        <Pause size={14} />
                        Pause
                      </button>
                    </>
                  )}
                  {sequence.status !== 'archived' && (
                    <button
                      onClick={() => openEditModal(sequence)}
                      className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded text-sm transition"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange(sequence.id, sequence.status === 'archived' ? 'draft' : 'archived')}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-600 text-gray-300 py-2 rounded text-sm transition"
                  >
                    <Archive size={14} />
                  </button>
                </div>

                {/* Expanded Enrollments */}
                {expandedSequence === sequence.id && (
                  <div className="border-t border-slate-700/50 bg-slate-800/30 p-4 max-h-80 overflow-y-auto">
                    <h4 className="text-gray-300 text-sm font-semibold mb-3">Enrolled Contacts ({enrollments[sequence.id]?.length || 0})</h4>
                    {enrollments[sequence.id] && enrollments[sequence.id].length === 0 ? (
                      <p className="text-gray-400 text-xs">No contacts enrolled yet</p>
                    ) : (
                      <div className="space-y-2">
                        {enrollments[sequence.id]?.map(enrollment => (
                          <div key={enrollment.id} className="p-2 bg-slate-700/30 rounded border border-slate-600/30 text-xs flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{enrollment.lh_companies?.name || 'Unknown'}</p>
                              <p className="text-gray-400">Status: {enrollment.status} • Step {enrollment.current_step || 0}/{sequence.steps?.length || 0}</p>
                            </div>
                            {enrollment.status === 'active' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleExecuteStep(enrollment.id, sequence.id)}
                                  className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded text-xs transition"
                                  title="Execute next step"
                                >
                                  <Play size={12} />
                                </button>
                                <button
                                  onClick={() => handleUnenroll(enrollment.id, sequence.id)}
                                  className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-xs transition"
                                  title="Unenroll"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-sky-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
