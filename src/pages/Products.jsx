import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Smartphone, LayoutGrid, ExternalLink, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { PRODUCTS, CATEGORY_TINT, paletteTint } from '../lib/products'
import { useStages } from '../lib/useStages'
import { supabase } from '../lib/supabase'
import StagesEditor from '../components/StagesEditor'

/**
 * Products hub (/admin/products)
 *
 * One card per Liftori product, organized by editable BUILD STAGE tabs
 * (managed in product_stages via the Manage stages editor). Each product's
 * stage = its product_workspaces.stage override, else the registry default.
 */

export default function Products() {
  const { stages, byKey, reload } = useStages()
  const [overrides, setOverrides] = useState({})
  const [editorOpen, setEditorOpen] = useState(false)
  const [stage, setStage] = useState('developing')

  useEffect(() => {
    let alive = true
    supabase.from('product_workspaces').select('slug, stage').then(({ data }) => {
      if (!alive || !data) return
      const map = {}
      data.forEach((r) => { if (r.stage) map[r.slug] = r.stage })
      setOverrides(map)
    })
    return () => { alive = false }
  }, [])

  const stageOf = (p) => overrides[p.slug] || p.stage
  const counts = stages.reduce((a, s) => ((a[s.stage_key] = PRODUCTS.filter((p) => stageOf(p) === s.stage_key).length), a), {})

  // keep the active tab valid/populated as stages or overrides load
  useEffect(() => {
    const exists = stages.some((s) => s.stage_key === stage)
    if (!exists || counts[stage] === 0) {
      const firstPop = stages.find((s) => counts[s.stage_key] > 0)
      if (firstPop) setStage(firstPop.stage_key)
      else if (!exists && stages[0]) setStage(stages[0].stage_key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.length, Object.keys(overrides).length])

  const shown = PRODUCTS.filter((p) => stageOf(p) === stage)
  const activeLabel = byKey[stage]?.label || stage

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-brand-blue">
            <LayoutGrid className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">Liftori Products</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">Products</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Every CRM, web app, and mobile app Liftori builds — each one a single project, organized by build stage. Open a product to manage its CRM, preview its app, document the build, and set its status.
          </p>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-gray-200 hover:bg-navy-700"
        >
          <SlidersHorizontal className="h-4 w-4" /> Manage stages
        </button>
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10">
        {stages.map((s) => {
          const active = stage === s.stage_key
          return (
            <button
              key={s.stage_key}
              onClick={() => setStage(s.stage_key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {s.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-gray-500'}`}>
                {counts[s.stage_key] || 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Cards for the active stage */}
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => <ProductCard key={p.slug} product={p} stageObj={byKey[stageOf(p)]} stageKey={stageOf(p)} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-navy-800/40 p-10 text-center">
          <p className="text-sm text-gray-400">Nothing in <span className="font-medium text-gray-200">{activeLabel}</span> yet.</p>
        </div>
      )}

      {editorOpen && <StagesEditor onClose={() => setEditorOpen(false)} onSaved={reload} />}
    </div>
  )
}

function ProductCard({ product, stageObj, stageKey }) {
  const label = stageObj?.label || stageKey
  const tint = paletteTint(stageObj?.color)
  return (
    <Link
      to={`/admin/products/${product.slug}`}
      className="group flex flex-col rounded-xl border border-white/10 bg-navy-900/60 p-5 transition-colors hover:border-brand-blue/40 hover:bg-navy-800/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{product.name}</h3>
          <p className="mt-0.5 text-sm text-gray-400">{product.tagline}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tint}`}>
          {label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_TINT[product.category] || 'border-white/10 bg-white/5 text-gray-300'}`}>
          {product.category}
        </span>
        {product.app && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
            <Smartphone className="h-3 w-3" /> App
          </span>
        )}
        {product.systemUrl && (
          <span className="inline-flex items-center gap-1 rounded-md border border-brand-blue/20 bg-brand-blue/10 px-2 py-0.5 text-[11px] font-medium text-brand-blue">
            <ExternalLink className="h-3 w-3" /> {product.systemLabel}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-gray-500 group-hover:text-brand-blue">
        <span>Open project</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}
