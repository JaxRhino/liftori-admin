import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient, HubPage, StatCard, Section } from './_shared';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

// Lead Sources & Attribution. Reads the tenant's OWN Supabase via
// useCrmClient(). Tracks where every lead/customer came from
// (customer_contacts.lead_source) and reports ROI per source against a
// configurable cost. Sources are managed from this page (lead_sources).

const CATEGORY_META = {
  referral:   { label: 'Referral',   color: 'bg-emerald-500/20 text-emerald-300' },
  web:        { label: 'Web',        color: 'bg-blue-500/20 text-blue-300' },
  ads:        { label: 'Ads',        color: 'bg-amber-500/20 text-amber-300' },
  canvassing: { label: 'Canvassing', color: 'bg-cyan-500/20 text-cyan-300' },
  other:      { label: 'Other',      color: 'bg-gray-500/20 text-gray-300' },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_META);
const WON_STAGES = ['won', 'closed_won', 'ops'];
const norm = (s) => (s || '').toString().trim().toLowerCase();
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString();
const blankSource = () => ({ name: '', label: '', category: 'other', cost_cents: 0, is_active: true, sort_order: 99 });

export default function CrmLeadSources() {
  const { client } = useCrmClient();
  const [sources, setSources] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {..} = edit
  const [form, setForm] = useState(blankSource());

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client]);

  async function load() {
    try {
      setLoading(true);
      const [srcRes, contactRes, dealRes] = await Promise.all([
        client.from('lead_sources').select('*').order('sort_order'),
        client.from('customer_contacts').select('id, lead_source, contact_type, lifetime_value'),
        client.from('customer_pipeline').select('contact_id, deal_value, stage'),
      ]);
      setSources(srcRes?.data || []);
      setContacts(contactRes?.data || []);
      setDeals(dealRes?.data || []);
    } catch (e) {
      console.error('Lead sources load failed', e);
      toast.error('Failed to load lead sources');
    } finally {
      setLoading(false);
    }
  }

  function metrics(b, cost_cents) {
    const cost = (Number(cost_cents) || 0) / 100;
    const conv = b.leads ? (b.won / b.leads) * 100 : 0;
    const cpl = b.leads && cost ? cost / b.leads : null;
    const cpa = b.won && cost ? cost / b.won : null;
    const roi = cost > 0 ? ((b.revenue - cost) / cost) * 100 : null;
    return { ...b, cost_cents, conv, cpl, cpa, roi };
  }

  // ----- attribution roll-up ----------------------------------------------
  const { rows, totals } = useMemo(() => {
    const openByContact = {};
    const wonByContact = {};
    for (const d of deals) {
      const v = Number(d.deal_value) || 0;
      if (WON_STAGES.includes(norm(d.stage))) wonByContact[d.contact_id] = (wonByContact[d.contact_id] || 0) + v;
      else openByContact[d.contact_id] = (openByContact[d.contact_id] || 0) + v;
    }

    const buckets = {};
    const ensure = (key) => (buckets[key] = buckets[key] || { leads: 0, won: 0, revenue: 0, pipeline: 0 });
    for (const c of contacts) {
      const key = norm(c.lead_source) || '__none__';
      const b = ensure(key);
      b.leads += 1;
      if (norm(c.contact_type) === 'customer') b.won += 1;
      b.revenue += Number(c.lifetime_value) || 0;
      b.pipeline += openByContact[c.id] || 0;
      b.revenue += wonByContact[c.id] || 0;
    }

    const known = new Set(sources.map((s) => norm(s.name)));
    const display = sources.map((s) => {
      const b = buckets[norm(s.name)] || { leads: 0, won: 0, revenue: 0, pipeline: 0 };
      return { ...metrics(b, s.cost_cents), id: s.id, name: s.name, label: s.label || s.name, category: s.category || 'other', cost_cents: s.cost_cents || 0, is_active: s.is_active, configured: true };
    });
    for (const [key, b] of Object.entries(buckets)) {
      if (key === '__none__') {
        display.push({ ...metrics(b, 0), id: 'none', name: '', label: 'Unattributed', category: 'other', cost_cents: 0, is_active: true, configured: false });
      } else if (!known.has(key)) {
        display.push({ ...metrics(b, 0), id: 'unmatched-' + key, name: key, label: key, category: 'other', cost_cents: 0, is_active: true, configured: false });
      }
    }
    display.sort((a, b) => b.revenue - a.revenue);

    const t = display.reduce((acc, r) => {
      acc.leads += r.leads; acc.won += r.won; acc.revenue += r.revenue; acc.pipeline += r.pipeline; acc.cost += r.cost_cents / 100;
      return acc;
    }, { leads: 0, won: 0, revenue: 0, pipeline: 0, cost: 0 });
    t.roi = t.cost > 0 ? ((t.revenue - t.cost) / t.cost) * 100 : null;
    const paid = display.filter((r) => r.cost_cents > 0);
    t.best = paid.length ? paid.reduce((m, r) => (r.roi != null && (m == null || r.roi > m.roi) ? r : m), null) : null;
    return { rows: display, totals: t };
  }, [sources, contacts, deals]);

  // ----- source CRUD -------------------------------------------------------
  function openNew() { setForm(blankSource()); setEditing({}); }
  function openEdit(r) {
    setForm({ name: r.name, label: r.label, category: r.category, cost_cents: r.cost_cents, is_active: r.is_active, sort_order: r.sort_order ?? 99 });
    setEditing(r);
  }
  async function saveSource() {
    const name = norm(form.name) || norm(form.label);
    if (!name) { toast.error('Name is required'); return; }
    const payload = {
      name,
      label: form.label || form.name,
      category: form.category,
      cost_cents: Math.round(Number(form.cost_cents) || 0),
      is_active: !!form.is_active,
      sort_order: Number(form.sort_order) || 99,
    };
    try {
      if (editing && editing.id && editing.configured) {
        const { error } = await client.from('lead_sources').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Source updated');
      } else {
        const { error } = await client.from('lead_sources').insert(payload);
        if (error) throw error;
        toast.success('Source added');
      }
      setEditing(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Save failed');
    }
  }
  async function deleteSource(r) {
    if (!r.id || !r.configured) return;
    if (!window.confirm('Delete "' + r.label + '"? Attribution on existing contacts is kept.')) return;
    try {
      const { error } = await client.from('lead_sources').delete().eq('id', r.id);
      if (error) throw error;
      toast.success('Source removed');
      load();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Delete failed');
    }
  }
  function setCost(cents) { setForm((f) => ({ ...f, cost_cents: cents })); }

  function roiCell(roi, cost_cents, revenue) {
    if (cost_cents > 0) {
      const cls = roi >= 0 ? 'text-emerald-400' : 'text-red-400';
      return <span className={'font-semibold ' + cls}>{roi >= 0 ? '+' : ''}{Math.round(roi)}%</span>;
    }
    if (revenue > 0) return <span className="text-emerald-400/80">Organic</span>;
    return <span className="text-gray-600">&mdash;</span>;
  }

  return (
    <HubPage
      title="Lead Sources"
      subtitle="Where every lead comes from -- and the return each source delivers."
      actions={
        <Button onClick={() => setManageOpen(true)} variant="outline" className="border-navy-700 text-gray-200">
          <SlidersHorizontal className="w-4 h-4 mr-2" /> Manage sources
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Leads" value={totals.leads} />
            <StatCard label="Attributed Revenue" value={money(totals.revenue)} accent="text-emerald-400" />
            <StatCard label="Marketing Spend" value={money(totals.cost)} accent="text-amber-400" hint="across paid sources" />
            <StatCard
              label="Best ROI Source"
              value={totals.best ? totals.best.label : '—'}
              accent="text-brand-blue"
              hint={totals.best && totals.best.roi != null ? '+' + Math.round(totals.best.roi) + '% return' : 'add cost to a source'}
            />
          </div>

          <Section title="Performance by source">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                    <th className="text-left px-5 py-3 font-medium">Source</th>
                    <th className="text-right px-4 py-3 font-medium">Leads</th>
                    <th className="text-right px-4 py-3 font-medium">Won</th>
                    <th className="text-right px-4 py-3 font-medium">Conv.</th>
                    <th className="text-right px-4 py-3 font-medium">Pipeline</th>
                    <th className="text-right px-4 py-3 font-medium">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium">Cost</th>
                    <th className="text-right px-4 py-3 font-medium">CPL</th>
                    <th className="text-right px-4 py-3 font-medium">CPA</th>
                    <th className="text-right px-5 py-3 font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-500">No leads attributed yet. Set a Lead Source on a customer to see it here.</td></tr>
                  )}
                  {rows.map((r) => {
                    const cat = CATEGORY_META[r.category] || CATEGORY_META.other;
                    return (
                      <tr key={r.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{r.label}</span>
                            <Badge className={cat.color + ' text-[10px]'}>{cat.label}</Badge>
                            {!r.configured && <span className="text-[10px] text-gray-500">unconfigured</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-200">{r.leads}</td>
                        <td className="px-4 py-3 text-right text-gray-200">{r.won}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{Math.round(r.conv)}%</td>
                        <td className="px-4 py-3 text-right text-gray-400">{money(r.pipeline)}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{money(r.revenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{r.cost_cents > 0 ? money(r.cost_cents / 100) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{r.cpl != null ? money(r.cpl) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{r.cpa != null ? money(r.cpa) : '—'}</td>
                        <td className="px-5 py-3 text-right">{roiCell(r.roi, r.cost_cents, r.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
          <p className="text-xs text-gray-600">
            Revenue is realized customer lifetime value plus won deals; pipeline is the value of open deals. ROI = (revenue minus cost) divided by cost, using each source's configured cost.
          </p>
        </div>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage lead sources</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {sources.map((s) => {
              const cat = CATEGORY_META[s.category] || CATEGORY_META.other;
              return (
                <div key={s.id} className="flex items-center justify-between bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white text-sm truncate">{s.label || s.name}</span>
                    <Badge className={cat.color + ' text-[10px]'}>{cat.label}</Badge>
                    {!s.is_active && <span className="text-[10px] text-gray-500">inactive</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{s.cost_cents > 0 ? money(s.cost_cents / 100) : 'no cost'}</span>
                    <button onClick={() => openEdit({ ...s, configured: true })} className="px-2 py-1 bg-brand-blue/20 hover:bg-brand-blue/30 text-brand-blue rounded text-xs transition">Edit</button>
                    <button onClick={() => deleteSource({ ...s, configured: true })} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
            {sources.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">No sources yet. Add your first one.</p>}
          </div>
          <DialogFooter>
            <Button onClick={openNew} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing != null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-md">
          <DialogHeader><DialogTitle>{editing && editing.id && editing.configured ? 'Edit source' : 'New source'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Display name</label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="Google Ads" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-navy-800 border border-navy-700 text-white rounded px-3 py-2">
                  {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Cost (period spend)</label>
                <Input type="number" min="0" value={form.cost_cents ? form.cost_cents / 100 : ''} onChange={(e) => setCost(Math.round((Number(e.target.value) || 0) * 100))} className="bg-navy-800 border-navy-700 text-white placeholder-gray-500" placeholder="0" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-blue" />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-navy-700 text-gray-300">Cancel</Button>
            <Button onClick={saveSource} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HubPage>
  );
}
