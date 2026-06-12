// =====================================================================
// EcomDashboard - thrift reseller command center (industry: ecommerce).
// KPIs, recent orders, stale-listing callout, category breakdown.
// Mobile-first: 2-up KPI grid on phones.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubPage, StatCard, Section, EmptyState } from '../crm/_shared'
import {
  useCrmClient, fmtMoney, fmtMoney0, fmtDate, daysSince, relTime,
  StatusChip, ORDER_STATUS, ListingThumb,
} from './_ecomShared'

function StatSkeleton() {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4 animate-pulse">
      <div className="h-3 w-24 bg-navy-700/70 rounded mb-3" />
      <div className="h-6 w-20 bg-navy-700/70 rounded" />
    </div>
  )
}

export default function EcomDashboard() {
  const { client, platformId } = useCrmClient()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    let active = true
    async function load() {
      try {
        setLoading(true)
        const [lst, cats, ords] = await Promise.all([
          client.from('listings')
            .select('id,title,price,cost,status,category_id,main_image_url,created_at,published_website_at,sold_at,sold_price,sold_channel')
            .order('created_at', { ascending: false }),
          client.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
          client.from('orders')
            .select('id,order_number,status,total,created_at,customer:customers(first_name,last_name,email)')
            .order('created_at', { ascending: false })
            .limit(8),
        ])
        if (!active) return
        if (lst.error) throw lst.error
        setListings(lst.data || [])
        setCategories(cats.data || [])
        setOrders(ords.data || [])
      } catch (e) {
        console.error('Error loading ecomm dashboard:', e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [client])

  const stats = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const activeListings = listings.filter(l => l.status === 'active')
    const drafts = listings.filter(l => l.status === 'draft')
    const soldThisMonth = listings.filter(l =>
      l.status === 'sold' && l.sold_at && new Date(l.sold_at) >= monthStart)
    const revenue = soldThisMonth.reduce((s, l) => s + Number(l.sold_price || 0), 0)
    const profit = soldThisMonth.reduce((s, l) => s + (Number(l.sold_price || 0) - Number(l.cost || 0)), 0)
    const avgSale = soldThisMonth.length ? revenue / soldThisMonth.length : 0
    const stale = activeListings
      .filter(l => daysSince(l.published_website_at || l.created_at) > 30)
      .sort((a, b) => new Date(a.published_website_at || a.created_at) - new Date(b.published_website_at || b.created_at))
    return { activeCount: activeListings.length, draftCount: drafts.length, soldCount: soldThisMonth.length, revenue, profit, avgSale, stale, activeListings }
  }, [listings])

  const categoryBreakdown = useMemo(() => {
    const counts = {}
    stats.activeListings.forEach(l => { const k = l.category_id || 'none'; counts[k] = (counts[k] || 0) + 1 })
    const rows = categories
      .map(c => ({ id: c.id, name: c.name, count: counts[c.id] || 0 }))
      .filter(c => c.count > 0)
    const uncategorized = counts.none || 0
    if (uncategorized > 0) rows.push({ id: 'none', name: 'Uncategorized', count: uncategorized })
    const max = Math.max(1, ...rows.map(r => r.count))
    return rows.sort((a, b) => b.count - a.count).map(r => ({ ...r, pct: (r.count / max) * 100 }))
  }, [stats.activeListings, categories])

  if (loading) {
    return (
      <HubPage title="Dashboard" subtitle="Your shop at a glance">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      </HubPage>
    )
  }

  return (
    <HubPage
      title="Dashboard"
      subtitle="Your shop at a glance"
      actions={
        <Link to={`/crm/${platformId}/listings/new`} className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium">
          + New Listing
        </Link>
      }
    >
      {/* KPI GRID - 2-up on phones */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Active Listings" value={stats.activeCount} accent="text-emerald-300" />
        <StatCard label="Drafts" value={stats.draftCount} accent="text-gray-300" />
        <StatCard label="Sold This Month" value={stats.soldCount} accent="text-brand-cyan" />
        <StatCard label="Revenue (Month)" value={fmtMoney0(stats.revenue)} accent="text-white" />
        <StatCard label="Avg Sale Price" value={fmtMoney0(stats.avgSale)} accent="text-white" />
        <StatCard label="Profit (Month)" value={fmtMoney0(stats.profit)} accent={stats.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'} hint="sold price minus cost" />
      </div>

      {/* STALE LISTINGS CALLOUT */}
      {stats.stale.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 className="text-amber-300 font-semibold text-sm">
              {stats.stale.length} listing{stats.stale.length === 1 ? '' : 's'} active over 30 days
            </h3>
            <Link to={`/crm/${platformId}/listings`} className="text-xs text-amber-300/80 hover:text-amber-200">View all listings →</Link>
          </div>
          <p className="text-xs text-gray-400 mb-3">Consider a price drop, fresh photos, or a social re-post to move them.</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {stats.stale.slice(0, 6).map(l => (
              <Link key={l.id} to={`/crm/${platformId}/listings/${l.id}`} className="flex items-center gap-2 bg-navy-800 border border-navy-700/50 rounded-lg px-2.5 py-2 shrink-0 hover:border-amber-500/40 transition-colors">
                <ListingThumb src={l.main_image_url} alt={l.title} className="w-9 h-9" />
                <div className="min-w-0">
                  <div className="text-xs text-white truncate max-w-[120px]">{l.title || 'Untitled'}</div>
                  <div className="text-[11px] text-amber-300">{daysSince(l.published_website_at || l.created_at)}d · {fmtMoney0(l.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* RECENT ORDERS */}
        <Section title="Recent Orders" right={<Link to={`/crm/${platformId}/orders`} className="text-xs text-brand-blue hover:text-brand-light">View all</Link>}>
          {orders.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No orders yet. They'll show up here the moment one lands.</div>
          ) : (
            <div className="divide-y divide-navy-700/40">
              {orders.map(o => {
                const cust = o.customer
                const name = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || cust.email : 'Guest'
                return (
                  <Link key={o.id} to={`/crm/${platformId}/orders`} className="flex items-center justify-between px-5 py-3 hover:bg-navy-900/50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">#{o.order_number || String(o.id).slice(0, 8)}</div>
                      <div className="text-xs text-gray-500 truncate">{name} · {relTime(o.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-white font-semibold">{fmtMoney(o.total)}</span>
                      <StatusChip map={ORDER_STATUS} value={o.status} />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </Section>

        {/* CATEGORY BREAKDOWN */}
        <Section title="Active Listings by Category">
          {categoryBreakdown.length === 0 ? (
            <EmptyState title="No active listings" description="Publish your first listing and the category mix shows up here." />
          ) : (
            <div className="p-5 space-y-3">
              {categoryBreakdown.map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{c.name}</span>
                    <span className="text-gray-500">{c.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-navy-900 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Mobile FAB */}
      <Link
        to={`/crm/${platformId}/listings/new`}
        className="sm:hidden fixed bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-brand-blue text-white shadow-lg shadow-brand-blue/30 flex items-center justify-center text-2xl font-light"
        aria-label="New listing"
      >
        +
      </Link>
    </HubPage>
  )
}
