import { Link } from 'react-router-dom'
import { Smartphone, LayoutGrid, ExternalLink, ArrowRight } from 'lucide-react'
import { PRODUCTS, CATEGORY_TINT, STATUS_TINT } from '../lib/products'

/**
 * Products hub (/admin/products)
 *
 * One card per Liftori product — every CRM, web app, and mobile app is a build,
 * unified here. A product with a CRM + a mobile app is ONE card; its detail page
 * carries both (CRM button + App Viewer tab). Replaces the old scattered
 * "CRMS" + "Mobile Apps" sidebar lists.
 */

const STATUS_LABEL = { live: 'Live', demo: 'Demo', planned: 'Planned' }

export default function Products() {
  const live = PRODUCTS.filter((p) => p.status === 'live')
  const demo = PRODUCTS.filter((p) => p.status === 'demo')
  const planned = PRODUCTS.filter((p) => p.status === 'planned')

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-brand-blue">
          <LayoutGrid className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-widest">Liftori Products</span>
        </div>
        <h1 className="mt-1 text-3xl font-bold text-white">Products</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Every CRM, web app, and mobile app Liftori builds — each one a single project. Open a product to manage its CRM and preview its app from one place.
        </p>
      </div>

      <Section title="Live" count={live.length}>
        {live.map((p) => <ProductCard key={p.slug} product={p} />)}
      </Section>

      {demo.length > 0 && (
        <Section title="Demo" count={demo.length}>
          {demo.map((p) => <ProductCard key={p.slug} product={p} />)}
        </Section>
      )}

      {planned.length > 0 && (
        <Section title="Planned — not provisioned yet" count={planned.length}>
          {planned.map((p) => <ProductCard key={p.slug} product={p} />)}
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">{title}</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">{count}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  )
}

function ProductCard({ product }) {
  const dim = product.status === 'planned'
  return (
    <Link
      to={`/admin/products/${product.slug}`}
      className={`group flex flex-col rounded-xl border border-white/10 bg-navy-900/60 p-5 transition-colors hover:border-brand-blue/40 hover:bg-navy-800/70 ${dim ? 'opacity-70 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-white">{product.name}</h3>
          <p className="mt-0.5 text-sm text-gray-400">{product.tagline}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TINT[product.status]}`}>
          {STATUS_LABEL[product.status]}
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
