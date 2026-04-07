import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchAutomations, createAutomation, updateAutomation, deleteAutomation,
  fetchChannels, fetchTemplates, createTemplate, updateTemplate,
} from '../../lib/commsService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Trash2, Settings, AlertCircle, PlayCircle, Clock,
  ZapOff, Zap, Mail, MessageSquare, Tag, User, Edit,
} from 'lucide-react';

const TRIGGER_TYPES = [
  { id: 'new_conversation', label: 'New Conversation', icon: Plus },
  { id: 'status_change', label: 'Status Change', icon: Settings },
  { id: 'time_delay', label: 'Time Delay', icon: Clock },
  { id: 'manual', label: 'Manual', icon: PlayCircle },
  { id: 'event', label: 'Event', icon: Zap },
  { id: 'schedule', label: 'Schedule', icon: Clock },
];

const ACTION_TYPES = [
  { id: 'send_email', label: 'Send Email', icon: Mail },
  { id: 'send_sms', label: 'Send SMS', icon: MessageSquare },
  { id: 'assign', label: 'Assign', icon: User },
  { id: 'tag', label: 'Add Tag', icon: Tag },
  { id: 'update_status', label: 'Update Status', icon: Settings },
  { id: 'webhook', label: 'Webhook', icon: Zap },
  { id: 'notify', label: 'Notify Team', icon: AlertCircle },
];

const TEMPLATE_CATEGORIES = ['welcome', 'followup', 'closure', 'feedback', 'other'];

export default function AutomationsPage() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Automation dialog
  const [showAutoDialog, setShowAutoDialog] = useState(false);
  const [editingAuto, setEditingAuto] = useState(null);
  const [autoForm, setAutoForm] = useState({
    name: '',
    trigger_type: 'new_conversation',
    trigger_config: '',
    action_type: 'send_email',
    action_config: '',
    template_id: '',
    channel_id: '',
    is_active: true,
  });

  // Template dialog
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'other',
    channel_type: 'email',
    subject: '',
    body: '',
    variables: '',
  });

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [autoData, channelsData, templatesData] = await Promise.all([
        fetchAutomations(),
        fetchChannels(),
        fetchTemplates(),
      ]);
      setAutomations(autoData);
      setChannels(channelsData);
      setTemplates(templatesData);
    } catch (err) {
      console.error('[Automations] Fetch error:', err);
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  }

  // ─── AUTOMATION HANDLERS ────────────────────

  function openCreateAutoDialog() {
    setEditingAuto(null);
    setAutoForm({
      name: '',
      trigger_type: 'new_conversation',
      trigger_config: '',
      action_type: 'send_email',
      action_config: '',
      template_id: '',
      channel_id: '',
      is_active: true,
    });
    setShowAutoDialog(true);
  }

  function openEditAutoDialog(auto) {
    setEditingAuto(auto);
    setAutoForm({
      name: auto.name,
      trigger_type: auto.trigger_type,
      trigger_config: auto.trigger_config || '',
      action_type: auto.action_type,
      action_config: auto.action_config || '',
      template_id: auto.template_id || '',
      channel_id: auto.channel_id || '',
      is_active: auto.is_active,
    });
    setShowAutoDialog(true);
  }

  async function handleSaveAutomation() {
    if (!autoForm.name.trim()) {
      toast.error('Automation name is required');
      return;
    }

    try {
      const payload = {
        name: autoForm.name,
        trigger_type: autoForm.trigger_type,
        trigger_config: autoForm.trigger_config,
        action_type: autoForm.action_type,
        action_config: autoForm.action_config,
        template_id: autoForm.template_id || null,
        channel_id: autoForm.channel_id || null,
        is_active: autoForm.is_active,
      };

      if (editingAuto) {
        const updated = await updateAutomation(editingAuto.id, payload);
        setAutomations(prev => prev.map(a => a.id === editingAuto.id ? updated : a));
        toast.success('Automation updated');
      } else {
        const created = await createAutomation({
          ...payload,
          run_count: 0,
          last_run_at: null,
        });
        setAutomations(prev => [created, ...prev]);
        toast.success('Automation created');
      }

      setShowAutoDialog(false);
      setEditingAuto(null);
    } catch (err) {
      console.error('[Automations] Save error:', err);
      toast.error('Failed to save automation');
    }
  }

  async function handleToggleActive(auto) {
    try {
      const updated = await updateAutomation(auto.id, { is_active: !auto.is_active });
      setAutomations(prev => prev.map(a => a.id === auto.id ? updated : a));
      toast.success(updated.is_active ? 'Automation enabled' : 'Automation disabled');
    } catch (err) {
      console.error('[Automations] Toggle error:', err);
      toast.error('Failed to toggle automation');
    }
  }

  async function handleDeleteAutomation() {
    if (!deleteTarget) return;
    try {
      await deleteAutomation(deleteTarget.id);
      setAutomations(prev => prev.filter(a => a.id !== deleteTarget.id));
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      toast.success('Automation deleted');
    } catch (err) {
      console.error('[Automations] Delete error:', err);
      toast.error('Failed to delete automation');
    }
  }

  // ─── TEMPLATE HANDLERS ──────────────────────

  function openCreateTemplateDialog() {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      category: 'other',
      channel_type: 'email',
      subject: '',
      body: '',
      variables: '',
    });
    setShowTemplateDialog(true);
  }

  function openEditTemplateDialog(template) {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      category: template.category,
      channel_type: template.channel_type,
      subject: template.subject || '',
      body: template.body || '',
      variables: template.variables ? JSON.stringify(template.variables) : '',
    });
    setShowTemplateDialog(true);
  }

  async function handleSaveTemplate() {
    if (!templateForm.name.trim() || !templateForm.body.trim()) {
      toast.error('Name and body are required');
      return;
    }

    try {
      const variables = templateForm.variables
        ? templateForm.variables.split(',').map(v => v.trim())
        : [];

      const payload = {
        name: templateForm.name,
        category: templateForm.category,
        channel_type: templateForm.channel_type,
        subject: templateForm.subject,
        body: templateForm.body,
        variables,
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        toast.success('Template updated');
      } else {
        await createTemplate(payload);
        toast.success('Template created');
      }

      setShowTemplateDialog(false);
      setEditingTemplate(null);
      // Refresh templates
      const updatedTemplates = await fetchTemplates();
      setTemplates(updatedTemplates);
    } catch (err) {
      console.error('[Templates] Save error:', err);
      toast.error('Failed to save template');
    }
  }

  const stats = {
    active: automations.filter(a => a.is_active).length,
    totalRuns: automations.reduce((sum, a) => sum + (a.run_count || 0), 0),
    lastRun: automations
      .filter(a => a.last_run_at)
      .sort((a, b) => new Date(b.last_run_at) - new Date(a.last_run_at))[0]?.last_run_at,
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-sky-500" />
          <p className="mt-4 text-gray-400">Loading automations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Message Automations</h1>
          <p className="mt-2 text-gray-400">
            Create automated workflows to send messages, assign conversations, and more
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-gray-400">Active Automations</p>
              <p className="mt-2 text-3xl font-bold text-sky-400">{stats.active}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-gray-400">Total Runs</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{stats.totalRuns}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-gray-400">Last Run</p>
              <p className="mt-2 text-lg font-bold text-gray-300">
                {stats.lastRun
                  ? new Date(stats.lastRun).toLocaleDateString()
                  : 'Never'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Automations List */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Automations</h2>
            <Button onClick={openCreateAutoDialog} className="bg-sky-500 hover:bg-sky-600">
              <Plus className="h-4 w-4 mr-2" />
              New Automation
            </Button>
          </div>

          {automations.length === 0 ? (
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-12 w-12 text-gray-600 mb-4" />
                <p className="text-lg font-semibold text-white">No Automations Yet</p>
                <p className="mt-2 text-sm text-gray-400">
                  Create your first automation to start automating customer communications
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map(auto => {
                const triggerType = TRIGGER_TYPES.find(t => t.id === auto.trigger_type);
                const actionType = ACTION_TYPES.find(t => t.id === auto.action_type);
                const TriggerIcon = triggerType?.icon || Zap;
                const ActionIcon = actionType?.icon || Mail;

                return (
                  <Card key={auto.id} className="border-slate-700 bg-slate-800/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-white">{auto.name}</h3>
                            <Badge
                              className={`${
                                auto.is_active
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {auto.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <div className="flex items-center gap-1">
                              <TriggerIcon className="h-4 w-4" />
                              <span>{triggerType?.label}</span>
                            </div>
                            <span>→</span>
                            <div className="flex items-center gap-1">
                              <ActionIcon className="h-4 w-4" />
                              <span>{actionType?.label}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(auto)}
                          >
                            {auto.is_active ? (
                              <ZapOff className="h-4 w-4" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditAutoDialog(auto)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              setDeleteTarget(auto);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-gray-400">Runs</p>
                          <p className="mt-1 text-lg font-bold text-gray-300">{auto.run_count || 0}</p>
                        </div>
                        {auto.template_id && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400">Template</p>
                            <p className="mt-1 truncate text-gray-300">
                              {templates.find(t => t.id === auto.template_id)?.name || 'Unknown'}
                            </p>
                          </div>
                        )}
                        {auto.channel_id && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400">Channel</p>
                            <p className="mt-1 truncate text-gray-300">
                              {channels.find(c => c.id === auto.channel_id)?.name || 'Unknown'}
                            </p>
                          </div>
                        )}
                        {auto.last_run_at && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400">Last Run</p>
                            <p className="mt-1 text-gray-300">
                              {new Date(auto.last_run_at).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Templates Section */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Message Templates</h2>
            <Button
              variant="outline"
              onClick={openCreateTemplateDialog}
              className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="h-12 w-12 text-gray-600 mb-4" />
                <p className="text-lg font-semibold text-white">No Templates Yet</p>
                <p className="mt-2 text-sm text-gray-400">
                  Create templates to reuse common messages in your automations
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-400">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-400">Category</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-400">Channel</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-400">Usage</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {templates.map(template => (
                    <tr key={template.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3 text-white font-medium">{template.name}</td>
                      <td className="px-6 py-3">
                        <Badge className="bg-slate-600 text-gray-300 capitalize">
                          {template.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-gray-300 capitalize">
                        {template.channel_type}
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {automations.filter(a => a.template_id === template.id).length} automations
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditTemplateDialog(template)}
                            className="text-sky-400 hover:text-sky-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Automation Dialog */}
      <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingAuto ? 'Edit Automation' : 'Create Automation'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <label className="text-sm font-semibold text-gray-400">Name</label>
              <Input
                value={autoForm.name}
                onChange={(e) => setAutoForm({ ...autoForm, name: e.target.value })}
                placeholder="e.g., Welcome New Conversation"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">When</label>
              <select
                value={autoForm.trigger_type}
                onChange={(e) => setAutoForm({ ...autoForm, trigger_type: e.target.value })}
                className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
              >
                {TRIGGER_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">
                Trigger Details (Optional)
              </label>
              <Textarea
                value={autoForm.trigger_config}
                onChange={(e) => setAutoForm({ ...autoForm, trigger_config: e.target.value })}
                placeholder="e.g., status = open, delay = 1 hour"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>

            <div className="border-t border-slate-700 pt-4">
              <label className="text-sm font-semibold text-gray-400">Then</label>
              <select
                value={autoForm.action_type}
                onChange={(e) => setAutoForm({ ...autoForm, action_type: e.target.value })}
                className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
              >
                {ACTION_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">
                Action Details (Optional)
              </label>
              <Textarea
                value={autoForm.action_config}
                onChange={(e) => setAutoForm({ ...autoForm, action_config: e.target.value })}
                placeholder="e.g., subject = Welcome!, assign_to = support_team"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-400">Template</label>
                <select
                  value={autoForm.template_id}
                  onChange={(e) => setAutoForm({ ...autoForm, template_id: e.target.value })}
                  className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
                >
                  <option value="">None</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-400">Channel</label>
                <select
                  value={autoForm.channel_id}
                  onChange={(e) => setAutoForm({ ...autoForm, channel_id: e.target.value })}
                  className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
                >
                  <option value="">All Channels</option>
                  {channels.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded bg-slate-700/20 p-3">
              <input
                type="checkbox"
                checked={autoForm.is_active}
                onChange={(e) => setAutoForm({ ...autoForm, is_active: e.target.checked })}
                id="active-toggle"
                className="rounded border-slate-600"
              />
              <label htmlFor="active-toggle" className="text-sm font-semibold text-gray-300">
                Active
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAutomation}>
              {editingAuto ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <label className="text-sm font-semibold text-gray-400">Template Name</label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Welcome Email"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-gray-400">Category</label>
                <select
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                  className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
                >
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="capitalize">{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-400">Channel Type</label>
                <select
                  value={templateForm.channel_type}
                  onChange={(e) => setTemplateForm({ ...templateForm, channel_type: e.target.value })}
                  className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
            </div>

            {templateForm.channel_type === 'email' && (
              <div>
                <label className="text-sm font-semibold text-gray-400">Subject</label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="e.g., Welcome to our service!"
                  className="mt-1 bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-semibold text-gray-400">Message Body</label>
              <Textarea
                value={templateForm.body}
                onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                placeholder="Your message template..."
                className="mt-1 bg-slate-700/50 border-slate-600 text-white resize-none"
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-500">
                Use {{variable}} for dynamic content
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-400">
                Variables (comma-separated, Optional)
              </label>
              <Input
                value={templateForm.variables}
                onChange={(e) => setTemplateForm({ ...templateForm, variables: e.target.value })}
                placeholder="e.g., name, email, company"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Delete Automation?
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            This will permanently delete the automation <strong>{deleteTarget?.name}</strong>. This
            action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAutomation}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
