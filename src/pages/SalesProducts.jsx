import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Sales Hub > Products. Reps browse the Liftori products they're cleared to sell
// (with a live demo link to walk a prospect through). Admins add/edit products
// and choose which sales roles can see each one. Gated by sales.products.
const ROLE_CHOICES = [
  { code: 'sales_rep', label: 'Sales Rep' },
  { code: 'sales_director', label: 'Director of Sales' },
  { code: 'call_agent', label: 'Call Agent' },
]
const BLANK = { slug: '', name: '', tagline: '', description: '', demo_url: '', pricing_summary: '', category: 'CRM', status: 'active', visible_to_roles: ['sales_rep', 'sales_director'], sort_order: 0, dev_notice: '', release_date: '' }

export default function SalesProducts() {
  const { profile, perms } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role || 'customer'
  const isManager = ['super_admin', 'admin', 'dev'].includes(role)
  const fullAccess = perms?.['*'] === true

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // product object or BLANK
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  function flash(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('sales_products').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
    setProducts(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const visible = useMemo(() => {
    if (isManager) return products
    return products.filter(p => p.status !== 'retired' && (fullAccess || (p.visible_to_roles || []).includes(role)))
  }, [products, isManager, fullAccess, role])

  async function save(e) {
    e.preventDefault()
    if (!editing.name || !editing.slug) { flash('Name and slug are required'); return }
    setSaving(true)
    try {
      const row = {
        slug: editing.slug.trim(), name: editing.name.trim(), tagline: editing.tagline || null,
        description: editing.description || null, demo_url: editing.demo_url || null,
        pricing_summary: editing.pricing_summary || null, category: editing.category || null,
        status: editing.status, visible_to_roles: editing.visible_to_roles || [],
        dev_notice: editing.dev_notice || null, release_date: editing.release_date || null,
        sort_order: Number(editing.sort_order) || 0, updated_at: new Date().toISOString(),
      }
      const res = editing.id
        ? await supabase.from('sales_products').update(row).eq('id', editing.id)
        : await supabase.from('sales_products').insert(row)
      if (res.error) throw res.error
      flash(editing.id ? 'Product updated' : 'Product added')
      setEditing(null); load()
    } catch (err) { flash('Save failed: ' + (err?.message || 'error')) }
    finally { setSaving(false) }
  }

  function toggleRole(code) {
    setEditing(prev => {
      const has = (prev.visible_to_roles || []).includes(code)
      return { ...prev, visible_to_roles: has ? prev.visible_to_roles.filter(r => r !== code) : [...(prev.visible_to_roles || []), code] }
    })
  }

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Products</h1>
            <p className="mt-1 text-sm text-slate-400">Liftori products you're cleared to sell. Open a live demo to walk a prospect through it.</p>
          </div>
          {isManager && (
            <button onClick={() => setEditing({ ...BLANK })} className="btn-primary shrink-0">Add product</button>
          )}
        </div>

        {loading ? (
          <div className="mt-16 text-center text-slate-500 text-sm">Loading products…</div>
        ) : visible.length === 0 ? (
          <div className="mt-16 text-center text-slate-500 text-sm">No products available to you yet. Check back soon.</div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(p => (
              <div key={p.id} className="flex flex-col rounded-xl border border-navy-700 bg-navy-800/50 p-5">
                <div className="flex items-center justify-between gap-2">
                  {p.category && <span className="text-[11px] uppercase tracking-wide text-brand-cyan font-semibold">{p.category}</span>}
                  {p.status === 'coming_soon' && <span className="text-[11px] rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5">Coming soon</span>}
                  {p.status === 'retired' && <span className="text-[11px] rounded-md bg-slate-600/20 text-slate-400 px-2 py-0.5">Retired</span>}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{p.name}</h2>
                {p.tagline && <p className="mt-1 text-sm text-slate-300">{p.tagline}</p>}
                {p.dev_notice && (
                  <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">Still in Dev Lab</div>
                    <p className="mt-0.5 text-[12px] leading-snug text-amber-200/90">{p.dev_notice}</p>
                    {p.release_date && <p className="mt-1 text-[11px] text-amber-300/80">Release planned {new Date(p.release_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                  </div>
                )}
                {p.description && <p className="mt-3 text-[13px] leading-relaxed text-slate-400 line-clamp-5">{p.description}</p>}
                {p.pricing_summary && <p className="mt-3 text-xs text-slate-500">{p.pricing_summary}</p>}
                {isManager && (
                  <p className="mt-2 text-[11px] text-slate-500">Visible to: {(p.visible_to_roles || []).join(', ') || 'admins only'}</p>
                )}
                <div className="mt-4 flex items-center gap-2 pt-1">
                  {p.demo_url && (
                    <button
                      onClick={() => p.demo_url.startsWith('http') ? window.open(p.demo_url, '_blank') : navigate(p.demo_url)}
                      className="btn-primary text-sm"
                    >Open demo</button>
                  )}
                  {isManager && (
                    <button onClick={() => setEditing({ ...p })} className="text-sm text-slate-400 hover:text-white">Edit</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setEditing(null)}>
          <form onClick={e => e.stopPropagation()} onSubmit={save} className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-xl border border-navy-700 bg-navy-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">{editing.id ? 'Edit product' : 'Add product'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Name</label><input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></div>
              <div><label className="label">Slug</label><input className="input" value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value })} placeholder="roofx" required /></div>
            </div>
            <div><label className="label">Tagline</label><input className="input" value={editing.tagline || ''} onChange={e => setEditing({ ...editing, tagline: e.target.value })} /></div>
            <div><label className="label">Description</label><textarea className="input min-h-[90px]" value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Demo URL</label><input className="input" value={editing.demo_url || ''} onChange={e => setEditing({ ...editing, demo_url: e.target.value })} placeholder="/crm/.../dashboard" /></div>
              <div><label className="label">Category</label><input className="input" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
            </div>
            <div><label className="label">Pricing summary</label><input className="input" value={editing.pricing_summary || ''} onChange={e => setEditing({ ...editing, pricing_summary: e.target.value })} /></div>
            <div><label className="label">Dev notice (yellow banner)</label><textarea className="input min-h-[60px]" value={editing.dev_notice || ''} onChange={e => setEditing({ ...editing, dev_notice: e.target.value })} placeholder="Still in Dev Lab — some features may not fully work yet. If you find a bug, report it." /></div>
            <div><label className="label">Planned release date</label><input type="date" className="input" value={editing.release_date || ''} onChange={e => setEditing({ ...editing, release_date: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Status</label>
                <select className="input" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="coming_soon">Coming soon</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div><label className="label">Sort order</label><input type="number" className="input" value={editing.sort_order} onChange={e => setEditing({ ...editing, sort_order: e.target.value })} /></div>
            </div>
            <div>
              <label className="label">Which roles can sell this</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ROLE_CHOICES.map(r => {
                  const on = (editing.visible_to_roles || []).includes(r.code)
                  return (
                    <button type="button" key={r.code} onClick={() => toggleRole(r.code)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${on ? 'bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan' : 'border-navy-700 text-slate-400 hover:text-slate-200'}`}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Admins and managers always see every product.</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="text-sm text-slate-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save product'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg bg-sky-600 text-white text-sm shadow-lg">{toast}</div>}
    </div>
  )
}
