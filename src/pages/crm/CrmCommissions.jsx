import React, { useState, useEffect, useMemo } from 'react';
import { useCrmClient, HubPage, StatCard, Section } from './_shared';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

// Sales commission tracking. Reads the tenant's OWN Supabase via useCrmClient().
// Commission is earned by a deal's assigned rep when the deal is sold
// (stage won/ops). Rates live in commission_rates (per-rep + a default row);
// earned commissions are persisted in sales_commissions with a payout status.

const WON_STAGES = ['won', 'closed_won', 'ops'];
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString();
const statusMeta = {
  pending:  { label: 'Pending',  color: 'bg-amber-500/20 text-amber-300' },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-300' },
  paid:     { label: 'Paid',     color: 'bg-emerald-500/20 text-emerald-300' },
};

export default function CrmCommissions() {
  const { client } = useCrmClient();
  const [commissions, setCommissions] = useState([]);
  const [deals, setDeals] = useState([]);
  const [team, setTeam] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [rateDraft, setRateDraft] = useState({}); // user_id|'__default__' -> pct string

  useEffect(() => { if (client) load(); /* eslint-disable-next-line */ }, [client]);

  async function load() {
    try {
      setLoading(true);
      const [cRes, dRes, tRes, rRes] = await Promise.all([
        client.from('sales_commissions').select('*').order('created_at', { ascending: false }),
        client.from('customer_pipeline').select('id, title, stage, deal_value, assigned_to, won_date'),
        client.from('org_team_members').select('id, user_id, first_name, last_name, role, status'),
        client.from('commission_rates').select('*'),
      ]);
      setCommissions(cRes?.data || []);
      setDeals(dRes?.data || []);
      setTeam(tRes?.data || []);
      setRates(rRes?.data || []);
    } catch (e) {
      console.error('commission load failed', e);
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }

  const repByUser = useMemo(() => {
    const m = {};
    for (const t of team) if (t.user_id) m[t.user_id] = (t.first_name || '') + ' ' + (t.last_name || '');
    return m;
  }, [team]);
  const defaultRate = useMemo(() => {
    const d = rates.find((r) => !r.rep_user_id);
    return d ? Number(d.rate_pct) : 8;
  }, [rates]);
  const rateByUser = useMemo(() => {
    const m = {};
    for (const r of rates) if (r.rep_user_id) m[r.rep_user_id] = Number(r.rate_pct);
    return m;
  }, [rates]);
  const dealById = useMemo(() => {
    const m = {};
    for (const d of deals) m[d.id] = d;
    return m;
  }, [deals]);

  // sold deals with a rep that don't yet have a commission row
  const uncommitted = useMemo(() => {
    const have = new Set(commissions.map((c) => c.deal_id));
    return deals.filter((d) => WON_STAGES.includes((d.stage || '').toLowerCase()) && d.assigned_to && !have.has(d.id));
  }, [deals, commissions]);

  const { repRows, totals } = useMemo(() => {
    const byRep = {};
    for (const c of commissions) {
      const key = c.rep_user_id || '__none__';
      const r = (byRep[key] = byRep[key] || { rep: repByUser[c.rep_user_id] || 'Unassigned', deals: 0, sold: 0, earned: 0, pending: 0, paid: 0 });
      r.deals += 1;
      r.sold += (c.base_cents || 0) / 100;
      r.earned += (c.amount_cents || 0) / 100;
      if (c.status === 'paid') r.paid += (c.amount_cents || 0) / 100;
      else r.pending += (c.amount_cents || 0) / 100;
    }
    const rows = Object.values(byRep).sort((a, b) => b.earned - a.earned);
    const t = rows.reduce((acc, r) => {
      acc.earned += r.earned; acc.pending += r.pending; acc.paid += r.paid; return acc;
    }, { earned: 0, pending: 0, paid: 0, reps: rows.length });
    return { repRows: rows, totals: t };
  }, [commissions, repByUser]);

  async function syncWonDeals() {
    if (!uncommitted.length) { toast.info('No new sold deals to commission'); return; }
    setBusy(true);
    try {
      const rows = uncommitted.map((d) => {
        const pct = rateByUser[d.assigned_to] ?? defaultRate;
        const base = Number(d.deal_value) || 0;
        return {
          deal_id: d.id, rep_user_id: d.assigned_to, base_cents: Math.round(base * 100),
          rate_pct: pct, amount_cents: Math.round(base * 100 * pct / 100),
          status: 'pending', won_date: d.won_date || new Date().toISOString().slice(0, 10),
        };
      });
      const { error } = await client.from('sales_commissions').insert(rows);
      if (error) throw error;
      toast.success(`Added ${rows.length} commission${rows.length > 1 ? 's' : ''}`);
      load();
    } catch (e) {
      console.error(e); toast.error(e.message || 'Sync failed');
    } finally { setBusy(false); }
  }

  async function setStatus(c, status) {
    try {
      const patch = { status, paid_at: status === 'paid' ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
      const { error } = await client.from('sales_commissions').update(patch).eq('id', c.id);
      if (error) throw error;
      setCommissions((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    } catch (e) {
      console.error(e); toast.error(e.message || 'Update failed');
    }
  }

  function openRates() {
    const d = {};
    d.__default__ = String(defaultRate);
    for (const t of team) if (t.user_id) d[t.user_id] = rateByUser[t.user_id] != null ? String(rateByUser[t.user_id]) : '';
    setRateDraft(d);
    setRatesOpen(true);
  }
  async function saveRates() {
    setBusy(true);
    try {
      // default
      const defPct = Number(rateDraft.__default__) || 0;
      const existingDefault = rates.find((r) => !r.rep_user_id);
      if (existingDefault) await client.from('commission_rates').update({ rate_pct: defPct }).eq('id', existingDefault.id);
      else await client.from('commission_rates').insert({ rep_user_id: null, rate_pct: defPct });
      // per-rep
      for (const t of team) {
        if (!t.user_id) continue;
        const raw = rateDraft[t.user_id];
        const existing = rates.find((r) => r.rep_user_id === t.user_id);
        if (raw === '' || raw == null) {
          if (existing) await client.from('commission_rates').delete().eq('id', existing.id);
        } else {
          const pct = Number(raw) || 0;
          if (existing) await client.from('commission_rates').update({ rate_pct: pct }).eq('id', existing.id);
          else await client.from('commission_rates').insert({ rep_user_id: t.user_id, rate_pct: pct });
        }
      }
      toast.success('Rates saved');
      setRatesOpen(false);
      load();
    } catch (e) {
      console.error(e); toast.error(e.message || 'Save failed');
    } finally { setBusy(false); }
  }

  const reps = team.filter((t) => t.user_id);

  return (
    <HubPage
      title="Commissions"
      subtitle="Per-rep commission on sold jobs, with payout tracking."
      actions={
        <div className="flex items-center gap-2">
          <Button onClick={openRates} variant="outline" className="border-navy-700 text-gray-200">
            <SlidersHorizontal className="w-4 h-4 mr-2" /> Rates
          </Button>
          <Button onClick={syncWonDeals} disabled={busy} className="bg-brand-blue hover:bg-brand-blue/90 text-white">
            <RefreshCw className="w-4 h-4 mr-2" /> Sync sold deals{uncommitted.length ? ` (${uncommitted.length})` : ''}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Earned" value={money(totals.earned)} />
            <StatCard label="Pending Payout" value={money(totals.pending)} accent="text-amber-400" hint="not yet paid" />
            <StatCard label="Paid Out" value={money(totals.paid)} accent="text-emerald-400" />
            <StatCard label="Reps with Commission" value={totals.reps} accent="text-brand-blue" />
          </div>

          <Section title="Payout by rep">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                    <th className="text-left px-5 py-3 font-medium">Rep</th>
                    <th className="text-right px-4 py-3 font-medium">Sold Deals</th>
                    <th className="text-right px-4 py-3 font-medium">Total Sold</th>
                    <th className="text-right px-4 py-3 font-medium">Earned</th>
                    <th className="text-right px-4 py-3 font-medium">Pending</th>
                    <th className="text-right px-5 py-3 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {repRows.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No commissions yet. Win a deal with an assigned rep, then Sync sold deals.</td></tr>
                  )}
                  {repRows.map((r, i) => (
                    <tr key={i} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                      <td className="px-5 py-3 text-white font-medium">{r.rep}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{r.deals}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{money(r.sold)}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{money(r.earned)}</td>
                      <td className="px-4 py-3 text-right text-amber-400">{money(r.pending)}</td>
                      <td className="px-5 py-3 text-right text-emerald-400">{money(r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Commission detail">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-navy-700/50">
                    <th className="text-left px-5 py-3 font-medium">Deal</th>
                    <th className="text-left px-4 py-3 font-medium">Rep</th>
                    <th className="text-right px-4 py-3 font-medium">Sale</th>
                    <th className="text-right px-4 py-3 font-medium">Rate</th>
                    <th className="text-right px-4 py-3 font-medium">Commission</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-500">No commission records.</td></tr>
                  )}
                  {commissions.map((c) => {
                    const sm = statusMeta[c.status] || statusMeta.pending;
                    const deal = dealById[c.deal_id];
                    return (
                      <tr key={c.id} className="border-b border-navy-700/30 hover:bg-navy-900/40">
                        <td className="px-5 py-3 text-white">{deal ? deal.title : '(deal removed)'}</td>
                        <td className="px-4 py-3 text-gray-300">{repByUser[c.rep_user_id] || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{money((c.base_cents || 0) / 100)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{Number(c.rate_pct)}%</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{money((c.amount_cents || 0) / 100)}</td>
                        <td className="px-4 py-3"><Badge className={sm.color + ' text-[10px]'}>{sm.label}</Badge></td>
                        <td className="px-5 py-3 text-right">
                          {c.status === 'paid' ? (
                            <button onClick={() => setStatus(c, 'pending')} className="px-2 py-1 bg-navy-700/60 hover:bg-navy-700 text-gray-300 rounded text-xs transition">Mark unpaid</button>
                          ) : (
                            <button onClick={() => setStatus(c, 'paid')} className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs transition">Mark paid</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
          <p className="text-xs text-gray-600">
            A rep earns commission when their deal reaches a sold stage (Won or Ops). Sync sold deals creates any missing records using the rep's rate, or the default when none is set.
          </p>
        </div>
      )}

      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
        <DialogContent className="bg-navy-900 border-navy-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Commission rates</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-200">Default rate</span>
              <div className="flex items-center gap-1">
                <Input type="number" min="0" value={rateDraft.__default__ ?? ''} onChange={(e) => setRateDraft((d) => ({ ...d, __default__: e.target.value }))} className="w-24 bg-navy-800 border-navy-700 text-white text-right" />
                <span className="text-gray-400 text-sm">%</span>
              </div>
            </div>
            <div className="h-px bg-navy-700/50" />
            {reps.length === 0 && <p className="text-sm text-gray-500">No team members with logins yet. Reps appear here once they have an account.</p>}
            {reps.map((t) => (
              <div key={t.user_id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-300">{t.first_name} {t.last_name}<span className="text-gray-600 text-xs ml-2">{t.role}</span></span>
                <div className="flex items-center gap-1">
                  <Input type="number" min="0" placeholder="default" value={rateDraft[t.user_id] ?? ''} onChange={(e) => setRateDraft((d) => ({ ...d, [t.user_id]: e.target.value }))} className="w-24 bg-navy-800 border-navy-700 text-white text-right" />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-600">Leave a rep blank to use the default rate. Changing a rate affects future commissions; existing records keep their rate.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatesOpen(false)} className="border-navy-700 text-gray-300">Cancel</Button>
            <Button onClick={saveRates} disabled={busy} className="bg-brand-blue hover:bg-brand-blue/90 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HubPage>
  );
}
