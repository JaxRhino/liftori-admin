import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Smartphone, LayoutGrid, ExternalLink, ArrowRight } from 'lucide-react'
import { PRODUCTS, CATEGORY_TINT, STAGES, STAGE_LABEL, STAGE_TINT } from '../lib/products'

/**
 * Products hub (/admin/products)
 *
 * One card per Liftori product — every CRM, web app, and mobile app is a build,
 * unified here. Organized by BUILD STAGE tabs (Planned -> Dev Prep -> Developing
 * -> Testing -> Production Ready -> Launched) so the page reflects where each
 * build actually is. A product with a CRM + a mobile app is ONE card; its detail
 * page carries both (CRM button + App Viewer tab).
 */

export default function Products() {
  // default to the first stage that has products (falls back to 'developing')
  const counts = STAGES.reduce((a, s) => ((a[s.key] = PRODUCTS.filter((p) => p.stage === s.key).length), a), {})
  const firstPopulated = STAGES.find((s) => counts[s.key] > 0)?.key || 'developing'
  const [stage, setStage] = useState(firstPopulated)

  const shown = PRODUCTS.filter((p) => p.stage === stage)

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-brand-blue">
          <LayoutGrid className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-widest">Liftori Products</span>
        </div>
        <h1 className="mt-1 text-3xl font-bold text-white">Products</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Every CRM, web app, and mobile app Liftori builds — each one a single project, organized by build stage. Open a product to manage its CRM and preview its app from one place.
        </p>
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10">
        {STAGES.map((s) => {
          const active = stage === s.key
          return (
            <button
              key={s.key}
              onClick={() => setStage(s.key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {s.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-gray-500'}`}>
                {counts[s.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Cards for the active stage */}
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => <ProductCard key={p.slug} product={p} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-navy-800/40 p-10 text-center">
          <p className="text-sm text-gray-400">Nothing in <span className="font-medium text-gray-200">{STAGE_LABEL[stage]}</span> yet.</p>
        </div>
      )}
    </div>
  )
}

function ProductCard({ product }) {
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
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STAGE_TINT[product.stage]}`}>
          {STAGE_LABEL[product.stage]}
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
