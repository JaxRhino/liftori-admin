import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient, HubPage, StatCard, Section } from './_shared';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

// Automated follow-up sequences. Reads the tenant's OWN Supabase via
// useCrmClient(). Builds email/SMS drips + reminders on the existing
// email_sequences / email_sequence_steps / email_sends schema. Enrolling a
// contact materializes one scheduled email_sends row per step (scheduled_for
// = now + the step delay). Outbound SENDING is gated per account by
// org_settings.outbound_sending_enabled — when OFF, steps queue but never go
// out, so nothing is sent until the account is switched on (and messaging
// is connected).

const FROM_FALLBACK = 'noreply@liftori.ai';
const TRIGGERS = ['manual', 'lead_created', 'estimate_sent', 'appointment_booked', 'job_completed'];
const channelMeta = {
  email: { label: 'Email', color: 'bg-blue-500/20 text-blue-300' },
  sms:   { label: 'SMS',   color: 'bg-emerald-500/20 text-emerald-300' },
};
const statusMeta = {
  scheduled: { label: 'Scheduled', color: 'bg-amber-500/20 text-amber-300' },
  sent:      { label: 'Sent',      color: 'bg-emerald-500/20 text-emerald-300' },
  failed:    { label: 'Failed',    color: 'bg-red-500/20 text-red-300' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-300' },
};

const fmtDelay = (m) => {
  m = Number(m) || 0;
  if (m <= 0) return 'Immediately';
  if (m % 1440 === 0) return (m / 1440) + 'd';
  if (m % 60 === 0) return (m / 60) + 'h';
  return m + 'm';
};
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return iso; } };
const contactName = (c) => c ? ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || c.email || 'Unknown' : 'Unknown';

export default function CrmSequences() {
  const { client } = useCrmClient();
  const [sequences, setSequences] = useState([]);
  const [steps, setSteps] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [sends, setSends] = useState([]);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // sequence being edited, or {} for new
  const [draftSteps, setDraftSteps] = useState([]);
  const [enrolling, setEnrolling] = useState(null); // sequence to enroll into
  const [enrollContact, setEnrollContact] = useState('');

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client]);

  async function load() {
    try {
      setLoading(true);
      const [seqRes, stepRes, tplRes, conRes, sendRes, orgRes] = await Promise.all([
        client.from('email_sequences').select('*').order('created_at', { ascending: false }),
        client.from('email_sequence_steps').select('*').order('step_order'),
        client.from('comms_templates').select('id, name, channel_type, subject, body, is_active').order('name'),
        client.from('customer_contacts').select('id, first_name, last_name, email, phone, contact_type').order('created_at', { ascending: false }),
        client.from('email_sends').select('*').order('scheduled_for', { ascending: true }),
        client.from('org_settings').select('*').limit(1).maybeSingle(),
      ]);
      setSequences(seqRes?.data || []);
      setSteps(stepRes?.data || []);
      setTemplates(tplRes?.data || []);
      setContacts(conRes?.data || []);
      setSends(sendRes?.data || []);
      setOrg(orgRes?.data || null);
    } catch (e) {
      console.error('sequences load failed', e);
      toast.error('Failed to load sequences');
    } finally {
      setLoading(false);
    }
  }

  const sending = !!org?.outbound_sending_enabled;
  const stepsBySeq = useMemo(() => {
    const m = {};
    for (const s of steps) (m[s.sequence_id] = m[s.sequence_id] || []).push(s);
    Object.values(m).forEach((arr) => arr.sort((a, b) => (a.step_order || 0) - (b.step_order || 0)));
    return m;
  }, [steps]);
  const tplById = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates]);
  const conById = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c])), [contacts]);
  const scheduled = useMemo(() => sends.filter((s) => s.status === 'scheduled'), [sends]);
  const sentCount = useMemo(() => sends.filter((s) => s.status === 'sent').length, [sends]);
  const activeCount = useMemo(() => sequences.filter((s) => s.status === 'active').length, [sequences]);
  const enrolledTotal = useMemo(() => sequences.reduce((a, s) => a + (s.total_enrolled || 0), 0), [sequences]);

  async function toggleSending() {
    if (!org?.id) { toast.error('No account settings row'); return; }
    const next = !sending;
    try {
      const { error } = await client.from('org_settings').update({ outbound_sending_enabled: next }).eq('id', org.id);
      if (error) throw error;
      setOrg({ ...org, outbound_sending_enabled: next });
      toast.success(next ? 'Outbound sending turned ON for this account' : 'Outbound sending turned OFF');
    } catch (e) { console.error(e); toast.error(e.message || 'Could not update'); }
  }

  // ---- sequence + steps editor ----
  function openNew() {
    setEditing({ name: '', description: '', trigger_event: 'manual', goal: '', status: 'active' });
    setDraftSteps([{ channel: 'email', delay_value: 0, delay_unit: 'minutes', template_id: '' }]);
  }
  function openEdit(seq) {
    setEditing({ ...seq });
    const ss = (stepsBySeq[seq.id] || []).map((s) => ({
      id: s.id, channel: s.channel || 'email', template_id: s.template_id || '',
      delay_value: s.delay_minutes ? (s.delay_minutes % 1440 === 0 ? s.delay_minutes / 1440 : s.delay_minutes % 60 === 0 ? s.delay_minutes / 60 : s.delay_minutes) : 0,
      delay_unit: s.delay_minutes ? (s.delay_minutes % 1440 === 0 ? 'days' : s.delay_minutes % 60 === 0 ? 'hours' : 'minutes') : 'minutes',
    }));
    setDraftSteps(ss.length ? ss : [{ channel: 'email', delay_value: 0, delay_unit: 'minutes', template_id: '' }]);
  }
  const toMinutes = (v, u) => { const n = Number(v) || 0; return u === 'days' ? n * 1440 : u === 'hours' ? n * 60 : n; };

  async function saveSequence() {
    if (!editing.name.trim()) { toast.error('Sequence name is required'); return; }
    if (draftSteps.some((s) => !s.template_id)) { toast.error('Every step needs a template'); return; }
    setBusy(true);
    try {
      let seqId = editing.id;
      const payload = { name: editing.name, description: editing.description, trigger_event: editing.trigger_event, goal: editing.goal, status: editing.status };
      if (seqId) {
        const { error } = await client.from('email_sequences').update(payload).eq('id', seqId);
        if (error) throw error;
        await client.from('email_sequence_steps').delete().eq('sequence_id', seqId);
      } else {
        const { data, error } = await client.from('email_sequences').insert(payload).select('id').single();
        if (error) throw error;
        seqId = data.id;
      }
      const rows = draftSteps.map((s, i) => ({
        sequence_id: seqId, step_order: i + 1, channel: s.channel, template_id: s.template_id,
        delay_minutes: toMinutes(s.delay_value, s.delay_unit), stop_on_reply: true,
      }));
      const { error: stepErr } = await client.from('email_sequence_steps').insert(rows);
      if (stepErr) throw stepErr;
      toast.success('Sequence saved');
      setEditing(null);
      load();
    } catch (e) { console.error(e); toast.error(e.message || 'Save failed'); } finally { setBusy(false); }
  }
  async function deleteSequence(seq) {
    if (!window.confirm(`Delete "${seq.name}"? Scheduled steps for it are removed too.`)) return;
    try {
      await client.from('email_sends').delete().eq('sequence_id', seq.id).eq('status', 'scheduled');
      await client.from('email_sequence_steps').delete().eq('sequence_id', seq.id);
      const { error } = await client.from('email_sequences').delete().eq('id', seq.id);
      if (error) throw error;
      toast.success('Sequence deleted'); load();
    } catch (e) { console.error(e); toast.error(e.message || 'Delete failed'); }
  }

  // ---- enrollment ----
  async function doEnroll() {
    const seq = enrolling; const cid = enrollContact;
    if (!cid) { toast.error('Pick a contact'); return; }
    const seqSteps = stepsBySeq[seq.id] || [];
    if (!seqSteps.length) { toast.error('This sequence has no steps'); return; }
    setBusy(true);
    try {
      const c = conById[cid];
      const rows = seqSteps.map((st) => {
        const tpl = tplById[st.template_id] || {};
        return {
          sequence_id: seq.id, sequence_step_id: st.id, template_id: st.template_id, contact_id: cid,
          channel: st.channel, to_address: st.channel === 'sms' ? (c?.phone || '') : (c?.email || ''),
          from_address: FROM_FALLBACK, subject: tpl.subject || null, body: tpl.body || '',
          status: 'scheduled', scheduled_for: new Date(Date.now() + (st.delay_minutes || 0) * 60000).toISOString(),
        };
      });
      const { error } = await client.from('email_sends').insert(rows);
      if (error) throw error;
      await client.from('email_sequences').update({ total_enrolled: (seq.total_enrolled || 0) + 1 }).eq('id', seq.id);
      toast.success(`Enrolled ${contactName(c)} (${rows.length} steps queued)`);
      setEnrolling(null); setEnrollContact(''); load();
    } catch (e) { console.error(e); toast.error(e.message || 'Enroll failed'); } finally { setBusy(false); }
  }
  async function cancelSend(s) {
    try {
      const { error } = await client.from('email_sends').delete().eq('id', s.id);
      if (error) throw error;
      setSends((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) { console.error(e); toast.error(e.message || 'Could not cancel'); }
  }

  return (
    <HubPage
      title="Follow-up Sequences"
      subtitle="Automated email and SMS drips plus reminders on a schedule."
      actions={<Button onClick={openNew} className="bg-brand-blue hover:bg-brand-blue/90 text-white"><Plus className="w-4 h-4 mr-2" /> New sequence</Button>}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24"><div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {/* account sending gate */}
          <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${sending ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
            <div>
              <p className={`font-semibold ${sending ? 'text-emerald-300' : 'text-amber-300'}`}>{sending ? 'Outbound sending is ON for this account' : 'Outbound sending is OFF for this account'}</p>
              <p className="text-sm text-gray-400 mt-0.5">{sending ? 'Scheduled steps will be delivered once messaging is connected.' : 'Steps are scheduled and queued, but nothing is sent until you turn sending on.'}</p>
            </div>
            <button onClick={toggleSending} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sending ? 'bg-emerald-600/30 text-emerald-200 hover:bg-emerald-600/40' : 'bg-navy-700 text-gray-200 hover:bg-navy-600'}`}>
              {sending ? 'Turn sending off' : 'Turn sending on'}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Sequences" value={activeCount} />
            <StatCard label="Total Enrolled" value={enrolledTotal} accent="text-brand-blue" />
            <StatCard label="Steps Scheduled" value={scheduled.length} accent="text-amber-400" hint="queued, awaiting send" />
            <StatCard label="Sent" value={sentCount} accent="text-emerald-400" />
          </div>

          {/* sequences */}
          <Section title="Sequences">
            <div className="divide-y divide-navy-700/40">
              {sequences.length === 0 && <div className="px-5 py-10 text-center text-gray-500">No sequences yet. Create your first drip.</div>}
              {sequences.map((seq) => {
                const ss = stepsBySeq[seq.id] || [];
                return (
                  <div key={seq.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{seq.name}</span>
                          <Badge className={(seq.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300') + ' text-[10px]'}>{seq.status || 'draft'}</Badge>
                          <span className="text-xs text-gray-500">on {(seq.trigger_event || 'manual').replace('_', ' ')}</span>
                        </div>
                        {seq.description && <p className="text-sm text-gray-400 mt-0.5">{seq.description}</p>}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {ss.length === 0 && <span className="text-xs text-gray-500">no steps</span>}
                          {ss.map((st, i) => {
                            const cm = channelMeta[st.channel] || channelMeta.email;
                            const tpl = tplById[st.template_id];
                            return (
                              <span key={st.id} className="inline-flex items-center gap-1.5 bg-navy-800 border border-navy-700/50 rounded-lg px-2 py-1">
                                <span className="text-gray-500 text-[10px]">{i + 1}</span>
                                <Badge className={cm.color + ' text-[10px]'}>{cm.label}</Badge>
                                <span className="text-xs text-gray-300">{tpl ? tpl.name : 'template'}</span>
                                <span className="text-[10px] text-gray-500">{fmtDelay(st.delay_minutes)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500">{seq.total_enrolled || 0} enrolled</span>
                        <button onClick={() => { setEnrolling(seq); setEnrollContact(''); }} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition inline-flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Enroll</button>
                        <button onClick={() => openEdit(seq)} className="px-2 py-1 bg-navy-700/60 hover:bg-navy-700 text-gray-200 rounded text-xs transition">Edit</button>
                        <button onClick={() => deleteSequence(seq)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* queue */}
          <Section title={`Scheduled queue (${scheduled.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                    <th className="text-left px-5 py-3 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 font-medium">Channel</th>
                    <th className="text-left px-4 py-3 font-medium">Message</th>
                    <th className="text-left px-4 py-3 font-medium">Scheduled</th>
                    <th className="text-right px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduled.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-500">Nothing queued. Enroll a contact in a sequence to schedule follow-ups.</td></tr>}
                  {scheduled.map((s) => {
                    const cm = channelMeta[s.channel] || channelMeta.email;
                    return (
                      <tr key={s.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-white">{contactName(conById[s.contact_id])}</td>
                        <td className="px-4 py-3"><Badge className={cm.color + ' text-[10px]'}>{cm.label}</Badge></td>
                        <td className="px-4 py-3 text-gray-300 truncate max-w-xs">{s.subject || s.body || '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{fmtWhen(s.scheduled_for)}</td>
                        <td className="px-5 py-3 text-right"><button onClick={() => cancelSend(s)} className="px-2 py-1 bg-navy-700/60 hover:bg-navy-700 text-gray-300 rounded text-xs transition">Cancel</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* sequence editor */}
      <Dialog open={editing != null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit sequence' : 'New sequence'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" placeholder="New Lead Nurture" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Trigger</label>
                  <select value={editing.trigger_event} onChange={(e) => setEditing({ ...editing, trigger_event: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                    {TRIGGERS.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                  <Input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="bg-navy-800 border-navy-700 text-white" placeholder="Welcome new leads and book an inspection" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-400">Steps</label>
                  <button onClick={() => setDraftSteps([...draftSteps, { channel: 'email', delay_value: 1, delay_unit: 'days', template_id: '' }])} className="text-xs text-brand-blue hover:text-brand-blue/80">+ Add step</button>
                </div>
                <div className="space-y-2">
                  {draftSteps.map((s, i) => {
                    const opts = templates.filter((t) => !t.channel_type || t.channel_type === s.channel);
                    return (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center bg-navy-800 border border-navy-700/50 rounded-lg p-2">
                        <span className="col-span-1 text-center text-gray-500 text-xs">{i + 1}</span>
                        <select value={s.channel} onChange={(e) => { const d = [...draftSteps]; d[i] = { ...s, channel: e.target.value, template_id: '' }; setDraftSteps(d); }} className="col-span-2 bg-navy-900 border border-navy-700 text-white rounded px-2 py-1.5 text-sm">
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                        </select>
                        <select value={s.template_id} onChange={(e) => { const d = [...draftSteps]; d[i] = { ...s, template_id: e.target.value }; setDraftSteps(d); }} className="col-span-4 bg-navy-900 border border-navy-700 text-white rounded px-2 py-1.5 text-sm">
                          <option value="">Template...</option>
                          {opts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <span className="col-span-1 text-right text-xs text-gray-500">wait</span>
                        <Input type="number" min="0" value={s.delay_value} onChange={(e) => { const d = [...draftSteps]; d[i] = { ...s, delay_value: e.target.value }; setDraftSteps(d); }} className="col-span-1 bg-navy-900 border-navy-700 text-white text-right px-2 py-1 text-sm h-8" />
                        <select value={s.delay_unit} onChange={(e) => { const d = [...draftSteps]; d[i] = { ...s, delay_unit: e.target.value }; setDraftSteps(d); }} className="col-span-2 bg-navy-900 border border-navy-700 text-white rounded px-2 py-1.5 text-sm">
                          <option value="minutes">min</option>
                          <option value="hours">hrs</option>
                          <option value="days">days</option>
                        </select>
                        <button onClick={() => setDraftSteps(draftSteps.filter((_, j) => j !== i))} className="col-span-1 text-red-400 hover:text-red-300 flex justify-center"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                  {draftSteps.length === 0 && <p className="text-xs text-gray-500">Add at least one step.</p>}
                </div>
                {templates.length === 0 && <p className="text-xs text-amber-400 mt-2">No message templates exist yet. Create templates in Communications first.</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-navy-700 text-gray-300">Cancel</Button>
            <Button onClick={saveSequence} disabled={busy} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Save sequence</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* enroll */}
      <Dialog open={enrolling != null} onOpenChange={(o) => { if (!o) setEnrolling(null); }}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-md">
          <DialogHeader><DialogTitle>Enroll a contact{enrolling ? ` in "${enrolling.name}"` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Contact</label>
              <select value={enrollContact} onChange={(e) => setEnrollContact(e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                <option value="">Select a contact...</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{contactName(c)}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-500">{enrolling ? `${(stepsBySeq[enrolling.id] || []).length} step(s) will be scheduled.` : ''} {sending ? '' : 'Sending is off, so they queue until you turn it on.'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrolling(null)} className="border-navy-700 text-gray-300">Cancel</Button>
            <Button onClick={doEnroll} disabled={busy} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Enroll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HubPage>
  );
}
