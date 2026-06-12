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
        {active === 'scorecard' && <Scorecard client={client} team={team} />}
        {active === 'vision' && <Vision client={client} />}
        {active === 'accountability' && <Accountability client={client} team={team} />}
        {active === 'meetings' && <Meetings client={client} team={team} />}
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

function mondayOf(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function lastWeeks(n) { const arr = []; let m = mondayOf(new Date()); for (let i = 0; i < n; i++) { arr.unshift(new Date(m)); m = new Date(m); m.setDate(m.getDate() - 7); } return arr; }
function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function Scorecard({ client, team }) {
  const [metrics, setMetrics] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = () => ({ name: '', owner_id: '', goal: '', category: '' });
  const [form, setForm] = useState(blank());
  const weeks = lastWeeks(6);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data: m } = await client.from('eos_scorecard_metrics').select('*').eq('is_active', true).order('display_order', { ascending: true }); setMetrics(m || []); const { data: e } = await client.from('eos_scorecard_entries').select('*').gte('period_date', isoDate(weeks[0])); setEntries(e || []); } catch (err) { console.error(err); } finally { setLoading(false); } }
  function entryFor(mid, d) { const ds = isoDate(d); return entries.find(e => e.metric_id === mid && String(e.period_date).slice(0, 10) === ds); }
  async function setVal(metric, d, raw) { try { const v = raw === '' ? null : Number(raw); const ds = isoDate(d); const goal = Number(metric.goal); const on = v == null ? null : (goal ? v >= goal : null); const ex = entryFor(metric.id, d); if (ex) { if (v == null) await client.from('eos_scorecard_entries').delete().eq('id', ex.id); else await client.from('eos_scorecard_entries').update({ actual_value: v, on_track: on }).eq('id', ex.id); } else if (v != null) { await client.from('eos_scorecard_entries').insert({ metric_id: metric.id, period_date: ds, actual_value: v, on_track: on }); } load(); } catch (err) { console.error(err); } }
  function openNew() { setEditing(null); setForm(blank()); setOpen(true); }
  function openEdit(m) { setEditing(m); setForm({ name: m.name || '', owner_id: m.owner_id || '', goal: m.goal != null ? m.goal : '', category: m.category || '' }); setOpen(true); }
  async function saveMetric() { try { const patch = { name: form.name, owner_id: form.owner_id || null, goal: form.goal === '' ? null : Number(form.goal), category: form.category || null }; if (editing) await client.from('eos_scorecard_metrics').update(patch).eq('id', editing.id); else await client.from('eos_scorecard_metrics').insert({ ...patch, is_active: true, display_order: metrics.length }); setOpen(false); toast.success('Metric saved'); load(); } catch (err) { console.error(err); toast.error('Save failed'); } }
  async function removeMetric(m) { try { await client.from('eos_scorecard_metrics').update({ is_active: false }).eq('id', m.id); load(); } catch (e) { console.error(e); } }
  return (
    <div>
      <Header title="Scorecard" subtitle="Weekly measurables" onCreate={openNew} createLabel="Add Metric" />
      {loading ? <Empty>Loading…</Empty> : metrics.length === 0 ? <Empty>No metrics yet. Add your first measurable.</Empty> : (
        <Card className="bg-navy-900 border-navy-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-navy-800 text-gray-400">
                <th className="px-3 py-2 text-left font-semibold">Measurable</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-right font-semibold">Goal</th>
                {weeks.map(w => <th key={isoDate(w)} className="px-2 py-2 text-center font-semibold text-xs">{(w.getMonth() + 1) + '/' + w.getDate()}</th>)}
                <th className="px-2 py-2"></th>
              </tr></thead>
              <tbody>
                {metrics.map(m => (
                  <tr key={m.id} className="border-b border-navy-800/60">
                    <td className="px-3 py-2 text-white">{m.name}</td>
                    <td className="px-3 py-2 text-gray-400">{team.nameOf(m.owner_id)}</td>
                    <td className="px-3 py-2 text-right text-gray-300">{m.goal != null ? m.goal : '-'}</td>
                    {weeks.map(w => { const en = entryFor(m.id, w); const on = en ? en.on_track : null; return (
                      <td key={isoDate(w)} className="px-1 py-1 text-center">
                        <input type="number" defaultValue={en ? en.actual_value : ''} onBlur={(e) => setVal(m, w, e.target.value)} className={'w-14 text-center rounded px-1 py-1 text-xs bg-navy-950 border ' + (on === true ? 'border-emerald-600 text-emerald-300' : on === false ? 'border-red-600 text-red-300' : 'border-navy-700 text-white')} />
                      </td>
                    ); })}
                    <td className="px-2 py-1 text-right whitespace-nowrap"><button onClick={() => openEdit(m)} className="text-gray-400 hover:text-white mr-2"><Pencil size={14} /></button><button onClick={() => removeMetric(m)} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>{editing ? 'Edit Metric' : 'Add Metric'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Owner"><OwnerSelect team={team} value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} /></Field>
              <Field label="Goal"><Input type="number" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></Field>
              <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Sales" /></Field>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setOpen(false)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button><Button onClick={saveMetric} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEFAULT_VTO = { core_values: [], core_focus: { purpose: '', niche: '' }, ten_year_target: '', marketing_strategy: { target_market: '', unique_value: '', three_uniques: ['', '', ''] }, three_year_picture: { revenue: '', profit: '', measurables: '' }, one_year_plan: { revenue: '', profit: '', goals: '' } };

function Vision({ client }) {
  const [row, setRow] = useState(null);
  const [v, setV] = useState(DEFAULT_VTO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_vto').select('*').eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle(); if (data) { setRow(data); setV({ ...DEFAULT_VTO, ...data, core_focus: { ...DEFAULT_VTO.core_focus, ...(data.core_focus || {}) }, marketing_strategy: { ...DEFAULT_VTO.marketing_strategy, ...(data.marketing_strategy || {}) }, three_year_picture: { ...DEFAULT_VTO.three_year_picture, ...(data.three_year_picture || {}) }, one_year_plan: { ...DEFAULT_VTO.one_year_plan, ...(data.one_year_plan || {}) }, core_values: Array.isArray(data.core_values) ? data.core_values : [] }); } } catch (e) { console.error(e); } finally { setLoading(false); } }
  function set(path, val) { setV(prev => { const n = { ...prev }; if (path.length === 1) n[path[0]] = val; else { n[path[0]] = { ...n[path[0]], [path[1]]: val }; } return n; }); }
  async function save() { try { setSaving(true); const payload = { core_values: v.core_values, core_focus: v.core_focus, ten_year_target: v.ten_year_target, marketing_strategy: v.marketing_strategy, three_year_picture: v.three_year_picture, one_year_plan: v.one_year_plan, is_active: true, updated_at: new Date().toISOString() }; if (row) await client.from('eos_vto').update(payload).eq('id', row.id); else { const { data } = await client.from('eos_vto').insert({ ...payload, version: 1 }).select().single(); setRow(data); } toast.success('Vision saved'); } catch (e) { console.error(e); toast.error('Save failed'); } finally { setSaving(false); } }
  if (loading) return <Empty>Loading…</Empty>;
  const inp = 'w-full bg-navy-950 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500';
  const lbl = 'block text-xs text-gray-400 mb-1';
  return (
    <div>
      <Header title="Vision/Traction Organizer" subtitle="Your V/TO" onCreate={save} createLabel={saving ? 'Saving…' : 'Save'} />
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-4">
          <Card className="bg-navy-900 border-navy-800 p-5">
            <div className="flex items-center justify-between mb-2"><h3 className="text-white font-semibold">Core Values</h3><button onClick={() => set(['core_values'], [...v.core_values, { name: '', description: '' }])} className="text-xs text-brand-blue hover:text-brand-light">+ Add</button></div>
            <div className="space-y-2">{v.core_values.map((cv, i) => (<div key={i} className="flex gap-2"><input value={cv.name || ''} onChange={(e) => { const a = [...v.core_values]; a[i] = { ...a[i], name: e.target.value }; set(['core_values'], a); }} placeholder="Value" className={inp + ' flex-1'} /><input value={cv.description || ''} onChange={(e) => { const a = [...v.core_values]; a[i] = { ...a[i], description: e.target.value }; set(['core_values'], a); }} placeholder="What it means" className={inp + ' flex-[2]'} /><button onClick={() => set(['core_values'], v.core_values.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 text-sm">✕</button></div>))}{v.core_values.length === 0 ? <div className="text-gray-500 text-sm">No core values yet.</div> : null}</div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-5 space-y-3">
            <h3 className="text-white font-semibold">Core Focus</h3>
            <div><label className={lbl}>Purpose / Cause / Passion</label><Textarea rows={2} value={v.core_focus.purpose} onChange={(e) => set(['core_focus', 'purpose'], e.target.value)} /></div>
            <div><label className={lbl}>Niche</label><Input value={v.core_focus.niche} onChange={(e) => set(['core_focus', 'niche'], e.target.value)} /></div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-5 space-y-3">
            <h3 className="text-white font-semibold">10-Year Target</h3>
            <Textarea rows={2} value={v.ten_year_target} onChange={(e) => set(['ten_year_target'], e.target.value)} />
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-5 space-y-3">
            <h3 className="text-white font-semibold">Marketing Strategy</h3>
            <div><label className={lbl}>Target Market</label><Input value={v.marketing_strategy.target_market} onChange={(e) => set(['marketing_strategy', 'target_market'], e.target.value)} /></div>
            <div><label className={lbl}>Unique Value</label><Input value={v.marketing_strategy.unique_value} onChange={(e) => set(['marketing_strategy', 'unique_value'], e.target.value)} /></div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="bg-navy-900 border-navy-800 p-5 space-y-3">
            <h3 className="text-white font-semibold">3-Year Picture</h3>
            <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Revenue</label><Input value={v.three_year_picture.revenue} onChange={(e) => set(['three_year_picture', 'revenue'], e.target.value)} /></div><div><label className={lbl}>Profit</label><Input value={v.three_year_picture.profit} onChange={(e) => set(['three_year_picture', 'profit'], e.target.value)} /></div></div>
            <div><label className={lbl}>Measurables / What it looks like</label><Textarea rows={4} value={v.three_year_picture.measurables} onChange={(e) => set(['three_year_picture', 'measurables'], e.target.value)} /></div>
          </Card>
          <Card className="bg-navy-900 border-navy-800 p-5 space-y-3">
            <h3 className="text-white font-semibold">1-Year Plan</h3>
            <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Revenue</label><Input value={v.one_year_plan.revenue} onChange={(e) => set(['one_year_plan', 'revenue'], e.target.value)} /></div><div><label className={lbl}>Profit</label><Input value={v.one_year_plan.profit} onChange={(e) => set(['one_year_plan', 'profit'], e.target.value)} /></div></div>
            <div><label className={lbl}>Goals for the year</label><Textarea rows={4} value={v.one_year_plan.goals} onChange={(e) => set(['one_year_plan', 'goals'], e.target.value)} /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const DEPTS = ['leadership', 'sales', 'operations', 'marketing', 'support', 'admin'];
function Accountability({ client, team }) {
  const [row, setRow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_accountability_charts').select('*').eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle(); if (data) { setRow(data); setSeats(Array.isArray(data.seats) ? data.seats : []); } } catch (e) { console.error(e); } finally { setLoading(false); } }
  function upd(id, patch) { setSeats(s => s.map(x => x.id === id ? { ...x, ...patch } : x)); }
  function addSeat() { setSeats(s => [...s, { id: Math.random().toString(36).slice(2, 10), title: '', department: 'operations', person_id: '', roles: [], gets_it: false, wants_it: false, capacity: false }]); }
  function removeSeat(id) { setSeats(s => s.filter(x => x.id !== id)); }
  async function save() { try { setSaving(true); const payload = { seats, is_active: true, updated_at: new Date().toISOString() }; if (row) await client.from('eos_accountability_charts').update(payload).eq('id', row.id); else { const { data } = await client.from('eos_accountability_charts').insert({ ...payload, version: 1 }).select().single(); setRow(data); } toast.success('Chart saved'); } catch (e) { console.error(e); toast.error('Save failed'); } finally { setSaving(false); } }
  if (loading) return <Empty>Loading…</Empty>;
  const gwc = (seat, key, lab) => <label className="flex items-center gap-1 text-xs text-gray-300"><input type="checkbox" checked={!!seat[key]} onChange={(e) => upd(seat.id, { [key]: e.target.checked })} className="accent-brand-blue" />{lab}</label>;
  return (
    <div>
      <Header title="Accountability Chart" subtitle="Seats, roles, and GWC" onCreate={save} createLabel={saving ? 'Saving…' : 'Save'} />
      <div className="mb-3"><Button onClick={addSeat} className="bg-navy-700 hover:bg-navy-600 text-white text-sm flex items-center gap-2"><Plus size={16} /> Add Seat</Button></div>
      {seats.length === 0 ? <Empty>No seats yet. Add the first seat.</Empty> : (
        <div className="grid md:grid-cols-2 gap-4">
          {seats.map(seat => (
            <Card key={seat.id} className="bg-navy-900 border-navy-800 p-4 space-y-3">
              <div className="flex items-center gap-2"><input value={seat.title} onChange={(e) => upd(seat.id, { title: e.target.value })} placeholder="Seat title" className="flex-1 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500" /><button onClick={() => removeSeat(seat.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={15} /></button></div>
              <div className="grid grid-cols-2 gap-2"><select value={seat.department} onChange={(e) => upd(seat.id, { department: e.target.value })} className="bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white">{DEPTS.map(d => <option key={d} value={d}>{d}</option>)}</select><select value={seat.person_id || ''} onChange={(e) => upd(seat.id, { person_id: e.target.value })} className="bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white"><option value="">Vacant</option>{team.team.map(m => <option key={m.id} value={m.id}>{[m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member'}</option>)}</select></div>
              <div className="flex items-center gap-4">{gwc(seat, 'gets_it', 'Gets it')}{gwc(seat, 'wants_it', 'Wants it')}{gwc(seat, 'capacity', 'Capacity')}</div>
              <Textarea rows={2} value={(seat.roles || []).join('\n')} onChange={(e) => upd(seat.id, { roles: e.target.value.split('\n').filter(Boolean) })} placeholder="Key responsibilities (one per line)" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const MEET_STATUS = { scheduled: { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-300' }, in_progress: { label: 'In Progress', color: 'bg-amber-500/20 text-amber-300' }, complete: { label: 'Complete', color: 'bg-emerald-500/20 text-emerald-300' }, cancelled: { label: 'Cancelled', color: 'bg-navy-700 text-gray-400' } };
const L10_AGENDA = ['Segue (5m)', 'Scorecard (5m)', 'Rock Review (5m)', 'Headlines (5m)', 'To-Do List (5m)', 'IDS (60m)', 'Conclude (5m)'];
function Meetings({ client, team }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const blank = () => ({ title: 'Weekly Level 10', scheduled_date: '' });
  const [form, setForm] = useState(blank());
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [client]);
  async function load() { if (!client) return; try { setLoading(true); const { data } = await client.from('eos_meetings').select('*').order('scheduled_date', { ascending: false, nullsFirst: false }); setRows(data || []); } catch (e) { console.error(e); } finally { setLoading(false); } }
  async function create() { try { const num = (rows.length || 0) + 1; await client.from('eos_meetings').insert({ title: form.title, scheduled_date: form.scheduled_date || null, status: 'scheduled', meeting_type: 'l10', meeting_number: num }); setOpen(false); setForm(blank()); toast.success('Meeting scheduled'); load(); } catch (e) { console.error(e); toast.error('Could not schedule'); } }
  async function setStatus(r, s) { try { const patch = { status: s }; if (s === 'in_progress') patch.start_time = new Date().toISOString(); if (s === 'complete') patch.completed_at = new Date().toISOString(); await client.from('eos_meetings').update(patch).eq('id', r.id); load(); } catch (e) { console.error(e); } }
  async function remove(r) { try { await client.from('eos_meetings').delete().eq('id', r.id); load(); } catch (e) { console.error(e); } }
  return (
    <div>
      <Header title="Level 10 Meetings" subtitle="Weekly leadership meeting" onCreate={() => setOpen(true)} createLabel="Schedule Meeting" />
      {loading ? <Empty>Loading…</Empty> : rows.length === 0 ? <Empty>No meetings yet. Schedule your first Level 10.</Empty> : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map(r => { const st = MEET_STATUS[r.status] || MEET_STATUS.scheduled; return (
            <Card key={r.id} className="bg-navy-900 border-navy-800 p-4">
              <div className="flex items-start justify-between gap-2 mb-2"><div><div className="text-white font-medium">{r.title || 'Level 10'}</div><div className="text-xs text-gray-500">{r.scheduled_date ? fmtDate(r.scheduled_date) : 'Unscheduled'}{r.meeting_number ? '  -  #' + r.meeting_number : ''}</div></div><Badge className={st.color + ' text-xs'}>{st.label}</Badge></div>
              <div className="flex flex-wrap gap-1 mb-3">{L10_AGENDA.map((a, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-navy-800 text-gray-400">{a}</span>)}</div>
              <div className="flex items-center gap-2">
                {r.status === 'scheduled' ? <Button onClick={() => setStatus(r, 'in_progress')} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs">Start</Button> : null}
                {r.status === 'in_progress' ? <Button onClick={() => setStatus(r, 'complete')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">Complete</Button> : null}
                <button onClick={() => remove(r)} className="text-gray-500 hover:text-red-400 ml-auto"><Trash2 size={15} /></button>
              </div>
            </Card>
          ); })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Schedule Meeting</DialogTitle></DialogHeader>
          <div className="space-y-3"><Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="Date & Time"><Input type="datetime-local" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} /></Field></div>
          <DialogFooter><Button onClick={() => setOpen(false)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button><Button onClick={create} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Schedule</Button></DialogFooter>
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
