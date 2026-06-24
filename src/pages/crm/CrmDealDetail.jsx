import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, Plus, Download, FileText, Upload, MessageSquare, CheckCircle2, Circle, Trash2, DollarSign, Send, Mail, Phone, StickyNote, X, Layers } from 'lucide-react';
import { toast } from 'sonner';
import CrmMeasure from './operations/CrmMeasure';
import CustomerPhotos from '../../components/crm/CustomerPhotos';
import { supabase as mainClient } from '../../lib/supabase';

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
const genInvoiceNumber = () => 'INV-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 899);
const genPaymentNumber = () => 'PMT-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 899);
const rid = () => Math.random().toString(36).slice(2, 10);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

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

// Job Details dropdown options
const JOB_TYPES = ['Repair', 'Full Replacement', 'New Construction', 'Inspection', 'Maintenance', 'Insurance Claim', 'Gutters'];
const ROOF_TYPES = ['Asphalt Shingle', 'Metal', 'Tile', 'Flat / TPO', 'Flat / EPDM', 'Cedar Shake', 'Slate', 'Modified Bitumen'];
const PITCHES = ['Flat', 'Low Slope', '3/12', '4/12', '5/12', '6/12', '7/12', '8/12', '9/12', '10/12', '11/12', '12/12+'];
const MANUFACTURERS = ['GAF', 'Owens Corning', 'CertainTeed', 'IKO', 'Atlas', 'TAMKO', 'Malarkey'];

// datetime-local <-> ISO helpers
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CrmDealDetail() {
  const { platformId, id } = useParams();
  const navigate = useNavigate();
  const { client, platform } = useCrmClient();
  const isRoofing = String((platform && platform.industry) || '').toLowerCase().includes('roof');

  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState(null);
  const [contact, setContact] = useState(null);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState(null);
  const [contactForm, setContactForm] = useState(null);
  const [stages, setStages] = useState([]);
  const [measSub, setMeasSub] = useState('saved');
  const [reportRequests, setReportRequests] = useState([]);
  const [reqForm, setReqForm] = useState(null);
  const [reqSubmitting, setReqSubmitting] = useState(false);
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
  const [payments, setPayments] = useState({});         // { [invoiceId]: [payment rows] }

  // Finance tab UI state
  const [invEditor, setInvEditor] = useState(null);     // editing/new invoice draft object | null
  const [invSaving, setInvSaving] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [payFor, setPayFor] = useState(null);           // invoice we are recording a payment on | null

  // Communications tab UI state
  const [activeConv, setActiveConv] = useState(null);   // selected conversation | null
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [newConvOpen, setNewConvOpen] = useState(false);

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
      const c = data.customer_contacts || null;
      setContact(c);
      setForm({
        title: data.title || '', description: data.description || '',
        stage: data.stage || '', deal_value: data.deal_value ?? '',
        probability: data.probability ?? 50, lead_temperature: data.lead_temperature || 'warm',
        service_type: data.service_type || '',
        expected_close_date: data.expected_close_date || '', assigned_to: data.assigned_to || '',
        tags: (data.tags || []).join(', '), notes: data.notes || '',
        job_address: data.job_address || '', job_type: data.job_type || '',
        roof_type: data.roof_type || '', sq_count: data.sq_count ?? '', pitch: data.pitch || '',
        initial_appointment_at: toLocalInput(data.initial_appointment_at),
        follow_up_appointment_at: toLocalInput(data.follow_up_appointment_at),
        install_date: data.install_date || '', project_manager: data.project_manager || '',
        gate_instructions: data.gate_instructions || '', property_stories: data.property_stories || '', appointment_notes: data.appointment_notes || '',
        material_manufacturer: data.material_manufacturer || '', material_color: data.material_color || '', layers_to_tear_off: data.layers_to_tear_off || '',
        decking_type: data.decking_type || '', ventilation_type: data.ventilation_type || '', gutters_notes: data.gutters_notes || '',
        site_access_notes: data.site_access_notes || '', skylights_chimneys: data.skylights_chimneys || '', drip_edge_color: data.drip_edge_color || '',
        inspection_date: data.inspection_date || '', coc_date: data.coc_date || '', closed_date: data.closed_date || '',
        job_foreman: data.job_foreman || '', crew_name: data.crew_name || '',
        public_adjuster_name: data.public_adjuster_name || '', public_adjuster_contact: data.public_adjuster_contact || '', public_adjuster_phone: data.public_adjuster_phone || '', public_adjuster_email: data.public_adjuster_email || '',
        default_estimate_id: data.default_estimate_id || '',
        insurance_carrier: data.insurance_carrier || '', claim_number: data.claim_number || '',
        policy_number: data.policy_number || '', date_of_loss: data.date_of_loss || '',
        adjuster_name: data.adjuster_name || '', adjuster_phone: data.adjuster_phone || '',
        adjuster_email: data.adjuster_email || '',
        claim_amount: data.claim_amount ?? '', deductible: data.deductible ?? '',
      });
      setContactForm({
        first_name: (c && c.first_name) || '', last_name: (c && c.last_name) || '',
        email: (c && c.email) || '', phone: (c && c.phone) || '',
      });
      const _addr = data.job_address || (c ? [c.property_address, c.property_city, c.property_state, c.property_zip].filter(Boolean).join(', ') : '');
      setReqForm({ address: _addr, lat: null, lng: null, located: false, confirmed: false, title: data.title || '', waste: '10', manufacturer: data.material_manufacturer || '', color: data.material_color || '', want3d: true, structures: [] });
      loadReportRequests();
      loadStages(data.pipeline_definition_id);
      client.from('org_team_members').select('user_id, first_name, last_name, role').not('user_id', 'is', null)
        .then(({ data: tm }) => setTeam(tm || [])).catch(() => {});
    } catch (e) {
      console.error('Error loading deal:', e);
      toast.error('Failed to load deal');
    } finally {
      setLoading(false);
    }
  }

  // Load stage options for this deal's pipeline (falls back to the default pipeline).
  async function loadStages(pdid) {
    try {
      let pid = pdid;
      if (!pid) {
        const { data: defs } = await client.from('pipeline_definitions').select('id, is_default').order('is_default', { ascending: false }).limit(1);
        pid = defs && defs[0] ? defs[0].id : null;
      }
      if (!pid) { setStages([]); return; }
      const { data: sd } = await client.from('pipeline_stage_definitions').select('key, label, stage_order').eq('pipeline_id', pid).order('stage_order', { ascending: true });
      setStages(sd || []);
    } catch { setStages([]); }
  }

  async function loadReportRequests() {
    try { const { data } = await mainClient.from('roof_report_requests').select('*').eq('pipeline_id', id).order('requested_at', { ascending: false }); setReportRequests(data || []); } catch { setReportRequests([]); }
  }

  async function geocodeReqAddress() {
    if (!reqForm || !reqForm.address) { toast.error('Enter an address first'); return; }
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(reqForm.address));
      const j = await r.json();
      if (j && j[0]) { setReqForm(f => ({ ...f, lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), located: true, confirmed: false, geoV: (f.geoV || 0) + 1, address: j[0].display_name || f.address })); toast.success('Location found - drag the pin onto the house'); }
      else toast.error('Address not found');
    } catch { toast.error('Location lookup failed'); }
  }

  async function submitReportRequest() {
    if (!reqForm) return;
    if (!reqForm.located || !reqForm.confirmed) { toast.error('Find and confirm the property location first'); return; }
    try {
      setReqSubmitting(true);
      const structures = (reqForm.structures || []).filter(st => st && st.name && st.name.trim());
      const { error } = await mainClient.from('roof_report_requests').insert({
        platform_id: platformId, platform_name: (platform && platform.client_name) || null, tenant_ref: (platform && platform.supabase_project_id) || null,
        pipeline_id: id, contact_id: deal.contact_id || null,
        title: reqForm.title || deal.title || null, customer_name: contact ? contactLabel(contact) : null,
        property_address: reqForm.address || null, lat: reqForm.lat, lng: reqForm.lng,
        waste_factor: parseFloat(reqForm.waste) || null, secondary_structures: structures,
        material_manufacturer: reqForm.manufacturer || null, desired_roof_color: reqForm.color || null, want_3d_render: !!reqForm.want3d,
        status: 'pending', price_cents: 1500,
      });
      if (error) throw error;
      toast.success('Report requested - pending (6-hour turnaround)');
      await loadReportRequests();
      setMeasSub('saved');
    } catch (e) { console.error(e); toast.error('Could not submit request'); } finally { setReqSubmitting(false); }
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
        await loadFinance();
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
    if (tabKey === 'finance') await loadFinance();
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
        lead_temperature: form.lead_temperature,
        job_address: form.job_address || null, job_type: form.job_type || null,
        roof_type: form.roof_type || null, pitch: form.pitch || null,
        sq_count: form.sq_count === '' || form.sq_count == null ? null : parseFloat(form.sq_count),
        initial_appointment_at: form.initial_appointment_at ? new Date(form.initial_appointment_at).toISOString() : null,
        follow_up_appointment_at: form.follow_up_appointment_at ? new Date(form.follow_up_appointment_at).toISOString() : null,
        install_date: form.install_date || null,
        gate_instructions: form.gate_instructions || null, property_stories: form.property_stories || null, appointment_notes: form.appointment_notes || null,
        material_manufacturer: form.material_manufacturer || null, material_color: form.material_color || null, layers_to_tear_off: form.layers_to_tear_off || null,
        decking_type: form.decking_type || null, ventilation_type: form.ventilation_type || null, gutters_notes: form.gutters_notes || null,
        site_access_notes: form.site_access_notes || null, skylights_chimneys: form.skylights_chimneys || null, drip_edge_color: form.drip_edge_color || null,
        inspection_date: form.inspection_date || null, coc_date: form.coc_date || null, closed_date: form.closed_date || null,
        job_foreman: form.job_foreman || null, crew_name: form.crew_name || null,
        public_adjuster_name: form.public_adjuster_name || null, public_adjuster_contact: form.public_adjuster_contact || null, public_adjuster_phone: form.public_adjuster_phone || null, public_adjuster_email: form.public_adjuster_email || null,
        expected_close_date: form.expected_close_date || null,
        assigned_to: form.assigned_to || null, project_manager: form.project_manager || null,
        insurance_carrier: form.insurance_carrier || null, claim_number: form.claim_number || null,
        policy_number: form.policy_number || null, date_of_loss: form.date_of_loss || null,
        adjuster_name: form.adjuster_name || null, adjuster_phone: form.adjuster_phone || null,
        adjuster_email: form.adjuster_email || null,
        claim_amount: form.claim_amount === '' || form.claim_amount == null ? null : parseFloat(form.claim_amount),
        deductible: form.deductible === '' || form.deductible == null ? null : parseFloat(form.deductible),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
      };
      const { error } = await client.from('customer_pipeline').update(patch).eq('id', id);
      if (error) throw error;
      if (contactForm && deal && deal.contact_id) {
        const cpatch = {
          first_name: contactForm.first_name || null, last_name: contactForm.last_name || null,
          email: contactForm.email || null, phone: contactForm.phone || null,
          updated_at: new Date().toISOString(),
        };
        const { error: cerr } = await client.from('customer_contacts').update(cpatch).eq('id', deal.contact_id);
        if (cerr) throw cerr;
        setContact(prev => (prev ? { ...prev, ...cpatch } : prev));
      }
      setDeal(prev => (prev ? { ...prev, ...patch } : prev));
      toast.success('Deal updated');
      loadDeal();
    } catch (e) { console.error(e); toast.error('Save failed'); } finally { setSaving(false); }
  }

  // ---- Estimates: mark one estimate as the job's default (drives Job Value) ----
  async function setDefaultEstimate(est) {
    try {
      const turningOff = !!est.is_default;
      // Only one default per job: clear all first.
      await client.from('customer_estimates').update({ is_default: false }).eq('pipeline_id', id);
      if (turningOff) {
        await client.from('customer_pipeline').update({ default_estimate_id: null, updated_at: new Date().toISOString() }).eq('id', id);
        setForm(f => (f ? { ...f, default_estimate_id: '' } : f));
        setDeal(d => (d ? { ...d, default_estimate_id: null } : d));
        toast.success('Default estimate cleared');
      } else {
        await client.from('customer_estimates').update({ is_default: true }).eq('id', est.id);
        const total = Number(est.total) || 0;
        await client.from('customer_pipeline').update({ default_estimate_id: est.id, deal_value: total, updated_at: new Date().toISOString() }).eq('id', id);
        setForm(f => (f ? { ...f, default_estimate_id: est.id, deal_value: total } : f));
        setDeal(d => (d ? { ...d, default_estimate_id: est.id, deal_value: total } : d));
        toast.success('Set as default estimate - Job Value updated');
      }
      reload('estimates');
    } catch (e) { console.error(e); toast.error('Could not update default estimate'); }
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

  // ---- Finance: per-job invoice builder (all scoped pipeline_id = id) ----
  async function loadFinance() {
    const safe = (p) => p.then(r => r.data || []).catch(() => []);
    const inv = await safe(client.from('finance_invoices').select('*').eq('pipeline_id', id).order('invoice_date', { ascending: false }));
    setInvoices(inv);
    const ids = inv.map(i => i.id).filter(Boolean);
    if (ids.length) {
      const pays = await safe(client.from('finance_payments').select('*').in('invoice_id', ids).order('payment_date', { ascending: false }));
      const byInv = {};
      pays.forEach(p => { (byInv[p.invoice_id] = byInv[p.invoice_id] || []).push(p); });
      setPayments(byInv);
    } else {
      setPayments({});
    }
  }

  function blankInvoice() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: null, invoice_number: genInvoiceNumber(),
      invoice_date: today, due_date: today, status: 'draft',
      line_items: [{ _k: rid(), description: '', qty: 1, unit_price: 0, amount: 0 }],
      tax_rate: 0, amount_paid: 0, notes: deal.title || '', terms: '',
    };
  }

  function openInvoiceEditor(inv) {
    if (!inv) { setInvEditor(blankInvoice()); return; }
    const items = Array.isArray(inv.line_items) && inv.line_items.length
      ? inv.line_items.map(li => ({ _k: rid(), description: li.description || li.name || '', qty: num(li.qty ?? li.quantity ?? 1), unit_price: num(li.unit_price), amount: num(li.amount) }))
      : [{ _k: rid(), description: '', qty: 1, unit_price: 0, amount: 0 }];
    setInvEditor({
      id: inv.id, invoice_number: inv.invoice_number || genInvoiceNumber(),
      invoice_date: (inv.invoice_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      due_date: (inv.due_date || '').slice(0, 10) || '', status: inv.status || 'draft',
      line_items: items, tax_rate: num(inv.tax_rate), amount_paid: num(inv.amount_paid),
      notes: inv.notes || '', terms: inv.terms || '',
    });
  }

  function invTotals(ed) {
    const items = (ed.line_items || []).map(li => ({ ...li, amount: round2(num(li.qty) * num(li.unit_price)) }));
    const subtotal = round2(items.reduce((s, li) => s + li.amount, 0));
    const tax_amount = round2(subtotal * (num(ed.tax_rate) / 100));
    const total_amount = round2(subtotal + tax_amount);
    const balance_due = round2(total_amount - num(ed.amount_paid));
    return { items, subtotal, tax_amount, total_amount, balance_due };
  }

  async function saveInvoice() {
    if (!invEditor) return;
    setInvSaving(true);
    try {
      const t = invTotals(invEditor);
      const line_items = t.items.map(({ _k, ...li }) => li);
      const row = {
        invoice_number: invEditor.invoice_number,
        customer_id: deal.contact_id || null,
        customer_name: contact ? contactLabel(contact) : null,
        pipeline_id: id, project_name: deal.title || null,
        invoice_date: invEditor.invoice_date || null,
        due_date: invEditor.due_date || null,
        status: invEditor.status || 'draft',
        line_items, subtotal: t.subtotal, tax_rate: num(invEditor.tax_rate),
        tax_amount: t.tax_amount, total_amount: t.total_amount,
        amount_paid: num(invEditor.amount_paid), balance_due: t.balance_due,
        notes: invEditor.notes || null, terms: invEditor.terms || null,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (invEditor.id) {
        ({ error } = await client.from('finance_invoices').update(row).eq('id', invEditor.id));
      } else {
        ({ error } = await client.from('finance_invoices').insert(row));
      }
      if (error) throw error;
      toast.success(invEditor.id ? 'Invoice updated' : 'Invoice created');
      setInvEditor(null);
      await loadFinance();
    } catch (e) { console.error(e); toast.error('Could not save invoice'); }
    finally { setInvSaving(false); }
  }

  async function generateMilestones(splits, baseAmount) {
    try {
      const total = num(baseAmount);
      const today = new Date().toISOString().slice(0, 10);
      const rows = (splits || []).filter(sp => num(sp.pct) > 0).map(sp => {
        const amount = round2(total * (num(sp.pct) / 100));
        return {
          invoice_number: genInvoiceNumber(),
          customer_id: deal.contact_id || null,
          customer_name: contact ? contactLabel(contact) : null,
          pipeline_id: id, project_name: deal.title || null,
          invoice_date: today, due_date: today, status: 'draft',
          line_items: [{ description: `${sp.label} - ${deal.title || 'job'}`, qty: 1, unit_price: amount, amount }],
          subtotal: amount, tax_rate: 0, tax_amount: 0, total_amount: amount,
          amount_paid: 0, balance_due: amount, terms: `${sp.label} (${sp.pct}%)`,
          notes: deal.title || null,
        };
      });
      if (!rows.length) { toast.error('Add at least one milestone with a percent.'); return; }
      const { error } = await client.from('finance_invoices').insert(rows);
      if (error) throw error;
      toast.success(rows.length + ' draft invoices created');
      setMilestoneOpen(false);
      await loadFinance();
    } catch (e) { console.error(e); toast.error('Could not generate milestones'); }
  }

  async function recordPayment(invoice, { amount, payment_method, payment_date, reference_number, notes }) {
    try {
      const payAmt = num(amount);
      if (payAmt <= 0) { toast.error('Enter a payment amount.'); return; }
      const payRow = {
        payment_number: genPaymentNumber(), invoice_id: invoice.id,
        customer_id: invoice.customer_id || deal.contact_id || null,
        customer_name: invoice.customer_name || (contact ? contactLabel(contact) : null),
        amount: payAmt, payment_date: payment_date || new Date().toISOString().slice(0, 10),
        payment_method: payment_method || 'card', reference_number: reference_number || null,
        status: 'completed', notes: notes || null,
      };
      const { error: pe } = await client.from('finance_payments').insert(payRow);
      if (pe) throw pe;
      const newPaid = round2(num(invoice.amount_paid) + payAmt);
      const newBalance = round2(Math.max(0, num(invoice.total_amount) - newPaid));
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';
      const { error: ie } = await client.from('finance_invoices')
        .update({ amount_paid: newPaid, balance_due: newBalance, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', invoice.id);
      if (ie) throw ie;
      toast.success('Payment recorded');
      setPayFor(null);
      await loadFinance();
    } catch (e) { console.error(e); toast.error('Could not record payment'); }
  }

  // ---- Communications: per-job conversation threads (scoped pipeline_id = id) ----
  async function openConversation(conv) {
    setActiveConv(conv);
    setMsgDraft('');
    setMsgLoading(true);
    try {
      const { data } = await client.from('comms_messages').select('*')
        .eq('conversation_id', conv.id).order('created_at', { ascending: true });
      setMessages(data || []);
    } catch (e) { console.error(e); setMessages([]); }
    finally { setMsgLoading(false); }
  }

  async function sendMessage() {
    if (!activeConv || !msgDraft.trim()) return;
    const body = msgDraft.trim();
    try {
      const { data, error } = await client.from('comms_messages').insert({
        conversation_id: activeConv.id, channel_type: activeConv.channel_type || 'note',
        direction: 'outbound', sender_type: 'user', sender_name: 'You', body,
      }).select().single();
      if (error) throw error;
      setMessages(prev => [...prev, data]);
      setMsgDraft('');
      const nowIso = new Date().toISOString();
      await client.from('comms_conversations').update({
        last_message_at: nowIso, last_message_preview: body.slice(0, 120), updated_at: nowIso,
      }).eq('id', activeConv.id);
      setConversations(prev => prev.map(c => c.id === activeConv.id
        ? { ...c, last_message_at: nowIso, last_message_preview: body.slice(0, 120) } : c));
    } catch (e) { console.error(e); toast.error('Could not send message'); }
  }

  async function createConversation({ channel_type, subject }) {
    try {
      const { data, error } = await client.from('comms_conversations').insert({
        channel_type: channel_type || 'note', subject: subject || (deal.title || 'Job conversation'),
        status: 'open', contact_id: deal.contact_id || null,
        contact_name: contact ? contactLabel(contact) : null,
        contact_email: contact?.email || null, contact_phone: contact?.phone || null,
        pipeline_id: id, unread_count: 0, last_message_at: new Date().toISOString(),
        last_message_preview: '', is_starred: false,
      }).select().single();
      if (error) throw error;
      setNewConvOpen(false);
      await reload('communications');
      if (data) openConversation(data);
      toast.success('Conversation started');
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
                {(deal.job_type || deal.service_type) && <span>- {deal.job_type || deal.service_type}</span>}
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
          {TABS.filter(t => t.key !== 'measurements' || isRoofing).map(t => (
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
                <KV k="Job Type" v={deal.job_type || deal.service_type} />
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
                  {isRoofing && <QuickLink label="Measurements" onClick={() => setTab('measurements')} />}
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
          <div className="space-y-5">
            {/* Top line: Job Title + Stage + Lead Temp */}
            <SectionCard title="Job">
              <Field label="Job Title" full><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Stage">
                <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">-</option>
                  {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  {form.stage && !stages.some(s => s.key === form.stage) && <option value={form.stage}>{form.stage}</option>}
                </select>
              </Field>
              <Field label="Lead Temperature">
                <select value={form.lead_temperature} onChange={e => setForm({ ...form, lead_temperature: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  {['cold', 'warm', 'hot'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </SectionCard>

            {/* Customer */}
            <SectionCard title="Customer">
              <Field label="First Name"><Input value={contactForm?.first_name || ''} onChange={e => setContactForm({ ...contactForm, first_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Last Name"><Input value={contactForm?.last_name || ''} onChange={e => setContactForm({ ...contactForm, last_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Phone"><Input value={contactForm?.phone || ''} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Email"><Input type="email" value={contactForm?.email || ''} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
            </SectionCard>

            {/* Job Details */}
            <SectionCard title="Job Details">
              <Field label="Job Address" full><AddressAutocomplete value={form.job_address} onChange={v => setForm({ ...form, job_address: v })} placeholder={contact ? [contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(', ') : 'Start typing an address...'} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Job Type">
                <select value={form.job_type} onChange={e => setForm({ ...form, job_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">-</option>
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  {form.job_type && !JOB_TYPES.includes(form.job_type) && <option value={form.job_type}>{form.job_type}</option>}
                </select>
              </Field>
              <Field label="Stories">
                <select value={form.property_stories} onChange={e => setForm({ ...form, property_stories: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">-</option>
                  {['1', '2', '3', '4+'].map(t => <option key={t} value={t}>{t}</option>)}
                  {form.property_stories && !['1', '2', '3', '4+'].includes(form.property_stories) && <option value={form.property_stories}>{form.property_stories}</option>}
                </select>
              </Field>
              {isRoofing && (
                <Field label="Roof Type">
                  <select value={form.roof_type} onChange={e => setForm({ ...form, roof_type: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                    <option value="">-</option>
                    {ROOF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    {form.roof_type && !ROOF_TYPES.includes(form.roof_type) && <option value={form.roof_type}>{form.roof_type}</option>}
                  </select>
                </Field>
              )}
              {isRoofing && (
                <Field label="Predominant Pitch">
                  <select value={form.pitch} onChange={e => setForm({ ...form, pitch: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                    <option value="">-</option>
                    {PITCHES.map(t => <option key={t} value={t}>{t}</option>)}
                    {form.pitch && !PITCHES.includes(form.pitch) && <option value={form.pitch}>{form.pitch}</option>}
                  </select>
                </Field>
              )}
              {isRoofing && (
                <Field label="Sq Count"><Input type="number" value={form.sq_count} onChange={e => setForm({ ...form, sq_count: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Layers to Tear Off"><Input value={form.layers_to_tear_off} onChange={e => setForm({ ...form, layers_to_tear_off: e.target.value })} placeholder="e.g. 1, 2, unknown" className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Material Manufacturer">
                  <select value={form.material_manufacturer} onChange={e => setForm({ ...form, material_manufacturer: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                    <option value="">-</option>
                    {MANUFACTURERS.map(t => <option key={t} value={t}>{t}</option>)}
                    {form.material_manufacturer && !MANUFACTURERS.includes(form.material_manufacturer) && <option value={form.material_manufacturer}>{form.material_manufacturer}</option>}
                  </select>
                </Field>
              )}
              {isRoofing && (
                <Field label="Color"><Input value={form.material_color} onChange={e => setForm({ ...form, material_color: e.target.value })} placeholder="Shingle color" className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Decking Type / Condition"><Input value={form.decking_type} onChange={e => setForm({ ...form, decking_type: e.target.value })} placeholder="Plywood / plank, re-deck?" className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Ventilation Type"><Input value={form.ventilation_type} onChange={e => setForm({ ...form, ventilation_type: e.target.value })} placeholder="Ridge vent, turbines, box, etc." className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Drip Edge Color"><Input value={form.drip_edge_color} onChange={e => setForm({ ...form, drip_edge_color: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Gutters (size / color / guards)"><Input value={form.gutters_notes} onChange={e => setForm({ ...form, gutters_notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              {isRoofing && (
                <Field label="Skylights / Chimneys"><Input value={form.skylights_chimneys} onChange={e => setForm({ ...form, skylights_chimneys: e.target.value })} placeholder="Counts / notes" className="bg-navy-800 border-navy-700 text-white" /></Field>
              )}
              <Field label="Job Value">
                {form.default_estimate_id ? (
                  <div className="flex items-center justify-between gap-2 bg-navy-800 border border-navy-700 rounded px-3 py-2">
                    <span className="text-white font-medium">{money(form.deal_value)}</span>
                    <button type="button" onClick={() => setTab('estimates')} className="text-xs text-brand-blue hover:text-brand-cyan">from default estimate</button>
                  </div>
                ) : (
                  <div>
                    <Input type="number" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })} className="bg-navy-800 border-navy-700 text-white" />
                    <p className="text-xs text-gray-500 mt-1">Mark an estimate as default in the Estimates tab to auto-fill this.</p>
                  </div>
                )}
              </Field>
              <Field label="Dumpster & Site Access Notes" full><Textarea value={form.site_access_notes} onChange={e => setForm({ ...form, site_access_notes: e.target.value })} placeholder="Driveway, material drop spot, dumpster placement" className="bg-navy-800 border-navy-700 text-white min-h-20" /></Field>
            </SectionCard>

            {/* Appointments */}
            <SectionCard title="Appointments">
              <Field label="Initial Appointment"><Input type="datetime-local" value={form.initial_appointment_at} onChange={e => setForm({ ...form, initial_appointment_at: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Follow Up Appointment"><Input type="datetime-local" value={form.follow_up_appointment_at} onChange={e => setForm({ ...form, follow_up_appointment_at: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Estimated Close Date"><Input type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Install Date"><Input type="date" value={form.install_date} onChange={e => setForm({ ...form, install_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Town Inspection Date"><Input type="date" value={form.inspection_date} onChange={e => setForm({ ...form, inspection_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="COC Date"><Input type="date" value={form.coc_date} onChange={e => setForm({ ...form, coc_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Closed Date"><Input type="date" value={form.closed_date} onChange={e => setForm({ ...form, closed_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
            </SectionCard>

            {/* Initial Appointment Instructions */}
            <SectionCard title="Initial Appointment Instructions">
              <Field label="Gate Instructions" full><Input value={form.gate_instructions} onChange={e => setForm({ ...form, gate_instructions: e.target.value })} placeholder="Gate code, access notes, etc." className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Property Stories">
                <select value={form.property_stories} onChange={e => setForm({ ...form, property_stories: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">-</option>
                  {['1', '2', '3', '4+'].map(t => <option key={t} value={t}>{t}</option>)}
                  {form.property_stories && !['1', '2', '3', '4+'].includes(form.property_stories) && <option value={form.property_stories}>{form.property_stories}</option>}
                </select>
              </Field>
              <Field label="Appointment Notes" full><Textarea value={form.appointment_notes} onChange={e => setForm({ ...form, appointment_notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-24" /></Field>
            </SectionCard>

            {/* Assigned */}
            <SectionCard title="Assigned">
              <Field label="Sales Rep">
                <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.user_id} value={m.user_id}>{`${m.first_name || ''} ${m.last_name || ''}`.trim()}{m.role ? ` - ${m.role}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Project Manager">
                <select value={form.project_manager} onChange={e => setForm({ ...form, project_manager: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.user_id} value={m.user_id}>{`${m.first_name || ''} ${m.last_name || ''}`.trim()}{m.role ? ` - ${m.role}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Job Foreman">
                <select value={form.job_foreman} onChange={e => setForm({ ...form, job_foreman: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  <option value="">Unassigned</option>
                  {team.map(m => <option key={m.user_id} value={m.user_id}>{((m.first_name || '') + ' ' + (m.last_name || '')).trim()}{m.role ? ' - ' + m.role : ''}</option>)}
                </select>
              </Field>
              <Field label="Crew"><Input value={form.crew_name} onChange={e => setForm({ ...form, crew_name: e.target.value })} placeholder="Crew name / assignment" className="bg-navy-800 border-navy-700 text-white" /></Field>
            </SectionCard>

            {/* Insurance Claim Information */}
            <SectionCard title="Insurance Claim Information">
              <Field label="Insurance Carrier"><Input value={form.insurance_carrier} onChange={e => setForm({ ...form, insurance_carrier: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Claim Number"><Input value={form.claim_number} onChange={e => setForm({ ...form, claim_number: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Policy Number"><Input value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Date of Loss"><Input type="date" value={form.date_of_loss} onChange={e => setForm({ ...form, date_of_loss: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Adjuster Name"><Input value={form.adjuster_name} onChange={e => setForm({ ...form, adjuster_name: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Adjuster Phone"><Input value={form.adjuster_phone} onChange={e => setForm({ ...form, adjuster_phone: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Adjuster Email"><Input type="email" value={form.adjuster_email} onChange={e => setForm({ ...form, adjuster_email: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Claim Amount ($)"><Input type="number" value={form.claim_amount} onChange={e => setForm({ ...form, claim_amount: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Deductible ($)"><Input type="number" value={form.deductible} onChange={e => setForm({ ...form, deductible: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Public Adjuster"><Input value={form.public_adjuster_name} onChange={e => setForm({ ...form, public_adjuster_name: e.target.value })} placeholder="Firm / adjuster assigned" className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Public Adjuster Contact"><Input value={form.public_adjuster_contact} onChange={e => setForm({ ...form, public_adjuster_contact: e.target.value })} placeholder="Contact name" className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Public Adjuster Phone"><Input value={form.public_adjuster_phone} onChange={e => setForm({ ...form, public_adjuster_phone: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Public Adjuster Email"><Input type="email" value={form.public_adjuster_email} onChange={e => setForm({ ...form, public_adjuster_email: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
            </SectionCard>

            {/* Additional */}
            <SectionCard title="Additional">
              <Field label="Description" full><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-24" /></Field>
              <Field label="Tags (comma separated)" full><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
              <Field label="Notes" full><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-24" /></Field>
            </SectionCard>

            <div className="flex justify-end">
              <Button onClick={saveDetails} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </div>
        )}

        {/* MEASUREMENTS - sub-tabs: Saved Reports / Roof Measure / Request Report / Integrations */}
        {tab === 'measurements' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1 border-b border-navy-800 overflow-x-auto">
              {[['saved', 'Saved Reports'], ['measure', 'Roof Measure'], ['request', 'Request Report'], ['integrations', 'Integrations']].map(([k, label]) => (
                <button key={k} onClick={() => setMeasSub(k)} className={'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ' + (measSub === k ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white')}>{label}</button>
              ))}
            </div>

            {measSub === 'measure' && (
              <Card className="bg-navy-900 border-navy-800 p-4">
                <CrmMeasure embedded lockedContactId={deal.contact_id || null} lockedContactLabel={lockedLabel} pipelineId={id} initialAddress={form.job_address || (contact ? [contact.property_address, contact.property_city, contact.property_state, contact.property_zip].filter(Boolean).join(", ") : "")} initialTitle={form.title || ""} />
              </Card>
            )}

            {measSub === 'saved' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Liftori Reports</h3>
                  <ListTable empty="No Liftori report requests for this job yet. Use Request Report to order one."
                    cols={['Title', 'Color', 'Status', 'Requested', 'Due / Delivered', 'Report']}
                    rows={reportRequests.map(r => [
                      r.title || '-',
                      [r.material_manufacturer, r.desired_roof_color].filter(Boolean).join(' / ') || '-',
                      <Badge className={statusTone(r.status) + ' text-xs'}>{r.status}</Badge>,
                      date(r.requested_at),
                      r.delivered_at ? date(r.delivered_at) : date(r.due_at),
                      r.report_url ? <a href={r.report_url} target="_blank" rel="noreferrer" className="text-brand-blue hover:text-brand-cyan">Open</a> : '-',
                    ])} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Roof Measure Saves</h3>
                  <ListTable empty="No saved roof measurements for this job yet."
                    cols={['Title', 'Saved', 'Open']}
                    rows={measurements.map(m => [
                      (m.measurements && m.measurements.title) || m.template_type || 'Roof measurement',
                      date(m.created_at),
                      <button onClick={() => setMeasSub('measure')} className="text-brand-blue hover:text-brand-cyan">View</button>,
                    ])} />
                </div>
              </div>
            )}

            {measSub === 'request' && reqForm && (
              <Card className="bg-navy-900 border-navy-800 p-6 max-w-3xl space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Request Roof Report</h3>
                  <p className="text-sm text-gray-400 mt-1">Liftori-generated roof report. $15 per report, 6-hour turnaround. Optional 3D render of the home in the selected roof color.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Property Address" full>
                    <div className="flex gap-2">
                      <Input value={reqForm.address} onChange={e => setReqForm(f => ({ ...f, address: e.target.value, located: false, confirmed: false }))} className="bg-navy-800 border-navy-700 text-white flex-1" />
                      <Button onClick={geocodeReqAddress} className="bg-navy-700 hover:bg-navy-600 text-white whitespace-nowrap">Find</Button>
                    </div>
                    {reqForm.located && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-400">Drag the pin (or click the map) onto the correct roof - the report is built on this exact spot.</p>
                        <RequestMap key={'reqmap-' + (reqForm.geoV || 0)} lat={reqForm.lat} lng={reqForm.lng} onMove={(la, ln) => setReqForm(f => ({ ...f, lat: la, lng: ln }))} />
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input type="checkbox" checked={!!reqForm.confirmed} onChange={e => setReqForm(f => ({ ...f, confirmed: e.target.checked }))} />
                          Pin is on the correct house ({reqForm.lat != null ? reqForm.lat.toFixed(5) : '?'}, {reqForm.lng != null ? reqForm.lng.toFixed(5) : '?'})
                        </label>
                      </div>
                    )}
                  </Field>
                  <Field label="Measurement Title"><Input value={reqForm.title} onChange={e => setReqForm(f => ({ ...f, title: e.target.value }))} className="bg-navy-800 border-navy-700 text-white" /></Field>
                  <Field label="Linked Customer"><Input value={contact ? contactLabel(contact) : ''} disabled className="bg-navy-800 border-navy-700 text-gray-400" /></Field>
                  <Field label="Waste Factor (%)"><Input type="number" value={reqForm.waste} onChange={e => setReqForm(f => ({ ...f, waste: e.target.value }))} className="bg-navy-800 border-navy-700 text-white" /></Field>
                  <Field label="Roof Color Manufacturer">
                    <select value={reqForm.manufacturer} onChange={e => setReqForm(f => ({ ...f, manufacturer: e.target.value }))} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                      <option value="">-</option>
                      {MANUFACTURERS.map(t => <option key={t} value={t}>{t}</option>)}
                      {reqForm.manufacturer && !MANUFACTURERS.includes(reqForm.manufacturer) && <option value={reqForm.manufacturer}>{reqForm.manufacturer}</option>}
                    </select>
                  </Field>
                  <Field label="Desired Roof Color (for 3D render)"><Input value={reqForm.color} onChange={e => setReqForm(f => ({ ...f, color: e.target.value }))} placeholder="e.g. Weathered Wood" className="bg-navy-800 border-navy-700 text-white" /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={!!reqForm.want3d} onChange={e => setReqForm(f => ({ ...f, want3d: e.target.checked }))} />
                  Include 3D color render of the home
                </label>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-400">Secondary Structures (sheds, garages, buildings)</label>
                    <Button onClick={() => setReqForm(f => ({ ...f, structures: [...(f.structures || []), { name: '' }] }))} className="bg-navy-700 hover:bg-navy-600 text-white text-xs flex items-center gap-1"><Plus size={13} /> Add structure</Button>
                  </div>
                  <div className="space-y-2">
                    {(reqForm.structures || []).map((st, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input value={st.name} onChange={e => setReqForm(f => { const arr = [...f.structures]; arr[i] = { ...arr[i], name: e.target.value }; return { ...f, structures: arr }; })} placeholder="Structure title (e.g. Detached garage)" className="bg-navy-800 border-navy-700 text-white flex-1" />
                        <button onClick={() => setReqForm(f => ({ ...f, structures: f.structures.filter((_, j) => j !== i) }))} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-navy-800">
                  <span className="text-sm text-gray-400">$15.00 - 6-hour turnaround</span>
                  <Button onClick={submitReportRequest} disabled={reqSubmitting || !reqForm.located || !reqForm.confirmed} className="bg-brand-blue hover:bg-brand-blue/90 text-white">{reqSubmitting ? 'Submitting...' : 'Request Report'}</Button>
                </div>
              </Card>
            )}

            {measSub === 'integrations' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                <Card className="bg-navy-900 border-navy-800 p-6">
                  <h3 className="text-white font-semibold">Hover</h3>
                  <p className="text-sm text-gray-400 mt-1">Connect a Hover account to pull 3D measurements directly into this job.</p>
                  <Button disabled className="bg-navy-700 text-gray-400 mt-4 cursor-not-allowed">Connect (coming soon)</Button>
                </Card>
                <Card className="bg-navy-900 border-navy-800 p-6">
                  <h3 className="text-white font-semibold">Roofr</h3>
                  <p className="text-sm text-gray-400 mt-1">Connect Roofr to import roof reports and measurements for this job.</p>
                  <Button disabled className="bg-navy-700 text-gray-400 mt-4 cursor-not-allowed">Connect (coming soon)</Button>
                </Card>
              </div>
            )}
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
              cols={['Estimate #', 'Title', 'Status', 'Total', 'Default', 'Created']}
              rows={estimates.map(e => [
                e.estimate_number, e.title,
                <Badge className={`${statusTone(e.status)} text-xs`}>{e.status}</Badge>,
                money(e.total),
                <button onClick={(ev) => { ev.stopPropagation(); setDefaultEstimate(e); }} className={`text-xs px-2 py-1 rounded font-medium ${e.is_default ? 'bg-emerald-500/20 text-emerald-300' : 'border border-navy-700 text-gray-400 hover:text-white'}`}>{e.is_default ? 'Default' : 'Set default'}</button>,
                date(e.created_at),
              ])} />
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

        {/* FINANCE - per-job invoice builder */}
        {tab === 'finance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Invoiced" value={money(invoices.reduce((s, i) => s + num(i.total_amount), 0))} />
              <StatCard label="Collected" value={money(invoices.reduce((s, i) => s + num(i.amount_paid), 0))} />
              <StatCard label="Outstanding" value={money(invoices.filter(i => !['paid', 'void'].includes((i.status || '').toLowerCase())).reduce((s, i) => s + num(i.balance_due), 0))} />
              <StatCard label="Invoices" value={String(invoices.length)} />
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <Button onClick={() => navigate(`/crm/${platformId}/finance`)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Open Finance hub</Button>
              <Button onClick={() => setMilestoneOpen(true)} className="bg-navy-700 hover:bg-navy-600 text-white text-sm flex items-center gap-1"><Layers size={15} /> From amount</Button>
              <Button onClick={() => openInvoiceEditor(null)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm flex items-center gap-1"><Plus size={15} /> New invoice</Button>
            </div>

            {invoices.length === 0 ? (
              <Card className="bg-navy-900 border-navy-800 p-10 text-center text-gray-400">No invoices for this job yet.</Card>
            ) : (
              <div className="space-y-3">
                {invoices.map(inv => (
                  <Card key={inv.id} className="bg-navy-900 border-navy-800 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{inv.invoice_number}</span>
                          <Badge className={`${statusTone(inv.status)} text-xs`}>{inv.status}</Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Issued {date(inv.invoice_date)} - Due {date(inv.due_date)}</div>
                      </div>
                      <div className="flex items-center gap-5 text-right">
                        <div><div className="text-[11px] text-gray-500">Total</div><div className="text-white font-medium">{money(inv.total_amount)}</div></div>
                        <div><div className="text-[11px] text-gray-500">Paid</div><div className="text-emerald-300 font-medium">{money(inv.amount_paid)}</div></div>
                        <div><div className="text-[11px] text-gray-500">Balance</div><div className="text-amber-300 font-medium">{money(inv.balance_due)}</div></div>
                      </div>
                    </div>
                    {(payments[inv.id] || []).length > 0 && (
                      <div className="mt-3 border-t border-navy-800 pt-2 space-y-1">
                        {(payments[inv.id] || []).map(pmt => (
                          <div key={pmt.id} className="flex items-center justify-between text-xs text-gray-400">
                            <span>{pmt.payment_number} - {pmt.payment_method || 'payment'} - {date(pmt.payment_date)}</span>
                            <span className="text-emerald-300">{money(pmt.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 mt-3">
                      <Button onClick={() => openInvoiceEditor(inv)} className="bg-navy-700 hover:bg-navy-600 text-white text-xs">Edit</Button>
                      {num(inv.balance_due) > 0 && (inv.status || '').toLowerCase() !== 'void' && (
                        <Button onClick={() => setPayFor(inv)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-xs flex items-center gap-1"><DollarSign size={13} /> Record payment</Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {invEditor && (
          <InvoiceEditor
            editor={invEditor} setEditor={setInvEditor} totals={invTotals(invEditor)}
            onSave={saveInvoice} saving={invSaving} onClose={() => setInvEditor(null)}
          />
        )}
        {milestoneOpen && (
          <MilestoneModal defaultAmount={num(deal.deal_value)} onGenerate={generateMilestones} onClose={() => setMilestoneOpen(false)} />
        )}
        {payFor && (
          <PaymentModal invoice={payFor} onSave={(p) => recordPayment(payFor, p)} onClose={() => setPayFor(null)} />
        )}

        {/* COMMUNICATIONS - per-job thread */}
        {tab === 'communications' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setNewConvOpen(true)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm flex items-center gap-1"><Plus size={15} /> New conversation</Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Conversation list */}
              <Card className="bg-navy-900 border-navy-800 lg:col-span-1 overflow-hidden">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No conversations logged for this job yet.</div>
                ) : (
                  <div className="divide-y divide-navy-800 max-h-[560px] overflow-y-auto">
                    {conversations.map(c => (
                      <button key={c.id} onClick={() => openConversation(c)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${activeConv?.id === c.id ? 'bg-navy-800' : 'hover:bg-navy-800/50'}`}>
                        <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center text-gray-300 flex-shrink-0"><ChannelIcon type={c.channel_type} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white truncate">{c.subject || 'Conversation'}</span>
                            <span className="text-[10px] uppercase tracking-wide text-gray-500">{c.channel_type || 'note'}</span>
                          </div>
                          {c.last_message_preview && <div className="text-xs text-gray-500 truncate">{c.last_message_preview}</div>}
                          {c.last_message_at && <div className="text-[10px] text-gray-600 mt-0.5">{new Date(c.last_message_at).toLocaleString()}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Thread */}
              <Card className="bg-navy-900 border-navy-800 lg:col-span-2 flex flex-col min-h-[420px]">
                {!activeConv ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-10">Select a conversation to view the thread.</div>
                ) : (
                  <>
                    <div className="px-5 py-3 border-b border-navy-800 flex items-center gap-2">
                      <ChannelIcon type={activeConv.channel_type} />
                      <span className="text-sm font-semibold text-white truncate">{activeConv.subject || 'Conversation'}</span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 ml-auto">{activeConv.channel_type || 'note'}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[440px]">
                      {msgLoading ? (
                        <div className="text-center text-gray-500 text-sm py-8">Loading...</div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">No messages yet. Start the thread below.</div>
                      ) : messages.map(m => {
                        const out = (m.direction || 'outbound') === 'outbound';
                        return (
                          <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[78%] rounded-2xl px-4 py-2 ${out ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-200'}`}>
                              <div className="text-[11px] opacity-70 mb-0.5">{m.sender_name || (out ? 'You' : 'Contact')}</div>
                              <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                              <div className="text-[10px] opacity-60 mt-1 text-right">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-navy-800 p-3 flex gap-2">
                      <Input value={msgDraft} onChange={e => setMsgDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Type a message..." className="bg-navy-800 border-navy-700 text-white" />
                      <Button onClick={sendMessage} disabled={!msgDraft.trim()} className="bg-brand-blue hover:bg-brand-blue/90 text-white flex items-center gap-1"><Send size={15} /></Button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        )}

        {newConvOpen && (
          <NewConversationModal onCreate={createConversation} onClose={() => setNewConvOpen(false)} defaultSubject={deal.title || ''} />
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

function SectionCard({ title, children }) {
  return (
    <Card className="bg-navy-900 border-navy-800 p-6">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </Card>
  );
}

const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
const RRR_MAP_STYLE = { version: 8, sources: { esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Imagery (c) Esri' } }, layers: [{ id: 'esri', type: 'raster', source: 'esri' }] };
function rrrLoadCss(href) { if (document.querySelector('link[data-cdn="' + href + '"]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.cdn = href; document.head.appendChild(l); }
function rrrLoadScript(src) { return new Promise((resolve, reject) => { const ex = document.querySelector('script[data-cdn="' + src + '"]'); if (ex) { if (ex.dataset.loaded === '1') return resolve(); ex.addEventListener('load', () => resolve()); ex.addEventListener('error', () => reject(new Error('load fail'))); return; } const sc = document.createElement('script'); sc.src = src; sc.async = true; sc.dataset.cdn = src; sc.addEventListener('load', () => { sc.dataset.loaded = '1'; resolve(); }); sc.addEventListener('error', () => reject(new Error('load fail'))); document.head.appendChild(sc); }); }
async function rrrEnsureMap() { rrrLoadCss(MAPLIBRE_CSS); if (!window.maplibregl) await rrrLoadScript(MAPLIBRE_JS); }

function AddressAutocomplete({ value, onChange, placeholder, className }) {
  const [q, setQ] = useState(value || '');
  const [sugs, setSugs] = useState([]);
  const [open, setOpen] = useState(false);
  const tRef = useRef(null);
  useEffect(() => { setQ(value || ''); }, [value]);
  function onType(v) {
    setQ(v); onChange(v); setOpen(true);
    if (tRef.current) clearTimeout(tRef.current);
    if (!v || v.length < 4) { setSugs([]); return; }
    tRef.current = setTimeout(async () => {
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&q=' + encodeURIComponent(v));
        const j = await r.json();
        setSugs(Array.isArray(j) ? j : []);
      } catch (e) { setSugs([]); }
    }, 350);
  }
  function pick(s) { onChange(s.display_name); setQ(s.display_name); setSugs([]); setOpen(false); }
  return (
    <div className="relative">
      <Input value={q} onChange={e => onType(e.target.value)} onFocus={() => { if (q) setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} className={className} />
      {open && sugs.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-navy-800 border border-navy-700 rounded-lg max-h-56 overflow-auto shadow-xl">
          {sugs.map((s, i) => (
            <button key={i} type="button" onMouseDown={e => { e.preventDefault(); pick(s); }} className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-navy-700 border-b border-navy-700/50 last:border-0">{s.display_name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestMap({ lat, lng, onMove }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await rrrEnsureMap();
        if (cancelled || !ref.current || mapRef.current) return;
        const mlg = window.maplibregl;
        const map = new mlg.Map({ container: ref.current, style: RRR_MAP_STYLE, center: [lng, lat], zoom: 20 });
        map.addControl(new mlg.NavigationControl({ showCompass: false }), 'top-left');
        const marker = new mlg.Marker({ color: '#2f6df6', draggable: true }).setLngLat([lng, lat]).addTo(map);
        marker.on('dragend', () => { const p = marker.getLngLat(); onMove(p.lat, p.lng); });
        map.on('click', (e) => { marker.setLngLat(e.lngLat); onMove(e.lngLat.lat, e.lngLat.lng); });
        mapRef.current = map; markerRef.current = marker;
      } catch (e) { /* map is best-effort */ }
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);
  return <div ref={ref} className="w-full h-80 rounded-lg overflow-hidden border border-navy-700" />;
}

function Field({ label, full, children }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
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


// =====================================================================
// Finance + Communications sub-components (per-job, scoped pipeline_id)
// =====================================================================
const moneyFull = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className={`bg-navy-900 border border-navy-800 rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-navy-800 sticky top-0 bg-navy-900">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const INV_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

function InvoiceEditor({ editor, setEditor, totals, onSave, saving, onClose }) {
  const set = (patch) => setEditor(prev => ({ ...prev, ...patch }));
  const setItem = (k, patch) => set({ line_items: editor.line_items.map(li => li._k === k ? { ...li, ...patch } : li) });
  const addRow = () => set({ line_items: [...editor.line_items, { _k: Math.random().toString(36).slice(2, 10), description: '', qty: 1, unit_price: 0, amount: 0 }] });
  const rmRow = (k) => set({ line_items: editor.line_items.filter(li => li._k !== k) });
  return (
    <Modal wide title={editor.id ? 'Edit invoice' : 'New invoice'} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Invoice #"><Input value={editor.invoice_number} onChange={e => set({ invoice_number: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
          <Field label="Status">
            <select value={editor.status} onChange={e => set({ status: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
              {INV_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Invoice date"><Input type="date" value={editor.invoice_date || ''} onChange={e => set({ invoice_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
          <Field label="Due date"><Input type="date" value={editor.due_date || ''} onChange={e => set({ due_date: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-400">Line items</label>
            <Button onClick={addRow} className="bg-navy-700 hover:bg-navy-600 text-white text-xs flex items-center gap-1"><Plus size={13} /> Add row</Button>
          </div>
          <div className="space-y-2">
            {editor.line_items.map(li => {
              const lineAmt = (Number(li.qty) || 0) * (Number(li.unit_price) || 0);
              return (
                <div key={li._k} className="flex items-center gap-2">
                  <Input value={li.description} onChange={e => setItem(li._k, { description: e.target.value })} placeholder="Description" className="bg-navy-800 border-navy-700 text-white flex-1" />
                  <Input type="number" value={li.qty} onChange={e => setItem(li._k, { qty: e.target.value })} placeholder="Qty" className="bg-navy-800 border-navy-700 text-white w-20" />
                  <Input type="number" value={li.unit_price} onChange={e => setItem(li._k, { unit_price: e.target.value })} placeholder="Unit $" className="bg-navy-800 border-navy-700 text-white w-28" />
                  <div className="w-24 text-right text-sm text-gray-300">{moneyFull(lineAmt)}</div>
                  <button onClick={() => rmRow(li._k)} className="text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Field label="Tax rate (%)"><Input type="number" value={editor.tax_rate} onChange={e => set({ tax_rate: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
            <Field label="Terms"><Input value={editor.terms} onChange={e => set({ terms: e.target.value })} className="bg-navy-800 border-navy-700 text-white" /></Field>
            <Field label="Notes"><Textarea value={editor.notes} onChange={e => set({ notes: e.target.value })} className="bg-navy-800 border-navy-700 text-white min-h-16" /></Field>
          </div>
          <div className="bg-navy-800/50 rounded-lg p-4 space-y-2 text-sm self-start">
            <Row k="Subtotal" v={moneyFull(totals.subtotal)} />
            <Row k={`Tax (${Number(editor.tax_rate) || 0}%)`} v={moneyFull(totals.tax_amount)} />
            <Row k="Total" v={moneyFull(totals.total_amount)} bold />
            <Row k="Paid" v={moneyFull(editor.amount_paid)} />
            <Row k="Balance due" v={moneyFull(totals.balance_due)} bold />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">{saving ? 'Saving...' : 'Save invoice'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ k, v, bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{k}</span>
      <span className={bold ? 'text-white font-semibold' : 'text-gray-200'}>{v}</span>
    </div>
  );
}

function MilestoneModal({ defaultAmount, onGenerate, onClose }) {
  const [amount, setAmount] = useState(defaultAmount || 0);
  const [splits, setSplits] = useState([
    { label: 'Deposit', pct: 30 },
    { label: 'Progress', pct: 40 },
    { label: 'Final', pct: 30 },
  ]);
  const setPct = (i, v) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, pct: v } : s));
  const setLabel = (i, v) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, label: v } : s));
  const total = Number(amount) || 0;
  const pctSum = splits.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  return (
    <Modal title="Generate milestone invoices" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Amount to split ($)"><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-navy-800 border-navy-700 text-white" /></Field>
        <div className="space-y-2">
          {splits.map((sp, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={sp.label} onChange={e => setLabel(i, e.target.value)} className="bg-navy-800 border-navy-700 text-white flex-1" />
              <Input type="number" value={sp.pct} onChange={e => setPct(i, e.target.value)} className="bg-navy-800 border-navy-700 text-white w-20" />
              <span className="text-gray-500 text-xs">%</span>
              <div className="w-24 text-right text-sm text-gray-300">{moneyFull(total * (Number(sp.pct) || 0) / 100)}</div>
            </div>
          ))}
        </div>
        <div className={`text-xs ${pctSum === 100 ? 'text-gray-500' : 'text-amber-300'}`}>Percentages total {pctSum}%{pctSum !== 100 ? ' (should be 100%)' : ''}.</div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button>
          <Button onClick={() => onGenerate(splits, amount)} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Create drafts</Button>
        </div>
      </div>
    </Modal>
  );
}

const PAY_METHODS = ['card', 'check', 'cash', 'ach', 'wire', 'other'];

function PaymentModal({ invoice, onSave, onClose }) {
  const [amount, setAmount] = useState(invoice.balance_due || '');
  const [method, setMethod] = useState('card');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Modal title={`Record payment - ${invoice.invoice_number}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-xs text-gray-500">Balance due {moneyFull(invoice.balance_due)} of {moneyFull(invoice.total_amount)}.</div>
        <Field label="Amount ($)"><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-navy-800 border-navy-700 text-white" /></Field>
        <Field label="Method">
          <select value={method} onChange={e => setMethod(e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
            {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Payment date"><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="bg-navy-800 border-navy-700 text-white" /></Field>
        <Field label="Reference #"><Input value={reference} onChange={e => setReference(e.target.value)} className="bg-navy-800 border-navy-700 text-white" /></Field>
        <Field label="Notes"><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-navy-800 border-navy-700 text-white min-h-16" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button>
          <Button onClick={() => onSave({ amount, payment_method: method, payment_date: paymentDate, reference_number: reference, notes })} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Record payment</Button>
        </div>
      </div>
    </Modal>
  );
}

const CHANNELS = ['note', 'email', 'sms', 'call'];

function NewConversationModal({ onCreate, onClose, defaultSubject }) {
  const [channel, setChannel] = useState('note');
  const [subject, setSubject] = useState(defaultSubject || '');
  return (
    <Modal title="New conversation" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Channel">
          <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2 text-sm">
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Subject"><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Conversation subject" className="bg-navy-800 border-navy-700 text-white" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Cancel</Button>
          <Button onClick={() => onCreate({ channel_type: channel, subject })} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">Start</Button>
        </div>
      </div>
    </Modal>
  );
}

function ChannelIcon({ type }) {
  const t = (type || 'note').toLowerCase();
  if (t === 'email') return <Mail size={15} />;
  if (t === 'sms') return <MessageSquare size={15} />;
  if (t === 'call') return <Phone size={15} />;
  return <StickyNote size={15} />;
}
