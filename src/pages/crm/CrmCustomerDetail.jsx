import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const date = (d) => d ? new Date(d).toLocaleDateString() : '-';

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
      const [pr, jb, es, inv, pay, ag, ph] = await Promise.all([
        safe(client.from('customer_projects').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('ops_work_orders').select('*').eq('contact_id', id).order('scheduled_start', { ascending: false, nullsFirst: false })),
        safe(client.from('customer_estimates').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('finance_invoices').select('*').eq('customer_id', id).order('invoice_date', { ascending: false })),
        safe(client.from('finance_payments').select('*').eq('customer_id', id).order('payment_date', { ascending: false })),
        safe(client.from('customer_agreements').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
        safe(client.from('customer_photos').select('*').eq('contact_id', id).order('created_at', { ascending: false })),
      ]);
      setProjects(pr); setJobs(jb); setEstimates(es); setInvoices(inv); setPayments(pay); setAgreements(ag); setPhotos(ph);
    } catch (e) {
      console.error('Error loading customer:', e);
      toast.error('Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const name = customer ? (customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer') : '';

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
          <Button onClick={() => setTab('details')} className="bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-2"><Pencil size={16} /> Edit</Button>
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
              <Field label="Last Name"><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
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
          <ListTable empty="No projects for this customer." cols={['Project', 'Type', 'Status', 'City', 'Value', 'Progress']}
            rows={projects.map(p => [p.title, p.project_type, <Badge className={`${statusTone(p.status)} text-xs`}>{p.status}</Badge>, [p.job_city, p.job_state].filter(Boolean).join(', '), money(p.estimated_value), (p.completion_percentage || 0) + '%'])} />
        )}

        {tab === 'jobs' && (
          <ListTable empty="No jobs for this customer." cols={['Job', 'WO #', 'Status', 'Priority', 'Scheduled', 'Value']}
            rows={jobs.map(j => [j.title || 'Untitled', j.work_order_number, <Badge className={`${statusTone(j.status)} text-xs`}>{j.status}</Badge>, j.priority, date(j.scheduled_start), money(j.estimated_cost)])} />
        )}

        {tab === 'estimates' && (
          <ListTable empty="No estimates for this customer." cols={['Estimate #', 'Title', 'Status', 'Total', 'Valid Until', 'Created']}
            rows={estimates.map(e => [e.estimate_number, e.title, <Badge className={`${statusTone(e.status)} text-xs`}>{e.status}</Badge>, money(e.total), date(e.valid_until), date(e.created_at)])} />
        )}

        {tab === 'invoices' && (
          <div className="space-y-6">
            <ListTable empty="No invoices for this customer." cols={['Invoice #', 'Date', 'Due', 'Status', 'Total', 'Paid', 'Balance']}
              rows={invoices.map(i => [i.invoice_number, date(i.invoice_date), date(i.due_date), <Badge className={`${statusTone(i.status)} text-xs`}>{i.status}</Badge>, money(i.total_amount), money(i.amount_paid), money(i.balance_due)])} />
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Payments</h3>
              <ListTable empty="No payments recorded." cols={['Payment #', 'Date', 'Method', 'Status', 'Amount']}
                rows={payments.map(p => [p.payment_number, date(p.payment_date), p.payment_method, <Badge className={`${statusTone(p.status)} text-xs`}>{p.status}</Badge>, money(p.amount)])} />
            </div>
          </div>
        )}

        {tab === 'agreements' && (
          <ListTable empty="No agreements for this customer." cols={['Agreement #', 'Title', 'Type', 'Status', 'Value', 'Start', 'End']}
            rows={agreements.map(a => [a.agreement_number, a.title, a.agreement_type, <Badge className={`${statusTone(a.status)} text-xs`}>{a.status}</Badge>, money(a.total_value), date(a.start_date), date(a.end_date)])} />
        )}

        {tab === 'documents' && (
          <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">
            Documents are coming soon - a per-customer file library (contracts, permits, etc.) with upload to the tenant's storage.
          </Card>
        )}

        {tab === 'photos' && (
          photos.length === 0 ? (
            <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No photos for this customer yet.</Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map(p => (
                <div key={p.id} className="bg-navy-900 border border-navy-800 rounded-lg overflow-hidden">
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

function Field({ label, full, children }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-400 mb-2">{label}</label>
      {children}
    </div>
  );
}

function ListTable({ cols, rows, empty }) {
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
              <tr key={ri} className="border-b border-navy-800 hover:bg-navy-800/50 transition">
                {r.map((cell, ci) => <td key={ci} className={`px-4 py-3 ${ci >= r.length - 1 ? 'text-right text-white font-medium' : 'text-gray-300'}`}>{cell || '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
