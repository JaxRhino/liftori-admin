import { useEffect, useMemo, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const PRODUCT_TYPES = [
  { key: 'digital',   label: '💾 Digital',   color: 'bg-sky-500/15 text-sky-300'         },
  { key: 'physical',  label: '📦 Physical',  color: 'bg-emerald-500/15 text-emerald-300' },
  { key: 'service',   label: '🛠 Service',   color: 'bg-amber-500/15 text-amber-300'     },
  { key: 'affiliate', label: '🔗 Affiliate', color: 'bg-pink-500/15 text-pink-300'       },
  { key: 'course',    label: '🎓 Course',    color: 'bg-violet-500/15 text-violet-300'   },
  { key: 'merch',     label: '👕 Merch',     color: 'bg-rose-500/15 text-rose-300'       },
  { key: 'other',     label: '✨ Other',     color: 'bg-slate-500/15 text-slate-300'     },
]

export default function AffiliateInventory() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState(emptyForm())

  function emptyForm() {
    return {
      name: '', product_type: 'digital', price: '', affiliate_url: '',
      stock_quantity: '', sku: '', description: '', image_url: '', active: true,
    }
  }

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_products').select('*').eq('user_id', user.id)
        .order('updated_at', { ascending: false }).limit(200)
      if (error) throw error
      setRows(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load products') }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      product_type: form.product_type,
      price: form.price ? parseFloat(form.price) : null,
      affiliate_url: form.affiliate_url.trim() || null,
      stock_quantity: form.stock_quantity !== '' ? parseInt(form.stock_quantity, 10) : null,
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      active: form.active,
    }
    try {
      if (editId) {
        const { error } = await supabase.from('creator_products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
        if (error) throw error
        toast.success('Product updated')
      } else {
        const { error } = await supabase.from('creator_products').insert(payload)
        if (error) throw error
        toast.success('Product added')
      }
      setForm(emptyForm()); setEditId(null); setShowForm(false)
      load()
    } catch (err) { console.error(err); toast.error('Save failed') }
  }

  function startEdit(p) {
    setEditId(p.id)
    setForm({
      name: p.name || '',
      product_type: p.product_type || 'digital',
      price: p.price?.toString() || '',
      affiliate_url: p.affiliate_url || '',
      stock_quantity: p.stock_quantity?.toString() ?? '',
      sku: p.sku || '',
      description: p.description || '',
      image_url: p.image_url || '',
      active: p.active !== false,
    })
    setShowForm(true)
  }

  async function toggleActive(p) {
    try {
      await supabase.from('creator_products').update({ active: !p.active, updated_at: new Date().toISOString() }).eq('id', p.id)
      load()
    } catch { toast.error('Update failed') }
  }

  async function adjustStock(p, delta) {
    const current = p.stock_quantity ?? 0
    const next = Math.max(0, current + delta)
    try {
      await supabase.from('creator_products').update({ stock_quantity: next, updated_at: new Date().toISOString() }).eq('id', p.id)
      load()
    } catch { toast.error('Update failed') }
  }

  async function del(id) {
    if (!window.confirm('Delete this product?')) return
    try { await supabase.from('creator_products').delete().eq('id', id); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  async function copyUrl(url) {
    if (!url) return
    try { await navigator.clipboard.writeText(url); toast.success('Link copied') }
    catch { toast.error('Copy failed') }
  }

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (!showInactive && !r.active) return false
      if (filterType !== 'all' && r.product_type !== filterType) return false
      return true
    })
  }, [rows, filterType, showInactive])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.active)
    const totalRev = rows.reduce((sum, r) => sum + (parseFloat(r.total_revenue) || 0), 0)
    const totalUnits = rows.reduce((sum, r) => sum + (r.total_units_sold || 0), 0)
    const lowStock = rows.filter((r) => r.active && r.stock_quantity !== null && r.stock_quantity <= 5).length
    return { active: active.length, total: rows.length, totalRev, totalUnits, lowStock }
  }, [rows])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><span>📦</span><span>Inventory</span></h1>
          <p className="text-sm text-gray-400">Your product catalog — merch, digital drops, affiliate links, services. One place for everything you sell.</p>
        </div>
        <button onClick={() => { setShowForm((x) => !x); if (!showForm) { setEditId(null); setForm(emptyForm()) } }} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium">
          {showForm ? 'Cancel' : '+ New product'}
        </button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Active products" value={stats.active} accent="text-emerald-300" />
        <StatCard label="Total products" value={stats.total} accent="text-slate-300" />
        <StatCard label="Revenue to date" value={`$${stats.totalRev.toFixed(2)}`} accent="text-pink-300" />
        <StatCard label="Low stock alerts" value={stats.lowStock} accent={stats.lowStock > 0 ? 'text-rose-300' : 'text-slate-300'} />
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Product name" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <select value={form.product_type} onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))} className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white">
              {PRODUCT_TYPES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} type="number" step="0.01" placeholder="Price ($)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} type="number" placeholder="Stock (leave blank for unlimited)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="SKU (optional)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.affiliate_url} onChange={(e) => setForm((f) => ({ ...f, affiliate_url: e.target.value }))} type="url" placeholder="Product / affiliate URL" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
            <input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} type="url" placeholder="Image URL (optional)" className="bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white md:col-span-2" />
          </div>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Short description" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Active — visible in your catalog
          </label>
          <button type="submit" className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded text-xs font-medium">{editId ? 'Update' : 'Add product'}</button>
        </form>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilterType('all')} className={`text-[11px] px-2 py-1 rounded-md border ${filterType === 'all' ? 'bg-pink-500 border-pink-500 text-white' : 'bg-navy-900 border-navy-700/50 text-gray-400 hover:text-white'}`}>All</button>
        {PRODUCT_TYPES.map((p) => (
          <button key={p.key} onClick={() => setFilterType(p.key)} className={`text-[11px] px-2 py-1 rounded-md border ${filterType === p.key ? 'bg-pink-500 border-pink-500 text-white' : 'bg-navy-900 border-navy-700/50 text-gray-400 hover:text-white'}`}>
            {p.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">
          {rows.length === 0 ? 'No products yet. Add your first drop, affiliate, or service.' : 'No products match those filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((p) => {
            const meta = PRODUCT_TYPES.find((x) => x.key === p.product_type)
            const lowStock = p.stock_quantity !== null && p.stock_quantity <= 5
            const outOfStock = p.stock_quantity !== null && p.stock_quantity <= 0
            return (
              <div key={p.id} className={`bg-navy-800/50 border rounded-lg overflow-hidden ${p.active ? 'border-navy-700/50' : 'border-navy-700/30 opacity-60'}`}>
                {p.image_url ? (
                  <div className="h-32 bg-navy-900 overflow-hidden">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
                  </div>
                ) : (
                  <div className="h-24 bg-gradient-to-br from-pink-500/10 to-violet-500/10 flex items-center justify-center text-3xl">
                    {meta?.label.split(' ')[0]}
                  </div>
                )}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${meta?.color}`}>{p.product_type}</span>
                        {!p.active && <span className="text-[9px] uppercase text-gray-500">INACTIVE</span>}
                        {outOfStock && <span className="text-[9px] uppercase bg-rose-500/15 text-rose-300 px-1.5 py-0.5 rounded">Sold out</span>}
                        {!outOfStock && lowStock && <span className="text-[9px] uppercase bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded">Low stock</span>}
                      </div>
                      <div className="text-sm font-semibold text-white mt-0.5 line-clamp-1">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-400 line-clamp-2">{p.description}</div>}
                    </div>
                    {p.price !== null && p.price !== undefined && (
                      <div className="text-sm font-bold text-emerald-300 flex-shrink-0">${parseFloat(p.price).toFixed(2)}</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    {p.sku && <span>SKU: {p.sku}</span>}
                    {p.stock_quantity !== null && (
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => adjustStock(p, -1)} className="text-gray-400 hover:text-white px-1">−</button>
                        <span className="text-white">Stock: {p.stock_quantity}</span>
                        <button onClick={() => adjustStock(p, 1)} className="text-gray-400 hover:text-white px-1">+</button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-navy-700/30">
                    {p.affiliate_url && (
                      <button onClick={() => copyUrl(p.affiliate_url)} className="text-[10px] px-2 py-0.5 bg-navy-700 hover:bg-navy-600 text-white rounded">🔗 Copy link</button>
                    )}
                    <button onClick={() => toggleActive(p)} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-white">{p.active ? 'Hide' : 'Activate'}</button>
                    <button onClick={() => startEdit(p)} className="text-[10px] px-2 py-0.5 text-gray-400 hover:text-white">Edit</button>
                    <button onClick={() => del(p.id)} className="text-[10px] ml-auto text-gray-500 hover:text-rose-400">Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-3">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
