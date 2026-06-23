import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrmClient } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff, Ruler } from 'lucide-react';
import { toast } from 'sonner';

// Base CRM estimate builder. Reads the impersonated tenant's OWN DB via
// useCrmClient() (NOT a hardcoded client). Cost-based line items grouped
// into toggleable sections; a gross-profit slider derives price + net profit.
//
// Roofing tenants (platform.industry contains "roof") additionally get a Roof
// Measurement panel. Any line item flagged "per square" auto-fills its qty from
// the measured + waste-adjusted squares. Everything roofing is additive and
// gated, so non-roofing tenants render exactly as before.

const uid = () => Math.random().toString(36).slice(2, 10);
const money = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number(v) || 0;
const TIER_LABEL = { good: 'Good', better: 'Better', best: 'Best' };

const PITCH_OPTIONS = [
  { v: 'flat', label: 'Flat (0:12 - 2:12)', waste: 10 },
  { v: 'low', label: 'Low (3:12 - 4:12)', waste: 12 },
  { v: 'standard', label: 'Standard (5:12 - 7:12)', waste: 15 },
  { v: 'steep', label: 'Steep (8:12 - 9:12)', waste: 17 },
  { v: 'very_steep', label: 'Very steep (10:12 - 12:12)', waste: 20 },
  { v: 'extreme', label: 'Extreme (> 12:12)', waste: 22 },
];

function defaultSections() {
  return [
    { id: uid(), title: 'Materials', enabled: true, items: [] },
    { id: uid(), title: 'Labor', enabled: true, items: [] },
    { id: uid(), title: 'Fees', enabled: true, items: [] },
  ];
}

export default function CrmEstimateDetail() {
  const { client, platform } = useCrmClient();
  const { platformId, id } = useParams();
  const navigate = useNavigate();

  const isRoofing = String((platform && platform.industry) || '').toLowerCase().includes('roof');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [org, setOrg] = useState(null);
  const [settings, setSettings] = useState(null);

  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [status, setStatus] = useState('draft');
  const [sections, setSections] = useState(defaultSections());
  const [grossMargin, setGrossMargin] = useState(50);
  const [taxRate, setTaxRate] = useState(0);
  const [measurements, setMeasurements] = useState({});
  const [groupId, setGroupId] = useState(null);
  const [tier, setTier] = useState(null);
  const [tierRecommended, setTierRecommended] = useState(false);
  const [siblings, setSiblings] = useState([]);

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
      setSections(Array.isArray(est.sections) && est.sections.length ? est.sections : defaultSections());
      setMeasurements(est.measurements && typeof est.measurements === 'object' && !Array.isArray(est.measurements) ? est.measurements : {});
      setGroupId(est.proposal_group_id || null);
      setTier(est.tier || null);
      setTierRecommended(!!est.tier_recommended);
      if (est.proposal_group_id) {
        const { data: sibs } = await client.from('customer_estimates').select('id, tier, tier_order, tier_recommended, total, title').eq('proposal_group_id', est.proposal_group_id).order('tier_order', { ascending: true });
        setSiblings(sibs || []);
      } else { setSiblings([]); }
      const [orgRes, setRes] = await Promise.all([
        client.from('org_settings').select('*').limit(1).maybeSingle(),
        client.from('estimate_settings').select('*').limit(1).maybeSingle(),
      ]);
      setOrg(orgRes.data || null);
      setSettings(setRes.data || null);
      setGrossMargin(est.gross_margin != null ? est.gross_margin : (setRes.data ? setRes.data.default_gross_margin : 50));
      setTaxRate(est.tax_rate != null ? est.tax_rate : (setRes.data ? setRes.data.default_tax_rate : 0));
      if (est.contact_id) {
        const { data: cust } = await client.from('customer_contacts').select('*').eq('id', est.contact_id).single();
        setCustomer(cust || null);
      }
    } catch (e) { console.error(e); toast.error('Failed to load estimate'); }
    finally { setLoading(false); }
  }

  // Waste-adjusted squares that per-square line items auto-fill to.
  const adjSquares = useMemo(() => {
    const sq = Math.max(0, num(measurements.squares));
    const waste = Math.max(0, num(measurements.waste_pct));
    return sq * (1 + waste / 100);
  }, [measurements]);

  const effQty = (it) => (isRoofing && it.per_square ? adjSquares : num(it.qty));

  function setMeas(k, v) { setMeasurements(prev => ({ ...prev, [k]: v })); }
  function onPitchChange(v) {
    const opt = PITCH_OPTIONS.find(p => p.v === v);
    setMeasurements(prev => ({ ...prev, pitch: v, waste_pct: (prev.waste_pct === '' || prev.waste_pct == null) && opt ? opt.waste : prev.waste_pct }));
  }

  function updateSection(sid, patch) { setSections(prev => prev.map(s => s.id === sid ? { ...s, ...patch } : s)); }
  function addSection() { setSections(prev => [...prev, { id: uid(), title: 'New Section', enabled: true, items: [] }]); }
  function removeSection(sid) { setSections(prev => prev.filter(s => s.id !== sid)); }
  function toggleSection(sid) { setSections(prev => prev.map(s => s.id === sid ? { ...s, enabled: s.enabled === false } : s)); }
  function addItem(sid) { setSections(prev => prev.map(s => s.id === sid ? { ...s, items: [...(s.items || []), { id: uid(), description: '', qty: 1, unit: '', unit_cost: 0 }] } : s)); }
  function updateItem(sid, iid, patch) { setSections(prev => prev.map(s => s.id === sid ? { ...s, items: s.items.map(it => it.id === iid ? { ...it, ...patch } : it) } : s)); }
  function removeItem(sid, iid) { setSections(prev => prev.map(s => s.id === sid ? { ...s, items: s.items.filter(it => it.id !== iid) } : s)); }
  function togglePerSquare(sid, iid) {
    setSections(prev => prev.map(s => s.id === sid ? { ...s, items: s.items.map(it => it.id === iid ? { ...it, per_square: !it.per_square, unit: !it.per_square ? 'sq' : it.unit } : it) } : s));
  }

  const sectionCost = (s) => (s.items || []).reduce((sum, it) => sum + effQty(it) * num(it.unit_cost), 0);

  const calc = useMemo(() => {
    const enabled = sections.filter(s => s.enabled !== false);
    const totalCost = enabled.reduce((sum, s) => sum + (s.items || []).reduce((a, it) => a + effQty(it) * num(it.unit_cost), 0), 0);
    const m = Math.min(Math.max(num(grossMargin), 0), 95) / 100;
    let price = m >= 1 ? totalCost : totalCost / (1 - m);
    let minApplied = false;
    const minP = num(settings ? settings.minimum_price : 0);
    if (minP > 0 && price < minP) { price = minP; minApplied = true; }
    const netProfit = price - totalCost;
    const taxAmount = price * num(taxRate) / 100;
    const total = price + taxAmount;
    const effMargin = price > 0 ? (netProfit / price) * 100 : 0;
    return { totalCost, price, netProfit, taxAmount, total, minApplied, effMargin };
    // eslint-disable-next-line
  }, [sections, grossMargin, taxRate, settings, adjSquares, isRoofing]);

  async function makeTiers() {
    if (groupId) return;
    try {
      setSaving(true);
      await save();
      const gid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (uid() + uid() + uid() + uid());
      await client.from('customer_estimates').update({ proposal_group_id: gid, tier: 'good', tier_order: 0 }).eq('id', id);
      const en = estimate && estimate.estimate_number ? estimate.estimate_number : 'EST';
      const base = { contact_id: estimate.contact_id, project_id: estimate.project_id, pipeline_id: estimate.pipeline_id, intro, terms, valid_until: validUntil || null, sections, gross_margin: num(grossMargin), tax_rate: num(taxRate), status: 'draft', proposal_group_id: gid, show_photos: estimate.show_photos, photo_ids: estimate.photo_ids, cover_image_url: estimate.cover_image_url };
      if (isRoofing) base.measurements = measurements;
      await client.from('customer_estimates').insert([
        { ...base, title: title || 'Proposal', tier: 'better', tier_order: 1, estimate_number: en + '-B' },
        { ...base, title: title || 'Proposal', tier: 'best', tier_order: 2, estimate_number: en + '-C' },
      ]);
      toast.success('Created Good / Better / Best tiers');
      await load();
    } catch (e) { console.error(e); toast.error('Failed to create tiers'); }
    finally { setSaving(false); }
  }

  async function toggleRecommended() {
    if (!groupId) return;
    const next = !tierRecommended;
    try {
      await client.from('customer_estimates').update({ tier_recommended: false }).eq('proposal_group_id', groupId);
      if (next) await client.from('customer_estimates').update({ tier_recommended: true }).eq('id', id);
      setTierRecommended(next);
      await load();
    } catch (e) { console.error(e); toast.error('Failed to update'); }
  }

  function copyShareLink() {
    if (!groupId) return;
    const url = window.location.origin + '/proposal/' + platformId + '/' + groupId;
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    toast.success('Proposal link copied');
  }

  async function save(nextStatus) {
    try {
      setSaving(true);
      // Bake the auto-filled qty into per-square items so the stored estimate carries real numbers.
      const bakedSections = sections.map(s => ({ ...s, items: (s.items || []).map(it => it.per_square ? { ...it, qty: Number(adjSquares.toFixed(2)) } : it) }));
      const patch = {
        title, intro, terms, valid_until: validUntil || null,
        status: nextStatus || status, tier_recommended: tierRecommended,
        sections: bakedSections, gross_margin: num(grossMargin),
        total_cost: calc.totalCost, net_profit: calc.netProfit, minimum_applied: calc.minApplied,
        subtotal: calc.price, tax_rate: num(taxRate), tax_amount: calc.taxAmount, total: calc.total,
      };
      if (isRoofing) patch.measurements = measurements;
      const { error } = await client.from('customer_estimates').update(patch).eq('id', id);
      if (error) throw error;
      if (nextStatus) setStatus(nextStatus);
      toast.success('Estimate saved');
    } catch (e) { console.error(e); toast.error('Save failed'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="min-h-screen bg-navy-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>;

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

        {groupId ? (
          <Card className="bg-navy-900 border-navy-800 p-4 mb-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 mr-1">Proposal tiers</span>
                {siblings.map(sib => (
                  <button key={sib.id} onClick={() => { if (sib.id !== id) navigate('/crm/' + platformId + '/estimates/' + sib.id); }} className={'px-3 py-1.5 rounded-lg text-sm font-medium border ' + (sib.id === id ? 'bg-brand-blue text-white border-brand-blue' : 'border-navy-700 text-gray-300 hover:text-white')}>
                    {(TIER_LABEL[sib.tier] || sib.tier)}{sib.tier_recommended ? ' \u2605' : ''}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleRecommended} className={'px-3 py-1.5 rounded-lg text-sm border ' + (tierRecommended ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'border-navy-700 text-gray-400 hover:text-white')}>{tierRecommended ? '\u2605 Recommended' : 'Mark recommended'}</button>
                <Button onClick={copyShareLink} className="bg-navy-700 hover:bg-navy-600 text-white text-sm">Copy proposal link</Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="mb-5">
            <button onClick={makeTiers} disabled={saving} className="text-sm text-brand-blue hover:text-brand-light flex items-center gap-1"><Plus size={14} /> Make this a Good / Better / Best proposal</button>
          </div>
        )}

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

        {isRoofing && (
          <Card className="bg-navy-900 border-navy-800 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Ruler size={16} className="text-brand-blue" />
              <span className="text-white font-semibold text-base">Roof Measurement</span>
              <span className="text-xs text-gray-500">drives per-square quantities</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Field label="Squares (100 sq ft)"><Input type="number" value={measurements.squares ?? ''} onChange={(e) => setMeas('squares', e.target.value)} placeholder="0" /></Field>
              <Field label="Pitch">
                <select value={measurements.pitch || ''} onChange={(e) => onPitchChange(e.target.value)} className="w-full bg-navy-950 border border-navy-700 rounded px-2 py-2 text-sm text-white">
                  <option value="">- Select -</option>
                  {PITCH_OPTIONS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Waste %"><Input type="number" value={measurements.waste_pct ?? ''} onChange={(e) => setMeas('waste_pct', e.target.value)} placeholder="15" /></Field>
              <Field label="Tear-off layers"><Input type="number" value={measurements.layers ?? ''} onChange={(e) => setMeas('layers', e.target.value)} placeholder="1" /></Field>
              <Field label="Stories"><Input type="number" value={measurements.stories ?? ''} onChange={(e) => setMeas('stories', e.target.value)} placeholder="1" /></Field>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-navy-950 border border-navy-700 px-4 py-3">
              <div className="text-xs text-gray-400">Adjusted squares <span className="text-gray-600">(squares + waste)</span></div>
              <div className="text-brand-blue font-bold text-lg">{adjSquares.toFixed(1)} sq</div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Toggle <span className="text-brand-blue">/sq</span> on any line item below and its quantity auto-fills to the adjusted squares.</p>
          </Card>
        )}

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
                <div className="space-y-2">
                  {(s.items || []).map(it => {
                    const perSq = isRoofing && it.per_square;
                    return (
                      <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                        {isRoofing && (
                          <button onClick={() => togglePerSquare(s.id, it.id)} title="Auto-fill quantity from adjusted squares" className={'col-span-1 text-[10px] font-medium px-1.5 py-1.5 rounded border ' + (perSq ? 'bg-brand-blue/20 border-brand-blue text-brand-blue' : 'border-navy-700 text-gray-500 hover:text-gray-300')}>/sq</button>
                        )}
                        <input value={it.description} onChange={(e) => updateItem(s.id, it.id, { description: e.target.value })} placeholder="Description" className={(isRoofing ? 'col-span-4' : 'col-span-5') + ' bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500'} />
                        {perSq ? (
                          <div className="col-span-2 bg-navy-800 border border-navy-700 rounded px-2 py-1.5 text-sm text-brand-blue text-center" title="From adjusted squares">{adjSquares.toFixed(1)} sq</div>
                        ) : (
                          <input value={it.qty} onChange={(e) => updateItem(s.id, it.id, { qty: e.target.value })} type="number" placeholder="Qty" className="col-span-2 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                        )}
                        <input value={it.unit_cost} onChange={(e) => updateItem(s.id, it.id, { unit_cost: e.target.value })} type="number" placeholder="Unit cost" className="col-span-2 bg-navy-950 border border-navy-700 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500" />
                        <span className="col-span-2 text-right text-sm text-gray-300">{money(effQty(it) * num(it.unit_cost))}</span>
                        <button onClick={() => removeItem(s.id, it.id)} className="col-span-1 text-gray-500 hover:text-red-400 flex justify-end"><Trash2 size={14} /></button>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => addItem(s.id)} className="mt-3 text-xs text-brand-blue hover:text-brand-light flex items-center gap-1"><Plus size={14} /> Add line item</button>
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
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1"><span>Gross Margin</span><span className="text-brand-blue font-medium">{num(grossMargin).toFixed(0)}%</span></div>
            <input type="range" min="0" max="90" step="1" value={grossMargin} onChange={(e) => setGrossMargin(e.target.value)} className="w-full accent-brand-blue" />
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
