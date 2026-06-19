import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Smartphone, ExternalLink, Globe, FileText, StickyNote,
  LayoutDashboard, Check, AlertTriangle,
} from 'lucide-react'
import { getProduct, CATEGORY_TINT, STATUS_TINT } from '../lib/products'
import AppPreviewPane from '../components/AppPreviewPane'

/**
 * ProductDetail (/admin/products/:slug)
 *
 * Unified per-product workspace. Tabs: Overview, App (embedded App Viewer),
 * Scope, Notes. Header carries an "Open CRM / Open System" button + live-site
 * link. Every product gets the full tab set even when it has no DB or app yet.
 */

const STATUS_LABEL = { live: 'Live', demo: 'Demo', planned: 'Planned' }

export default function ProductDetail() {
  const { slug } = useParams()
  const product = getProduct(slug)
  const [tab, setTab] = useState('overview')

  if (!product) return <NotFound slug={slug} />

  const internalSystem = product.systemUrl && product.systemUrl.startsWith('/')

  const TABS = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'app', label: 'App', icon: Smartphone },
    { key: 'scope', label: 'Scope', icon: FileText },
    { key: 'notes', label: 'Notes', icon: StickyNote },
  ]

  return (
    <div className="p-6 space-y-6">
      <Link to="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All products
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-white">{product.name}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TINT[product.status]}`}>{STATUS_LABEL[product.status]}</span>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_TINT[product.category] || 'border-white/10 bg-white/5 text-gray-300'}`}>{product.category}</span>
          </div>
          <p className="mt-1 text-sm text-gray-400">{product.tagline}</p>
        </div>

        <div className="flex items-center gap-2">
          {product.liveSite && (
            <a href={product.liveSite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800 px-3 py-2 text-sm text-gray-200 hover:bg-navy-700">
              <Globe className="h-4 w-4" /> Live site
            </a>
          )}
          {product.systemUrl && (
            internalSystem ? (
              <Link to={product.systemUrl} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/90">
                <ExternalLink className="h-4 w-4" /> {product.systemLabel}
              </Link>
            ) : (
              <a href={product.systemUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/90">
                <ExternalLink className="h-4 w-4" /> {product.systemLabel}
              </a>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              <Icon className="h-4 w-4" />
              {t.label}
              {t.key === 'app' && product.app && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>
          )
        })}
      </div>

      {/* Tab body */}
      {tab === 'overview' && <Overview product={product} />}
      {tab === 'app' && <AppPreviewPane app={product.app} productName={product.name} />}
      {tab === 'scope' && <Prose title="Scope" body={product.scope} />}
      {tab === 'notes' && <Prose title="Notes" body={product.notes} />}
    </div>
  )
}

function Overview({ product }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-xl border border-white/10 bg-navy-900/60 p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-300">About</h3>
          <p className="text-sm leading-relaxed text-gray-300">{product.description}</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-navy-900/60 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">What's built</h3>
          {product.whatsBuilt && product.whatsBuilt.length > 0 ? (
            <ul className="space-y-2">
              {product.whatsBuilt.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-white/10 bg-navy-800/40 p-3 text-sm text-gray-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>Not provisioned yet — this product page is built and ready. Use the {product.systemLabel || 'action'} button to spin it up.</span>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-xl border border-white/10 bg-navy-900/60 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">Stack</h3>
          <div className="flex flex-wrap gap-2">
            {product.stack.map((s) => (
              <span key={s} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300">{s}</span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-navy-900/60 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">At a glance</h3>
          <Row label="Has CRM / system" value={product.systemUrl ? 'Yes' : 'No'} />
          <Row label="Has mobile app" value={product.app ? (product.app.status === 'live' ? 'Yes — live' : 'Scaffold') : 'No'} />
          <Row label="Live site" value={product.liveSite ? 'Yes' : 'No'} />
        </section>
      </aside>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  )
}

function Prose({ title, body }) {
  return (
    <section className="max-w-3xl rounded-xl border border-white/10 bg-navy-900/60 p-5">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-300">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-line">{body || 'Nothing recorded yet.'}</p>
    </section>
  )
}

function NotFound({ slug }) {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-white/10 bg-navy-800/40 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
        <h1 className="mt-3 text-xl font-bold text-white">Product not found</h1>
        <p className="mt-2 text-sm text-gray-400">No product is registered under <span className="font-mono text-brand-blue">{slug}</span>.</p>
        <Link to="/admin/products" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-navy-800/70 px-3 py-1.5 text-sm text-gray-200 hover:bg-navy-700">
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Link>
      </div>
    </div>
  )
}
