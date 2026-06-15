// =====================================================================
// _ecomShared - shared primitives for the e-commerce (thrift reseller)
// industry pages. Mirrors src/pages/crm/_shared.jsx conventions.
// Mobile-first: VJ Thrift Finds runs this CRM from a phone.
// =====================================================================
import { useCrm } from '../../contexts/CrmContext'

// Re-export the same hook shape the base CRM pages use.
export function useCrmClient() {
  const { client, platform, orgSettings, enabledHubs, platformId } = useCrm()
  return { client, platform, orgSettings, enabledHubs, platformId }
}

// CRITICAL: anon cannot select access_token on social_accounts.
// Always query with this explicit column list - never select('*').
export const SOCIAL_ACCOUNT_COLUMNS =
  'id,platform,account_name,page_id,ig_user_id,is_active,token_expires_at,connected_at'

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'pinterest']

// ---------- formatters ----------
export const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export const fmtMoney0 = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function fmtDate(d) {
  if (!d) return '-'
  const date = new Date(d)
  const opts = { month: 'short', day: 'numeric' }
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString('en-US', opts)
}

export function daysSince(d) {
  if (!d) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000))
}

export function relTime(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ---------- status maps ----------
export const LISTING_STATUS = {
  draft:     { label: 'Draft',    cls: 'bg-navy-700/60 text-gray-300' },
  published: { label: 'Active',   cls: 'bg-emerald-500/20 text-emerald-300' },
  active:    { label: 'Active',   cls: 'bg-emerald-500/20 text-emerald-300' },
  sold:     { label: 'Sold',     cls: 'bg-brand-cyan/20 text-brand-cyan' },
  delisted: { label: 'Delisted', cls: 'bg-amber-500/20 text-amber-300' },
  archived: { label: 'Archived', cls: 'bg-navy-700/40 text-gray-500' },
}

export const ORDER_STATUS = {
  paid:      { label: 'Paid',      cls: 'bg-sky-500/20 text-sky-300' },
  packaging: { label: 'Packaging', cls: 'bg-amber-500/20 text-amber-300' },
  shipped:   { label: 'Shipped',   cls: 'bg-brand-cyan/20 text-brand-cyan' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-500/20 text-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-navy-700/60 text-gray-400' },
  refunded:  { label: 'Refunded',  cls: 'bg-rose-500/20 text-rose-300' },
}

export const ORDER_FLOW = ['paid', 'packaging', 'shipped', 'delivered']

export const POST_STATUS = {
  queued: { label: 'Queued', cls: 'bg-amber-500/20 text-amber-300' },
  posted: { label: 'Posted', cls: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Failed', cls: 'bg-rose-500/20 text-rose-300' },
}

export function StatusChip({ map, value }) {
  const cfg = (map || {})[value] || { label: value || '-', cls: 'bg-navy-700/60 text-gray-300' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ---------- platform icons (lucide 1.7 has no brand icons) ----------
function FacebookGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.62.77-1.62 1.56v1.88h2.76l-.44 2.91h-2.32V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  )
}
function InstagramGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
function PinterestGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 16.5c.6-2.4 1.2-4.9 1.5-6.2M11 8.2c1.8-1 4 .1 4 2.1 0 2.2-1.6 3.7-3.2 3.4-.8-.2-1.2-.8-1.1-1.6" strokeLinecap="round" />
    </svg>
  )
}
function ShareGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  )
}

const PLATFORM_GLYPHS = { facebook: FacebookGlyph, instagram: InstagramGlyph, pinterest: PinterestGlyph }

export const PLATFORM_LABELS = { facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest' }

export function PlatformIcon({ platform, className = 'w-4 h-4' }) {
  const Glyph = PLATFORM_GLYPHS[platform] || ShareGlyph
  return Glyph ? <Glyph className={className} /> : null
}

// ---------- listing thumbnail w/ graceful fallback ----------
export function ListingThumb({ src, alt, className = 'w-12 h-12' }) {
  if (!src) {
    return (
      <div className={`${className} rounded-lg bg-navy-700/50 flex items-center justify-center text-gray-600 shrink-0`}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    )
  }
  return <img src={src} alt={alt || ''} className={`${className} rounded-lg object-cover bg-navy-700/50 shrink-0`} loading="lazy" />
}

// ---------- mobile-friendly slide-over drawer ----------
export function Drawer({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'} max-h-[88vh] sm:max-h-none bg-navy-900 border-t sm:border-t-0 sm:border-l border-navy-700/50 rounded-t-2xl sm:rounded-none flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy-700/50 shrink-0">
          <h2 className="text-white font-semibold truncate">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-navy-800 flex items-center justify-center text-gray-400 hover:text-white" aria-label="Close">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

// Insert a best-effort activity_log row. Never blocks the calling flow.
export async function logActivity(client, action, entityType, entityId, details) {
  try {
    await client.from('activity_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      details: details || {},
    })
  } catch (e) {
    console.warn('activity_log insert failed (non-fatal):', e)
  }
}
