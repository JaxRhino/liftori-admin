// =====================================================================
// EcomListings - mobile-first listing grid for the thrift shop.
// Card grid + status tabs + search + category + sort + FAB.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCrmClient, fmtMoney0, daysSince, StatusChip, LISTING_STATUS, ListingThumb,
} from './_ecomShared'
import { supabase as mainDb } from '../../lib/supabase'

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'draft',     label: 'Draft' },
  { key: 'published', label: 'Active' },
  { key: 'sold',      label: 'Sold' },
  { key: 'archived',  label: 'Archived' },
]

const SORTS = [
  { key: 'newest',     label: 'Newest' },
  { key: 'oldest',     label: 'Oldest' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'price_asc',  label: 'Price: low to high' },
]

export default function EcomListings() {
  const { client, platformId } = useCrmClient()
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    if (!client) return
    let active = true
    async function load() {
      try {
        setLoading(true)
        const [lst, cats] = await Promise.all([
          mainDb.from('products')
            .select('id,title,price,sold_price,status,category_id,brand_maker,main_image_url,quantity,created_at,published_website_at,sold_at,is_featured,ai_generated')
            .order('created_at', { ascending: false }),
          mainDb.from('categories').select('id,name').eq('is_active', true).order('sort_order'),
        ])
        if (!active) return
        if (lst.error) throw lst.error
        setListings(lst.data || [])
        setCategories(cats.data || [])
      } catch (e) {
        console.error('Error loading listings:', e)
        toast.error('Failed to load listings')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [client])

  const counts = useMemo(() => {
    const c = { all: listings.length }
    STATUS_TABS.slice(1).forEach(t => { c[t.key] = listings.filter(l => l.status === t.key).length })
    return c
  }, [listings])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = listings.filter(l => {
      if (tab !== 'all' && l.status !== tab) return false
      if (categoryId !== 'all' && l.category_id !== categoryId) return false
      if (!q) return true
      return [l.title, l.brand_maker].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    })
    if (sort === 'newest') rows = [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === 'oldest') rows = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (sort === 'price_desc') rows = [...rows].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))
    if (sort === 'price_asc') rows = [...rows].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))
    return rows
  }, [listings, tab, search, categoryId, sort])

  if (loading) return <div className="p-6 text-gray-400">Loading listings...</div>

  return (
    <div className="p-4 sm:p-6 pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Listings</h1>
          <p className="text-gray-400 text-sm mt-0.5">{counts.published || 0} active · {counts.draft || 0} drafts</p>
        </div>
        <button
          onClick={() => navigate(`/crm/${platformId}/listings/new`)}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium"
        >
          {Plus ? <Plus size={16} /> : null} New Listing
        </button>
      </div>

      {/* STATUS TABS - horizontally scrollable on phones */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition ${
              tab === t.key ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-navy-700 text-gray-400 hover:text-white'
            }`}
          >
            {t.label} ({counts[t.key] || 0})
          </button>
        ))}
      </div>

      {/* SEARCH + CATEGORY + SORT */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          {Search ? <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /> : null}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or brand..."
            className="w-full bg-navy-900 border border-navy-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-500"
          />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="bg-navy-900 border border-navy-700 text-gray-300 rounded-lg px-2.5 py-2 text-sm">
          <option value="all">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-navy-900 border border-navy-700 text-gray-300 rounded-lg px-2.5 py-2 text-sm">
          {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* CARD GRID */}
      {filtered.length === 0 ? (
        <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
          <h3 className="text-white font-semibold mb-1">No listings here</h3>
          <p className="text-gray-400 text-sm mb-4">Snap a few photos and let AI draft the listing for you.</p>
          <button onClick={() => navigate(`/crm/${platformId}/listings/new`)} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium">
            + New Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(l => {
            const days = daysSince(l.published_website_at || l.created_at)
            return (
              <button
                key={l.id}
                onClick={() => navigate(`/crm/${platformId}/listings/${l.id}`)}
                className="text-left bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden hover:border-brand-blue/40 transition-colors group"
              >
                <div className="relative aspect-square bg-navy-900">
                  <ListingThumb src={l.main_image_url} alt={l.title} className="w-full h-full !rounded-none" />
                  <div className="absolute top-2 left-2"><StatusChip map={LISTING_STATUS} value={l.status} /></div>
                  {l.is_featured && (
                    <div className="absolute top-2 right-2 bg-brand-blue/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">Featured</div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-sm text-white font-medium truncate group-hover:text-brand-light transition-colors">{l.title || 'Untitled listing'}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-semibold text-brand-cyan">
                      {l.status === 'sold' ? fmtMoney0(l.sold_price ?? l.price) : fmtMoney0(l.price)}
                    </span>
                    <span className={`text-[11px] ${l.status === 'published' && days > 30 ? 'text-amber-300' : 'text-gray-500'}`}>
                      {l.status === 'sold' ? 'sold' : `${days}d listed`}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => navigate(`/crm/${platformId}/listings/new`)}
        className="sm:hidden fixed bottom-6 right-5 z-30 w-14 h-14 rounded-full bg-brand-blue text-white shadow-lg shadow-brand-blue/30 flex items-center justify-center"
        aria-label="New listing"
      >
        {Plus ? <Plus size={26} /> : <span className="text-2xl font-light">+</span>}
      </button>
    </div>
  )
}
