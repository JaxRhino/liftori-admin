import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Bot,
  Plus,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Calendar,
  Headphones,
  Trash2,
  Activity,
  Clock,
  Users,
  Zap,
  Edit3,
  Power,
  MessageSquare,
  UserCheck,
  ArrowRightLeft,
  Sparkles,
  BookOpen,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// AI AGENTS MANAGEMENT PAGE
// Create, configure, and monitor AI voice agents
// ═══════════════════════════════════════════════════════════════

const ROLE_CONFIG = {
  receptionist:  { label: 'Receptionist',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',     icon: PhoneIncoming },
  sales:         { label: 'Outbound Sales',     color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: PhoneOutgoing },
  sales_inbound: { label: 'Inbound Sales',      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: PhoneIncoming },
  booking:       { label: 'Booking Agent',      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Calendar },
  support:       { label: 'Support Agent',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Headphones },
  hr_recruiter:  { label: 'HR Recruiter',       color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',     icon: UserCheck },
  custom:        { label: 'Custom Agent',       color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',     icon: Bot },
};

const DEFAULT_FORM = {
  name: '',
  role: 'receptionist',
  description: '',
  system_prompt: '',
  greeting: '',
  voice_name: '',
  voice_id: '',
  phone_number: '',
  llm_model: 'claude-sonnet-4-20250514',
  max_concurrent_calls: 5,
};

export default function AIAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showConversations, setShowConversations] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [agentsRes, templatesRes, convRes] = await Promise.all([
        supabase.from('ai_agents').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_agent_templates').select('*').order('is_default', { ascending: false }),
        supabase.from('ai_conversations').select('id, agent_id, status, outcome, duration, from_number, caller_name, started_at').order('started_at', { ascending: false }).limit(100),
      ]);
      setAgents(agentsRes.data || []);
      setTemplates(templatesRes.data || []);
      setConversations(convRes.data || []);
    } catch (err) {
      console.error('Failed to load AI agents:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateFromTemplate(template) {
    setSelectedTemplate(template);
    setForm({
      ...DEFAULT_FORM,
      name: template.name,
      role: template.role,
      description: template.description || '',
      system_prompt: template.system_prompt || '',
      greeting: template.greeting || '',
    });
    setShowCreate(true);
  }

  function openCreateBlank() {
    setSelectedTemplate(null);
    setForm({ ...DEFAULT_FORM, greeting: 'Hello, thank you for calling. How can I help you today?' });
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!form.name) {
      toast.error('Agent name is required');
      return;
    }
    try {
      const { error } = await supabase.from('ai_agents').insert({
        name: form.name,
        role: form.role,
        description: form.description,
        // Empty prompt → NULL (worker uses built-in role default)
        system_prompt: form.system_prompt.trim() || null,
        greeting: form.greeting || null,
        voice_name: form.voice_name || null,
        voice_id: form.voice_id || null,
        phone_number: form.phone_number || null,
        llm_model: form.llm_model,
        max_concurrent_calls: form.max_concurrent_calls,
        personality: selectedTemplate?.personality || { tone: 'professional', pace: 'moderate', empathy: 'high' },
        capabilities: selectedTemplate?.capabilities || [],
        transfer_rules: selectedTemplate?.transfer_rules || [],
        created_by: user.id,
      });
      if (error) throw error;
      toast.success(`AI Agent "${form.name}" created`);
      setShowCreate(false);
      loadData();
    } catch (err) {
      toast.error('Failed to create agent: ' + err.message);
    }
  }

  async function handleToggleActive(agent) {
    try {
      const { error } = await supabase.from('ai_agents')
        .update({ is_active: !agent.is_active, updated_at: new Date().toISOString() })
        .eq('id', agent.id);
      if (error) throw error;
      toast.success(agent.is_active ? `${agent.name} deactivated` : `${agent.name} activated`);
      loadData();
    } catch (err) {
      toast.error('Failed to update agent');
    }
  }

  async function handleDelete(agent) {
    if (!confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('ai_agents').delete().eq('id', agent.id);
      if (error) throw error;
      toast.success(`${agent.name} deleted`);
      loadData();
    } catch (err) {
      toast.error('Failed to delete agent');
    }
  }

  async function handleSaveEdit() {
    if (!showEdit) return;
    try {
      const { error } = await supabase.from('ai_agents')
        .update({
          name: form.name,
          role: form.role,
          description: form.description,
          system_prompt: form.system_prompt.trim() || null,
          greeting: form.greeting || null,
          voice_name: form.voice_name || null,
          voice_id: form.voice_id || null,
          phone_number: form.phone_number || null,
          llm_model: form.llm_model,
          max_concurrent_calls: form.max_concurrent_calls,
          updated_at: new Date().toISOString(),
        })
        .eq('id', showEdit.id);
      if (error) throw error;
      toast.success('Agent updated');
      setShowEdit(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update: ' + err.message);
    }
  }

  function openEdit(agent) {
    setSelectedTemplate(null);
    setForm({
      name: agent.name,
      role: agent.role,
      description: agent.description || '',
      system_prompt: agent.system_prompt || '',
      greeting: agent.greeting || '',
      voice_name: agent.voice_name || '',
      voice_id: agent.voice_id || '',
      phone_number: agent.phone_number || '',
      llm_model: agent.llm_model || 'claude-sonnet-4-20250514',
      max_concurrent_calls: agent.max_concurrent_calls || 5,
    });
    setShowEdit(agent);
  }

  function getAgentConversations(agentId) {
    return conversations.filter(c => c.agent_id === agentId);
  }

  // Stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.is_active).length;
  const totalCalls = agents.reduce((sum, a) => sum + (a.total_calls || 0), 0);
  const activeConvos = conversations.filter(c => c.status === 'active').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Activity className="animate-spin text-sky-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bot size={28} className="text-sky-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">AI Agents</h1>
              <p className="text-gray-400 text-sm">Configure and monitor your AI voice agents</p>
            </div>
          </div>
          <Button onClick={openCreateBlank} className="bg-sky-600 hover:bg-sky-700 flex items-center gap-2">
            <Plus size={16} /> New Agent
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Agents', value: totalAgents, icon: Bot, color: 'text-sky-400' },
            { label: 'Active', value: activeAgents, icon: Zap, color: 'text-green-400' },
            { label: 'Total Calls', value: totalCalls, icon: Phone, color: 'text-purple-400' },
            { label: 'Live Now', value: activeConvos, icon: Activity, color: 'text-orange-400' },
          ].map(stat => (
            <Card key={stat.label} className="bg-slate-800/50 border-slate-700 p-4">
              <div className="flex items-center gap-3">
                <stat.icon size={20} className={stat.color} />
                <div>
                  <p className="text-gray-400 text-xs">{stat.label}</p>
                  <p className="text-white text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ─── YOUR LIVE AGENTS ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white text-lg font-bold flex items-center gap-2">
                <Zap size={18} className="text-sky-400" />
                Your Live Agents
              </h2>
              <p className="text-gray-400 text-xs">These are the agents actually answering and making your calls. Click Edit to tune them.</p>
            </div>
            <span className="text-xs text-gray-500">{agents.length} agent{agents.length === 1 ? '' : 's'}</span>
          </div>

          {agents.length === 0 ? (
            <Card className="bg-slate-800/30 border-slate-700 border-dashed p-8 text-center">
              <Bot size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No live agents yet — pick a template below to create your first one.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents.map(agent => {
                const config = ROLE_CONFIG[agent.role] || ROLE_CONFIG.custom;
                const Icon = config.icon;
                const agentConvos = getAgentConversations(agent.id);
                const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities : [];
                const transferRules = Array.isArray(agent.transfer_rules) ? agent.transfer_rules : [];
                const usingDefault = !agent.system_prompt || !agent.system_prompt.trim();

                return (
                  <Card key={agent.id} className={`border-slate-700 transition-colors ${agent.is_active ? 'bg-slate-800/60' : 'bg-slate-800/30 opacity-60'}`}>
                    <div className="p-5">
                      {/* Agent Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${agent.is_active ? 'bg-sky-500/20' : 'bg-gray-700'}`}>
                            <Icon size={20} className={agent.is_active ? 'text-sky-400' : 'text-gray-500'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-white font-semibold">{agent.name}</h3>
                              <span className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge className={config.color + ' text-xs'}>{config.label}</Badge>
                              {usingDefault && (
                                <Badge className="bg-slate-700 text-gray-400 border-slate-600 text-[10px]" title="No custom prompt set — using the baked-in worker default. Edit to override.">
                                  default prompt
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(agent)} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-slate-700 transition-colors" title="Edit">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleToggleActive(agent)} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-slate-700 transition-colors" title={agent.is_active ? 'Deactivate' : 'Activate'}>
                            <Power size={14} />
                          </button>
                          <button onClick={() => handleDelete(agent)} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {agent.description && (
                        <p className="text-gray-400 text-xs mb-3 line-clamp-2">{agent.description}</p>
                      )}

                      {/* Capabilities */}
                      {capabilities.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                            <Sparkles size={10} /> Capabilities
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {capabilities.map(cap => (
                              <span key={cap} className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[10px]">
                                {cap.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Transfer rules */}
                      {transferRules.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                            <ArrowRightLeft size={10} /> Transfer Rules
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {transferRules.slice(0, 4).map((rule, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px]">
                                {String(rule.trigger || '').replace(/_/g, ' ')} → {String(rule.target || '').replace(/_/g, ' ')}
                              </span>
                            ))}
                            {transferRules.length > 4 && (
                              <span className="px-2 py-0.5 rounded bg-slate-700 text-gray-400 text-[10px]">+{transferRules.length - 4} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">{agent.total_calls || 0}</p>
                          <p className="text-gray-500 text-[10px]">Total Calls</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">{agent.active_calls || 0}</p>
                          <p className="text-gray-500 text-[10px]">Active Now</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">{agent.avg_call_duration ? Math.round(agent.avg_call_duration / 60) + 'm' : '--'}</p>
                          <p className="text-gray-500 text-[10px]">Avg Duration</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">{agent.success_rate ? agent.success_rate + '%' : '--'}</p>
                          <p className="text-gray-500 text-[10px]">Success</p>
                        </div>
                      </div>

                      {/* Config Info */}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 border-t border-slate-700 pt-3">
                        {agent.phone_number ? (
                          <span className="flex items-center gap-1"><Phone size={10} /> {agent.phone_number}</span>
                        ) : (
                          <span className="flex items-center gap-1 italic"><Phone size={10} /> no number bound</span>
                        )}
                        {agent.voice_name && (
                          <span className="flex items-center gap-1"><MessageSquare size={10} /> {agent.voice_name}</span>
                        )}
                        <span className="flex items-center gap-1"><Zap size={10} /> {agent.llm_model?.replace('claude-', '').replace(/-\d{8}$/, '')}</span>
                        <span className="flex items-center gap-1"><Users size={10} /> {agent.max_concurrent_calls} max</span>
                      </div>

                      {/* Recent Conversations */}
                      {agentConvos.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400 text-xs font-medium">Recent Calls</span>
                            <button
                              onClick={() => setShowConversations(agent)}
                              className="text-sky-400 text-xs hover:underline"
                            >
                              View all
                            </button>
                          </div>
                          <div className="space-y-1">
                            {agentConvos.slice(0, 3).map(c => (
                              <div key={c.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-300">{c.caller_name || c.from_number || 'Unknown'}</span>
                                <div className="flex items-center gap-2">
                                  {c.duration > 0 && <span className="text-gray-500">{Math.round(c.duration / 60)}m</span>}
                                  <Badge className={
                                    c.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30 text-[10px]' :
                                    c.outcome === 'booked' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]' :
                                    c.outcome === 'transferred' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]' :
                                    'bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]'
                                  }>
                                    {c.status === 'active' ? 'Live' : c.outcome || 'completed'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── QUICK START TEMPLATES (always visible) ──────────────── */}
        {templates.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-white text-lg font-bold flex items-center gap-2">
                  <BookOpen size={18} className="text-cyan-400" />
                  Quick Start Templates
                </h2>
                <p className="text-gray-400 text-xs">Pre-configured role blueprints. Click one to spawn a new live agent pre-filled with its prompt and capabilities.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(t => {
                const config = ROLE_CONFIG[t.role] || ROLE_CONFIG.custom;
                const Icon = config.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => openCreateFromTemplate(t)}
                    className="text-left bg-slate-800/40 border border-slate-700 rounded-lg p-4 hover:border-sky-500/50 hover:bg-slate-700/60 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={16} className="text-sky-400" />
                      <Badge className={config.color + ' text-xs'}>{config.label}</Badge>
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1">{t.name}</h3>
                    <p className="text-gray-400 text-xs line-clamp-2 mb-2">{t.description}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <Sparkles size={10} />
                      <span>{Array.isArray(t.capabilities) ? t.capabilities.length : 0} capabilities</span>
                      <span>·</span>
                      <ArrowRightLeft size={10} />
                      <span>{Array.isArray(t.transfer_rules) ? t.transfer_rules.length : 0} transfer rules</span>
                    </div>
                    <p className="text-sky-400 text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Plus size={10} /> Create agent from template
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={showCreate || !!showEdit} onOpenChange={() => { setShowCreate(false); setShowEdit(null); }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEdit ? `Edit ${showEdit.name}` : 'Create AI Agent'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">Agent Name</label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My Receptionist"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm"
                >
                  <option value="receptionist">Receptionist (inbound)</option>
                  <option value="sales_inbound">Inbound Sales</option>
                  <option value="sales">Outbound Sales</option>
                  <option value="booking">Booking Agent</option>
                  <option value="support">Support Agent</option>
                  <option value="hr_recruiter">HR Recruiter (outbound screening)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1 block">Description</label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What does this agent do?"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1 block flex items-center justify-between">
                <span>System Prompt</span>
                {(!form.system_prompt || !form.system_prompt.trim()) && (
                  <span className="text-[10px] font-normal text-sky-400 normal-case">
                    Empty → uses the worker's built-in {form.role} default
                  </span>
                )}
              </label>
              <Textarea
                value={form.system_prompt}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                placeholder="Leave blank to use the worker's built-in role prompt. Type here to override it — saved value wins on the next call, no deploy needed."
                className="bg-slate-700 border-slate-600 text-white min-h-[140px] font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1 block">Greeting Message</label>
              <Input
                value={form.greeting}
                onChange={e => setForm(f => ({ ...f, greeting: e.target.value }))}
                placeholder="Hello, thank you for calling..."
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">Voice Name</label>
                <Input
                  value={form.voice_name}
                  onChange={e => setForm(f => ({ ...f, voice_name: e.target.value }))}
                  placeholder="e.g. Rachel, Adam"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">ElevenLabs Voice ID</label>
                <Input
                  value={form.voice_id}
                  onChange={e => setForm(f => ({ ...f, voice_id: e.target.value }))}
                  placeholder="Voice ID from ElevenLabs"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">Phone Number</label>
                <Input
                  value={form.phone_number}
                  onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                  placeholder="+1234567890"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">LLM Model</label>
                <select
                  value={form.llm_model}
                  onChange={e => setForm(f => ({ ...f, llm_model: e.target.value }))}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm"
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium mb-1 block">Max Concurrent Calls</label>
              <Input
                type="number"
                value={form.max_concurrent_calls}
                onChange={e => setForm(f => ({ ...f, max_concurrent_calls: parseInt(e.target.value) || 1 }))}
                className="bg-slate-700 border-slate-600 text-white w-32"
                min={1}
                max={50}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setShowEdit(null); }}>Cancel</Button>
            <Button onClick={showEdit ? handleSaveEdit : handleCreate} className="bg-sky-600 hover:bg-sky-700">
              {showEdit ? 'Save Changes' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
