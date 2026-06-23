import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Smartphone, ExternalLink, Globe, LayoutDashboard, Check, AlertTriangle, Wrench } from 'lucide-react'
import { CATEGORY_TINT, paletteTint } from '../lib/products'
import { useStages } from '../lib/useStages'
import AppPreviewPane from '../components/AppPreviewPane'
import FeatureLibraryPicker from '../components/FeatureLibraryPicker'
import { supabase } from '../lib/supabase'
import { WorkspaceTabBody, wsTabBadge, WORKSPACE_TABS, WORKSPACE_TAB_KEYS, PRODUCT_TYPES } from '../components/BuildWorkspace'

/**
 * LiftoriBuild (/admin/liftori)
 *
 * The internal build tracker for the Liftori platform ITSELF - same workspace
 * template as every customer Product (Overview, Project Details, Design, App,
 * App Features, Features, Scope, Timeline, Implementation Plan, Security, Costs,
 * Documents, Tasks), so our own infrastructure is documented exactly like the
 * products we ship. Build data persists in product_workspaces under slug
 * 'liftori'. Lives under Operations > Dev Lab; NOT in the customer Products grid.
 */

const SLUG = 'liftori'

// Baked-in "product" definition for the Liftori platform (admin side, internal).
const LIFTORI = {
  slug: SLUG,
  name: 'Liftori',
  tagline: 'The Liftori platform itself - admin OS, customer flow, CRM engine & infrastructure',
  category: 'Business Platform',
  stage: 'developing',
  systemLabel: 'Open Admin',
  systemUrl: 'https://admin.liftori.ai',
  liveSite: 'https://www.liftori.ai',
  stack: ['React 18 + Vite', 'Tailwind CSS', 'Supabase (Postgres + Auth + Edge Fns)', 'Vercel', 'Cloudflare', 'Resend', 'Stripe', 'Claude API'],
  description:
    "Liftori is an AI-powered platform that turns business ideas into live, deployed products. This page tracks the build of the Liftori platform itself - the admin operating system (Sales, Operations, Finance, Marketing, Dev Lab, EOS), the customer onboarding flow, the multi-tenant CRM engine that powers every client, payments, the AI layer, and the underlying infrastructure. Use the Features tab to see, by area, what's Live, what's Building, and what's still Needed so nothing gets lost.",
  whatsBuilt: [
    'Admin OS - ~100 pages across Sales, Operations, Finance, Marketing, Dev Lab, EOS, Comms',
    'Multi-tenant CRM engine (RoofX, CSC, Apex, VJ, Freight) on one reusable shell',
    'Customer onboarding wizard (12 flows) -> lead -> project routing -> team email',
    'Stripe LIVE, monetization + platform-fee layer, plans/tiers',
    'Marketing Hub, Lead Hunter, Call Center, HR Hub, Consulting/EOS suites',
    'Agent chat + autonomous dev org, work queue, telemetry-driven nightly builds',
  ],
  app: null,
}

export default function LiftoriBuild() {
  const product = LIFTORI
  const { stages, byKey } = useStages()
  const [tab, setTab] = useState('overview')
  const [ws, setWs] = useState({})
  const [loading, setLoading] = useState(true)
  const [wsSaving, setWsSaving] = useState(false)
  const [stageOverride, setStageOverride] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase
      .from('product_workspaces')
      .select('workspace, stage')
      .eq('slug', SLUG)
      .maybeSingle()
      .then(({ data }) => { if (alive) { setWs(data?.workspace || {}); setStageOverride(data?.stage || null); setLoading(false) } })
    return () => { alive = false }
  }, [])

  async function saveWs(next) {
    setWs(next)            // optimistic
    setWsSaving(true)
    try {
      const { error } = await supabase
        .from('product_workspaces')
        .upsert({ slug: SLUG, workspace: next, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
      if (error) console.error('Error saving Liftori workspace:', error)
    } finally {
      setWsSaving(false)
    }
  }

  async function changeStage(next) {
    setStageOverride(next)
    try {
      const { error } = await supabase
        .from('product_workspaces')
        .upsert({ slug: SLUG, stage: next, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
      if (error) console.error('Error saving stage:', error)
    } catch (e) { console.error(e) }
  }

  const effectiveStage = stageOverride || product.stage

  const productType = {
    value: ws.details?.product_type || product.category,
    options: PRODUCT_TYPES,
    onChange: (v) => saveWs({ ...ws, details: { ...(ws.details || {}), product_type: v } }),
  }

  // Order: Overview, Project Details, Design, App, App Features, then the rest.
  const detailsTab = WORKSPACE_TABS.find((t) => t.key === 'details')
  const designTab = WORKSPACE_TABS.find((t) => t.key === 'design')
  const restTabs = WORKSPACE_TABS.filter((t) => t.key !== 'details' && t.key !== 'design')
  const allTabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    ...(detailsTab ? [detailsTab] : []),
    ...(designTab ? [designTab] : []),
    { key: 'app', label: 'App', icon: Smartphone },
    { key: 'app_builder', label: 'App Features', icon: Wrench },
    ...restTabs,
  ]

  return (
    <div className="p-6 space-y-6">
      <Link to="/admin/dev-lab" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Dev Lab
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-white">{product.name}</h1>
            <select
              value={effectiveStage}
              onChange={(e) => changeStage(e.target.value)}
              title="Change status / build stage"
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-blue/40 ${paletteTint(byKey[effectiveStage]?.color)}`}
            >
              {stages.map((s) => (
                <option key={s.stage_key} value={s.stage_key} className="bg-navy-800 normal-case text-white">{s.label}</option>
              ))}
            </select>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_TINT[product.category] || 'border-white/10 bg-white/5 text-gray-300'}`}>{product.category}</span>
            {wsSaving && <span className="text-[11px] text-gray-500">Saving...</span>}
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
            <a href={product.systemUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue/90">
              <ExternalLink className="h-4 w-4" /> {product.systemLabel}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {allTabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          const badge = WORKSPACE_TAB_KEYS.includes(t.key) ? wsTabBadge(ws, t.key) : null
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
                active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-400 hover:text-white'
              }`}>
              {Icon && <Icon className="h-4 w-4" />}
              {t.label}
              {badge != null && <span className="ml-0.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* Tab body */}
      {tab === 'overview' && <Overview product={product} />}
      {tab === 'app' && <AppPreviewPane app={product.app} productName={product.name} />}
      {tab === 'app_builder' && (
        loading
          ? <div className="rounded-xl border border-white/10 bg-navy-900/60 p-8 text-center text-sm text-gray-500">Loading build data...</div>
          : <div className="space-y-4">
              <p className="text-sm text-gray-400">Check the pre-built app features this platform needs - each drops into the build with its scope, tasks, timeline and estimated cost (shared with the spec tabs).</p>
              <FeatureLibraryPicker ws={ws} onSave={saveWs} mode="app" />
            </div>
      )}
      {WORKSPACE_TAB_KEYS.includes(tab) && (
        loading
          ? <div className="rounded-xl border border-white/10 bg-navy-900/60 p-8 text-center text-sm text-gray-500">Loading build data...</div>
          : <WorkspaceTabBody tab={tab} ws={ws} onSave={saveWs} productType={productType} />
      )}
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
          <ul className="space-y-2">
            {product.whatsBuilt.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-white/10 bg-navy-800/40 p-3 text-sm text-gray-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>Open the Features tab for the full has-vs-needs map by area (Live / Building / Needed), and the other spec tabs to document scope, security and the plan.</span>
          </p>
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
          <Row label="Admin OS" value="admin.liftori.ai" />
          <Row label="Landing" value="liftori.ai" />
          <Row label="Internal mobile app" value="Liftori App (own product)" />
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
