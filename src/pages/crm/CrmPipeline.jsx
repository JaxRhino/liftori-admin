import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { LayoutGrid, Table2, Plus, Trash2, ChevronDown, Dot, SlidersHorizontal, ArrowUp, ArrowDown, X } from 'lucide-react';
import { toast } from 'sonner';

// Reusable tenant Sales Pipeline. Reads the tenant's OWN Supabase DB via
// useCrmClient(). Stages are DB-driven (pipeline_definitions +
// pipeline_stage_definitions) with a hardcoded fallback so a tenant with no
// custom pipeline still renders.

const DEFAULT_STAGES = [
  { key: 'new_lead',    label: 'New Lead',    color: '#6b7280', probability: 10,  stage_order: 1 },
  { key: 'contacted',   label: 'Contacted',   color: '#2563eb', probability: 25,  stage_order: 2 },
  { key: 'qualified',   label: 'Qualified',   color: '#4f46e5', probability: 40,  stage_order: 3 },
  { key: 'proposal',    label: 'Proposal',    color: '#9333ea', probability: 60,  stage_order: 4 },
  { key: 'negotiation', label: 'Negotiation', color: '#ca8a04', probability: 75,  stage_order: 5 },
  { key: 'won',         label: 'Won',         color: '#16a34a', probability: 100, stage_order: 6, is_won: true },
  { key: 'lost',        label: 'Lost',        color: '#dc2626', probability: 0,   stage_order: 7, is_lost: true },
];

const temperatureConfig = {
  cold: { label: 'Cold', color: 'text-blue-400', dotColor: 'bg-blue-400' },
  warm: { label: 'Warm', color: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  hot:  { label: 'Hot',  color: 'text-red-400', dotColor: 'bg-red-400' },
};

const slugify = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'stage';

export default function CrmPipeline() {
  const { client } = useCrmClient();
  const [viewMode, setViewMode] = useState('kanban');
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [stageDefs, setStageDefs] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [activeStageFilter, setActiveStageFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');
  const [formData, setFormData] = useState(blankForm());

  function blankForm() {
    return {
      title: '', description: '', contact_id: '', stage: '', deal_value: '',
      probability: 50, lead_temperature: 'warm', service_type: '',
      expected_close_date: '', tags: '', notes: '',
    };
  }

  useEffect(() => { if (client) loadData(); /* eslint-disable-next-line */ }, [client]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dealsRes, contactsRes, pdefsRes] = await Promise.all([
        client.from('customer_pipeline').select('*, customer_contacts(first_name, last_name)').order('last_activity_at', { ascending: false }),
        client.from('customer_contacts').select('*').order('created_at', { ascending: false }),
        client.from('pipeline_definitions').select('*').eq('is_active', true).order('display_order'),
      ]);
      const pdefs = (pdefsRes?.data || []).filter(p => (p.kind || 'sales') === 'sales');
      let sdefs = [];
      if (pdefs.length) {
        const { data } = await client.from('pipeline_stage_definitions')
          .select('*').in('pipeline_id', pdefs.map(p => p.id)).order('stage_order');
        sdefs = data || [];
      }
      setDeals(dealsRes?.data || []);
      setContacts(contactsRes?.data || []);
      setPipelines(pdefs);
      setStageDefs(sdefs);
      setActivePipelineId(prev =>
        (prev && pdefs.some(p => p.id === prev))
          ? prev
          : (pdefs.find(p => p.is_default)?.id || pdefs[0]?.id || null));
    } catch (error) {
      console.error('Error loading pipeline data:', error);
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  };

  const usingDefs = pipelines.length > 0;

  const activeStages = useMemo(() => {
    if (!usingDefs) return DEFAULT_STAGES;
    return stageDefs.filter(s => s.pipeline_id === activePipelineId).sort((a, b) => a.stage_order - b.stage_order);
  }, [usingDefs, stageDefs, activePipelineId]);

  const pipelineDeals = useMemo(() => {
    if (!usingDefs) return deals;
    return deals.filter(d => d.pipeline_definition_id === activePipelineId);
  }, [usingDefs, deals, activePipelineId]);

  const dealsByStage = useMemo(() => {
    const acc = {};
    activeStages.forEach(s => { acc[s.key] = []; });
    pipelineDeals.forEach(d => { if (!acc[d.stage]) acc[d.stage] = []; acc[d.stage].push(d); });
    return acc;
  }, [activeStages, pipelineDeals]);

  const wonKeys = useMemo(() => new Set(activeStages.filter(s => s.is_won).map(s => s.key)), [activeStages]);

  const getContactName = (contactId) => {
    const c = contacts.find(x => x.id === contactId);
    if (!c) return 'Unknown';
    return c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
  };

  const handleNewDeal = () => {
    setEditingDeal(null);
    setFormData({ ...blankForm(), stage: activeStages[0]?.key || '' });
    setIsDialogOpen(true);
  };

  const handleEditDeal = (deal) => {
    setEditingDeal(deal);
    setFormData({
      title: deal.title || '', description: deal.description || '',
      contact_id: deal.contact_id || '', stage: deal.stage || activeStages[0]?.key || '',
      deal_value: deal.deal_value || '', probability: deal.probability || 50,
      lead_temperature: deal.lead_temperature || 'warm', service_type: deal.service_type || '',
      expected_close_date: deal.expected_close_date || '',
      tags: deal.tags?.join(', ') || '', notes: deal.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSaveDeal = async () => {
    if (!formData.title.trim()) { toast.error('Deal title is required'); return; }
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        contact_id: formData.contact_id || null,
        stage: formData.stage,
        deal_value: parseFloat(formData.deal_value) || 0,
        probability: parseInt(formData.probability) || 0,
        lead_temperature: formData.lead_temperature,
        service_type: formData.service_type,
        expected_close_date: formData.expected_close_date || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: formData.notes,
      };
      if (editingDeal) {
        const { error } = await client.from('customer_pipeline')
          .update({ ...payload, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
          .eq('id', editingDeal.id);
        if (error) throw error;
        toast.success('Deal updated');
      } else {
        const { error } = await client.from('customer_pipeline')
          .insert({ ...payload, pipeline_definition_id: usingDefs ? activePipelineId : null, last_activity_at: new Date().toISOString() });
        if (error) throw error;
        toast.success('Deal created');
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving deal:', error);
      toast.error('Failed to save deal');
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Delete this deal?')) return;
    try {
      const { error } = await client.from('customer_pipeline').delete().eq('id', dealId);
      if (error) throw error;
      toast.success('Deal deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast.error('Failed to delete deal');
    }
  };

  const handleMoveStage = async (dealId, newStage) => {
    try {
      const { error } = await client.from('customer_pipeline')
        .update({ stage: newStage, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
        .eq('id', dealId);
      if (error) throw error;
      toast.success('Deal moved');
      loadData();
    } catch (error) {
      console.error('Error moving deal:', error);
      toast.error('Failed to move deal');
    }
  };

  const visibleDeals = activeStageFilter ? pipelineDeals.filter(d => d.stage === activeStageFilter) : pipelineDeals;

  const stats = {
    total: pipelineDeals.length,
    pipelineValue: pipelineDeals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0),
    weightedValue: pipelineDeals.reduce((sum, d) => sum + ((Number(d.deal_value) || 0) * ((d.probability || 0) / 100)), 0),
    won: pipelineDeals.filter(d => wonKeys.has(d.stage)).length,
    winRate: pipelineDeals.length > 0 ? Math.round((pipelineDeals.filter(d => wonKeys.has(d.stage)).length / pipelineDeals.length) * 100) : 0,
  };

  if (loading) return <div className="p-6 text-gray-400">Loading pipeline...</div>;

  const activePipeline = pipelines.find(p => p.id === activePipelineId);

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">Pipeline</h1>
            {usingDefs && activePipeline?.description && <p className="text-sm text-gray-400 mt-1">{activePipeline.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            {usingDefs && (
              <button onClick={() => setStageEditorOpen(true)} className="px-3 py-2 rounded bg-navy-800 text-gray-300 hover:text-white hover:bg-navy-700 flex items-center gap-2 text-sm" title="Customize stages">
                <SlidersHorizontal size={16} /> Stages
              </button>
            )}
            <button onClick={() => setViewMode('kanban')} className={`p-2 rounded transition ${viewMode === 'kanban' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded transition ${viewMode === 'table' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}><Table2 size={20} /></button>
            <Button onClick={handleNewDeal} className="bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-2"><Plus size={18} /> New Project</Button>
          </div>
        </div>

        {usingDefs && pipelines.length > 1 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {pipelines.map(p => (
              <button key={p.id} onClick={() => { setActivePipelineId(p.id); setActiveStageFilter(null); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition flex items-center gap-2 ${p.id === activePipelineId ? 'border-transparent text-white' : 'border-navy-700 text-gray-400 hover:text-white hover:border-navy-600'}`}
                style={p.id === activePipelineId ? { background: (p.color || '#06b6d4') + '26', boxShadow: `inset 0 0 0 1px ${p.color || '#06b6d4'}` } : {}}>
                <span className="h-2 w-2 rounded-full" style={{ background: p.color || '#06b6d4' }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <StageStepper stages={activeStages} dealsByStage={dealsByStage} activeStage={activeStageFilter} onSelect={(k) => setActiveStageFilter(k)} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Projects" value={stats.total} />
          <StatCard label="Pipeline Value" value={`$${(stats.pipelineValue / 1000).toFixed(0)}K`} />
          <StatCard label="Weighted Value" value={`$${(stats.weightedValue / 1000).toFixed(0)}K`} />
          <StatCard label="Won" value={stats.won} />
          <StatCard label="Win Rate" value={`${stats.winRate}%`} />
        </div>

        {viewMode === 'kanban' ? (
          <KanbanView stages={activeStages}
            dealsByStage={activeStageFilter ? { [activeStageFilter]: dealsByStage[activeStageFilter] || [] } : dealsByStage}
            temperatureConfig={temperatureConfig} getContactName={getContactName}
            onEditDeal={handleEditDeal} onMoveStage={handleMoveStage} onDeleteDeal={handleDeleteDeal} />
        ) : (
          <TableView deals={visibleDeals} stages={activeStages} temperatureConfig={temperatureConfig} getContactName={getContactName}
            onEditDeal={handleEditDeal} onDeleteDeal={handleDeleteDeal}
            sortColumn={sortColumn} setSortColumn={setSortColumn} sortDirection={sortDirection} setSortDirection={setSortDirection} />
        )}

        <DealDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} formData={formData} setFormData={setFormData}
          contacts={contacts} stages={activeStages} temperatureConfig={temperatureConfig} isEditing={!!editingDeal} onSave={handleSaveDeal} />

        {stageEditorOpen && (
          <StageEditor client={client} pipeline={activePipeline} stages={activeStages} dealsByStage={dealsByStage}
            onClose={() => setStageEditorOpen(false)} onSaved={() => { setStageEditorOpen(false); loadData(); }} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card className="bg-navy-900 border-navy-800 p-4">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="text-white text-2xl font-bold">{value}</div>
    </Card>
  );
}

function StageStepper({ stages, dealsByStage, activeStage, onSelect }) {
  if (!stages.length) return null;
  return (
    <div className="mb-6 overflow-x-auto pb-1">
      <div className="flex items-stretch gap-1.5 min-w-full">
        {stages.map((s) => {
          const list = dealsByStage[s.key] || [];
          const count = list.length;
          const value = list.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
          const lit = count > 0;
          const isActive = activeStage === s.key;
          const color = s.color || '#64748b';
          return (
            <button key={s.key} onClick={() => onSelect(isActive ? null : s.key)}
              className="group relative flex-1 min-w-[128px] text-left rounded-lg px-3 pt-3 pb-2.5 transition border"
              style={{ background: isActive ? color + '24' : (lit ? color + '12' : 'rgba(15,23,42,0.45)'), borderColor: isActive ? color : (lit ? color + '40' : 'rgba(30,41,59,0.9)'), boxShadow: isActive ? `0 0 18px ${color}55` : 'none' }}>
              <span className="absolute -top-[3px] left-1 right-1 h-[3px] rounded-full" style={{ background: (lit || isActive) ? color : '#1e293b', boxShadow: (lit || isActive) ? `0 0 10px ${color}aa` : 'none' }} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color }}>{s.label}</span>
                <span className="text-[10px] text-gray-500">{s.probability ?? 0}%</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-white tabular-nums">{count}</div>
              <div className="text-[11px] text-gray-400">${(value / 1000).toFixed(1)}k</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KanbanView({ stages, dealsByStage, temperatureConfig, getContactName, onEditDeal, onMoveStage, onDeleteDeal }) {
  const empty = stages.every(s => (dealsByStage[s.key] || []).length === 0);
  if (empty) return <div className="flex items-center justify-center h-64 text-gray-400">No deals yet. Create your first deal to get started.</div>;
  const shown = stages.filter(s => dealsByStage[s.key] !== undefined);
  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex gap-4 min-w-full pr-4">
        {shown.map((s) => {
          const stageDeal = dealsByStage[s.key] || [];
          const stageValue = stageDeal.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
          return (
            <div key={s.key} className="flex-shrink-0 w-64 flex flex-col bg-navy-900 rounded-lg border border-navy-800 overflow-hidden">
              <div className="p-4 text-white font-semibold" style={{ background: (s.color || '#475569') }}>
                <div className="flex justify-between items-start mb-2"><div>{s.label}</div><div className="text-sm font-normal text-white/80">{stageDeal.length}</div></div>
                <div className="text-sm text-white/80">${(stageValue / 1000).toFixed(0)}K</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 max-h-[600px]">
                {stageDeal.length > 0 ? stageDeal.map(deal => (
                  <DealCard key={deal.id} deal={deal} stages={stages} temperatureConfig={temperatureConfig} getContactName={getContactName}
                    onEdit={() => onEditDeal(deal)} onMove={(ns) => onMoveStage(deal.id, ns)} onDelete={() => onDeleteDeal(deal.id)} />
                )) : <div className="text-gray-500 text-sm py-8 text-center">No deals</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, stages, temperatureConfig, getContactName, onEdit, onMove, onDelete }) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const tempConfig = temperatureConfig[deal.lead_temperature] || temperatureConfig.warm;
  return (
    <Card className="bg-navy-800 border-navy-700 p-3 cursor-pointer hover:border-brand-blue/50 transition">
      <div onClick={onEdit} className="mb-2">
        <h4 className="font-semibold text-white truncate text-sm">{deal.title}</h4>
        <p className="text-gray-400 text-xs truncate">{getContactName(deal.contact_id)}</p>
      </div>
      {deal.service_type && <Badge className="bg-brand-blue/20 text-brand-blue text-xs mb-2">{deal.service_type}</Badge>}
      <div className="space-y-2 text-xs mb-3">
        <div className="flex justify-between text-white"><span>${(Number(deal.deal_value) || 0).toLocaleString()}</span><span className="text-gray-400">{deal.probability || 0}%</span></div>
        <div className="flex items-center gap-1"><Dot className={`${tempConfig.dotColor}`} size={16} /><span className={`${tempConfig.color}`}>{tempConfig.label}</span></div>
        {deal.expected_close_date && <div className="text-gray-400">Close: {new Date(deal.expected_close_date).toLocaleDateString()}</div>}
      </div>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <button onClick={() => setMoveMenuOpen(!moveMenuOpen)} className="w-full px-2 py-1 rounded text-xs bg-navy-700 hover:bg-navy-600 text-gray-300 flex items-center justify-center gap-1">Move <ChevronDown size={14} /></button>
          {moveMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-navy-700 border border-navy-600 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
              {stages.map(s => <button key={s.key} onClick={() => { onMove(s.key); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-navy-600 text-gray-300">{s.label}</button>)}
            </div>
          )}
        </div>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-600/20 text-red-400 transition"><Trash2 size={14} /></button>
      </div>
    </Card>
  );
}

function TableView({ deals, stages, temperatureConfig, getContactName, onEditDeal, onDeleteDeal, sortColumn, setSortColumn, sortDirection, setSortDirection }) {
  const stageMap = useMemo(() => Object.fromEntries(stages.map(s => [s.key, s])), [stages]);
  const handleSort = (column) => { if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc'); else { setSortColumn(column); setSortDirection('asc'); } };
  const sortedDeals = [...deals].sort((a, b) => {
    let aVal = a[sortColumn] || '', bVal = b[sortColumn] || '';
    if (sortColumn === 'deal_value') { aVal = parseFloat(aVal) || 0; bVal = parseFloat(bVal) || 0; }
    else if (sortColumn === 'probability') { aVal = parseInt(aVal) || 0; bVal = parseInt(bVal) || 0; }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  if (deals.length === 0) return <div className="flex items-center justify-center h-64 text-gray-400">No deals yet. Create your first deal to get started.</div>;
  return (
    <Card className="bg-navy-900 border-navy-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-800">
              <th className="px-4 py-3 text-left text-gray-400 font-semibold"><button onClick={() => handleSort('title')} className="hover:text-white transition">Title {sortColumn === 'title' && (sortDirection === 'asc' ? '^' : 'v')}</button></th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Contact</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold"><button onClick={() => handleSort('stage')} className="hover:text-white transition">Stage {sortColumn === 'stage' && (sortDirection === 'asc' ? '^' : 'v')}</button></th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Service Type</th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold"><button onClick={() => handleSort('deal_value')} className="hover:text-white transition">Value {sortColumn === 'deal_value' && (sortDirection === 'asc' ? '^' : 'v')}</button></th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold"><button onClick={() => handleSort('probability')} className="hover:text-white transition">Prob % {sortColumn === 'probability' && (sortDirection === 'asc' ? '^' : 'v')}</button></th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Temp</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Close Date</th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDeals.map(deal => {
              const stageInfo = stageMap[deal.stage];
              const tempInfo = temperatureConfig[deal.lead_temperature];
              return (
                <tr key={deal.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition">
                  <td className="px-4 py-3 text-white font-medium truncate max-w-xs">{deal.title}</td>
                  <td className="px-4 py-3 text-gray-400">{getContactName(deal.contact_id)}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs text-white px-2 py-1 rounded" style={{ background: (stageInfo?.color || '#475569') }}>{stageInfo?.label || deal.stage}</span></td>
                  <td className="px-4 py-3 text-gray-400">{deal.service_type}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">${(Number(deal.deal_value) || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-white text-right">{deal.probability || 0}%</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><Dot className={`${tempInfo?.dotColor}`} size={16} /><span className={`${tempInfo?.color} text-xs`}>{tempInfo?.label}</span></div></td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-right"><div className="flex gap-2 justify-end">
                    <button onClick={() => onEditDeal(deal)} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition">Edit</button>
                    <button onClick={() => onDeleteDeal(deal.id)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs transition">Delete</button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DealDialog({ isOpen, onOpenChange, formData, setFormData, contacts, stages, temperatureConfig, isEditing, onSave }) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? 'Edit Deal' : 'Create New Deal'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Deal Title *</label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. HVAC System Upgrade" className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Deal details..." className="bg-navy-800 border-navy-700 text-white placeholder-gray-500 min-h-24" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Contact</label>
            <select value={formData.contact_id} onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
              <option value="">Select a contact...</option>
              {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed'}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Stage</label>
              <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Lead Temperature</label>
              <select value={formData.lead_temperature} onChange={(e) => setFormData({ ...formData, lead_temperature: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                {Object.entries(temperatureConfig).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Deal Value ($)</label>
              <Input type="number" value={formData.deal_value} onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })} placeholder="0" className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Probability (%) - {formData.probability}%</label>
              <input type="range" min="0" max="100" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: e.target.value })} className="w-full h-2 bg-navy-800 rounded cursor-pointer" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Service Type</label>
            <Input value={formData.service_type} onChange={(e) => setFormData({ ...formData, service_type: e.target.value })} placeholder="e.g. HVAC Install, Roof Repair" className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Expected Close Date</label>
            <Input type="date" value={formData.expected_close_date} onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Tags (comma separated)</label>
            <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="e.g. residential, high-priority" className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." className="bg-navy-800 border-navy-700 text-white placeholder-gray-500 min-h-20" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-navy-700 text-gray-400 hover:text-white">Cancel</Button>
          <Button onClick={onSave} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{isEditing ? 'Update Deal' : 'Create Deal'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StageEditor({ client, pipeline, stages, dealsByStage, onClose, onSaved }) {
  const [rows, setRows] = useState(() => stages.map(s => ({ id: s.id, key: s.key, label: s.label, color: s.color || '#64748b', probability: s.probability ?? 0, is_won: !!s.is_won, is_lost: !!s.is_lost, _new: false })));
  const [removed, setRemoved] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const move = (i, dir) => setRows(rs => { const j = i + dir; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; const t = c[i]; c[i] = c[j]; c[j] = t; return c; });
  const addRow = () => setRows(rs => [...rs, { id: null, key: '', label: '', color: '#0ea5e9', probability: 0, is_won: false, is_lost: false, _new: true }]);
  const removeRow = (i) => {
    const r = rows[i];
    const count = (dealsByStage[r.key] || []).length;
    if (r.id && count > 0) { toast.error(`"${r.label}" has ${count} deal(s) - move them first`); return; }
    if (r.id) setRemoved(rm => [...rm, r.id]);
    setRows(rs => rs.filter((_, idx) => idx !== i));
  };
  const save = async () => {
    if (!pipeline?.id) { onClose(); return; }
    if (rows.some(r => !r.label.trim())) { toast.error('Every stage needs a label'); return; }
    try {
      setSaving(true);
      if (removed.length) await client.from('pipeline_stage_definitions').delete().in('id', removed);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const payload = { pipeline_id: pipeline.id, key: r.key && !r._new ? r.key : slugify(r.label), label: r.label.trim(), color: r.color, probability: parseInt(r.probability) || 0, stage_order: i + 1, is_won: !!r.is_won, is_lost: !!r.is_lost };
        if (r.id) await client.from('pipeline_stage_definitions').update(payload).eq('id', r.id);
        else await client.from('pipeline_stage_definitions').insert(payload);
      }
      toast.success('Stages updated');
      onSaved();
    } catch (e) { console.error('Error saving stages:', e); toast.error('Failed to save stages'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Customize Stages{pipeline ? ` - ${pipeline.name}` : ''}</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-400 mb-2">Rename, recolor, reorder, or add the stages your company actually uses. Changes apply to this pipeline.</p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id || `new-${i}`} className="flex items-center gap-2 bg-navy-800 border border-navy-700 rounded p-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <input type="color" value={r.color} onChange={(e) => update(i, { color: e.target.value })} className="h-8 w-8 rounded bg-transparent border border-navy-700 cursor-pointer" title="Stage color" />
              <input value={r.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Stage name" className="flex-1 bg-navy-900 border border-navy-700 text-white rounded px-2 py-1 text-sm" />
              <div className="flex items-center gap-1">
                <input type="number" min="0" max="100" value={r.probability} onChange={(e) => update(i, { probability: e.target.value })} className="w-16 bg-navy-900 border border-navy-700 text-white rounded px-2 py-1 text-sm" title="Probability %" />
                <span className="text-xs text-gray-500">%</span>
              </div>
              <label className="flex items-center gap-1 text-[11px] text-emerald-400" title="Counts as won"><input type="checkbox" checked={r.is_won} onChange={(e) => update(i, { is_won: e.target.checked, is_lost: e.target.checked ? false : r.is_lost })} /> Won</label>
              <label className="flex items-center gap-1 text-[11px] text-red-400" title="Counts as lost"><input type="checkbox" checked={r.is_lost} onChange={(e) => update(i, { is_lost: e.target.checked, is_won: e.target.checked ? false : r.is_won })} /> Lost</label>
              <button onClick={() => removeRow(i)} className="text-gray-500 hover:text-red-400" title="Remove stage"><X size={16} /></button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="mt-3 flex items-center gap-1 text-sm text-brand-blue hover:text-brand-cyan"><Plus size={16} /> Add stage</button>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-navy-700 text-gray-400 hover:text-white">Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{saving ? 'Saving...' : 'Save Stages'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
