import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

const CATEGORIES = [
  'AI / Tooling',
  'Infrastructure',
  'Database',
  'Domains / DNS',
  'Software / SaaS',
  'Marketing',
  'Contractors',
  'Payments / Fees',
  'Other',
];

const BILLING_CYCLES = [
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['annual', 'Annual'],
  ['weekly', 'Weekly'],
];

const SUB_STATUSES = ['active', 'paused', 'cancelled'];
const RELATIONSHIPS = ['investor', 'friend', 'family', 'advisor', 'contractor', 'other'];
const CONTRIB_TYPES = [
  ['cash_investment', 'Cash investment'],
  ['loan', 'Loan'],
  ['free_help', 'Free help / sweat'],
  ['in_kind', 'In-kind'],
  ['other', 'Other'],
];
const REPAY_TYPES = [
  ['equity', 'Equity %'],
  ['loan_interest', 'Loan + interest'],
  ['revenue_share', 'Revenue share'],
  ['fixed_payback', 'Fixed payback'],
  ['favor', 'Favor / thank-you'],
  ['none', 'None set'],
];
const INV_STATUSES = ['active', 'ongoing', 'repaid', 'written_off'];

const fld = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500';
const lbl = 'text-xs text-slate-400 block mb-1';

const money = (n) =>
  '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().split('T')[0];
const monthKey = (d) => (d || '').slice(0, 7);

function monthlyEquiv(amount, cycle) {
  const a = parseFloat(amount || 0);
  switch (cycle) {
    case 'weekly': return (a * 52) / 12;
    case 'quarterly': return a / 3;
    case 'annual': return a / 12;
    default: return a; // monthly
  }
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - new Date(todayISO() + 'T00:00:00')) / 86400000);
}

const cycleLabel = (c) => (BILLING_CYCLES.find((x) => x[0] === c) || [c, c])[1];
const contribLabel = (c) => (CONTRIB_TYPES.find((x) => x[0] === c) || [c, c])[1];
const repayLabel = (c) => (REPAY_TYPES.find((x) => x[0] === c) || [c, c])[1];

export default function CostTracker() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  const [costs, setCosts] = useState([]);
  const [subs, setSubs] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [aiCost, setAiCost] = useState(0);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [c, s, i, p, ai] = await Promise.all([
        supabase.from('operations_costs').select('*').order('date', { ascending: false }),
        supabase.from('cost_subscriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('cost_investments').select('*').order('contribution_date', { ascending: false }),
        supabase.from('cost_investment_payments').select('*').order('payment_date', { ascending: false }),
        supabase.from('ai_agent_cost_rollup').select('total_cost_usd'),
      ]);
      if (c.error) throw c.error;
      setCosts(c.data || []);
      setSubs(s.error ? [] : (s.data || []));
      setInvestments(i.error ? [] : (i.data || []));
      setPayments(p.error ? [] : (p.data || []));
      setAiCost((ai.data || []).reduce((sum, r) => sum + parseFloat(r.total_cost_usd || 0), 0));
    } catch (err) {
      console.error('Cost tracker load error:', err);
      toast.error('Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }

  // ---- derived metrics ----
  const metrics = useMemo(() => {
    const activeSubs = subs.filter((s) => s.status === 'active');
    const monthlyRecurring = activeSubs.reduce((sum, s) => sum + monthlyEquiv(s.amount, s.billing_cycle), 0);
    const totalSpend = costs.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
    const thisMonth = monthKey(todayISO());
    const thisMonthSpend = costs
      .filter((c) => monthKey(c.date) === thisMonth)
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

    const byCat = {};
    costs.forEach((c) => { byCat[c.category] = (byCat[c.category] || 0) + parseFloat(c.amount || 0); });
    activeSubs.forEach((s) => {
      byCat[s.category] = (byCat[s.category] || 0) + monthlyEquiv(s.amount, s.billing_cycle);
    });

    // last 6 months one-time spend
    const months = [];
    const base = new Date(todayISO() + 'T00:00:00');
    for (let k = 5; k >= 0; k--) {
      const d = new Date(base.getFullYear(), base.getMonth() - k, 1);
      const key = d.toISOString().slice(0, 7);
      months.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        total: costs.filter((c) => monthKey(c.date) === key).reduce((s, c) => s + parseFloat(c.amount || 0), 0),
      });
    }

    const upcoming = activeSubs
      .filter((s) => s.next_renewal)
      .map((s) => ({ ...s, dleft: daysUntil(s.next_renewal) }))
      .filter((s) => s.dleft !== null && s.dleft <= 45)
      .sort((a, b) => a.dleft - b.dleft);

    const totalInvested = investments.reduce((sum, v) => sum + parseFloat(v.amount || 0), 0);
    const totalOwed = investments.reduce((sum, v) => sum + parseFloat(v.amount_owed || 0), 0);
    const totalRepaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const outstanding = Math.max(0, totalOwed - totalRepaid);

    return {
      activeSubsCount: activeSubs.length,
      monthlyRecurring,
      annualRecurring: monthlyRecurring * 12,
      totalSpend,
      thisMonthSpend,
      byCat,
      months,
      upcoming,
      totalInvested,
      totalOwed,
      totalRepaid,
      outstanding,
      backers: investments.length,
    };
  }, [costs, subs, investments, payments]);

  const repaidFor = (invId) =>
    payments.filter((p) => p.investment_id === invId).reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  if (loading) return <div className="p-6 text-slate-400">Loading cost data...</div>;

  const TABS = [
    ['dashboard', 'Dashboard'],
    ['ledger', 'Cost Ledger'],
    ['recurring', 'Recurring & Subscriptions'],
    ['investments', 'Investments & Backers'],
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Cost Tracker</h1>
        <p className="text-slate-400 text-sm mt-1">
          Every cost, subscription, and backer in one place — so the whole picture is always clear.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-700 mb-6 overflow-x-auto">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === k
                ? 'border-sky-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <Dashboard metrics={metrics} aiCost={aiCost} subs={subs} costs={costs} onGo={setTab} />}
      {tab === 'ledger' && <LedgerTab costs={costs} user={user} refresh={fetchAll} />}
      {tab === 'recurring' && <RecurringTab subs={subs} metrics={metrics} user={user} refresh={fetchAll} />}
      {tab === 'investments' && (
        <InvestmentsTab investments={investments} payments={payments} repaidFor={repaidFor} user={user} refresh={fetchAll} />
      )}
    </div>
  );
}

/* ===================== DASHBOARD ===================== */
function Kpi({ label, value, sub, tone = 'white' }) {
  const toneCls = { white: 'text-white', red: 'text-red-400', green: 'text-emerald-400', yellow: 'text-amber-400', sky: 'text-sky-400' }[tone];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function Dashboard({ metrics, aiCost, subs, costs, onGo }) {
  const m = metrics;
  const maxMonth = Math.max(...m.months.map((x) => x.total), 1);
  const cats = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...cats.map((c) => c[1]), 1);
  const recent = [...costs].slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Spend KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total Spend (logged)" value={money(m.totalSpend)} sub={`${costs.length} entries`} tone="red" />
        <Kpi label="This Month" value={money(m.thisMonthSpend)} sub="one-time costs" />
        <Kpi label="Monthly Recurring" value={money(m.monthlyRecurring)} sub={`${m.activeSubsCount} active subscriptions`} tone="yellow" />
        <Kpi label="Annual Run-Rate" value={money(m.annualRecurring)} sub="recurring x 12" tone="yellow" />
      </div>

      {/* Investment KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Total Invested / Contributed" value={money(m.totalInvested)} sub={`${m.backers} backers`} tone="sky" />
        <Kpi label="Promised to Repay" value={money(m.totalOwed)} />
        <Kpi label="Repaid to Date" value={money(m.totalRepaid)} tone="green" />
        <Kpi label="Outstanding to Backers" value={money(m.outstanding)} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 6-month spend trend */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-300 text-sm font-semibold mb-4">One-Time Spend — Last 6 Months</p>
          <div className="flex items-end gap-3 h-40">
            {m.months.map((mo) => (
              <div key={mo.key} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[10px] text-slate-400 mb-1">{mo.total > 0 ? money(mo.total).replace('.00', '') : ''}</span>
                <div
                  className="w-full bg-sky-500/80 rounded-t"
                  style={{ height: `${Math.max((mo.total / maxMonth) * 100, mo.total > 0 ? 4 : 0)}%` }}
                />
                <span className="text-[11px] text-slate-500 mt-1.5">{mo.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown (costs + recurring monthly) */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-300 text-sm font-semibold mb-4">Spend by Category <span className="text-slate-500 font-normal">(logged + monthly recurring)</span></p>
          {cats.length === 0 ? (
            <p className="text-slate-500 text-sm">No costs recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {cats.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{cat}</span>
                    <span className="text-slate-400">{money(amt)}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(amt / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming renewals */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-300 text-sm font-semibold">Upcoming Renewals <span className="text-slate-500 font-normal">(next 45 days)</span></p>
            <button onClick={() => onGo('recurring')} className="text-sky-400 hover:text-sky-300 text-xs">Manage</button>
          </div>
          {m.upcoming.length === 0 ? (
            <p className="text-slate-500 text-sm">Nothing renewing soon.</p>
          ) : (
            <div className="space-y-2">
              {m.upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-white">{s.name}</span>
                    <span className="text-slate-500 text-xs ml-2">{cycleLabel(s.billing_cycle)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-300">{money(s.amount)}</span>
                    <span className={`text-xs ml-2 ${s.dleft <= 7 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {s.dleft <= 0 ? 'due' : `${s.dleft}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI usage + recent */}
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">AI Usage Cost (tracked by platform)</p>
            <p className="text-2xl font-bold text-white mt-1">{money(aiCost)}</p>
            <p className="text-slate-500 text-xs mt-1">Live total from agent invocations — read-only, not double-counted in logged spend.</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-300 text-sm font-semibold">Recent Costs</p>
              <button onClick={() => onGo('ledger')} className="text-sky-400 hover:text-sky-300 text-xs">View all</button>
            </div>
            {recent.length === 0 ? (
              <p className="text-slate-500 text-sm">No costs yet.</p>
            ) : (
              <div className="space-y-1.5">
                {recent.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300 truncate mr-3">{c.description}</span>
                    <span className="text-red-400 whitespace-nowrap">{money(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== COST LEDGER ===================== */
function LedgerTab({ costs, user, refresh }) {
  const blank = { date: todayISO(), description: '', category: 'AI / Tooling', vendor: '', amount: '', payment_method: '', notes: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [filterCat, setFilterCat] = useState('All');

  function startAdd() { setForm(blank); setEditing(null); setShowForm(true); }
  function startEdit(c) {
    setForm({ date: c.date, description: c.description, category: c.category, vendor: c.vendor || '', amount: String(c.amount), payment_method: c.payment_method || '', notes: c.notes || '' });
    setEditing(c.id); setShowForm(true);
  }

  async function save() {
    if (!form.description.trim() || !form.amount) { toast.error('Description and amount are required'); return; }
    const payload = {
      date: form.date, description: form.description.trim(), category: form.category,
      vendor: form.vendor.trim() || null, amount: parseFloat(form.amount),
      payment_method: form.payment_method.trim() || null, notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('operations_costs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing);
        if (error) throw error; toast.success('Cost updated');
      } else {
        const { error } = await supabase.from('operations_costs').insert({ ...payload, created_by: user?.id });
        if (error) throw error; toast.success('Cost added');
      }
      setShowForm(false); setEditing(null); setForm(blank); refresh();
    } catch (err) { console.error(err); toast.error('Failed to save'); }
  }

  async function del(id) {
    if (!confirm('Delete this cost entry?')) return;
    const { error } = await supabase.from('operations_costs').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted'); refresh();
  }

  const cats = useMemo(() => {
    const o = {}; costs.forEach((c) => { o[c.category] = (o[c.category] || 0) + parseFloat(c.amount || 0); }); return o;
  }, [costs]);
  const filtered = filterCat === 'All' ? costs : costs.filter((c) => c.category === filterCat);
  const totalFiltered = filtered.reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  const rows = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
    let run = 0;
    return sorted.map((c) => { run += parseFloat(c.amount || 0); return { ...c, run }; }).reverse();
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">One-time and ad-hoc costs you and Mike paid for.</p>
        <button onClick={startAdd} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Cost</button>
      </div>

      {Object.keys(cats).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterCat('All')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterCat === 'All' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>All</button>
          {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'All' : cat)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterCat === cat ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {cat}: {money(amt)}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">{editing ? 'Edit Cost' : 'Add New Cost'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={lbl}>Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fld} /></div>
            <div><label className={lbl}>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={fld}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={lbl}>Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Claude API top-up" className={fld} /></div>
            <div><label className={lbl}>Vendor (optional)</label><input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Anthropic" className={fld} /></div>
            <div><label className={lbl}>Amount ($)</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={fld} /></div>
            <div><label className={lbl}>Payment method (optional)</label><input type="text" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="e.g. Amex card" className={fld} /></div>
            <div className="md:col-span-2"><label className={lbl}>Notes (optional)</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional details..." className={fld} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-medium">{editing ? 'Update' : 'Add Cost'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-4 py-3">Date</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Description</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Category</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Vendor</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Amount</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Running Total</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No costs recorded yet</td></tr>
              ) : rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{c.date}</td>
                  <td className="px-4 py-3 text-white font-medium">{c.description}{c.notes ? <span className="block text-slate-500 text-xs font-normal">{c.notes}</span> : null}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">{c.category}</span></td>
                  <td className="px-4 py-3 text-slate-400">{c.vendor || '—'}</td>
                  <td className="px-4 py-3 text-right text-red-400 font-medium">{money(c.amount)}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-medium">{money(c.run)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(c)} className="text-sky-400 hover:text-sky-300 text-xs mr-3">Edit</button>
                    <button onClick={() => del(c.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td className="px-4 py-3 text-white font-semibold" colSpan={4}>{filterCat !== 'All' ? `Total (${filterCat})` : 'Grand Total'}</td>
                  <td className="px-4 py-3 text-right text-red-400 font-bold">{money(totalFiltered)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== RECURRING & SUBSCRIPTIONS ===================== */
function RecurringTab({ subs, metrics, user, refresh }) {
  const blank = { name: '', vendor: '', category: 'Software / SaaS', amount: '', billing_cycle: 'monthly', next_renewal: '', started_on: '', status: 'active', payment_method: '', manage_url: '', notes: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState('active');

  function startAdd() { setForm(blank); setEditing(null); setShowForm(true); }
  function startEdit(s) {
    setForm({ name: s.name, vendor: s.vendor || '', category: s.category, amount: String(s.amount), billing_cycle: s.billing_cycle, next_renewal: s.next_renewal || '', started_on: s.started_on || '', status: s.status, payment_method: s.payment_method || '', manage_url: s.manage_url || '', notes: s.notes || '' });
    setEditing(s.id); setShowForm(true);
  }

  async function save() {
    if (!form.name.trim() || !form.amount) { toast.error('Name and amount are required'); return; }
    const payload = {
      name: form.name.trim(), vendor: form.vendor.trim() || null, category: form.category,
      amount: parseFloat(form.amount), billing_cycle: form.billing_cycle,
      next_renewal: form.next_renewal || null, started_on: form.started_on || null,
      status: form.status, payment_method: form.payment_method.trim() || null,
      manage_url: form.manage_url.trim() || null, notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('cost_subscriptions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing);
        if (error) throw error; toast.success('Subscription updated');
      } else {
        const { error } = await supabase.from('cost_subscriptions').insert({ ...payload, created_by: user?.id });
        if (error) throw error; toast.success('Subscription added');
      }
      setShowForm(false); setEditing(null); setForm(blank); refresh();
    } catch (err) { console.error(err); toast.error('Failed to save'); }
  }

  async function del(id) {
    if (!confirm('Delete this subscription?')) return;
    const { error } = await supabase.from('cost_subscriptions').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted'); refresh();
  }

  const shown = filter === 'all' ? subs : subs.filter((s) => s.status === filter);
  const statusPill = { active: 'bg-emerald-500/15 text-emerald-400', paused: 'bg-amber-500/15 text-amber-400', cancelled: 'bg-slate-600/40 text-slate-400' };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Kpi label="Monthly Recurring" value={money(metrics.monthlyRecurring)} sub={`${metrics.activeSubsCount} active`} tone="yellow" />
        <Kpi label="Annual Run-Rate" value={money(metrics.annualRecurring)} tone="yellow" />
        <Kpi label="Renewing in 45 days" value={String(metrics.upcoming.length)} sub={metrics.upcoming[0] ? `next: ${metrics.upcoming[0].name}` : 'none soon'} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['active', 'paused', 'cancelled', 'all'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === f ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{f}</button>
          ))}
        </div>
        <button onClick={startAdd} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Subscription</button>
      </div>

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">{editing ? 'Edit Subscription' : 'Add Subscription / Recurring Charge'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={lbl}>Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Supabase Pro" className={fld} /></div>
            <div><label className={lbl}>Vendor (optional)</label><input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Supabase" className={fld} /></div>
            <div><label className={lbl}>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={fld}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className={lbl}>Amount ($)</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={fld} /></div>
            <div><label className={lbl}>Billing cycle</label><select value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })} className={fld}>{BILLING_CYCLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fld}>{SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className={lbl}>Next renewal</label><input type="date" value={form.next_renewal} onChange={(e) => setForm({ ...form, next_renewal: e.target.value })} className={fld} /></div>
            <div><label className={lbl}>Started on (optional)</label><input type="date" value={form.started_on} onChange={(e) => setForm({ ...form, started_on: e.target.value })} className={fld} /></div>
            <div><label className={lbl}>Payment method (optional)</label><input type="text" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="e.g. Amex card" className={fld} /></div>
            <div><label className={lbl}>Manage URL (optional)</label><input type="text" value={form.manage_url} onChange={(e) => setForm({ ...form, manage_url: e.target.value })} placeholder="https://..." className={fld} /></div>
            <div className="md:col-span-2"><label className={lbl}>Notes (optional)</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fld} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-medium">{editing ? 'Update' : 'Add Subscription'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-4 py-3">Name</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Category</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Amount</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Cycle</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">/ month</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Next renewal</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Status</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No subscriptions in this view</td></tr>
              ) : shown.map((s) => {
                const dleft = daysUntil(s.next_renewal);
                return (
                  <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{s.manage_url ? <a href={s.manage_url} target="_blank" rel="noreferrer" className="hover:text-sky-400">{s.name}</a> : s.name}</span>
                      {s.vendor ? <span className="block text-slate-500 text-xs">{s.vendor}</span> : null}
                    </td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">{s.category}</span></td>
                    <td className="px-4 py-3 text-right text-slate-200">{money(s.amount)}</td>
                    <td className="px-4 py-3 text-slate-400">{cycleLabel(s.billing_cycle)}</td>
                    <td className="px-4 py-3 text-right text-amber-400">{money(monthlyEquiv(s.amount, s.billing_cycle))}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.next_renewal ? (
                        <span className="text-slate-300">{s.next_renewal}{s.status === 'active' && dleft !== null && dleft <= 14 ? <span className={`ml-2 text-xs ${dleft <= 0 ? 'text-red-400' : 'text-amber-400'}`}>{dleft <= 0 ? 'due' : `${dleft}d`}</span> : null}</span>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusPill[s.status] || 'bg-slate-700 text-slate-300'}`}>{s.status}</span></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(s)} className="text-sky-400 hover:text-sky-300 text-xs mr-3">Edit</button>
                      <button onClick={() => del(s.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== INVESTMENTS & BACKERS ===================== */
function InvestmentsTab({ investments, payments, repaidFor, user, refresh }) {
  const blank = { backer_name: '', backer_email: '', backer_phone: '', relationship: 'investor', contribution_type: 'cash_investment', amount: '', contribution_date: todayISO(), repayment_type: 'none', repayment_terms: '', amount_owed: '', status: 'active', how_they_helped: '', notes: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [selected, setSelected] = useState(null); // investment id for detail
  const [payForm, setPayForm] = useState({ amount: '', payment_date: todayISO(), method: '', note: '' });

  function startAdd() { setForm(blank); setEditing(null); setShowForm(true); setSelected(null); }
  function startEdit(v) {
    setForm({ backer_name: v.backer_name, backer_email: v.backer_email || '', backer_phone: v.backer_phone || '', relationship: v.relationship || 'investor', contribution_type: v.contribution_type, amount: String(v.amount), contribution_date: v.contribution_date || todayISO(), repayment_type: v.repayment_type || 'none', repayment_terms: v.repayment_terms || '', amount_owed: v.amount_owed != null ? String(v.amount_owed) : '', status: v.status, how_they_helped: v.how_they_helped || '', notes: v.notes || '' });
    setEditing(v.id); setShowForm(true);
  }

  async function save() {
    if (!form.backer_name.trim()) { toast.error('Backer name is required'); return; }
    const payload = {
      backer_name: form.backer_name.trim(), backer_email: form.backer_email.trim() || null, backer_phone: form.backer_phone.trim() || null,
      relationship: form.relationship, contribution_type: form.contribution_type, amount: parseFloat(form.amount || 0),
      contribution_date: form.contribution_date || null, repayment_type: form.repayment_type, repayment_terms: form.repayment_terms.trim() || null,
      amount_owed: form.amount_owed === '' ? null : parseFloat(form.amount_owed), status: form.status,
      how_they_helped: form.how_they_helped.trim() || null, notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        const { error } = await supabase.from('cost_investments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing);
        if (error) throw error; toast.success('Backer updated');
      } else {
        const { error } = await supabase.from('cost_investments').insert({ ...payload, created_by: user?.id });
        if (error) throw error; toast.success('Backer added');
      }
      setShowForm(false); setEditing(null); setForm(blank); refresh();
    } catch (err) { console.error(err); toast.error('Failed to save'); }
  }

  async function del(id) {
    if (!confirm('Delete this backer and their repayment history?')) return;
    const { error } = await supabase.from('cost_investments').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted'); setSelected(null); refresh();
  }

  async function addPayment(invId) {
    if (!payForm.amount) { toast.error('Payment amount is required'); return; }
    const { error } = await supabase.from('cost_investment_payments').insert({
      investment_id: invId, amount: parseFloat(payForm.amount), payment_date: payForm.payment_date || todayISO(),
      method: payForm.method.trim() || null, note: payForm.note.trim() || null, created_by: user?.id,
    });
    if (error) { console.error(error); toast.error('Failed to log payment'); return; }
    toast.success('Payment logged'); setPayForm({ amount: '', payment_date: todayISO(), method: '', note: '' }); refresh();
  }

  async function delPayment(id) {
    if (!confirm('Delete this payment?')) return;
    const { error } = await supabase.from('cost_investment_payments').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted'); refresh();
  }

  const sel = investments.find((v) => v.id === selected);
  const selPayments = sel ? payments.filter((p) => p.investment_id === sel.id).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)) : [];
  const statusPill = { active: 'bg-emerald-500/15 text-emerald-400', ongoing: 'bg-sky-500/15 text-sky-400', repaid: 'bg-slate-600/40 text-slate-300', written_off: 'bg-amber-500/15 text-amber-400' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-sm">Investors, friends, and helpers — what they gave, how we repay them, and what's outstanding.</p>
        <button onClick={startAdd} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Backer</button>
      </div>

      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">{editing ? 'Edit Backer' : 'Add Backer'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={lbl}>Name</label><input type="text" value={form.backer_name} onChange={(e) => setForm({ ...form, backer_name: e.target.value })} placeholder="Full name" className={fld} /></div>
            <div><label className={lbl}>Relationship</label><select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className={fld}>{RELATIONSHIPS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}</select></div>
            <div><label className={lbl}>Email (optional)</label><input type="text" value={form.backer_email} onChange={(e) => setForm({ ...form, backer_email: e.target.value })} className={fld} /></div>
            <div><label className={lbl}>Phone (optional)</label><input type="text" value={form.backer_phone} onChange={(e) => setForm({ ...form, backer_phone: e.target.value })} className={fld} /></div>
            <div><label className={lbl}>Contribution type</label><select value={form.contribution_type} onChange={(e) => setForm({ ...form, contribution_type: e.target.value })} className={fld}>{CONTRIB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={lbl}>Contribution value ($)</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={fld} /></div>
            <div><label className={lbl}>Contribution date</label><input type="date" value={form.contribution_date} onChange={(e) => setForm({ ...form, contribution_date: e.target.value })} className={fld} /></div>
            <div><label className={lbl}>Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fld}>{INV_STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}</select></div>
            <div><label className={lbl}>Repayment type</label><select value={form.repayment_type} onChange={(e) => setForm({ ...form, repayment_type: e.target.value })} className={fld}>{REPAY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={lbl}>Amount to repay ($, optional)</label><input type="number" step="0.01" value={form.amount_owed} onChange={(e) => setForm({ ...form, amount_owed: e.target.value })} placeholder="Leave blank for equity / favor" className={fld} /></div>
            <div className="md:col-span-2"><label className={lbl}>Repayment terms / the deal</label><input type="text" value={form.repayment_terms} onChange={(e) => setForm({ ...form, repayment_terms: e.target.value })} placeholder='e.g. "5% equity" or "repay $2,000 + a steak dinner"' className={fld} /></div>
            <div className="md:col-span-2"><label className={lbl}>How they helped</label><input type="text" value={form.how_they_helped} onChange={(e) => setForm({ ...form, how_they_helped: e.target.value })} placeholder="e.g. Covered the LLC filing + intro'd our first client" className={fld} /></div>
            <div className="md:col-span-2"><label className={lbl}>Notes (optional)</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fld} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-medium">{editing ? 'Update' : 'Add Backer'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-2 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {investments.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
          No backers yet. Add the people who helped you get here.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {investments.map((v) => {
            const repaid = repaidFor(v.id);
            const owed = v.amount_owed != null ? parseFloat(v.amount_owed) : null;
            const remaining = owed != null ? Math.max(0, owed - repaid) : null;
            const pct = owed && owed > 0 ? Math.min(100, (repaid / owed) * 100) : 0;
            return (
              <div key={v.id} className={`bg-slate-800 border rounded-xl p-4 cursor-pointer transition-colors ${selected === v.id ? 'border-sky-500' : 'border-slate-700 hover:border-slate-600'}`} onClick={() => { setSelected(selected === v.id ? null : v.id); setPayForm({ amount: '', payment_date: todayISO(), method: '', note: '' }); }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">{v.backer_name}</p>
                    <p className="text-slate-500 text-xs capitalize">{v.relationship} · {contribLabel(v.contribution_type)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusPill[v.status] || 'bg-slate-700 text-slate-300'}`}>{(v.status || '').replace('_', ' ')}</span>
                </div>
                <div className="flex gap-6 mt-3 text-sm">
                  <div><p className="text-slate-500 text-xs">Contributed</p><p className="text-sky-400 font-semibold">{money(v.amount)}</p></div>
                  <div><p className="text-slate-500 text-xs">Repaid</p><p className="text-emerald-400 font-semibold">{money(repaid)}</p></div>
                  <div><p className="text-slate-500 text-xs">Remaining</p><p className="text-red-400 font-semibold">{remaining != null ? money(remaining) : '—'}</p></div>
                </div>
                {owed != null && owed > 0 && (
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <p className="text-slate-400 text-xs mt-2">{repayLabel(v.repayment_type)}{v.repayment_terms ? ` — ${v.repayment_terms}` : ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / repayment ledger */}
      {sel && (
        <div className="bg-slate-800 border border-sky-500/40 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold text-lg">{sel.backer_name}</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {[sel.backer_email, sel.backer_phone].filter(Boolean).join(' · ') || 'No contact info'}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => startEdit(sel)} className="text-sky-400 hover:text-sky-300 text-xs">Edit</button>
              <button onClick={() => del(sel.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xs">Close</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><p className="text-slate-500 text-xs">Contributed</p><p className="text-sky-400 font-semibold">{money(sel.amount)}</p></div>
            <div><p className="text-slate-500 text-xs">To repay</p><p className="text-white font-semibold">{sel.amount_owed != null ? money(sel.amount_owed) : '—'}</p></div>
            <div><p className="text-slate-500 text-xs">Repaid</p><p className="text-emerald-400 font-semibold">{money(repaidFor(sel.id))}</p></div>
            <div><p className="text-slate-500 text-xs">Remaining</p><p className="text-red-400 font-semibold">{sel.amount_owed != null ? money(Math.max(0, parseFloat(sel.amount_owed) - repaidFor(sel.id))) : '—'}</p></div>
          </div>

          {(sel.how_they_helped || sel.repayment_terms || sel.notes) && (
            <div className="space-y-1.5 mb-4 text-sm">
              {sel.how_they_helped && <p className="text-slate-300"><span className="text-slate-500">How they helped: </span>{sel.how_they_helped}</p>}
              {sel.repayment_terms && <p className="text-slate-300"><span className="text-slate-500">Terms: </span>{repayLabel(sel.repayment_type)} — {sel.repayment_terms}</p>}
              {sel.notes && <p className="text-slate-400"><span className="text-slate-500">Notes: </span>{sel.notes}</p>}
            </div>
          )}

          <p className="text-slate-300 text-sm font-semibold mb-2">Repayment Ledger</p>
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden mb-3">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-3 py-2">Date</th>
                <th className="text-right text-slate-400 font-medium px-3 py-2">Amount</th>
                <th className="text-left text-slate-400 font-medium px-3 py-2">Method</th>
                <th className="text-left text-slate-400 font-medium px-3 py-2">Note</th>
                <th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {selPayments.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No repayments logged yet</td></tr>
                ) : selPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-700/50">
                    <td className="px-3 py-2 text-slate-300">{p.payment_date}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">{money(p.amount)}</td>
                    <td className="px-3 py-2 text-slate-400">{p.method || '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{p.note || '—'}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => delPayment(p.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div><label className={lbl}>Amount ($)</label><input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0.00" className={`${fld} w-32`} /></div>
            <div><label className={lbl}>Date</label><input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} className={`${fld} w-40`} /></div>
            <div><label className={lbl}>Method</label><input type="text" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} placeholder="e.g. Zelle" className={`${fld} w-36`} /></div>
            <div className="flex-1 min-w-[140px]"><label className={lbl}>Note</label><input type="text" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} className={fld} /></div>
            <button onClick={() => addPayment(sel.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Log Payment</button>
          </div>
        </div>
      )}
    </div>
  );
}
