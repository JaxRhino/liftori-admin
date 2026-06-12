import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// Base CRM estimate builder. Reads the impersonated tenant's OWN DB via
// useCrmClient(). Cost-based line items grouped into toggleable sections.
// Two pricing modes: lump-sum (one gross-margin slider over total cost) or
// itemized (each line priced by its own markup percent).

const uid = () => Math.random().toString(36).slice(2, 10);
const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number(v) || 0;

function defaultSections() {
  return [
    { id: uid(), title: 'Materials', enabled: true, items: [] },
    { id: uid(), title: 'Labor', enabled: true, items: [] },
    { id: uid(), title: 'Fees', enabled: true, items: [] },
  ];
}

export default function CrmEstimateDetail() {
  const { client } = useCrmClient();
  const { platformId, id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [org, setOrg] = useState(null);
  const [settings, setSettings] = useState(null);
  const [catalog, setCatalog] = useState([]);

  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState('draft');
  const [sections, setSections] = useState(defaultSections());
  const [grossMargin, setGrossMargin] = useState(50);
  const [taxRate, setTaxRate] = useState(0);
  const [pricingMode, setPricingMode] = useState('lump');

  useEffect(() => { if (client && id) load(); /* eslint-disable-next-line */ }, [client, id]);

  async function load() {
    try {
      setLoading(true);
      const { data: est, error } = await client.from('customer_estimates').select('*').eq('id', id).single();
      if (error) throw error;
      setEstimate(est);
      setTitle(est.title || '');
      setIntro(est.intro || '');
      setTerms(est.terms || '');
      setValidUntil(est.valid_until || '');
      setStatus(est.status || 'draft');
      setPricingMode(est.pricing_mode === 'itemized' ? 'itemized' : 'lump');
      setSections(Array.isArray(est.sections) && est.sections.length ? est.sections : defaultSections());
      const [orgRes, setRes] = await Promise.all([
        client.from('org_settings').select('*').limit(1).maybeSingle(),
        client.from('estimate_settings').select('*').limit(1).maybeSingle(),
      ]);
      setOrg(orgRes.data || null);
      setSettings(setRes.data || null);
      const { data: cat } = await client.from('estimate_products').select('*').eq('is_active', true).order('item_type', { ascending: true }).order('name', { ascending: true });
      setCatalog(cat || []);
      setGrossMargin(est.gross_margin != null ? est.gross_margin : (setRes.data ? setRes.data.default_gross_margin : 50));
      setTaxRate(est.tax_rate != null ? est.tax_rate : (setRes.data ? setRes.data.default_tax_rate : 0));
      if (est.contact_id) {
        const { data: cust } = await client.from('customer_contacts').select('*').eq('id', est.contact_id).single();
        setCustomer(cust || null);
      }
    } catch (e) { console.error(e); toast.error('Failed to load estimate'); }
    finally { setLoading(false); }
  }

  function updateSection(sid, patch) { setSections(prev => prev.map(s => s.id === sid ? { ...s, ...patch } : s)); }
  function addSection() { setSections(prev => [...prev, { id: uid(), title: 'New Section', enabled: true, items: [] }]); }
  function removeSection(sid) { setSections(prev => prev.filter(s => s.id !== sid)); }
  function toggleSection(sid) { setSections(prev => prev.map(s => s.id === sid ? { ...s, enabled: s.enabled === false } : s)); }
  function addItem(sid) { setSections(prev => prev.map(s => s.id === sid ? { ...s, items: [...(s.items || []), { id: uid(), description: '', qty: 1, unit: '', unit_cost: 0, markup_percent: num(grossMargin) }] } : s)); }
  function addItemFromCatalog(sid, pid) {
    const pr = catalog.find(x => x.id === pid);
    if (!pr) return;
    setSections(prev => prev.map(s => s.id === sid ? { ...s, items: [...(s.items || []), { id: uid(), description: pr.name, qty: 1, unit: pr.unit || '', unit_cost: Number(pr.cost) || 0, markup_percent: Number(pr.markup_percent) || 0 }] } : s));
  }
  function updateItem(sid, iid, patch) { setSections(prev => prev.map(s => s.id === sid ? { ...s, items: s.items.map(it => it.id === iid ? { ...it, ...patch } : it) } : s)); }
  function removeItem(sid, iid) { setSections(prev => prev.map(s => s.id === sid ? { ...s, items: s.items.filter(it => it.id !== iid) } : s)); }

  const sectionCost = (s) => (s.items || []).reduce((sum, it) => sum + num(it.qty) * num(it.unit_cost), 0);
  const itemPrice = (it) => num(it.qty) * num(it.unit_cost) * (1 + num(it.markup_percent) / 100);

  const calc = useMemo(() => {
    const enabled = sections.filter(s => s.enabled !== false);
    const totalCost = enabled.reduce((sum, s) => sum + (s.items || []).reduce((a, it) => a + num(it.qty) * num(it.unit_cost), 0), 0);
    let price;
    if (pricingMode === 'itemized') {
      price = enabled.reduce((sum, s) => sum + (s.items || []).reduce((a, it) => a + num(it.qty) * num(it.unit_cost) * (1 + num(it.markup_percent) / 100), 0), 0);
    } else {
      const m = Math.min(Math.max(num(grossMargin), 0), 95) / 100;
      price = m >= 1 ? totalCost : totalCost / (1 - m);
    }
    let minApplied = false;
    const minP = num(settings ? settings.minimum_price : 0);
    if (minP > 0 && price < minP) { price = minP; minApplied = true; }
    const netProfit = price - totalCost;
    const taxAmount = price * num(taxRate) / 100;
    const total = price + taxAmount;
    const effMargin = price > 0 ? (netProfit / price) * 100 : 0;
    return { totalCost, price, netProfit, taxAmount, total, minApplied, effMargin };
  }, [sections, grossMargin, taxRate, settings, pricingMode]);

  async function save(nextStatus) {
    try {
      setSaving(true);
      const patch = {
        title, intro, terms, valid_until: validUntil || null,
        status: nextStatus || status,
        sections, gross_margin: num(grossMargin), pricing_mode: pricingMode,
        total_cost: calc.totalCost, net_profit: calc.netProfit, minimum_applied: calc.minApplied,
        subtotal: calc.price, tax_rate: num(taxRate), tax_amount: calc.taxAmount, total: calc.total,
      };
      const { error } = await client.from('customer_estimates').update(patch).eq('id', id);
      if (error) throw error;
      if (nextStatus) setStatus(nextStatus);
      toast.success('Estimate saved');
    } catch (e) { console.error(e); toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="min-h-screen bg-navy-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>;

  const itemized = pricingMode === 'itemized';
  const companyName = org && org.company_name ? org.company_name : 'Your Company';
  const custName = customer ? [customer.first_name, customer.last_name].filter(Boolean).join(' ') : '';
  const backTo = estimate && estimate.contact_id ? '/crm/' + platformId + '/customers/' + estimate.contact_id : '/crm/' + platformId + '/customers';

  return (
    <div className="min-h-screen bg-navy-950 p-6 pb-40">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(backTo)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"><ArrowLeft size={16} /> Back</button>
          <div className="flex items-center gap-2">
            <Badge className="bg-navy-700 text-gray-200 text-xs">{estimate ? estimate.estimate_number : ''}</Badge>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-navy-900 border border-navy-700 text-gray-200 rounded-lg px-2 py-1.5 text-sm">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="viewed">Viewed</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
            </select>
            <Button onClick={() => save()} disabled={saving} className="bg-brand-blue hover:bg-brand-blue/90 text-white text-sm">{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>

        <Card className="bg-navy-900 border-navy-800 p-6 mb-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              {org && org.logo_url ? <img src={org.logo_url} alt="" className="w-14 h-14 rounded-lg object-contain bg-navy-950" /> : <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white font-bold text-lg">{companyName.charAt(0)}</div>}
              <div>
                <div className="text-white font-semibold text-lg">{companyName}</div>
                <div className="text-xs text-gray-400">{[org && org.company_city, org && org.company_state].filter(Boolean).join(', ')}</div>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-gray-400">Prepared for</div>
              <div className="text-white font-medium">{custName || '-'}</div>
              {customer && customer.email ? <div className="text-xs text-gray-500">{customer.email}</div> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estimate Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Roof Replacement" /></Field>
            <Field label="Valid Until"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
          </div>
          <div className="mt-3"><Field label="Introduction / About"><Textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="A short intro about your company and this proposal..." /></Field></div>
        </Card>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Pricing</span>
            <div className="flex bg-navy-900 border border-navy-700 rounded-lg overflow-hidden">
              <button onClick={() => setPricingMode('lump')} className={'px-3 py-1.5 text-xs ' + (!itemized ? 'bg-brand-blue text-white' : 'text-gray-400')}>Lump-sum</button>
              <button onClick={() => setPricingMode('itemized')} className={'px-3 py-1.5 text-xs ' + (itemized ? 'bg-brand-blue text-white' : 'text-gray-400')}>Itemized</button>
            </div>
          </div>
          <span className="text-xs text-gray-500">{itemized ? 'Each line priced by its own markup' : 'One margin slider over total cost'}</span>
        </div>

        <div className="space-y-4">
          {sections.map(s => {
            const off = s.enabled === false;
            return (
              <Card key={s.id} className={'border p-4 ' + (off ? 'bg-navy-900/40 border-navy-800 opacity-60' : 'bg-navy-900 border-navy-800')}>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <input value={s.title} onChange={(e) => updateSection(s.id, { title: e.target.value })} className="bg-transparent text-white font-semibold text-base border-b border-transparent hover:border-navy-700 focus:border-brand-blue outline-none flex-1" />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">{money(sectionCost(s))}</span>
                    <button onClick={() => toggleSection(s.id)} title={off ? 'Enable section' : 'Disable section'} className="text-gray-400 hover:text-white">{off ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button onClick={() => removeSection(s.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                </div>

                {(s.items || []).length > 0 && (
                  <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] text-gray-500 px-1 mb-1">
                    <span className="col-span-4">Description</span>
                    <span className="col-span-1">Qty</span>
                    <span className="col-span-2 text-right">Unit cost</span>
                    {itemized ? <span className="col-span-2 text-right">Markup %</span> : null}
                    <span className={(itemized ? 'col-span-2' : 'col-span-4') + ' text-right'}>{itemized ? 'Price' : 'Cost'}</span>
                    <span className="col-span-1"></span>
                  </div>
                )}

                <div className="space-y-2">
                  {(s.items || []).map(it => (
                    <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                      <input value={it.description} onChange={(e) => updateItem(s.id, it.id, { description: e.target.value })} placeholder="Description" className="col-span-4 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                      <input value={it.qty} onChange={(e) => updateItem(s.id, it.id, { qty: e.target.value })} type="number" placeholder="Qty" className="col-span-1 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                      <input value={it.unit_cost} onChange={(e) => updateItem(s.id, it.id, { unit_cost: e.target.value })} type="number" placeholder="Cost" className="col-span-2 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white text-right placeholder-gray-500" />
                      {itemized ? <input value={it.markup_percent ?? ''} onChange={(e) => updateItem(s.id, it.id, { markup_percent: e.target.value })} type="number" placeholder="%" className="col-span-2 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white text-right placeholder-gray-500" /> : null}
                      <span className={(itemized ? 'col-span-2' : 'col-span-4') + ' text-right text-sm ' + (itemized ? 'text-white font-medium' : 'text-gray-300')}>{money(itemized ? itemPrice(it) : num(it.qty) * num(it.unit_cost))}</span>
                      <button onClick={() => removeItem(s.id, it.id)} className="col-span-1 text-gray-500 hover:text-red-400 flex justify-end"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button onClick={() => addItem(s.id)} className="text-xs text-brand-blue hover:text-brand-light flex items-center gap-1"><Plus size={14} /> Add line item</button>
                  {catalog.length > 0 && (
                    <select value="" onChange={(e) => { if (e.target.value) { addItemFromCatalog(s.id, e.target.value); e.target.value = ''; } }} className="bg-navy-950 border border-navy-700 rounded px-2 py-1 text-xs text-gray-300">
                      <option value="">+ from catalog…</option>
                      {catalog.map(pr => <option key={pr.id} value={pr.id}>{pr.name + ' (' + (pr.item_type === 'labor' ? 'Labor' : 'Material') + ')'}</option>)}
                    </select>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        <button onClick={addSection} className="mt-4 text-sm text-brand-blue hover:text-brand-light flex items-center gap-1"><Plus size={16} /> Add section</button>

        <Card className="bg-navy-900 border-navy-800 p-4 mt-5">
          <Field label="Terms & Notes"><Textarea rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms, warranty, etc." /></Field>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-navy-900 border-t border-navy-700 px-6 py-4 z-30">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
          <div>
            <div className="text-xs text-gray-500">Total Cost</div>
            <div className="text-white font-semibold">{money(calc.totalCost)}</div>
          </div>
          <div className="md:col-span-2">
            {itemized ? (
              <div>
                <div className="text-xs text-gray-500 mb-1">Effective Margin</div>
                <div className="text-brand-blue font-medium">{calc.effMargin.toFixed(1)}%</div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1"><span>Gross Margin</span><span className="text-brand-blue font-medium">{num(grossMargin).toFixed(0)}%</span></div>
                <input type="range" min="0" max="90" step="1" value={grossMargin} onChange={(e) => setGrossMargin(e.target.value)} className="w-full accent-brand-blue" />
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500">Net Profit</div>
            <div className="text-emerald-400 font-semibold">{money(calc.netProfit)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">{calc.minApplied ? 'Price (min)' : 'Price'}</div>
            <div className="text-white font-bold text-lg">{money(calc.price)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (<div><label className="block text-xs text-gray-400 mb-1">{label}</label>{children}</div>);
}
