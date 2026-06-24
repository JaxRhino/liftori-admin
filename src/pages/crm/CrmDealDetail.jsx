import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, Plus, Download, FileText, Upload, MessageSquare, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import CrmMeasure from './operations/CrmMeasure';
import CustomerPhotos from '../../components/crm/CustomerPhotos';

// =====================================================================
// CrmDealDetail - full-page Job/Deal detail for the RoofX roofing CRM.
// A "deal/job" = a customer_pipeline row (linked to customer_contacts via
// contact_id). EVERY child record on this page is scoped + tagged by
// pipeline_id = <this deal id> (the per-job isolation key the user added to
// customer_photos, ops_measurements, finance_invoices, documents, admin_notes,
// admin_tasks, comms_conversations; customer_estimates already had it).
// Cloned from CrmCustomerDetail.jsx (tab shell, navy/brand-blue, lucide,
// _shared client). Tabs are lazy: a tab queries only when first activated.
// =====================================================================

const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const date = (d) => d ? new Date(d).toLocaleDateString() : '-';
const fileSize = (b) => { const n = Number(b) || 0; if (!n) return '-'; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };
const contactLabel = (c) => c ? (c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer') : '';

const TABS = [
  { key: 'overview',       label: 'Overview' },
  { key: 'details',        label: 'Details' },
  { key: 'measurements',   label: 'Measurements' },
  { key: 'photos',         label: 'Photos' },
  { key: 'estimates',      label: 'Estimates' },
  { key: 'documents',      label: 'Documents' },
  { key: 'finance',        label: 'Finance' },
  { key: 'communications', label: 'Communications' },
  { key: 'notes',          label: 'Notes' },
  { key: 'tasks',          label: 'Tasks' },
];

const statusTone = (s) => {
  const v = (s || '').toLowerCase();
  if (['completed', 'paid', 'active', 'won', 'signed', 'approved', 'done', 'measured'].includes(v)) return 'bg-emerald-500/20 text-emerald-300';
  if (['in_progress', 'sent', 'scheduled', 'assigned', 'partial', 'pending', 'open'].includes(v)) return 'bg-amber-500/20 text-amber-300';
  if (['cancelled', 'void', 'declined', 'lost', 'overdue'].includes(v)) return 'bg-red-500/20 text-red-300';
  return 'bg-blue-500/20 text-blue-300';
};

const tempTone = (t) => ({ hot: 'bg-red-500/20 text-red-300', warm: 'bg-amber-500/20 text-amber-300', cold: 'bg-blue-500/20 text-blue-300' }[t] || 'bg-blue-500/20 text-blue-300');

export default function CrmDealDetail() {
  const { platformId, id } = useParams();
  const navigate = useNavigate();
  const { client } = useCrmClient();

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState(null);
  const [contact, setContact] = useState(null);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Lazy per-tab data. Each tab loads once on first activation, scoped by pipeline_id.
  const [loaded, setLoaded] = useState({});      // { [tabKey]: true }
  const [measurements, setMeasurements] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => { if (client && id) loadDeal(); /* eslint-disable-next-line */ }, [client, id]);

  async function loadDeal() {
    try {
      setLoading(true);
      const { data, error } = await client
        .from('customer_pipeline')
        .select('*, customer_contacts(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      setDeal(data);
      setContact(data.customer_contacts || null);
      setForm({
        title: data.title || '', description: data.description || '',
        stage: data.stage || '', deal_value: data.deal_value ?? '',
        probability: data.probability ?? 50, lead_temperature: data.lead_temperature || 'warm',
        service_type: data.service_type || '', status: data.status || '',
        expected_close_date: data.expected_close_date || '', assigned_to: data.assigned_to || '',
        tags: (data.tags || []).join(', '), notes: data.notes || '',
      });
      client.from('org_team_members').select('user_id, first_name, last_name, role').not('user_id', 'is', null)
        .then(({ data: tm }) => setTeam(tm || [])).catch(() => {});
    } catch (e) {
      console.error('Error loading deal:', e);
      toast.error('Failed to load deal');
    } finally {
      setLoading(false);
    }
  }

  // ---- lazy tab loaders (all scoped by pipeline_id = id) ----
  useEffect(() => {
    if (!client || !id || !deal) return;
    if (loaded[tab]) return;
    const mark = () => setLoaded(prev => ({ ...prev, [tab]: true }));
    const safe = (p) => p.then(r => r.data || []).catch(() => []);
    (async () => {
      if (tab === 'measurements') {
        setMeasurements(await safe(client.from('ops_measurements').select('*').eq('pipeline_id', id).eq('template_type', 'aerial_roof').order('created_at', { ascending: false })));
      } else if (tab === 'estimates') {
        setEstimates(await safe(client.from('customer_estimates').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
      } else if (tab === 'documents') {
        setDocuments(await safe(client.from('documents').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
      } else if (tab === 'finance') {
        setInvoices(await safe(client.from('finance_invoices').select('*').eq('pipeline_id', id).order('invoice_date', { ascending: false })));
      } else if (tab === 'communications') {
        setConversations(await safe(client.from('comms_conversations').select('*').eq('pipeline_id', id).order('last_message_at', { ascending: false, nullsFirst: false })));
      } else if (tab === 'notes') {
        setNotes(await safe(client.from('admin_notes').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
      } else if (tab === 'tasks') {
        setTasks(await safe(client.from('admin_tasks').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
      }
      mark();
    })();
    /* eslint-disable-next-line */
  }, [tab, client, id, deal]);

  async function reload(tabKey) {
    const safe = (p) => p.then(r => r.data || []).catch(() => []);
    if (tabKey === 'measurements') setMeasurements(await safe(client.from('ops_measurements').select('*').eq('pipeline_id', id).eq('template_type', 'aerial_roof').order('created_at', { ascending: false })));
    if (tabKey === 'estimates') setEstimates(await safe(client.from('customer_estimates').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
    if (tabKey === 'documents') setDocuments(await safe(client.from('documents').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
    if (tabKey === 'finance') setInvoices(await safe(client.from('finance_invoices').select('*').eq('pipeline_id', id).order('invoice_date', { ascending: false })));
    if (tabKey === 'communications') setConversations(await safe(client.from('comms_conversations').select('*').eq('pipeline_id', id).order('last_message_at', { ascending: false, nullsFirst: false })));
    if (tabKey === 'notes') setNotes(await safe(client.from('admin_notes').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
    if (tabKey === 'tasks') setTasks(await safe(client.from('admin_tasks').select('*').eq('pipeline_id', id).order('created_at', { ascending: false })));
  }

  // ---- Details save ----
  async function saveDetails() {
    try {
      setSaving(true);
      const patch = {
        title: form.title, description: form.description, stage: form.stage,
        deal_value: parseFloat(form.deal_value) || 0, probability: parseInt(form.probability) || 0,
        lead_temperature: form.lead_temperature, service_type: form.service_type, status: form.status || null,
        expected_close_date: form.expected_close_date || null, assigned_to: form.assigned_to || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
      };
      const { error } = await client.from('customer_pipeline').update(patch).eq('id', id);
      if (error) throw error;
      toast.success('Deal updated');
      loadDeal();
    } catch (e) { console.error(e); toast.error('Save failed'); } finally { setSaving(false); }
  }

  // ---- Estimates: create draft tagged pipeline_id + contact_id ----
  async function createEstimate() {
    try {
      const en = 'EST-' + Date.now().toString().slice(-6);
      const rid = () => Math.random().toString(36).slice(2, 10);
      const seed = [
        { id: rid(), title: 'Materials', enabled: true, items: [] },
        { id: rid(), title: 'Labor', enabled: true, items: [] },
        { id: rid(), title: 'Fees', enabled: true, items: [] },
      ];
      let margin = 50;
      try {
        const { data: st } = await client.from('estimate_settings').select('default_gross_margin').limit(1).maybeSingle();
        if (st && st.default_gross_margin != null) margin = st.default_gross_margin;
        const { data: prods } = await client.from('estimate_products').select('*').eq('is_active', true).eq('in_default_template', true).order('name', { ascending: true });
        (prods || []).forEach(pr => {
          const item = { id: rid(), description: pr.name, qty: 1, unit: pr.unit || '', unit_cost: Number(pr.cost) || 0 };
          (pr.item_type === 'labor' ? seed[1] : seed[0]).items.push(item);
        });
      } catch (seedErr) { console.error(seedErr); }
      const { data, error } = await client.from('customer_estimates').insert({
        contact_id: deal.contact_id || null, pipeline_id: id, estimate_number: en,
        title: 'New Estimate', status: 'draft', sections: seed, gross_margin: margin,
      }).select().single();
      if (error) throw error;
      navigate('/crm/' + platformId + '/estimates/' + data.id);
    } catch (e) { console.error(e); toast.error('Could not create estimate'); }
  }

  // ---- Documents: upload to `documents` bucket + insert row tagged pipeline_id ----
  const [docUploading, setDocUploading] = useState(false);
  async function onDocFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setDocUploading(true);
    try {
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const path = (id) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        const { error: upErr } = await client.storage.from('documents').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
        if (upErr) { console.error('doc upload failed', upErr); toast.error('Upload failed: ' + file.name); continue; }
        const { error: insErr } = await client.from('documents').insert({
          name: file.name, storage_path: path, mime_type: file.type || null,
          file_size_bytes: file.size || null, pipeline_id: id, related_entity_id: deal.contact_id || null,
        });
        if (insErr) console.error('doc row insert failed', insErr);
      }
      toast.success('Document uploaded');
      reload('documents');
    } catch (err) { console.error(err); toast.error('Upload error'); }
    finally { setDocUploading(false); e.target.value = ''; }
  }
  async function openDocument(doc) {
    try {
      if (doc.thumbnail_url) { window.open(doc.thumbnail_url, '_blank', 'noopener'); return; }
      if (doc.storage_path) {
        const { data, error } = await client.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener');
      } else { toast.error('No file attached'); }
    } catch (e) { console.error(e); toast.error('Could not open file'); }
  }

  // ---- Finance: minimal draft invoice tagged pipeline_id ----
  async function createInvoice() {
    try {
      const num = 'INV-' + Date.now().toString().slice(-6);
      const { data, error } = await client.from('finance_invoices').insert({
        invoice_number: num, customer_id: deal.contact_id || null, customer_name: contact ? contactLabel(contact) : null,
        pipeline_id: id, invoice_date: new Date().toISOString().slice(0, 10), status: 'draft',
        subtotal: 0, total_amount: 0, amount_paid: 0, balance_due: 0, notes: deal.title || null,
      }).select().single();
      if (error) throw error;
      toast.success('Draft invoice created');
      reload('finance');
    } catch (e) { console.error(e); toast.error('Could not create invoice'); }
  }

  // ---- Communications: log/start a conversation tagged pipeline_id ----
  async function startConversation() {
    try {
      const { error } = await client.from('comms_conversations').insert({
        channel_type: 'note', subject: deal.title || 'Job conversation', status: 'open',
        contact_id: deal.contact_id || null, pipeline_id: id, unread_count: 0,
        last_message_at: new Date().toISOString(), last_message_preview: 'Conversation logged from job page.',
      });
      if (error) throw error;
      toast.success('Conversation started');
      reload('communications');
    } catch (e) { console.error(e); toast.error('Could not start conversation'); }
  }

  // ---- Notes ----
  const [noteDraft, setNoteDraft] = useState('');
  async function addNote() {
    if (!noteDraft.trim()) return;
    try {
      const { error } = await client.from('admin_notes').insert({ body: noteDraft.trim(), pipeline_id: id, customer_id: deal.contact_id || null });
      if (error) throw error;
      setNoteDraft('');
      reload('notes');
    } catch (e) { console.error(e); toast.error('Could not add note'); }
  }

  // ---- Tasks ----
  const [taskDraft, setTaskDraft] = useState('');
  async function addTask() {
    if (!taskDraft.trim()) return;
    try {
      const { error } = await client.from('admin_tasks').insert({ title: taskDraft.trim(), status: 'pending', priority: 'normal', pipeline_id: id, customer_id: deal.contact_id || null });
      if (error) throw error;
      setTaskDraft('');
      reload('tasks');
    } catch (e) { console.error(e); toast.error('Could not add task'); }
  }
  async function toggleTask(t) {
    const next = (t.status === 'done' || t.status === 'completed') ? 'pending' : 'done';
    try {
      const { error } = await client.from('admin_tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', t.id);
      if (error) throw error;
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    } catch (e) { console.error(e); toast.error('Could not update task'); }
  }

  if (loading) return <div className="p-6 text-gray-400">Loading job...</div>;
  if (!deal) return <div className="p-6 text-gray-400">Job not found.</div>;

  const dealTitle = deal.title || 'Untitled Job';
  const lockedLabel = contact ? contactLabel(contact) : '';
  const counts = { measurements: measurements.length, photos: undefined, estimates: estimates.length, documents: documents.length, finance: invoices.length, communications: conversations.length, notes: notes.length, tasks: tasks.length };

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-full">
        <button onClick={() => navigate(`/crm/${platformId}/pipeline`)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Pipeline
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white text-xl font-bold">
              {dealTitle.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{dealTitle}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400 flex-wrap">
                {contact && (
                  <button onClick={() => navigate(`/crm/${platformId}/customers/${deal.contact_id}`)} className="text-brand-blue hover:text-brand-cyan">
                    {contactLabel(contact)}
                  </button>
                )}
                {deal.stage && <Badge className={`${statusTone(deal.stage)} text-xs`}>{deal.stage}</Badge>}
                {deal.status && <Badge className={`${statusTone(deal.status)} text-xs`}>{deal.status}</Badge>}
                {deal.service_type && <span>- {deal.service_type}</span>}
                <span className="text-white font-medium">{money(deal.deal_value)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setTab('details')} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Edit deal</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-navy-800 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.key ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'}`}>
              {t.label}{counts[t.key] ? <span className="ml-1.5 text-xs text-gray-500">{counts[t.key]}</span> : null}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Deal Value" value={money(deal.deal_value)} />
              <StatCard label="Probability" value={(deal.probability || 0) + '%'} />
              <StatCard label="Stage" value={deal.stage || '-'} />
              <StatCard label="Lead Temp" value={<Badge className={`${tempTone(deal.lead_temperature)} text-xs`}>{deal.lead_temperature || '-'}</Badge>} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Deal Summary">
                <KV k="Customer" v={contact ? contactLabel(contact) : '-'} />
                <KV k="Service Type" v={deal.service_type} />
                <KV k="Status" v={deal.status} />
                <KV k="Expected Close" v={date(deal.expected_close_date)} />
                <KV k="Assigned To" v={teamName(team, deal.assigned_to)} />
                <KV k="Tags" v={(deal.tags || []).join(', ')} />
              </Panel>
              <Panel title="Customer">
                <KV k="Name" v={contact ? contactLabel(contact) : '-'} />
                <KV k="Email" v={contact?.email} />
                <KV k="Phone" v={contact?.phone} />
                <KV k="Address" v={contact ? [contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(', ') : '-'} />
                {contact && (
                  <div className="pt-2">
                    <Button onClick={() => navigate(`/crm/${platformId}/customers/${deal.contact_id}`)} className="bg-navy-700 hover:bg-navy-600 text-white text-xs">Open customer</Button>
                  </div>
                )}
              </Panel>
              <Panel title="Description">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{deal.description || 'No description.'}</p>
              </Panel>
              <Panel title="Quick Links">
                <div className="flex flex-wrap gap-2">
                  <QuickLink label="Measurements" onClick={() => setTab('measurements')} />
                  <QuickLink label="Photos" onClick={() => setTab('photos')} />
                  <QuickLink label="Estimates" onClick={() => setTab('estimates')} />
                  <QuickLink label="Finance" onClick={() => setTab('finance')} />
                  <QuickLink label="Notes" onClick={() => setTab('notes')} />
                  <QuickLink label="Tasks" onClick={() => setTab('tasks')} />
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* DETAILS */}
        {tab === 'details' && form && (
          <Card className="bg-navy-900 border-navy-800 p-6 max-w-3xl">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Title" full><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Description" full><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-24" /></Field>
              <Field label="Stage"><Input value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Status"><Input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Deal Value ($)"><Input type="number" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label={`Probability - ${form.probability}%`}><input type="range" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} className="w-full h-2 bg-navy-800 rounded cursor-pointer" /></Field>
              <Field label="Lead Temperature">
                <select value={form.lead_temperature} onChange={e => setForm({ ...form, lead_temperature: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  {['cold', 'warm', 'hot'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Service Type"><Input value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Expected Close Date"><Input type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Assigned Rep">
                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.user_id} value={m.user_id}>{`${m.first_name || ''} ${m.last_name || ''}`.trim()}{m.role ? ` - ${m.role}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Tags (comma separated)" full><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Notes" full><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-24" /></Field>
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={saveDetails} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </Card>
        )}

        {/* MEASUREMENTS - embed Roof Measure pre-locked to this deal */}
        {tab === 'measurements' && (
          <div className="space-y-6">
            <Card className="bg-navy-900 border-navy-800 p-4">
              <CrmMeasure embedded lockedContactId={deal.contact_id || null} lockedContactLabel={lockedLabel} pipelineId={id} />
            </Card>
          </div>
        )}

        {/* PHOTOS - CompanyCam-style gallery scoped to this deal */}
        {tab === 'photos' && (
          <Card className="bg-navy-900 border-navy-800 p-4">
            <CustomerPhotos contactId={deal.contact_id || null} pipelineId={id} />
          </Card>
        )}

        {/* ESTIMATES */}
        {tab === 'estimates' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={createEstimate} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm flex items-center gap-1"><Plus size={15} /> New estimate</Button>
            </div>
            <ListTable onRowClick={(i) => navigate('/crm/' + platformId + '/estimates/' + estimates[i].id)} empty="No estimates for this job."
              cols={['Estimate #', 'Title', 'Status', 'Total', 'Valid Until', 'Created']}
              rows={estimates.map(e => [e.estimate_number, e.title, <Badge className={`${statusTone(e.status)} text-xs`}>{e.status}</Badge>, money(e.total), date(e.valid_until), date(e.created_at)])} />
          </div>
        )}

        {/* DOCUMENTS */}
        {tab === 'documents' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <label className="inline-flex items-center gap-1.5 cursor-pointer bg-brand-blue hover:bg-brand-blue/90 text-white text-sm font-medium px-3 py-2 rounded-lg">
                <Upload size={15} /> {docUploading ? 'Uploading...' : 'Upload'}
                <input type="file" className="hidden" multiple onChange={onDocFiles} disabled={docUploading} />
              </label>
            </div>
            <ListTable onRowClick={(i) => openDocument(documents[i])} empty="No documents for this job. Upload contracts, permits, or inspection reports."
              cols={['Name', 'Type', 'Size', 'Added']}
              rows={documents.map(d => [d.name || 'Untitled', d.doc_type || d.mime_type || '-', fileSize(d.file_size_bytes), date(d.created_at)])} />
          </div>
        )}

        {/* FINANCE */}
        {tab === 'finance' && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button onClick={() => navigate(`/crm/${platformId}/finance`)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Open Finance hub</Button>
              <Button onClick={createInvoice} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm flex items-center gap-1"><Plus size={15} /> New invoice</Button>
            </div>
            <ListTable empty="No invoices for this job yet." cols={['Invoice #', 'Date', 'Due', 'Status', 'Total', 'Paid', 'Balance']}
              rows={invoices.map(i => [i.invoice_number, date(i.invoice_date), date(i.due_date), <Badge className={`${statusTone(i.status)} text-xs`}>{i.status}</Badge>, money(i.total_amount), money(i.amount_paid), money(i.balance_due)])} />
          </div>
        )}

        {/* COMMUNICATIONS */}
        {tab === 'communications' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={startConversation} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm flex items-center gap-1"><MessageSquare size={15} /> Log conversation</Button>
            </div>
            {conversations.length === 0 ? (
              <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No conversations logged for this job yet.</Card>
            ) : (
              <Card className="bg-navy-900 border-navy-800 divide-y divide-navy-800">
                {conversations.map(c => (
                  <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center text-gray-300 flex-shrink-0"><MessageSquare size={15} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white truncate">{c.subject || 'Conversation'}</span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-500">{c.channel_type || 'note'}</span>
                      </div>
                      {c.last_message_preview && <div className="text-xs text-gray-500 truncate">{c.last_message_preview}</div>}
                    </div>
                    {c.last_message_at && <span className="text-[11px] text-gray-500 flex-shrink-0">{new Date(c.last_message_at).toLocaleDateString()}</span>}
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* NOTES */}
        {tab === 'notes' && (
          <div className="space-y-3 max-w-3xl">
            <Card className="bg-navy-900 border-navy-800 p-4">
              <Textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="Add a note about this job..." className="bg-navy-800 border-navy-700 text-white min-h-20 mb-3" />
              <div className="flex justify-end"><Button onClick={addNote} disabled={!noteDraft.trim()} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Add note</Button></div>
            </Card>
            {notes.length === 0 ? (
              <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No notes for this job yet.</Card>
            ) : (
              <div className="space-y-2">
                {notes.map(n => (
                  <Card key={n.id} className="bg-navy-900 border-navy-800 p-4">
                    {n.title && <div className="text-sm font-semibold text-white mb-1">{n.title}</div>}
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{n.body || n.content || ''}</p>
                    <div className="text-[11px] text-gray-500 mt-2">{date(n.created_at)}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TASKS */}
        {tab === 'tasks' && (
          <div className="space-y-3 max-w-3xl">
            <Card className="bg-navy-900 border-navy-800 p-4">
              <div className="flex gap-2">
                <Input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask(); }} placeholder="Add a task for this job..." className="bg-navy-800 border-navy-700 text-white" />
                <Button onClick={addTask} disabled={!taskDraft.trim()} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Add</Button>
              </div>
            </Card>
            {tasks.length === 0 ? (
              <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No tasks for this job yet.</Card>
            ) : (
              <Card className="bg-navy-900 border-navy-800 divide-y divide-navy-800">
                {tasks.map(t => {
                  const done = t.status === 'done' || t.status === 'completed';
                  return (
                    <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                      <button onClick={() => toggleTask(t)} className={done ? 'text-emerald-400' : 'text-gray-500 hover:text-white'}>
                        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm truncate ${done ? 'text-gray-500 line-through' : 'text-white'}`}>{t.title}</div>
                        {t.description && <div className="text-xs text-gray-500 truncate">{t.description}</div>}
                      </div>
                      {t.due_date && <span className="text-[11px] text-gray-500 flex-shrink-0">{date(t.due_date)}</span>}
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function teamName(team, uid) {
  if (!uid) return '-';
  const m = (team || []).find(x => x.user_id === uid);
  return m ? `${m.first_name || ''} ${m.last_name || ''}`.trim() || '-' : '-';
}

function StatCard({ label, value }) {
  return (
    <Card className="bg-navy-900 border-navy-800 p-4">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="text-white text-2xl font-bold">{value}</div>
    </Card>
  );
}

function Panel({ title, children }) {
  return (
    <Card className="bg-navy-900 border-navy-800 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-navy-800 pb-2 last:border-0">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-200 text-right truncate">{v || '-'}</span>
    </div>
  );
}

function QuickLink({ label, onClick }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-navy-700 text-gray-300 hover:bg-navy-800 hover:text-white transition">
      {label}
    </button>
  );
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      {children}
    </div>
  );
}

function ListTable({ cols, rows, empty, onRowClick }) {
  if (!rows || rows.length === 0) return <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">{empty}</Card>;
  return (
    <Card className="bg-navy-900 border-navy-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy-800">
              {cols.map((c, i) => <th key={i} className={`px-4 py-3 text-gray-400 font-semibold ${i >= cols.length - 1 ? 'text-right' : 'text-left'}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} onClick={onRowClick ? () => onRowClick(ri) : undefined} className={`border-b border-navy-800 hover:bg-navy-800/50 transition ${onRowClick ? 'cursor-pointer' : ''}`}>
                {r.map((cell, ci) => <td key={ci} className={`px-4 py-3 ${ci >= r.length - 1 ? 'text-right text-white font-medium' : 'text-gray-300'}`}>{cell || '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
