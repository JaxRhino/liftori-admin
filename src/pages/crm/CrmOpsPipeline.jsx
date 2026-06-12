import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { LayoutGrid, Table2, ChevronDown, SlidersHorizontal, ArrowUp, ArrowDown, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

// Tenant Operations (Jobs) Pipeline. Jobs = ops_work_orders, grouped by
// status onto the tenant's customizable OPS pipeline stages
// (pipeline_definitions kind='ops'). Lit-up stepper mirrors the Sales pipeline.

const DEFAULT_OPS_STAGES = [
  { key: 'pending',     label: 'Unscheduled', color: '#94a3b8', stage_order: 1 },
  { key: 'scheduled',   label: 'Scheduled',   color: '#0ea5e9', stage_order: 2 },
  { key: 'assigned',    label: 'Assigned',    color: '#3b82f6', stage_order: 3 },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b', stage_order: 4 },
  { key: 'completed',   label: 'Completed',   color: '#10b981', stage_order: 5, is_won: true },
  { key: 'cancelled',   label: 'Cancelled',   color: '#ef4444', stage_order: 6, is_lost: true },
];

const priorityConfig = {
  urgent: { label: 'Urgent', color: 'text-red-400' },
  high:   { label: 'High',   color: 'text-amber-400' },
  medium: { label: 'Medium', color: 'text-blue-400' },
  low:    { label: 'Low',    color: 'text-gray-400' },
};

const slugify = (s) =>
  (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'stage';

const jobValue = (j) => Number(j.estimated_cost) || Number(j.actual_cost) || 0;

export default function CrmOpsPipeline() {
  const { client } = useCrmClient();
  const [viewMode, setViewMode] = useState('kanban');
  const [jobs, setJobs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [stageDefs, setStageDefs] = useState([]);
  const [activeStageFilter, setActiveStageFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stageEditorOpen, setStageEditorOpen] = useState(false);

  useEffect(() => { if (client) loadData(); /* eslint-disable-next-line */ }, [client]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsRes, contactsRes, pdefsRes] = await Promise.all([
        client.from('ops_work_orders').select('*, customer_contacts(first_name, last_name)').order('scheduled_start', { ascending: false, nullsFirst: false }),
        client.from('customer_contacts').select('*'),
        client.from('pipeline_definitions').select('*').eq('is_active', true).order('display_order'),
      ]);
      const opsDefs = (pdefsRes?.data || []).filter(p => (p.kind || 'sales') === 'ops');
      const def = opsDefs.find(p => p.is_default) || opsDefs[0] || null;
      let sdefs = [];
      if (def) {
        const { data } = await client.from('pipeline_stage_definitions').select('*').eq('pipeline_id', def.id).order('stage_order');
        sdefs = data || [];
      }
      setJobs(jobsRes?.data || []);
      setContacts(contactsRes?.data || []);
      setPipeline(def);
      setStageDefs(sdefs);
    } catch (error) {
      console.error('Error loading ops pipeline:', error);
      toast.error('Failed to load job pipeline');
    } finally {
      setLoading(false);
    }
  };

  const usingDefs = stageDefs.length > 0;
  const activeStages = useMemo(
    () => usingDefs ? [...stageDefs].sort((a, b) => a.stage_order - b.stage_order) : DEFAULT_OPS_STAGES,
    [usingDefs, stageDefs]
  );

  const jobsByStage = useMemo(() => {
    const acc = {};
    activeStages.forEach(s => { acc[s.key] = []; });
    jobs.forEach(j => { const k = j.status || 'pending'; if (!acc[k]) acc[k] = []; acc[k].push(j); });
    return acc;
  }, [activeStages, jobs]);

  const wonKeys = useMemo(() => new Set(activeStages.filter(s => s.is_won).map(s => s.key)), [activeStages]);

  const getContactName = (contactId) => {
    const c = contacts.find(x => x.id === contactId);
    if (!c) return '';
    return c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
  };

  const handleMove = async (jobId, newStatus) => {
    try {
      const { error } = await client.from('ops_work_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', jobId);
      if (error) throw error;
      toast.success('Job moved');
      loadData();
    } catch (error) {
      console.error('Error moving job:', error);
      toast.error('Failed to move job');
    }
  };

  const visibleJobs = activeStageFilter ? (jobsByStage[activeStageFilter] || []) : jobs;

  const stats = {
    total: jobs.length,
    value: jobs.reduce((sum, j) => sum + jobValue(j), 0),
    open: jobs.filter(j => !wonKeys.has(j.status)).length,
    completed: jobs.filter(j => wonKeys.has(j.status)).length,
    completionRate: jobs.length > 0 ? Math.round((jobs.filter(j => wonKeys.has(j.status)).length / jobs.length) * 100) : 0,
  };

  if (loading) return <div className="p-6 text-gray-400">Loading job pipeline...</div>;

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">Ops Pipeline</h1>
            <p className="text-sm text-gray-400 mt-1">Jobs by stage{pipeline?.name ? ` - ${pipeline.name}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {usingDefs && (
              <button onClick={() => setStageEditorOpen(true)} className="px-3 py-2 rounded bg-navy-800 text-gray-300 hover:text-white hover:bg-navy-700 flex items-center gap-2 text-sm" title="Customize stages">
                <SlidersHorizontal size={16} /> Stages
              </button>
            )}
            <button onClick={() => setViewMode('kanban')} className={`p-2 rounded transition ${viewMode === 'kanban' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded transition ${viewMode === 'table' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}><Table2 size={20} /></button>
          </div>
        </div>

        <StageStepper stages={activeStages} jobsByStage={jobsByStage} activeStage={activeStageFilter} onSelect={(k) => setActiveStageFilter(k)} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total Jobs" value={stats.total} />
          <StatCard label="Pipeline Value" value={`$${(stats.value / 1000).toFixed(0)}K`} />
          <StatCard label="Open" value={stats.open} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Completion" value={`${stats.completionRate}%`} />
        </div>

        {viewMode === 'kanban' ? (
          <KanbanView
            stages={activeStages}
            jobsByStage={activeStageFilter ? { [activeStageFilter]: jobsByStage[activeStageFilter] || [] } : jobsByStage}
            getContactName={getContactName} onMove={handleMove} />
        ) : (
          <TableView jobs={visibleJobs} stages={activeStages} getContactName={getContactName} />
        )}

        {stageEditorOpen && pipeline && (
          <StageEditor client={client} pipeline={pipeline} stages={activeStages} jobsByStage={jobsByStage}
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

function StageStepper({ stages, jobsByStage, activeStage, onSelect }) {
  if (!stages.length) return null;
  return (
    <div className="mb-6 overflow-x-auto pb-1">
      <div className="flex items-stretch gap-1.5 min-w-full">
        {stages.map((s) => {
          const list = jobsByStage[s.key] || [];
          const count = list.length;
          const value = list.reduce((sum, j) => sum + jobValue(j), 0);
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

function KanbanView({ stages, jobsByStage, getContactName, onMove }) {
  const empty = stages.every(s => (jobsByStage[s.key] || []).length === 0);
  if (empty) return <div className="flex items-center justify-center h-64 text-gray-400">No jobs yet.</div>;
  const shown = stages.filter(s => jobsByStage[s.key] !== undefined);
  return (
    <div className="overflow-x-auto pb-4">
      <div className="inline-flex gap-4 min-w-full pr-4">
        {shown.map((s) => {
          const list = jobsByStage[s.key] || [];
          const value = list.reduce((sum, j) => sum + jobValue(j), 0);
          return (
            <div key={s.key} className="flex-shrink-0 w-64 flex flex-col bg-navy-900 rounded-lg border border-navy-800 overflow-hidden">
              <div className="p-4 text-white font-semibold" style={{ background: (s.color || '#475569') }}>
                <div className="flex justify-between items-start mb-2"><div>{s.label}</div><div className="text-sm font-normal text-white/80">{list.length}</div></div>
                <div className="text-sm text-white/80">${(value / 1000).toFixed(0)}K</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 max-h-[600px]">
                {list.length > 0 ? list.map(job => (
                  <JobCard key={job.id} job={job} stages={stages} getContactName={getContactName} onMove={(ns) => onMove(job.id, ns)} />
                )) : <div className="text-gray-500 text-sm py-8 text-center">No jobs</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ job, stages, getContactName, onMove }) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const prio = priorityConfig[job.priority] || null;
  return (
    <Card className="bg-navy-800 border-navy-700 p-3">
      <div className="mb-2">
        <h4 className="font-semibold text-white truncate text-sm">{job.title || 'Untitled job'}</h4>
        <p className="text-gray-400 text-xs truncate">{job.work_order_number || ''}{getContactName(job.contact_id) ? ` - ${getContactName(job.contact_id)}` : ''}</p>
      </div>
      {job.category && <Badge className="bg-brand-blue/20 text-brand-blue text-xs mb-2">{job.category}</Badge>}
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex justify-between text-white">
          <span>${(jobValue(job)).toLocaleString()}</span>
          {prio && <span className={prio.color}>{prio.label}</span>}
        </div>
        {job.scheduled_start && <div className="text-gray-400">Scheduled: {new Date(job.scheduled_start).toLocaleDateString()}</div>}
        {(job.city || job.address) && <div className="text-gray-500 truncate">{job.city || job.address}</div>}
      </div>
      <div className="relative">
        <button onClick={() => setMoveMenuOpen(!moveMenuOpen)} className="w-full px-2 py-1 rounded text-xs bg-navy-700 hover:bg-navy-600 text-gray-300 flex items-center justify-center gap-1">Move <ChevronDown size={14} /></button>
        {moveMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-navy-700 border border-navy-600 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
            {stages.map(s => <button key={s.key} onClick={() => { onMove(s.key); setMoveMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-navy-600 text-gray-300">{s.label}</button>)}
          </div>
        )}
      </div>
    </Card>
  );
}

function TableView({ jobs, stages, getContactName }) {
  const stageMap = useMemo(() => Object.fromEntries(stages.map(s => [s.key, s])), [stages]);
  if (jobs.length === 0) return <div className="flex items-center justify-center h-64 text-gray-400">No jobs yet.</div>;
  return (
    <Card className="bg-navy-900 border-navy-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-800">
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Job</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">WO #</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Contact</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Stage</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Priority</th>
              <th className="px-4 py-3 text-right text-gray-400 font-semibold">Value</th>
              <th className="px-4 py-3 text-left text-gray-400 font-semibold">Scheduled</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => {
              const stageInfo = stageMap[job.status];
              const prio = priorityConfig[job.priority];
              return (
                <tr key={job.id} className="border-b border-navy-800 hover:bg-navy-800/50 transition">
                  <td className="px-4 py-3 text-white font-medium truncate max-w-xs">{job.title || 'Untitled job'}</td>
                  <td className="px-4 py-3 text-gray-400">{job.work_order_number}</td>
                  <td className="px-4 py-3 text-gray-400">{getContactName(job.contact_id)}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center text-xs text-white px-2 py-1 rounded" style={{ background: (stageInfo?.color || '#475569') }}>{stageInfo?.label || job.status}</span></td>
                  <td className="px-4 py-3"><span className={`text-xs ${prio?.color || 'text-gray-500'}`}>{prio?.label || job.priority}</span></td>
                  <td className="px-4 py-3 text-white text-right font-medium">${(jobValue(job)).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{job.scheduled_start ? new Date(job.scheduled_start).toLocaleDateString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StageEditor({ client, pipeline, stages, jobsByStage, onClose, onSaved }) {
  const [rows, setRows] = useState(() => stages.map(s => ({ id: s.id, key: s.key, label: s.label, color: s.color || '#64748b', is_won: !!s.is_won, is_lost: !!s.is_lost, _new: false })));
  const [removed, setRemoved] = useState([]);
  const [saving, setSaving] = useState(false);
  const update = (i, patch) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const move = (i, dir) => setRows(rs => { const j = i + dir; if (j < 0 || j >= rs.length) return rs; const c = [...rs]; const t = c[i]; c[i] = c[j]; c[j] = t; return c; });
  const addRow = () => setRows(rs => [...rs, { id: null, key: '', label: '', color: '#0ea5e9', is_won: false, is_lost: false, _new: true }]);
  const removeRow = (i) => {
    const r = rows[i];
    const count = (jobsByStage[r.key] || []).length;
    if (r.id && count > 0) { toast.error(`"${r.label}" has ${count} job(s) - move them first`); return; }
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
        const payload = { pipeline_id: pipeline.id, key: r.key && !r._new ? r.key : slugify(r.label), label: r.label.trim(), color: r.color, stage_order: i + 1, is_won: !!r.is_won, is_lost: !!r.is_lost };
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
        <DialogHeader><DialogTitle>Customize Job Stages{pipeline ? ` - ${pipeline.name}` : ''}</DialogTitle></DialogHeader>
        <p className="text-xs text-gray-400 mb-2">Rename, recolor, reorder, or add the job stages your company uses. Job status values map onto these stage keys.</p>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id || `new-${i}`} className="flex items-center gap-2 bg-navy-800 border border-navy-700 rounded p-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-white disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <input type="color" value={r.color} onChange={(e) => update(i, { color: e.target.value })} className="h-8 w-8 rounded bg-transparent border border-navy-700 cursor-pointer" title="Stage color" />
              <input value={r.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Stage name" className="flex-1 bg-navy-900 border border-navy-700 text-white rounded px-2 py-1 text-sm" />
              <label className="flex items-center gap-1 text-[11px] text-emerald-400" title="Counts as done"><input type="checkbox" checked={r.is_won} onChange={(e) => update(i, { is_won: e.target.checked, is_lost: e.target.checked ? false : r.is_lost })} /> Done</label>
              <label className="flex items-center gap-1 text-[11px] text-red-400" title="Counts as cancelled"><input type="checkbox" checked={r.is_lost} onChange={(e) => update(i, { is_lost: e.target.checked, is_won: e.target.checked ? false : r.is_won })} /> Cancel</label>
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
