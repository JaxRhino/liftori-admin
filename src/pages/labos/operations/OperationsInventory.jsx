// =====================================================================
// OperationsInventory — photo-centric listings manager for VJ.
// Stats, search, filter chips, sort, grid/list view, New Listing drawer.
// Wave B.3: ProductImageUploader wires drag-drop uploads to the
// vj-products storage bucket and persists gallery to product_images.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Package, Search, Plus, Grid3x3, List, X, Camera, Sparkles, Image as ImageIcon, Upload, Check, Trash2, GripVertical, Star, Loader2 } from 'lucide-react'
import { HubPage, useLabosClient } from '../_shared'

const PRODUCT_BUCKET = 'vj-products'

const STATUS_FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'published', label: 'Published', match: p => p.status === 'published' || p.status === 'active' },
  { key: 'draft', label: 'Drafts', match: p => p.status === 'draft' },
  { key: 'sold', label: 'Sold', match: p => p.status === 'sold' || p.status === 'archived' },
  { key: 'featured', label: 'Featured', match: p => !!p.featured },
]

export default function OperationsInventory() {
  const { client } = useLabosClient()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState('grid')
  const [showNewListing, setShowNewListing] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    if (!client) return
    setLoading(true)
    const [p, c] = await Promise.all([
      client.from('products').select('*').order('created_at', { ascending: false }),
      client.from('categories').select('*').order('name'),
    ])
    setProducts(p.data || [])
    setCategories(c.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [client])

  const filtered = useMemo(() => {
    const f = STATUS_FILTERS.find(s => s.key === statusFilter) || STATUS_FILTERS[0]
    let list = products.filter(f.match)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...list]
    if (sort === 'newest') sorted.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sort === 'oldest') sorted.sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    else if (sort === 'price_high') sorted.sort((a,b) => Number(b.price || 0) - Number(a.price || 0))
    else if (sort === 'price_low') sorted.sort((a,b) => Number(a.price || 0) - Number(b.price || 0))
    else if (sort === 'title') sorted.sort((a,b) => (a.title || '').localeCompare(b.title || ''))
    return sorted
  }, [products, statusFilter, search, sort])

  const stats = useMemo(() => {
    const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const published = products.filter(p => p.status === 'published' || p.status === 'active').length
    const drafts = products.filter(p => p.status === 'draft').length
    const soldMonth = products.filter(p => p.status === 'sold' && new Date(p.updated_at) > monthAgo)
    const revenueMonth = soldMonth.reduce((s, p) => s + Number(p.price || 0), 0)
    return { total: products.length, published, drafts, soldMonth: soldMonth.length, revenueMonth }
  }, [products])

  return (
    <HubPage
      title="Inventory"
      subtitle="Manage your thrift listings — add new finds, update prices, track what's hot"
      actions={
        <button
          onClick={() => { setEditing(null); setShowNewListing(true) }}
          className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Listing
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MiniStat label="Total" value={stats.total} />
        <MiniStat label="Published" value={stats.published} accent="text-emerald-400" />
        <MiniStat label="Drafts" value={stats.drafts} accent="text-amber-400" />
        <MiniStat label="Sold (30d)" value={stats.soldMonth} accent="text-purple-400" />
        <MiniStat label="Revenue (30d)" value={`$${stats.revenueMonth.toFixed(0)}`} accent="text-brand-cyan" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, SKU, description..."
            className="w-full pl-10 pr-4 py-2 bg-navy-800 border border-navy-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price_high">Price: High to low</option>
          <option value="price_low">Price: Low to high</option>
          <option value="title">Title A-Z</option>
        </select>

        {/* View toggle */}
        <div className="inline-flex bg-navy-800 border border-navy-700/50 rounded-lg p-0.5">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${view === 'grid' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${view === 'list' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map(f => {
          const count = products.filter(f.match).length
          const active = statusFilter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-brand-blue text-white'
                  : 'bg-navy-800 text-gray-400 hover:bg-navy-700 hover:text-white border border-navy-700/50'
              }`}
            >
              {f.label} <span className={`ml-1 ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Grid / List */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-navy-800 border border-navy-700/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNew={() => { setEditing(null); setShowNewListing(true) }} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onEdit={() => { setEditing(p); setShowNewListing(true) }} />
          ))}
        </div>
      ) : (
        <ProductList products={filtered} onEdit={p => { setEditing(p); setShowNewListing(true) }} />
      )}

      {showNewListing && (
        <ListingDrawer
          product={editing}
          categories={categories}
          onClose={() => { setShowNewListing(false); setEditing(null) }}
          onSaved={() => { setShowNewListing(false); setEditing(null); load() }}
          client={client}
        />
      )}
    </HubPage>
  )
}

function MiniStat({ label, value, accent = 'text-white' }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${accent}`}>{value}</div>
    </div>
  )
}

function ProductCard({ product, onEdit }) {
  const statusTone = {
    published: 'bg-emerald-500/80',
    active: 'bg-emerald-500/80',
    draft: 'bg-amber-500/80',
    sold: 'bg-purple-500/80',
    archived: 'bg-gray-500/80',
  }[product.status] || 'bg-gray-500/80'

  return (
    <button
      onClick={onEdit}
      className="group relative text-left bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden hover:border-brand-blue/50 transition-all"
    >
      <div className="aspect-square bg-navy-900 relative overflow-hidden">
        {product.main_image_url ? (
          <img src={product.main_image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <ImageIcon className="w-10 h-10" />
          </div>
        )}
        <span className={`absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold text-white px-2 py-0.5 rounded-full ${statusTone}`}>
          {product.status}
        </span>
        {product.featured && (
          <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-bold text-amber-100 bg-amber-500/90 px-2 py-0.5 rounded-full">
            Featured
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm text-white truncate font-medium">{product.title || 'Untitled'}</div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-sm text-brand-cyan font-semibold">${Number(product.price || 0).toFixed(2)}</div>
          {product.stock_quantity !== null && product.stock_quantity !== undefined && (
            <div className="text-[10px] text-gray-500">Qty {product.stock_quantity}</div>
          )}
        </div>
      </div>
    </button>
  )
}

function ProductList({ products, onEdit }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[60px_1fr_100px_100px_100px] text-[10px] uppercase tracking-wider text-gray-500 px-5 py-2 border-b border-navy-700/50 bg-navy-900/40">
        <div></div>
        <div>Title</div>
        <div>Price</div>
        <div>Stock</div>
        <div>Status</div>
      </div>
      <ul className="divide-y divide-navy-700/50">
        {products.map(p => (
          <li
            key={p.id}
            onClick={() => onEdit(p)}
            className="grid grid-cols-[60px_1fr_100px_100px_100px] items-center px-5 py-3 hover:bg-navy-900/40 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-md bg-navy-900 overflow-hidden flex items-center justify-center">
              {p.main_image_url ? <img src={p.main_image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-gray-600" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white truncate">{p.title || 'Untitled'}</div>
              <div className="text-xs text-gray-500 truncate">{p.sku || '—'}</div>
            </div>
            <div className="text-sm text-brand-cyan font-medium">${Number(p.price || 0).toFixed(2)}</div>
            <div className="text-sm text-gray-400">{p.stock_quantity ?? '—'}</div>
            <div className="text-xs text-gray-400 capitalize">{p.status}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="bg-gradient-to-br from-brand-blue/5 via-navy-800 to-navy-800 border border-dashed border-navy-700/60 rounded-2xl p-14 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-blue/15 border border-brand-blue/20 flex items-center justify-center">
        <Package className="w-7 h-7 text-brand-blue" />
      </div>
      <h3 className="text-white text-lg font-semibold mb-1">No listings yet</h3>
      <p className="text-gray-400 text-sm max-w-sm mx-auto mb-5">
        Every great thrift shop started with one first find. Add your first listing and we'll help you get it in front of buyers.
      </p>
      <div className="flex items-center gap-2 justify-center">
        <button onClick={onNew} className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Add your first listing
        </button>
      </div>
      <div className="mt-6 text-xs text-gray-500 flex items-center gap-1.5 justify-center">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>Coming soon — snap a photo and AI auto-fills title, description, and price.</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// ListingDrawer — create or edit a listing
// ---------------------------------------------------------------------
function ListingDrawer({ product, categories, onClose, onSaved, client }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!product
  // A stable folder key for this drawer session — used as the storage path prefix
  // BEFORE we have a product id (new listings). Once saved, files live at this path permanently.
  const draftKeyRef = useRef(product?.id || `draft-${crypto.randomUUID()}`)

  // Images: { id?, image_url, sort_order, alt_text?, storage_path?, _pending?, _error? }
  const [images, setImages] = useState([])

  const [form, setForm] = useState({
    title: product?.title || '',
    description: product?.description || '',
    price: product?.price || '',
    compare_at_price: product?.compare_at_price || '',
    sku: product?.sku || '',
    condition: product?.condition || 'good',
    status: product?.status || 'draft',
    stock_quantity: product?.stock_quantity ?? 1,
    category_id: product?.category_id || '',
    tags: (product?.tags || []).join(', '),
    featured: product?.featured || false,
  })

  // When editing, hydrate gallery from product_images + main_image_url
  useEffect(() => {
    let cancelled = false
    async function loadImages() {
      if (!product?.id || !client) return
      const { data } = await client
        .from('product_images')
        .select('id, image_url, sort_order, alt_text')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      const rows = (data || []).map(r => ({ ...r, storage_path: storagePathFromPublicUrl(r.image_url) }))
      // If main_image_url isn't in product_images, prepend it so it shows as the hero thumbnail
      if (product.main_image_url && !rows.some(r => r.image_url === product.main_image_url)) {
        rows.unshift({
          image_url: product.main_image_url,
          sort_order: -1,
          alt_text: product.title || '',
          storage_path: storagePathFromPublicUrl(product.main_image_url),
        })
      }
      setImages(rows.map((r, i) => ({ ...r, sort_order: i })))
    }
    loadImages()
    return () => { cancelled = true }
  }, [product?.id, client])

  async function save() {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (images.some(i => i._pending)) { setError('Wait for image uploads to finish'); return }
    setSaving(true)
    setError('')
    try {
      const mainUrl = images[0]?.image_url || null
      const payload = {
        title: form.title.trim(),
        description: form.description,
        price: Number(form.price) || 0,
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        sku: form.sku || null,
        condition: form.condition,
        status: form.status,
        main_image_url: mainUrl,
        stock_quantity: Number(form.stock_quantity) || 0,
        category_id: form.category_id || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        featured: form.featured,
        slug: (product?.slug) || slugify(form.title),
      }
      if (form.status === 'published' && !product?.published_at) payload.published_at = new Date().toISOString()

      let savedId = product?.id
      if (isEdit) {
        const { error } = await client.from('products').update(payload).eq('id', product.id)
        if (error) throw error
      } else {
        const { data, error } = await client.from('products').insert(payload).select('id').single()
        if (error) throw error
        savedId = data.id
      }

      // Sync product_images: wipe + reinsert for simplicity. Tiny tables, always correct.
      if (savedId) {
        await client.from('product_images').delete().eq('product_id', savedId)
        const gallery = images.slice(1).map((img, i) => ({
          product_id: savedId,
          image_url: img.image_url,
          sort_order: i,
          alt_text: img.alt_text || form.title,
        }))
        if (gallery.length) {
          const { error: gErr } = await client.from('product_images').insert(gallery)
          if (gErr) throw gErr
        }
      }

      onSaved()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-xl bg-navy-900 border-l border-navy-700/50 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-navy-900 border-b border-navy-700/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">{isEdit ? 'Edit Listing' : 'New Listing'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{isEdit ? 'Update product details' : 'Add a new thrift find to your shop'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-navy-800 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Photos */}
          <div>
            <Label>Photos <span className="text-gray-500 font-normal">(first photo is the cover)</span></Label>
            <ProductImageUploader
              client={client}
              folderKey={draftKeyRef.current}
              images={images}
              setImages={setImages}
            />
          </div>

          <div>
            <Label>Title *</Label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Vintage Levi's 501 denim jacket"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
            />
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4}
              placeholder="Condition notes, measurements, styling tips, era..."
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-700/50 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
                />
              </div>
            </div>
            <div>
              <Label>Compare at</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.compare_at_price}
                  onChange={e => setForm({ ...form, compare_at_price: e.target.value })}
                  placeholder="Retail price"
                  className="w-full bg-navy-800 border border-navy-700/50 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Condition</Label>
              <select
                value={form.condition}
                onChange={e => setForm({ ...form, condition: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
              >
                <option value="new">New with tags</option>
                <option value="like_new">Like new</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="vintage">Vintage</option>
              </select>
            </div>
            <div>
              <Label>Stock qty</Label>
              <input
                type="number"
                value={form.stock_quantity}
                onChange={e => setForm({ ...form, stock_quantity: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select
                value={form.category_id}
                onChange={e => setForm({ ...form, category_id: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
              >
                <option value="">Uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>SKU</Label>
              <input
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                placeholder="Optional"
                className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
              />
            </div>
          </div>

          <div>
            <Label>Tags <span className="text-gray-500 font-normal">(comma-separated)</span></Label>
            <input
              value={form.tags}
              onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder="vintage, 90s, denim, unisex"
              className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue/50"
            />
          </div>

          <div className="flex items-center justify-between bg-navy-800/60 rounded-lg px-4 py-3">
            <div>
              <div className="text-sm text-white">Featured on storefront</div>
              <div className="text-xs text-gray-500">Pins this listing to the top of your shop.</div>
            </div>
            <button
              onClick={() => setForm({ ...form, featured: !form.featured })}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.featured ? 'bg-brand-blue' : 'bg-navy-700'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.featured ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div>
            <Label>Status</Label>
            <div className="grid grid-cols-3 gap-2">
              {['draft','published','sold'].map(s => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className={`py-2 rounded-lg text-sm capitalize font-medium transition-colors ${
                    form.status === s
                      ? 'bg-brand-blue text-white'
                      : 'bg-navy-800 text-gray-400 hover:text-white border border-navy-700/50'
                  }`}
                >
                  {s === 'published' ? 'Publish now' : s === 'draft' ? 'Save as draft' : 'Mark sold'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-navy-900 border-t border-navy-700/50 px-5 py-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !form.title.trim()}
            className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving...' : <><Check className="w-4 h-4" />{isEdit ? 'Save changes' : 'Create listing'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <label className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-1.5">{children}</label>
}

// ---------------------------------------------------------------------
// ProductImageUploader — drag/drop + click, multi-file, with reorder.
// Uploads immediately to PRODUCT_BUCKET under folderKey/<timestamp>-<name>.
// Parent owns state; uploader just mutates the images array.
// ---------------------------------------------------------------------
function ProductImageUploader({ client, folderKey, images, setImages }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const onFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'))
    if (!files.length) return

    // Create optimistic rows (sort_order is re-indexed on save, so it's a placeholder)
    const newRows = files.map((f, i) => ({
      _tempId: `tmp-${Date.now()}-${i}`,
      _pending: true,
      file: f,
      image_url: URL.createObjectURL(f),
      sort_order: 0,
      alt_text: f.name.replace(/\.[^.]+$/, ''),
    }))
    setImages(prev => [...prev, ...newRows].map((r, i) => ({ ...r, sort_order: i })))

    // Upload sequentially — less parallel pressure on free Supabase tier, simpler error reporting.
    for (const row of newRows) {
      try {
        const ext = (row.file.name.split('.').pop() || 'jpg').toLowerCase()
        const safe = row.file.name
          .replace(/\.[^.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40) || 'photo'
        const path = `${folderKey}/${Date.now()}-${safe}.${ext}`
        const { error: upErr } = await client.storage
          .from(PRODUCT_BUCKET)
          .upload(path, row.file, { cacheControl: '3600', upsert: false, contentType: row.file.type })
        if (upErr) throw upErr
        const { data } = client.storage.from(PRODUCT_BUCKET).getPublicUrl(path)
        setImages(prev => prev.map(p =>
          p._tempId === row._tempId
            ? { image_url: data.publicUrl, sort_order: p.sort_order, alt_text: p.alt_text, storage_path: path }
            : p
        ))
      } catch (e) {
        console.error('Upload failed', e)
        setImages(prev => prev.map(p =>
          p._tempId === row._tempId ? { ...p, _pending: false, _error: e.message || 'Upload failed' } : p
        ))
      }
    }
  }, [client, folderKey, setImages])

  function onDrop(e) {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files)
  }

  function removeAt(idx) {
    setImages(prev => {
      const row = prev[idx]
      // Fire-and-forget delete from storage if we know the path
      if (row?.storage_path) {
        client.storage.from(PRODUCT_BUCKET).remove([row.storage_path]).catch(() => {})
      }
      return prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sort_order: i }))
    })
  }

  function moveAt(idx, dir) {
    setImages(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((r, i) => ({ ...r, sort_order: i }))
    })
  }

  function setAsCover(idx) {
    if (idx === 0) return
    setImages(prev => {
      const next = [...prev]
      const [pick] = next.splice(idx, 1)
      next.unshift(pick)
      return next.map((r, i) => ({ ...r, sort_order: i }))
    })
  }

  const hasImages = images.length > 0

  return (
    <div>
      <div
        onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false) }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-xl px-4 py-6 text-center transition-colors ${
          isDragging
            ? 'border-brand-blue bg-brand-blue/10'
            : 'border-navy-700/70 bg-navy-800/60 hover:border-brand-blue/50 hover:bg-navy-800'
        }`}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-10 h-10 rounded-full bg-navy-900/60 border border-navy-700/60 flex items-center justify-center">
            <Upload className="w-5 h-5 text-brand-blue" />
          </div>
          <p className="text-sm text-white font-medium">
            {isDragging ? 'Drop to upload' : 'Drag photos here or click to browse'}
          </p>
          <p className="text-xs text-gray-500">JPG, PNG, WEBP · up to 10 MB each</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => { onFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {hasImages && (
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((img, idx) => {
            const isCover = idx === 0
            return (
              <li
                key={img.id || img._tempId || img.image_url}
                className={`relative group aspect-square rounded-lg overflow-hidden border ${
                  isCover ? 'border-brand-blue/60 ring-1 ring-brand-blue/40' : 'border-navy-700/60'
                }`}
              >
                <img src={img.image_url} alt={img.alt_text || ''} className="w-full h-full object-cover" />
                {img._pending && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
                {img._error && (
                  <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center px-2 text-center">
                    <span className="text-[10px] text-red-100 leading-tight">Upload failed — remove and retry</span>
                  </div>
                )}
                {isCover && (
                  <span className="absolute top-1.5 left-1.5 bg-brand-blue text-white text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                    Cover
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); moveAt(idx, -1) }}
                      disabled={idx === 0}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white"
                      title="Move up"
                    ><GripVertical className="w-3 h-3 rotate-90" /></button>
                    {!isCover && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setAsCover(idx) }}
                        className="p-1 rounded bg-white/10 hover:bg-amber-400/30 text-white"
                        title="Set as cover"
                      ><Star className="w-3 h-3" /></button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeAt(idx) }}
                    className="p-1 rounded bg-red-500/30 hover:bg-red-500/70 text-white"
                    title="Remove"
                  ><Trash2 className="w-3 h-3" /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function slugify(s) {
  return (s || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// Extract the "vj-products/<path>" portion of a Supabase public URL so we can
// delete files we own when the user removes them. Returns null for anything else.
function storagePathFromPublicUrl(url) {
  if (!url || typeof url !== 'string') return null
  const marker = `/storage/v1/object/public/${PRODUCT_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx < 0) return null
  return url.slice(idx + marker.length)
}
