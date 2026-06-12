import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Pencil, Trash2, Target, BarChart3, AlertCircle, ListChecks, Eye, Users, Megaphone, Calendar } from 'lucide-react';
import { toast } from 'sonner';

// Base CRM EOS hub. Reads the impersonated tenant's OWN DB via useCrmClient().
// Mirrors the Liftori internal EOS: Rocks, Scorecard, Issues, To-Dos, Vision,
// Level 10 Meetings, Accountability Chart, Headlines. One route eos/:module.

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '';
const initials = (n) => (n || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

const MODULES = [
  { key: 'rocks', label: 'Rocks', icon: Target, blurb: '90-day priorities' },
  { key: 'scorecard', label: 'Scorecard', icon: BarChart3, blurb: 'Weekly measurables' },
  { key: 'issues', label: 'Issues', icon: AlertCircle, blurb: 'Identify, discuss, solve' },
  { key: 'todos', label: 'To-Dos', icon: ListChecks, blurb: 'Weekly action items' },
  { key: 'vision', label: 'Vision', icon: Eye, blurb: 'V/TO organizer' },
  { key: 'meetings', label: 'Level 10', icon: Calendar, blurb: 'Weekly meetings' },
  { key: 'accountability', label: 'Accountability', icon: Users, blurb: 'Seats and roles' },
  { key: 'headlines', label: 'Headlines', icon: Megaphone, blurb: 'Good news wall' },
];

function useTeam(client) {
  const [team, setTeam] = useState([]);
  useEffect(() => {
    let on = true;
    (async () => {
      if (!client) return;
      let rows = [];
      try { const { data } = await client.from('org_team_members').select('id, first_name, last_name').eq('status', 'active'); rows = data || []; } catch (e) {}
      if (!rows.length) { try { const { data } = await client.from('profiles').select('id, first_name, last_name'); rows = data || []; } catch (e) {} }
      if (on) setTeam(rows);
    })();
    return () => { on = false; };
  }, [client]);
  const nameOf = (id) => { const m = team.find(t => t.id === id); return m ? ([m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member') : 'Unassigned'; };
  return { team, nameOf };
}

export default function CrmEos() {
  const { module, platformId } = useParams();
  const active = module || 'dashboard';
  const navigate = useNavigate();
  const { client } = useCrmClient();
  const team = useTeam(client);
  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-7xl mx-auto">
        {active === 'dashboard' && <EosHub platformId={platformId} navigate={navigate} />}
        {active === 'rocks' && <Rocks client={client} team={team} />}
        {active === 'issues' && <Issues client={client} team={team} />}
        {active === 'todos' && <Todos client={client} team={team} />}
        {active === 'headlines' && <Headlines client={client} team={team} />}
        {['scorecard', 'vision', 'meetings', 'accountability'].includes(active) && <Placeholder label={(MODULES.find(m => m.key === active) || {}).label} />}
      </div>
    </div>
  );
}

function EosHub({ platformId, navigate }) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-1">EOS</h1>
      <p className="text-gray-400 text-sm mb-6">Run on the Entrepreneurial Operating System. Pick a tool to get started.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {MODULES.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.key} onClick={() => navigate('/crm/' + platformId + '/eos/' + m.key)} className="text-left bg-navy-900 border border-navy-800 rounded-xl p-5 hover:border-brand-blue/50 transition">
              <Icon className="w-6 h-6 text-brand-blue mb-3" />
              <div className="text-white font-semibold">{m.label}</div>
              <div className="text-gray-400 text-xs mt-1">{m.blurb}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Header({ title, subtitle, onCreate, createLabel }) {
  return (
    <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
      <div>
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {subtitle ? <p className="text-gray-400 text-sm mt-1">{subtitle}</p> : null}
      </div>
      {onCreate ? <Button onClick={onCreate} className="bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-2"><Plus size={18} /> {createLabel}</Button> : null}
    </div>
  );
}

function StatBar({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      {stats.map((s, i) => (
        <div key={i} className="bg-navy-900 border border-navy-800 rounded-xl p-4">
          <div className="text-gray-400 text-xs">{s.label}</div>
          <div className={'text-2xl font-bold ' + (s.color || 'text-white')}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (<div><label className="block text-xs text-gray-400 mb-1">{label}</label>{children}</div>);
}

function OwnerSelect({ team, value, onChange }) {
  return (
    <select value={value || ''} onChange={onChange} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">
      <option value="">Unassigned</option>
      {team.team.map(m => <option key={m.id} value={m.id}>{[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member'}</option>)}
    </select>
  );
}

function Empty({ children }) { return <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">{children}</Card>; }
function Placeholder({ label }) { return <div><h1 className="text-3xl font-bold text-white mb-2">{label}</h1><Empty>This EOS section is being built next.</Empty></div>; }

const ROCK_STATUS = { not_started: { label: 'Not Started', color: 'bg-gray-500/20 text-gray-300' }, on_track: { label: 'On Track', color: 'bg-emerald-500/20 text-emerald-300' }, at_risk: { label: 'At Risk', color: 'bg-amber-500/20 text-amber-300' }, off_track: { label: 'Off Track', color: 'bg-red-500/20 text-red-300' }, complete: { label: 'Complete', color: 'bg-brand-blue/20 text-brand-blue' } };

function Rocks({ client, team }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const blank = () => ({ title: '', description: '', success_criteria: '', owner_id: '', status: 'on_track', progress_percentage: 0, rock_type: 'company' });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_rocks').select('*').order('created_at', { ascending: false }); setRows(data || []); } catch (e) { console.error(e); } finally { setLoading(false); } }
  function openNew() { setEditing(null); setForm(blank()); setOpen(true); }
  function openEdit(r) { setEditing(r); setForm({ title: r.title || '', description: r.description || '', success_criteria: r.success_criteria || '', owner_id: r.owner_id || '', status: r.status || 'on_track', progress_percentage: r.progress_percentage || 0, rock_type: r.rock_type || 'company' }); setOpen(true); }
  async function save() {
    try {
      const patch = { title: form.title, description: form.description || null, success_criteria: form.success_criteria || null, owner_id: form.owner_id || null, status: form.status, progress_percentage: Number(form.progress_percentage) || 0, rock_type: form.rock_type, is_complete: form.status === 'complete' };
      if (editing) { await client.from('eos_rocks').update(patch).eq('id', editing.id); } else { await client.from('eos_rocks').insert(patch); }
      setOpen(false); toast.success('Rock saved'); load();
    } catch (e) { console.error(e); toast.error('Save failed'); }
  }
  async function remove(r) { try { await client.from('eos_rocks').delete().eq('id', r.id); load(); } catch (e) { console.error(e); } }

  const count = (s) => rows.filter(r => (r.status || 'on_track') === s).length;
  return (
    <div>
      <Header title="90-Day Rocks" subtitle="Quarterly priorities" onCreate={openNew} createLabel="Create Rock" />
      <StatBar stats={[{ label: 'Total', value: rows.length }, { label: 'On Track', value: count('on_track'), color: 'text-emerald-400' }, { label: 'At Risk', value: count('at_risk'), color: 'text-amber-400' }, { label: 'Off Track', value: count('off_track'), color: 'text-red-400' }, { label: 'Complete', value: count('complete'), color: 'text-brand-blue' }]} />
      {loading ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>No rocks yet. Create your first 90-day priority.</Empty> : (
        <div className="space-y-2">
          {rows.map(r => { const st = ROCK_STATUS[r.status] || ROCK_STATUS.on_track; return (
            <Card key={r.id} className="bg-navy-900 border-navy-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1"><Badge className={st.color + ' text-xs'}>{st.label}</Badge><span className="text-xs text-gray-500">{team.nameOf(r.owner_id)}</span></div>
                  <div className="text-white font-medium">{r.title}</div>
                  {r.description ? <div className="text-sm text-gray-400 mt-0.5">{r.description}</div> : null}
                  <div className="mt-2 h-1.5 bg-navy-800 rounded-full overflow-hidden"><div className="h-full bg-brand-blue" style={{ width: (Number(r.progress_percentage) || 0) + '%' }} /></div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-gray-400">{(Number(r.progress_percentage) || 0)}%</span>
                  <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="text-gray-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ); })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>{editing ? 'Edit Rock' : 'Create Rock'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner"><OwnerSelect team={team} value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} /></Field>
              <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">{Object.keys(ROCK_STATUS).map(k => <option key={k} value={k}>{ROCK_STATUS[k].label}</option>)}</select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type"><select value={form.rock_type} onChange={(e) => setForm({ ...form, rock_type: e.target.value })} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white"><option value="company">Company</option><option value="department">Department</option><option value="personal">Personal</option></select></Field>
              <Field label="Progress %"><Input type="number" value={form.progress_percentage} onChange={(e) => setForm({ ...form, progress_percentage: e.target.value })} /></Field>
            </div>
            <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Success Criteria (Done = ?)"><Textarea rows={2} value={form.success_criteria} onChange={(e) => setForm({ ...form, success_criteria: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button onClick={() => setOpen(false)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button><Button onClick={save} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ISSUE_STATUS = { identified: { label: 'Identified', color: 'bg-gray-500/20 text-gray-300' }, in_discussion: { label: 'Discussing', color: 'bg-blue-500/20 text-blue-300' }, solved: { label: 'Solved', color: 'bg-emerald-500/20 text-emerald-300' }, archived: { label: 'Dropped', color: 'bg-navy-700 text-gray-400' } };
const PRIORITY = { high: { label: 'High', color: 'bg-red-500/20 text-red-300' }, medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-300' }, low: { label: 'Low', color: 'bg-gray-500/20 text-gray-300' } };

function Issues({ client, team }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(null);
  const blank = () => ({ title: '', description: '', priority: 'medium', status: 'identified', owner_id: '' });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_issues').select('*').order('created_at', { ascending: false }); setRows(data || []); } catch (e) { console.error(e); } finally { setLoading(false); } }
  function openNew() { setEditing(null); setForm(blank()); setOpen(true); }
  function openEdit(r) { setEditing(r); setForm({ title: r.title || '', description: r.description || '', priority: r.priority || 'medium', status: r.status || 'identified', owner_id: r.owner_id || '' }); setOpen(true); }
  async function save() { try { const patch = { title: form.title, description: form.description || null, priority: form.priority, status: form.status, owner_id: form.owner_id || null }; if (editing) await client.from('eos_issues').update(patch).eq('id', editing.id); else await client.from('eos_issues').insert(patch); setOpen(false); toast.success('Issue saved'); load(); } catch (e) { console.error(e); toast.error('Save failed'); } }
  async function setStatus(r, s) { try { await client.from('eos_issues').update({ status: s }).eq('id', r.id); load(); } catch (e) { console.error(e); } }
  async function remove(r) { try { await client.from('eos_issues').delete().eq('id', r.id); load(); } catch (e) { console.error(e); } }

  const filtered = rows.filter(r => filter === 'all' ? true : filter === 'open' ? !['solved', 'archived'].includes(r.status) : r.status === filter);
  return (
    <div>
      <Header title="Issues (IDS)" subtitle="Identify, discuss, solve" onCreate={openNew} createLabel="Add Issue" />
      <StatBar stats={[{ label: 'Total', value: rows.length }, { label: 'Identified', value: rows.filter(r => r.status === 'identified').length }, { label: 'Discussing', value: rows.filter(r => r.status === 'in_discussion').length, color: 'text-blue-400' }, { label: 'Solved', value: rows.filter(r => r.status === 'solved').length, color: 'text-emerald-400' }]} />
      <div className="flex items-center gap-1 mb-4">{[['open', 'Open'], ['in_discussion', 'Discussing'], ['solved', 'Solved'], ['all', 'All']].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={'px-3 py-1.5 rounded-full text-xs border ' + (filter === k ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400 hover:text-white')}>{l}</button>)}</div>
      {loading ? <Empty>Loading…</Empty> : filtered.length === 0 ? <Empty>No issues here.</Empty> : (
        <div className="space-y-2">
          {filtered.map(r => { const st = ISSUE_STATUS[r.status] || ISSUE_STATUS.identified; const pr = PRIORITY[r.priority] || PRIORITY.medium; return (
            <Card key={r.id} className="bg-navy-900 border-navy-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1"><Badge className={pr.color + ' text-xs'}>{pr.label}</Badge><Badge className={st.color + ' text-xs'}>{st.label}</Badge><span className="text-xs text-gray-500">{team.nameOf(r.owner_id)}</span></div>
                  <div className="text-white font-medium">{r.title}</div>
                  {r.description ? <div className="text-sm text-gray-400 mt-0.5">{r.description}</div> : null}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.status !== 'solved' ? <button onClick={() => setStatus(r, 'solved')} className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25">Solve</button> : null}
                  <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="text-gray-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            </Card>
          ); })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>{editing ? 'Edit Issue' : 'Add Issue'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Issue"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">{Object.keys(PRIORITY).map(k => <option key={k} value={k}>{PRIORITY[k].label}</option>)}</select></Field>
              <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">{Object.keys(ISSUE_STATUS).map(k => <option key={k} value={k}>{ISSUE_STATUS[k].label}</option>)}</select></Field>
              <Field label="Owner"><OwnerSelect team={team} value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} /></Field>
            </div>
            <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button onClick={() => setOpen(false)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button><Button onClick={save} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Todos({ client, team }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [editing, setEditing] = useState(null);
  const blank = () => ({ task: '', description: '', owner_id: '', priority: 'medium', due_date: '' });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_todos').select('*').order('created_at', { ascending: false }); setRows(data || []); } catch (e) { console.error(e); } finally { setLoading(false); } }
  function openNew() { setEditing(null); setForm(blank()); setOpen(true); }
  function openEdit(r) { setEditing(r); setForm({ task: r.task || '', description: r.description || '', owner_id: r.owner_id || '', priority: r.priority || 'medium', due_date: r.due_date ? String(r.due_date).slice(0, 10) : '' }); setOpen(true); }
  async function save() { try { const patch = { task: form.task, description: form.description || null, owner_id: form.owner_id || null, priority: form.priority, due_date: form.due_date || null }; if (editing) await client.from('eos_todos').update(patch).eq('id', editing.id); else await client.from('eos_todos').insert({ ...patch, status: 'open' }); setOpen(false); toast.success('To-do saved'); load(); } catch (e) { console.error(e); toast.error('Save failed'); } }
  async function toggle(r) { try { const done = r.status === 'complete'; await client.from('eos_todos').update({ status: done ? 'open' : 'complete', completed_at: done ? null : new Date().toISOString() }).eq('id', r.id); load(); } catch (e) { console.error(e); } }
  async function remove(r) { try { await client.from('eos_todos').delete().eq('id', r.id); load(); } catch (e) { console.error(e); } }

  const filtered = rows.filter(r => filter === 'all' ? true : filter === 'open' ? r.status !== 'complete' : r.status === 'complete');
  return (
    <div>
      <Header title="Weekly To-Dos" subtitle="Action items from meetings" onCreate={openNew} createLabel="Add To-Do" />
      <StatBar stats={[{ label: 'Total', value: rows.length }, { label: 'Open', value: rows.filter(r => r.status !== 'complete').length, color: 'text-amber-400' }, { label: 'Completed', value: rows.filter(r => r.status === 'complete').length, color: 'text-emerald-400' }]} />
      <div className="flex items-center gap-1 mb-4">{[['open', 'Open'], ['complete', 'Complete'], ['all', 'All']].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={'px-3 py-1.5 rounded-full text-xs border ' + (filter === k ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400 hover:text-white')}>{l}</button>)}</div>
      {loading ? <Empty>Loading…</Empty> : filtered.length === 0 ? <Empty>No to-dos here.</Empty> : (
        <div className="space-y-2">
          {filtered.map(r => { const done = r.status === 'complete'; const pr = PRIORITY[r.priority] || PRIORITY.medium; return (
            <Card key={r.id} className="bg-navy-900 border-navy-800 p-3">
              <div className="flex items-center gap-3">
                <button onClick={() => toggle(r)} className={'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ' + (done ? 'bg-brand-blue border-brand-blue text-white' : 'border-navy-600')}>{done ? '✓' : ''}</button>
                <div className="min-w-0 flex-1">
                  <div className={'text-sm ' + (done ? 'text-gray-500 line-through' : 'text-white')}>{r.task}</div>
                  <div className="flex items-center gap-2 mt-0.5"><span className="text-xs text-gray-500">{team.nameOf(r.owner_id)}</span><Badge className={pr.color + ' text-[10px]'}>{pr.label}</Badge>{r.due_date ? <span className="text-xs text-gray-500">Due {fmtDate(r.due_date)}</span> : null}</div>
                </div>
                <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => remove(r)} className="text-gray-500 hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </Card>
          ); })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>{editing ? 'Edit To-Do' : 'Add To-Do'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Task"><Input value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Owner"><OwnerSelect team={team} value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} /></Field>
              <Field label="Priority"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white">{Object.keys(PRIORITY).map(k => <option key={k} value={k}>{PRIORITY[k].label}</option>)}</select></Field>
              <Field label="Due"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button onClick={() => setOpen(false)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button><Button onClick={save} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Headlines({ client, team }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [category, setCategory] = useState('customer');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_headlines').select('*').order('created_at', { ascending: false }); setRows(data || []); } catch (e) { console.error(e); } finally { setLoading(false); } }
  async function post() { if (!msg.trim()) return; try { await client.from('eos_headlines').insert({ message: msg.trim(), category }); setMsg(''); load(); } catch (e) { console.error(e); toast.error('Could not post'); } }
  async function remove(r) { try { await client.from('eos_headlines').delete().eq('id', r.id); load(); } catch (e) { console.error(e); } }

  return (
    <div>
      <Header title="Headlines" subtitle="Customer and employee good news" />
      <Card className="bg-navy-900 border-navy-800 p-4 mb-5">
        <div className="flex items-center gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-navy-950 border border-navy-700 rounded-lg px-2 py-2 text-sm text-white"><option value="customer">Customer</option><option value="employee">Employee</option><option value="company">Company</option></select>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') post(); }} placeholder="Share a headline…" className="flex-1 bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500" />
          <Button onClick={post} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Post</Button>
        </div>
      </Card>
      {loading ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>No headlines yet.</Empty> : (
        <div className="space-y-2">
          {rows.map(r => (
            <Card key={r.id} className="bg-navy-900 border-navy-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><Badge className="bg-brand-blue/20 text-brand-blue text-[10px] mb-1">{r.category || 'company'}</Badge><div className="text-white text-sm">{r.message}</div><div className="text-xs text-gray-500 mt-1">{fmtDate(r.created_at)}</div></div>
                <button onClick={() => remove(r)} className="text-gray-500 hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
