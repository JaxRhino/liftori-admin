/**
 * BOLO Go — app + beta-tester metrics for the Super Admin dashboard.
 * Distinct from the Liftori platform "Tester Program": this is the BOLO Go
 * mobile reseller app (users, listings, community) and its in-app Beta Testers
 * feedback program (tester_feedback / _messages).
 *
 * IMPORTANT — counts use REAL app signals, not the backfilled `account_type`
 * flag (which was set to 'seller' on every pre-existing profile and badly
 * over-counts). Sellers = users with a provisioned storefront; shoppers =
 * account_type 'shopper'. Commerce is scoped to orders that actually carried a
 * platform fee, so "fees collected" reflects money truly taken (not backfill).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Smartphone, Users, Package, ShoppingBag, MessageSquare,
  Bug, RefreshCw, DollarSign, ChevronRight, Loader2,
} from 'lucide-react';

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FB_STATUS = {
  received: { label: 'Received', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  in_progress: { label: 'In progress', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  need_info: { label: 'Needs info', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  resolved: { label: 'Resolved', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  closed: { label: 'Closed', cls: 'text-slate-400 bg-white/5 border-slate-600/40' },
  wont_fix: { label: "Won't fix", cls: 'text-red-400 bg-red-500/10 border-red-500/30' },
};
const CAT_LABEL = { bug: 'Bugs', feature: 'Feature ideas', improvement: 'Improvements', question: 'Questions', other: 'Other' };

const ago = (iso) => {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
};

export default function BoloGoMetrics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [m, setM] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const wk = new Date(Date.now() - 7 * 864e5).toISOString();
    const c = (q) => q.then((r) => r.count || 0);
    try {
      const [
        storesRes, shoppers, newShoppers,
        listings, listings7d, posts, posts7d,
        ordersRes, fbRes, msgCount,
      ] = await Promise.all([
        supabase.from('storefronts').select('owner_user_id, created_at'),
        c(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_type', 'shopper')),
        c(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_type', 'shopper').gte('created_at', wk)),
        c(supabase.from('products').select('id', { count: 'exact', head: true })),
        c(supabase.from('products').select('id', { count: 'exact', head: true }).gte('created_at', wk)),
        c(supabase.from('posts').select('id', { count: 'exact', head: true })),
        c(supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', wk)),
        // Only orders that actually carried a platform fee = real marketplace cut.
        supabase.from('orders').select('total, platform_fee').gt('platform_fee', 0),
        supabase.from('tester_feedback').select('id, title, status, category, reporter_user_id, last_activity_at').order('last_activity_at', { ascending: false }),
        c(supabase.from('tester_feedback_messages').select('id', { count: 'exact', head: true })),
      ]);

      const stores = storesRes.data || [];
      const sellerIds = new Set(stores.map((s) => s.owner_user_id));
      const sellers = sellerIds.size;
      const newSellers = new Set(stores.filter((s) => s.created_at >= wk).map((s) => s.owner_user_id)).size;
      const appUsers = sellers + shoppers;
      const newUsers = newSellers + newShoppers;

      const orders = ordersRes.data || [];
      const gmv = orders.reduce((s, o) => s + Number(o.total || 0), 0);
      const fees = orders.reduce((s, o) => s + Number(o.platform_fee || 0), 0);

      const fb = fbRes.data || [];
      const open = fb.filter((r) => !['resolved', 'closed', 'wont_fix'].includes(r.status)).length;
      const reporters = new Set(fb.map((r) => r.reporter_user_id)).size;
      const byStatus = {};
      const byCat = {};
      fb.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; byCat[r.category] = (byCat[r.category] || 0) + 1; });

      setM({
        appUsers, sellers, shoppers, newUsers,
        listings, listings7d, posts, posts7d,
        sales: orders.length, gmv, fees,
        fbTotal: fb.length, fbOpen: open, reporters, msgs: msgCount,
        byStatus, byCat, recent: fb.slice(0, 5),
      });
    } catch (e) {
      console.error('[BoloGoMetrics]', e);
      setM(null);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold text-white">BOLO Go</h2>
          <span className="text-[11px] uppercase tracking-wider text-sky-400/70 font-semibold border border-sky-500/30 bg-sky-500/10 rounded-full px-2 py-0.5">App + Beta</span>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading || !m ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>
      ) : (
        <>
          {/* App KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <Kpi icon={Users} tint="text-sky-400" label="App Users" value={m.appUsers}
              sub={`${m.sellers} sellers · ${m.shoppers} shoppers`} delta={m.newUsers ? `+${m.newUsers} this week` : null} />
            <Kpi icon={Package} tint="text-violet-400" label="Listings" value={m.listings}
              delta={m.listings7d ? `+${m.listings7d} this week` : null} />
            <Kpi icon={ShoppingBag} tint="text-emerald-400" label="Marketplace Sales" value={m.sales} sub={`${money(m.gmv)} GMV`} />
            <Kpi icon={DollarSign} tint="text-amber-400" label="Fees Collected" value={money(m.fees)} />
            <Kpi icon={MessageSquare} tint="text-cyan-400" label="Community Posts" value={m.posts}
              delta={m.posts7d ? `+${m.posts7d} this week` : null} />
          </div>

          {/* Beta testers panel */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-white">Beta Testers</h3>
              </div>
              <button onClick={() => navigate('/admin/dev-team/beta-feedback')}
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                Open board <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <Mini label="Reports" value={m.fbTotal} />
              <Mini label="Open" value={m.fbOpen} tint={m.fbOpen ? 'text-amber-400' : 'text-white'} />
              <Mini label="Beta testers" value={m.reporters} />
              <Mini label="Replies" value={m.msgs} />
            </div>

            {m.fbTotal === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                No reports yet — testers can file bugs & feature ideas from the app (More → Beta Testers).
              </div>
            ) : (
              <>
                {/* breakdown chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(m.byStatus).map(([k, v]) => {
                    const meta = FB_STATUS[k] || { label: k, cls: 'text-slate-400 bg-white/5 border-slate-600/40' };
                    return <span key={k} className={`text-[11px] px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label} · {v}</span>;
                  })}
                  <span className="w-px h-4 bg-slate-700 self-center mx-1" />
                  {Object.entries(m.byCat).map(([k, v]) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-full border border-slate-600/40 bg-white/5 text-slate-300">{CAT_LABEL[k] || k} · {v}</span>
                  ))}
                </div>
                {/* recent */}
                <div className="space-y-1.5">
                  {m.recent.map((r) => {
                    const meta = FB_STATUS[r.status] || { label: r.status, cls: 'text-slate-400 bg-white/5 border-slate-600/40' };
                    return (
                      <button key={r.id} onClick={() => navigate('/admin/dev-team/beta-feedback')}
                        className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors">
                        <span className="text-sm text-white truncate flex-1">{r.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                        <span className="text-[11px] text-slate-500 w-8 text-right">{ago(r.last_activity_at)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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

function Mini({ label, value, tint }) {
  return (
    <div className="bg-slate-800/40 border border-slate-800 rounded-xl px-3 py-2.5">
      <div className={`text-xl font-bold ${tint || 'text-white'}`}>{value}</div>
      <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
