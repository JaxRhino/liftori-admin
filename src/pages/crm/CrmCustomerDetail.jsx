import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, Pencil, Plus, Mail, MessageSquare, Phone, Video } from 'lucide-react';
import { toast } from 'sonner';

const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const date = (d) => d ? new Date(d).toLocaleDateString() : '-';
const fileSize = (b) => { const n = Number(b) || 0; if (!n) return '-'; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; };
const DEFAULT_AGREEMENT_TERMS = `This Service Agreement (\"Agreement\") is entered into between the Company and the Client named above.\n\n1. Scope of Work. The Company agrees to perform the work described in the Scope of Work section. Any work outside that scope requires a written change order.\n\n2. Payment. The Client agrees to pay the amounts described under Payment Terms. Late balances may accrue interest as permitted by law.\n\n3. Schedule. The Company will make reasonable efforts to complete the work within the agreed dates, subject to weather, material availability, and site access.\n\n4. Warranty. The Company warrants its workmanship for the period stated in writing. Manufacturer warranties apply to materials.\n\n5. Termination. Either party may terminate this Agreement with written notice. The Client is responsible for work completed and materials ordered up to the termination date.\n\nBy signing below, both parties agree to the terms of this Agreement.`;

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'details',    label: 'Details' },
  { key: 'projects',   label: 'Projects' },
  { key: 'jobs',       label: 'Jobs' },
  { key: 'estimates',  label: 'Estimates' },
  { key: 'invoices',   label: 'Invoices' },
  { key: 'agreements', label: 'Agreements' },
  { key: 'documents',  label: 'Documents' },
  { key: 'photos',     label: 'Photos' },
];

const statusTone = (s) => {
  const v = (s || '').toLowerCase();
  if (['completed','paid','active','won','signed','approved'].includes(v)) return 'bg-emerald-500/20 text-emerald-300';
  if (['in_progress','sent','scheduled','assigned','partial'].includes(v)) return 'bg-amber-500/20 text-amber-300';
  if (['cancelled','void','declined','lost','overdue'].includes(v)) return 'bg-red-500/20 text-red-300';
  return 'bg-blue-500/20 text-blue-300';
};

export default function CrmCustomerDetail() {
  const { platformId, id } = useParams();
  const navigate = useNavigate();
  const { client } = useCrmClient();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [projects, setProjects] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [detail, setDetail] = useState(null);
  const [comms, setComms] = useState([]);
  const [agForm, setAgForm] = useState(null);

  async function createDefaultAgreement() {
    try {
      const num = 'AGR-' + Date.now().toString().slice(-6);
      const { data, error } = await client.from('customer_agreements').insert({
        contact_id: id, agreement_number: num, title: 'Service Agreement', agreement_type: 'service', status: 'draft',
        scope_of_work: 'Describe the work to be performed for the client here.', terms_text: DEFAULT_AGREEMENT_TERMS,
        payment_terms: 'Net 30. A 50% deposit is due upon acceptance; the balance is due on completion.',
      }).select().single();
      if (error) throw error;
      setAgreements(prev => [data, ...prev]); setAgForm({ ...data }); setDetail({ type: 'agreement', record: data });
      toast.success('Default agreement created');
    } catch (e) { console.error(e); toast.error('Could not create agreement'); }
  }

  async function saveAgreement() {
    if (!agForm) return;
    try {
      setSaving(true);
      const patch = { title: agForm.title, agreement_type: agForm.agreement_type, status: agForm.status, total_value: agForm.total_value || null, scope_of_work: agForm.scope_of_work, terms_text: agForm.terms_text, payment_terms: agForm.payment_terms, start_date: agForm.start_date || null, end_date: agForm.end_date || null };
      const { error } = await client.from('customer_agreements').update(patch).eq('id', agForm.id);
      if (error) throw error;
      setAgreements(prev => prev.map(a => a.id === agForm.id ? { ...a, ...patch } : a));
      toast.success('Agreement saved'); setDetail(null);
    } catch (e) { console.error(e); toast.error('Save failed'); } finally { setSaving(false); }
  }

  async function openDocumentUrl(doc) {
    try {
      if (doc.thumbnail_url) { window.open(doc.thumbnail_url, '_blank', 'noopener'); return; }
      if (doc.storage_path) {
        const { data, error } = await client.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener');
      } else { toast.error('No file attached'); }
    } catch (e) { console.error(e); toast.error('Could not open file'); }
  }

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
      const { data, error } = await client.from('customer_estimates').insert({ contact_id: id, estimate_number: en, title: 'New Estimate', status: 'draft', sections: seed, gross_margin: margin }).select().single();
      if (error) throw error;
      navigate('/crm/' + platformId + '/estimates/' + data.id);
    } catch (e) { console.error(e); toast.error('Could not create estimate'); }
  }
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => { if (client && id) load(); /* eslint-disable-next-line */ }, [client, id]);

  const load = async () => {
    try {
      setLoading(true);
      const { data: cust, error } = await client.from('customer_contacts').select('*').eq('id', id).single();
      if (error) throw error;
      setCustomer(cust);
      setForm({
        first_name: cust.first_name || '', last_name: cust.last_name || '', email: cust.email || '',
        phone: cust.phone || '', contact_type: cust.contact_type || 'customer',
        property_address: cust.property_address || '', property_city: cust.property_city || '',
        property_state: cust.property_state || '', property_zip: cust.property_zip || '',
        lead_source: cust.lead_source || '', notes: cust.notes || '',
      });
      const safe = (p) => p.then(r => r.data || []).catch(() => []);
      const [pr, jb, es, inv, pay, ag, ph, dc, cm] = await Promise.all([
        safe(client.from('customer_projects').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('ops_work_orders').select('*').eq('contact_id', id).order('scheduled_start', { ascending: false, nullsFirst: false })),
        safe(client.from('customer_estimates').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('finance_invoices').select('*').eq('customer_id', id).order('invoice_date', { ascending: false })),
        safe(client.from('finance_payments').select('*').eq('customer_id', id).order('payment_date', { ascending: false })),
        safe(client.from('customer_agreements').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('customer_photos').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('documents').select('*').eq('related_entity_id', id).order('created_at', { ascending: false })),
        safe(client.from('comms_conversations').select('*').eq('contact_id', id).order('last_message_at', { ascending: false, nullsFirst: false })),
      ]);
      setProjects(pr); setJobs(jb); setEstimates(es); setInvoices(inv); setPayments(pay); setAgreements(ag); setPhotos(ph); setDocuments(dc); setComms(cm);
    } catch (e) {
      console.error('Error loading customer:', e);
      toast.error('Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const name = customer ? (customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer') : '';

  async function createProject() {
    try {
      const { data, error } = await client.from('customer_projects').insert({ contact_id: id, title: 'New Project' }).select().single();
      if (error) throw error;
      setProjects(prev => [data, ...prev]); setTab('projects'); setDetail({ type: 'project', record: data });
      toast.success('Project created. Build the estimate \u2014 it converts to a Job once the estimate is signed.');
    } catch (e) { console.error(e); toast.error('Could not create project'); }
  }

  function startVideoCall() {
    const room = `liftori-${platformId}-${id}`.replace(/[^a-zA-Z0-9-]/g, '');
    const url = `https://meet.jit.si/${room}`;
    window.open(url, '_blank', 'noopener');
    toast.success('Video room opened \u2014 share the link with the customer to join.');
  }

  function commSoon(kind) { toast.message(`${kind} composer`, { description: 'Placeholder \u2014 email / text / call sending connects in a later phase.' }); }

  const saveDetails = async () => {
    try {
      setSaving(true);
      const { error } = await client.from('customer_contacts').update({ ...form, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Customer updated');
      load();
    } catch (e) {
      console.error('Error saving:', e); toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  const stats = useMemo(() => ({
    lifetime: customer?.lifetime_value || 0,
    projects: projects.length,
    jobs: jobs.length,
    openBalance: invoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0),
  }), [customer, projects, jobs, invoices]);

  if (loading) return <div className="p-6 text-gray-400">Loading customer...</div>;
  if (!customer) return <div className="p-6 text-gray-400">Customer not found.</div>;

  return (
    <div className="min-h-screen bg-navy-950 p-6">
      <div className="max-w-full">
        <button onClick={() => navigate(`/crm/${platformId}/customers`)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> All Customers
        </button>
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white text-xl font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400 flex-wrap">
                <Badge className={`${statusTone(customer.contact_type)} text-xs`}>{customer.contact_type || 'customer'}</Badge>
                {customer.email && <span>{customer.email}</span>}
                {customer.phone && <span>- {customer.phone}</span>}
                {(customer.property_city || customer.property_state) && <span>- {[customer.property_city, customer.property_state].filter(Boolean).join(', ')}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={createProject} className="bg-navy-700 hover:bg-navy-600 text-white flex items-center gap-2"><Plus size={16} /> New Project</Button>
            <Button onClick={() => setTab('details')} className="bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-2"><Pencil size={16} /> Edit</Button>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-5 border-b border-navy-800 overflow-x-auto">
          {TABS.map(t => {
            const count = { projects: projects.length, jobs: jobs.length, estimates: estimates.length, invoices: invoices.length, agreements: agreements.length, photos: photos.length }[t.key];
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.key ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'}`}>
                {t.label}{count ? <span className="ml-1.5 text-xs text-gray-500">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Lifetime Value" value={money(stats.lifetime)} />
              <StatCard label="Projects" value={stats.projects} />
              <StatCard label="Jobs" value={stats.jobs} />
              <StatCard label="Open Balance" value={money(stats.openBalance)} />
            </div>
            <Card className="bg-navy-900 border-navy-800 p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-white">Communications</h3>
                <div className="flex items-center gap-1.5">
                  <CommBtn icon={Mail} label="Email" onClick={() => commSoon('Email')} />
                  <CommBtn icon={MessageSquare} label="Text" onClick={() => commSoon('Text')} />
                  <CommBtn icon={Phone} label="Call" onClick={() => commSoon('Call')} />
                  <CommBtn icon={Video} label="Video" onClick={startVideoCall} accent />
                </div>
              </div>
              {comms.length === 0 ? (
                <Empty>No communications yet. Email, text, and call history will appear here once channels are connected.</Empty>
              ) : (
                <div className="space-y-1">{comms.slice(0, 8).map(c => <CommRow key={c.id} c={c} />)}</div>
              )}
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Recent Projects">
                {projects.slice(0, 5).map(p => <Row key={p.id} left={p.title} right={<Badge className={`${statusTone(p.status)} text-xs`}>{p.status}</Badge>} sub={money(p.estimated_value)} />)}
                {projects.length === 0 && <Empty>No projects</Empty>}
              </Panel>
              <Panel title="Recent Jobs">
                {jobs.slice(0, 5).map(j => <Row key={j.id} left={j.title || j.work_order_number} right={<Badge className={`${statusTone(j.status)} text-xs`}>{j.status}</Badge>} sub={date(j.scheduled_start)} />)}
                {jobs.length === 0 && <Empty>No jobs</Empty>}
              </Panel>
              <Panel title="Contact Info">
                <KV k="Email" v={customer.email} />
                <KV k="Phone" v={customer.phone} />
                <KV k="Address" v={[customer.property_address, customer.property_city, customer.property_state, customer.property_zip].filter(Boolean).join(', ')} />
                <KV k="Lead Source" v={customer.lead_source} />
              </Panel>
              <Panel title="Notes">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{customer.notes || 'No notes.'}</p>
              </Panel>
            </div>
          </div>
        )}

        {tab === 'details' && form && (
          <Card className="bg-navy-900 border-navy-800 p-6 max-w-3xl">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name"><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Last Name"><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="bg-navy-800 border-navy-700 text-wh	te" /></Field>
              <Field label="Email"><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Type">
                <select value={form.contact_type} onChange={e => setForm({ ...form, contact_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  {['customer','lead','prospect','vendor'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Lead Source"><Input value={form.lead_source} onChange={e => setForm({ ...form, lead_source: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Address" full><Input value={form.property_address} onChange={e => setForm({ ...form, property_address: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="City"><Input value={form.property_city} onChange={e => setForm({ ...form, property_city: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="State"><Input value={form.property_state} onChange={e => setForm({ ...form, property_state: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Zip"><Input value={form.property_zip} onChange={e => setForm({ ...form, property_zip: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Notes" full><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-24" /></Field>
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={saveDetails} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </Card>
        )}

        {tab === 'projects' && (
          <ListTable onRowClick={(i) => setDetail({ type: 'project', record: projects[i] })} empty="No projects for this customer." cols={['Project', 'Type', 'Status', 'City', 'Value', 'Progress']}
            rows={projects.map(p => [p.title, p.project_type, <Badge className={`${statusTone(p.status)} text-xs`}>{p.status}</Badge>, [p.job_city, p.job_state].filter(Boolean).join(', '), money(p.estimated_value), (p.completion_percentage || 0) + '%'])} />
        )}

        {tab === 'jobs' && (
          <ListTable onRowClick={(i) => setDetail({ type: 'job', record: jobs[i] })} empty="No jobs for this customer." cols={['Job', 'WO #', 'Status', 'Priority', 'Scheduled', 'Value']}
            rows={jobs.map(j => [j.title || 'Untitled', j.work_order_number, <Badge className={`${statusTone(j.status)} text-xs`}>{j.status}</Badge>, j.priority, date(j.scheduled_start), money(j.estimated_cost)])} />
        )}

        {tab === 'estimates' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={createEstimate} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">+ New Estimate</Button>
            </div>
            <ListTable onRowClick={(i) => navigate('/crm/' + platformId + '/estimates/' + estimates[i].id)} empty="No estimates for this customer." cols={['Estimate #', 'Title', 'Status', 'Total', 'Valid Until', 'Created']}
              rows={estimates.map(e => [e.estimate_number, e.title, <Badge className={`${statusTone(e.status)} text-xs`}>{e.status}</Badge>, money(e.total), date(e.valid_until), date(e.created_at)])} />
          </div>
        )}

        {tab === 'invoices' && (
          <div className="space-y-6">
            <ListTable onRowClick={(i) => setDetail({ type: 'invoice', record: invoices[i] })} empty="No invoices for this customer." cols={['Invoice #', 'Date', 'Due', 'Status', 'Total', 'Paid', 'Balance']}
              rows={invoices.map(i => [i.invoice_number, date(i.invoice_date), date(i.due_date), <Badge className={`${statusTone(i.status)} text-xs`}>{i.status}</Badge>, money(i.total_amount), money(i.amount_paid), money(i.balance_due)])} />
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Payments</h3>
              <ListTable empty="No payments recorded." cols={['Payment #', 'Date', 'Method', 'Status', 'Amount']}
                rows={payments.map(p => [p.payment_number, date(p.payment_date), p.payment_method, <Badge className={`${statusTone(p.status)} text-xs`}>{p.status}</Badge>, money(p.amount)])} />
            </div>
          </div>
        )}

        {tab === 'agreements' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={createDefaultAgreement} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">+ New Agreement</Button>
            </div>
            <ListTable onRowClick={(i) => { setAgForm({ ...agreements[i] }); setDetail({ type: 'agreement', record: agreements[i] }); }} empty="No agreements for this customer." cols={['Agreement #', 'Title', 'Type', 'Status', 'Value', 'Start', 'End']}
              rows={agreements.map(a => [a.agreement_number, a.title, a.agreement_type, <Badge className={`${statusTone(a.status)} text-xs`}>{a.status}</Badge>, money(a.total_value), date(a.start_date), date(a.end_date)])} />
          </div>
        )}

        {tab === 'documents' && (
          <ListTable onRowClick={(i) => setDetail({ type: 'document', record: documents[i] })} empty="No documents for this customer." cols={['Name', 'Type', 'Size', 'Added']}
            rows={documents.map(d => [d.name || 'Untitled', d.doc_type || d.mime_type || '-', fileSize(d.file_size_bytes), date(d.created_at)])} />
        )}

        {tab === 'photos' && (
          photos.length === 0 ? (
            <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No photos for this customer yet.</Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map(p => (
                <div key={p.id} onClick={() => setDetail({ type: 'photo', record: p })} className="bg-navy-900 border border-navy-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-blue/40 transition">
                  {p.url ? <img src={p.url} alt={p.caption || ''} className="w-full h-40 object-cover" /> : <div className="w-full h-40 bg-navy-800" />}
                  <div className="p-2">
                    {p.category && <Badge className="bg-brand-blue/20 text-brand-blue text-[10px] mb-1">{p.category}</Badge>}
                    <p className="text-xs text-gray-400 truncate">{p.caption || 'Untitled'}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {detail && (
        <RecordDetail detail={detail} agForm={agForm} setAgForm={setAgForm} onSaveAgreement={saveAgreement} onOpenDoc={openDocumentUrl} onClose={() => setDetail(null)} saving={saving} />
      )}
    </div>
  );
}

function RecordDetail({ detail, agForm, setAgForm, onSaveAgreement, onOpenDoc, onClose, saving }) {
  const { type, record } = detail;
  const r = record || {};
  const titleMap = { project: 'Project', job: 'Work Order', invoice: 'Invoice', agreement: 'Agreement', document: 'Document', photo: 'Photo' };
  const cityState = [r.job_city || r.city, r.job_state || r.state].filter(Boolean).join(', ');
  const pairsByType = {
    project: [['Title', r.title], ['Type', r.project_type], ['Status', r.status], ['Priority', r.priority], ['Location', cityState], ['Estimated Value', money(r.estimated_value)], ['Actual Cost', money(r.actual_cost)], ['Completion', (r.completion_percentage || 0) + '%'], ['Scheduled', date(r.scheduled_start) + ' - ' + date(r.scheduled_end)], ['Description', r.description], ['Notes', r.notes]],
    job: [['Title', r.title], ['WO #', r.work_order_number], ['Status', r.status], ['Priority', r.priority], ['Category', r.category], ['Scheduled', date(r.scheduled_start) + ' - ' + date(r.scheduled_end)], ['Estimated Cost', money(r.estimated_cost)], ['Actual Cost', money(r.actual_cost)], ['Location', [r.address, cityState].filter(Boolean).join(', ')], ['Description', r.description], ['Notes', r.notes]],
    invoice: [['Invoice #', r.invoice_number], ['Status', r.status], ['Invoice Date', date(r.invoice_date)], ['Due Date', date(r.due_date)], ['Subtotal', money(r.subtotal)], ['Tax', money(r.tax_amount)], ['Total', money(r.total_amount)], ['Paid', money(r.amount_paid)], ['Balance', money(r.balance_due)], ['Terms', r.terms], ['Notes', r.notes]],
    document: [['Name', r.name], ['Type', r.doc_type || r.mime_type], ['Size', fileSize(r.file_size_bytes)], ['Customer Visible', r.is_customer_visible ? 'Yes' : 'No'], ['Added', date(r.created_at)], ['Description', r.description]],
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-800 sticky top-0 bg-navy-900 z-10">
          <h3 className="text-white font-semibold">{titleMap[type] || 'Record'}{r.title ? ' - ' + r.title : ''}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
        </div>
        <div className="p-5 space-y-2">
          {pairsByType[type] && pairsByType[type].map(([k, v], i) => <KV key={i} k={k} v={v} />)}

          {type === 'document' && (
            <div className="pt-3"><Button onClick={() => onOpenDoc(r)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Open file</Button></div>
          )}

          {type === 'photo' && (
            <div className="space-y-3">
              {r.url ? <img src={r.url} alt={r.caption || ''} className="w-full rounded-lg max-h-[60vh] object-contain bg-navy-950" /> : <div className="w-full h-48 bg-navy-800 rounded-lg" />}
              <KV k="Caption" v={r.caption} />
              <KV k="Category" v={r.category} />
            </div>
          )}

          {type === 'agreement' && agForm && (
            <div className="space-y-3">
              <Field2 label="Title"><Input value={agForm.title || ''} onChange={(e) => setAgForm({ ...agForm, title: e.target.value })} /></Field2>
              <div className="grid grid-cols-2 gap-3">
                <Field2 label="Type"><Input value={agForm.agreement_type || ''} onChange={(e) => setAgForm({ ...agForm, agreement_type: e.target.value })} /></Field2>
                <Field2 label="Status"><Input value={agForm.status || ''} onChange={(e) => setAgForm({ ...agForm, status: e.target.value })} /></Field2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field2 label="Total Value"><Input type="number" value={agForm.total_value || ''} onChange={(e) => setAgForm({ ...agForm, total_value: e.target.value })} /></Field2>
                <Field2 label="Payment Terms"><Input value={agForm.payment_terms || ''} onChange={(e) => setAgForm({ ...agForm, payment_terms: e.target.value })} /></Field2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field2 label="Start Date"><Input type="date" value={agForm.start_date || ''} onChange={(e) => setAgForm({ ...agForm, start_date: e.target.value })} /></Field2>
                <Field2 label="End Date"><Input type="date" value={agForm.end_date || ''} onChange={(e) => setAgForm({ ...agForm, end_date: e.target.value })} /></Field2>
              </div>
              <Field2 label="Scope of Work"><Textarea rows={4} value={agForm.scope_of_work || ''} onChange={(e) => setAgForm({ ...agForm, scope_of_work: e.target.value })} /></Field2>
              <Field2 label="Terms"><Textarea rows={8} value={agForm.terms_text || ''} onChange={(e) => setAgForm({ ...agForm, terms_text: e.target.value })} /></Field2>
              <div className="flex justify-end gap-2 pt-1">
                <Button onClick={onClose} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button>
                <Button onClick={onSaveAgreement} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">{saving ? 'Saving...' : 'Save Agreement'}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field2({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
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

function Panel({ title, children }) {
  return (
    <Card className="bg-navy-900 border-navy-800 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function Row({ left, right, sub }) {
  return (
    <div className="flex items-center justify-between border-b border-navy-800 pb-2 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-white truncate">{left}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
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

function Empty({ children }) { return <div className="text-sm text-gray-500 py-3">{children}</div>; }

const CHANNEL_META = {
  email: { icon: Mail, label: 'Email', color: 'text-blue-300' },
  sms:   { icon: MessageSquare, label: 'Text', color: 'text-emerald-300' },
  text:  { icon: MessageSquare, label: 'Text', color: 'text-emerald-300' },
  call:  { icon: Phone, label: 'Call', color: 'text-amber-300' },
  phone: { icon: Phone, label: 'Call', color: 'text-amber-300' },
};

function CommBtn({ icon: Icon, label, onClick, accent }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${accent ? 'border-brand-blue/50 text-brand-blue hover:bg-brand-blue/10' : 'border-navy-700 text-gray-300 hover:bg-navy-800 hover:text-white'}`}>
      <Icon size={14} /> {label}
    </button>
  );
}

function CommRow({ c }) {
  const meta = CHANNEL_META[(c.channel_type || '').toLowerCase()] || { icon: MessageSquare, label: c.channel_type || 'Message', color: 'text-gray-300' };
  const Icon = meta.icon;
  const when = c.last_message_at ? new Date(c.last_message_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <div className="flex items-center gap-3 py-2 border-b border-navy-800 last:border-0">
      <div className={`w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center flex-shrink-0 ${meta.color}`}><Icon size={15} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white truncate">{c.subject || meta.label}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-500">{meta.label}</span>
        </div>
        {c.last_message_preview && <div className="text-xs text-gray-500 truncate">{c.last_message_preview}</div>}
      </div>
      {when && <span className="text-[11px] text-gray-500 flex-shrink-0">{when}</span>}
    </div>
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
