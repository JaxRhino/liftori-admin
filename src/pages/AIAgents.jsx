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
  Settings,
  Trash2,
  Play,
  Pause,
  Activity,
  BarChart3,
  Clock,
  Users,
  Zap,
  Copy,
  Edit3,
  Power,
  Eye,
  MessageSquare,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// AI AGENTS MANAGEMENT PAGE
// Create, configure, and monitor AI voice agents
// ═══════════════════════════════════════════════════════════════

const ROLE_CONFIG = {
  receptionist: { label: 'Receptionist', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: PhoneIncoming },
  sales: { label: 'Sales Agent', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: PhoneOutgoing },
  booking: { label: 'Booking Agent', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Calendar },
  support: { label: 'Support Agent', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Headphones },
  custom: { label: 'Custom Agent', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Bot },
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

  // Create form state
  const [form, setForm] = useState({
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
  });

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
      name: template.name,
      role: template.role,
      description: template.description || '',
      system_prompt: template.system_prompt,
      greeting: template.greeting || '',
      voice_name: '',
      voice_id: '',
      phone_number: '',
      llm_model: 'claude-sonnet-4-20250514',
      max_concurrent_calls: 5,
    });
    setShowCreate(true);
  }

  function openCreateBlank() {
    setSelectedTemplate(null);
    setForm({
      name: '',
      role: 'receptionist',
      description: '',
      system_prompt: '',
      greeting: 'Hello, thank you for calling. How can I help you today?',
      voice_name: '',
      voice_id: '',
      phone_number: '',
      llm_model: 'claude-sonnet-4-20250514',
      max_concurrent_calls: 5,
    });
    setShowCreate(true);
  }

  async function handleCreate() {
    if (!form.name || !form.system_prompt) {
      toast.error('Name and system prompt are required');
      return;
    }

    try {
      const { error } = await supabase.from('ai_agents').insert({
        name: form.name,
        role: form.role,
        description: form.description,
        system_prompt: form.system_prompt,
        greeting: form.greeting,
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
          system_prompt: form.system_prompt,
          greeting: form.greeting,
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
    setForm({
      name: agent.name,
      role: agent.role,
      description: agent.description || '',
      system_prompt: agent.system_prompt,
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

        {/* Agent Templates */}
        {agents.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-white text-lg font-bold">Quick Start Templates</h2>
              <p className="text-gray-400 text-sm">Choose a template to create your first AI agent</p>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map(t => {
                const config = ROLE_CONFIG[t.role] || ROLE_CONFIG.custom;
                const Icon = config.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => openCreateFromTemplate(t)}
                    className="text-left bg-slate-700/50 border border-slate-600 rounded-lg p-4 hover:border-sky-500/50 hover:bg-slate-700 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={18} className="text-sky-400" />
                      <Badge className={config.color + ' text-xs'}>{config.label}</Badge>
                    </div>
                    <h3 className="text-white font-semibold mb-1">{t.name}</h3>
                    <p className="text-gray-400 text-xs line-clamp-2">{t.description}</p>
                    <p className="text-sky-400 text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to create</p>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Agents List */}
        {agents.length > 0 && (
          <>
            {/* Templates strip (compact when agents exist) */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-500 text-xs">Quick add:</span>
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => openCreateFromTemplate(t)}
                  className="px-3 py-1 rounded-full text-xs border border-slate-600 text-gray-400 hover:text-white hover:border-sky-500/50 transition-colors"
                >
                  + {t.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents.map(agent => {
                const config = ROLE_CONFIG[agent.role] || ROLE_CONFIG.custom;
                const Icon = config.icon;
                const agentConvos = getAgentConversations(agent.id);

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
                            <Badge className={config.color + ' text-xs mt-0.5'}>{config.label}</Badge>
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
                      <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-slate-700 pt-3">
                        {agent.phone_number && (
                          <span className="flex items-center gap-1"><Phone size={10} /> {agent.phone_number}</span>
                        )}
                        {agent.voice_name && (
                          <span className="flex items-center gap-1"><MessageSquare size={10} /> {agent.voice_name}</span>
                        )}
                        <span className="flex items-center gap-1"><Zap size={10} /> {agent.llm_model?.replace('claude-', '').replace('-20250514', '')}</span>
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
          </>
        )}

        {/* Empty State */}
        {agents.length === 0 && templates.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-12">
            <div className="text-center">
              <Bot size={48} className="text-gray-600 mx-auto mb-4" />
              <h2 className="text-white text-xl font-bold mb-2">No AI Agents Yet</h2>
              <p className="text-gray-400 mb-4">Create your first AI voice agent to start automating calls</p>
              <Button onClick={openCreateBlank} className="bg-sky-600 hover:bg-sky-700">
                <Plus size={16} className="mr-2" /> Create Agent
              </Button>
            </div>
          </Card>
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
                  <option value="receptionist">Receptionist</option>
                  <option value="sales">Sales Agent</option>
                  <option value="booking">Booking Agent</option>
                  <option value="support">Support Agent</option>
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
              <label className="text-gray-400 text-xs font-medium mb-1 block">System Prompt</label>
              <Textarea
                value={form.system_prompt}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                placeholder="Instructions for the AI agent..."
                className="bg-slate-700 border-slate-600 text-white min-h-[120px]"
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
