/**
 * Platform Pulse — top-line "our data" snapshot for the Super Admin dashboard.
 *
 * Complements <BoloGoMetrics/> (which owns the deep BOLO Go app view) by
 * surfacing the rest of the business at a glance:
 *   • Growth   — waitlist signups + total users (+ this-week deltas)
 *   • Clients  — live client platforms + platform/project MRR, projects by status
 *   • Commerce — BOLO Go marketplace GMV + fees collected (real fee-bearing orders)
 *   • Credits  — AI credits added vs consumed
 *
 * Self-contained: queries the main Liftori Supabase directly, mirrors the
 * BoloGoMetrics card pattern. All counts degrade gracefully to 0.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Activity, Users, UserPlus, Building2, Briefcase,
  ShoppingBag, Sparkles, RefreshCw, Loader2,
} from 'lucide-react';

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function PlatformMetrics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [m, setM] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const wk = new Date(Date.now() - 7 * 864e5).toISOString();
    try {
      const [waitRes, profRes, platRes, projRes, ordRes, credRes] = await Promise.all([
        supabase.from('waitlist_signups').select('created_at'),
        supabase.from('profiles').select('created_at, is_agent'),
        supabase.from('platforms').select('status, monthly_revenue'),
        supabase.from('projects').select('status, mrr'),
        supabase.from('orders').select('total, platform_fee').gt('platform_fee', 0),
        supabase.from('credit_transactions').select('delta, created_at'),
      ]);

      const wait = waitRes.data || [];
      const profs = (profRes.data || []).filter((p) => !p.is_agent);
      const plats = platRes.data || [];
      const projs = projRes.data || [];
      const orders = ordRes.data || [];
      const creds = credRes.data || [];

      const byStatus = (rows) => {
        const o = {};
        rows.forEach((r) => { const k = r.status || 'Unknown'; o[k] = (o[k] || 0) + 1; });
        return Object.entries(o).sort((a, b) => b[1] - a[1]);
      };
      const liveCount = plats.filter((p) => /live|active/i.test(p.status || '')).length;

      setM({
        waitTotal: wait.length,
        waitWeek: wait.filter((r) => r.created_at >= wk).length,
        users: profs.length,
        usersWeek: profs.filter((r) => r.created_at >= wk).length,
        platTotal: plats.length,
        platLive: liveCount,
        platMrr: plats.reduce((s, p) => s + Number(p.monthly_revenue || 0), 0),
        platByStatus: byStatus(plats),
        projTotal: projs.length,
        projMrr: projs.reduce((s, p) => s + Number(p.mrr || 0), 0),
        projByStatus: byStatus(projs),
        boloSales: orders.length,
        boloGmv: orders.reduce((s, o) => s + Number(o.total || 0), 0),
        boloFees: orders.reduce((s, o) => s + Number(o.platform_fee || 0), 0),
        credAdded: creds.reduce((s, c) => s + (Number(c.delta) > 0 ? Number(c.delta) : 0), 0),
        credUsed: creds.reduce((s, c) => s + (Number(c.delta) < 0 ? -Number(c.delta) : 0), 0),
        credWeek: creds.filter((c) => c.created_at >= wk).length,
      });
    } catch (e) {
      console.error('[PlatformMetrics]', e);
      setM(null);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">Platform Pulse</h2>
          <span className="text-[11px] uppercase tracking-wider text-sky-400/70 font-semibold border border-sky-500/30 bg-sky-500/10 rounded-full px-2 py-0.5">Our data</span>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading || !m ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Kpi icon={UserPlus} tint="text-sky-400" label="Waitlist" value={m.waitTotal}
              delta={m.waitWeek ? `+${m.waitWeek} this week` : null} />
            <Kpi icon={Users} tint="text-violet-400" label="Users" value={m.users}
              delta={m.usersWeek ? `+${m.usersWeek} this week` : null} />
            <Kpi icon={Building2} tint="text-emerald-400" label="Client Platforms" value={m.platTotal}
              sub={`${m.platLive} live · ${money(m.platMrr)}/mo`} />
            <Kpi icon={Briefcase} tint="text-amber-400" label="Projects MRR" value={money(m.projMrr)}
              sub={`${m.projTotal} projects`} />
            <Kpi icon={ShoppingBag} tint="text-cyan-400" label="BOLO Go GMV" value={money(m.boloGmv)}
              sub={`${m.boloSales} sales · ${money(m.boloFees)} fees`} />
            <Kpi icon={Sparkles} tint="text-pink-400" label="AI Credits Used" value={m.credUsed}
              sub={`${m.credAdded} added`} delta={m.credWeek ? `${m.credWeek} txns this week` : null} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Panel title="Projects by stage" onClick={() => navigate('/admin/pipeline')}>
              {m.projByStatus.length === 0 ? (
                <Empty text="No projects yet." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {m.projByStatus.map(([k, v]) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600/40 bg-white/5 text-slate-300">{k} · {v}</span>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Client platforms" onClick={() => navigate('/admin/platforms')}>
              {m.platByStatus.length === 0 ? (
                <Empty text="No platforms yet." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {m.platByStatus.map(([k, v]) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{k} · {v}</span>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, tint, label, value, sub, delta }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
        {Icon ? <Icon className={`w-3.5 h-3.5 ${tint || ''}`} /> : null}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
      {sub ? <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div> : null}
      {delta ? <div className="text-[11px] text-emerald-400 mt-0.5">{delta}</div> : null}
    </div>
  );
}

function Panel({ title, onClick, children }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
      <button onClick={onClick} className="flex items-center justify-between w-full mb-3 group">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-[11px] text-sky-400 group-hover:text-sky-300 transition-colors">Open →</span>
      </button>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div className="text-center py-4 text-slate-500 text-sm">{text}</div>;
}
