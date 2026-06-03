// ============================================================
// EstimateTemplates.jsx — /admin/estimate-templates (Wave E.1)
// Reusable estimate bundles + line items + pricebook entry point.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const INDUSTRY_LABEL = {
  hvac: 'HVAC', plumbing: 'Plumbing', roofing: 'Roofing',
  cleaning: 'Cleaning', landscaping: 'Landscaping',
  electrical: 'Electrical', pest: 'Pest Control',
  pool: 'Pool Services', it: 'IT / MSP',
  consulting: 'Consulting', general: 'General',
}

export default function EstimateTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [items, setItems] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [industry, setIndustry] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('estimate_templates')
        .select('*')
        .order('industry', { ascending: true })
        .order('name', { ascending: true })
      if (!cancelled) {
        setTemplates(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function loadItems(templateId) {
    if (items[templateId]) return
    const { data } = await supabase
      .from('estimate_template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('step_order')
    setItems(prev => ({ ...prev, [templateId]: data || [] }))
  }

  function handleExpand(templateId) {
    setExpanded(expanded === templateId ? null : templateId)
    loadItems(templateId)
  }

  const filtered = useMemo(() => {
    return (templates || []).filter(t => {
      if (industry !== 'all' && t.industry !== industry) return false
      if (q && !`${t.name} ${t.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [templates, industry, q])

  const industries = useMemo(() => {
    const set = new Set(templates.map(t => t.industry).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [templates])

  if (!user) return <div className="p-6 text-slate-300">Not signed in.</div>

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Estimate Templates</h1>
            <p className="mt-1 text-sm text-slate-400">Reusable line-item bundles. Drop them on any deal and edit before sending.</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin/pricebook" className="inline-flex items-center gap-1.5 rounded-md border border-navy-700/60 px-3 py-2 text-sm text-slate-300 hover:border-brand-cyan/40 hover:text-brand-cyan">
              Pricebook
            </a>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-cyan px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90">
              + New Template
            </button>
          </div>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {industries.map(ind => (
            <button
              key={ind}
              onClick={() => setIndustry(ind)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                industry === ind
                  ? 'border-transparent bg-brand-cyan text-navy-950'
                  : 'border-navy-700/60 bg-navy-800/40 text-slate-300 hover:text-brand-cyan'
              }`}
            >
              {ind === 'all' ? 'All' : (INDUSTRY_LABEL[ind] || ind)}
            </button>
          ))}
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search templates..."
            className="ml-auto w-64 rounded-md border border-navy-700/60 bg-navy-900/60 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
          />
        </div>

        {loading ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">Loading templates…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">
            No templates yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const open = expanded === t.id
              const list = items[t.id] || []
              const total = list.filter(i => !i.is_optional).reduce((a, i) => a + (Number(i.quantity) * Number(i.unit_price)), 0)
              return (
                <article key={t.id} className="rounded-xl border border-navy-700/50 bg-navy-800/60">
                  <button
                    onClick={() => handleExpand(t.id)}
                    className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-navy-800/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{t.name}</h3>
                        {t.industry && (
                          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-300">
                            {INDUSTRY_LABEL[t.industry] || t.industry}
                          </span>
                        )}
                        {t.service_type && (
                          <span className="rounded-full border border-navy-700/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                            {t.service_type}
                          </span>
                        )}
                      </div>
                      {t.description && <p className="mt-1 text-xs text-slate-400">{t.description}</p>}
                      <p className="mt-2 text-[11px] text-slate-500">
                        Used {t.usage_count || 0} times · Valid {t.default_validity_days}d · Tax {(Number(t.default_tax_rate) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span className="shrink-0 text-2xl text-slate-500">{open ? '−' : '+'}</span>
                  </button>

                  {open && (
                    <div className="border-t border-navy-700/40 p-4">
                      {list.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-500">Loading line items…</p>
                      ) : (
                        <>
                          <table className="w-full text-xs">
                            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                              <tr>
                                <th className="px-2 py-2 text-left">Item</th>
                                <th className="px-2 py-2 text-right">Qty</th>
                                <th className="px-2 py-2 text-right">Unit</th>
                                <th className="px-2 py-2 text-right">Price</th>
                                <th className="px-2 py-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map(li => (
                                <tr key={li.id} className={`border-t border-navy-700/30 ${li.is_optional ? 'opacity-60' : ''}`}>
                                  <td className="px-2 py-2 text-slate-200">
                                    <div className="font-medium">{li.name}</div>
                                    {li.group_name && <div className="text-[10px] uppercase tracking-wider text-slate-500">{li.group_name}</div>}
                                    {li.is_optional && <div className="text-[10px] text-amber-400">optional</div>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-slate-300">{Number(li.quantity)}</td>
                                  <td className="px-2 py-2 text-right text-slate-400">{li.unit}</td>
                                  <td className="px-2 py-2 text-right text-slate-300">${Number(li.unit_price).toFixed(2)}</td>
                                  <td className="px-2 py-2 text-right text-slate-100">${(Number(li.quantity) * Number(li.unit_price)).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-navy-700/50">
                                <td colSpan={4} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-slate-500">Required subtotal</td>
                                <td className="px-2 py-2 text-right text-sm font-semibold text-brand-cyan">${total.toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <button className="rounded-md border border-navy-700/60 px-3 py-1.5 text-xs text-slate-300 hover:border-brand-cyan/40 hover:text-brand-cyan">Edit</button>
                            <button className="rounded-md bg-brand-cyan px-3 py-1.5 text-xs font-semibold text-navy-950 hover:bg-brand-cyan/90">Use on a deal →</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
