// Renders only when platform.labos_enabled === true.
// Surfaces LABOS-KEC details on the standard PlatformDetail.jsx sidebar so
// Ryan/Mike can jump straight from the platform record into the live operator
// admin without context-switching.

import { Link } from 'react-router-dom'

const INDUSTRY_LABELS = {
  kec: { label: 'KEC', subtitle: 'Kitchen Exhaust Cleaning', tone: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  thrift_retail: { label: 'Thrift / Retail', subtitle: 'Resale & marketplace', tone: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
}

const HUB_DISPLAY = {
  overview: 'Overview',
  customers: 'Customers',
  jobs: 'Jobs',
  deficiencies: 'Deficiencies',
  invoices: 'Invoices',
  certificates: 'Certificates',
  stickers: 'Stickers',
  ahj_map: 'AHJ Map',
  dashboard: 'Dashboard',
  sales: 'Sales',
  operations: 'Operations',
  marketing: 'Marketing',
  finance: 'Finance',
  communications: 'Comms',
  chat: 'Chat',
  support: 'Support',
}

export default function LabosTenantCard({ platform }) {
  if (!platform?.labos_enabled) return null

  const industry = INDUSTRY_LABELS[platform.industry] || { label: (platform.industry || 'LABOS').toUpperCase(), subtitle: 'Vertical platform', tone: 'bg-violet-500/15 text-violet-300 border-violet-500/30' }
  const hubs = Array.isArray(platform.labos_hubs) ? platform.labos_hubs : []
  const isKec = platform.industry === 'kec'

  return (
    <div className="bg-gradient-to-br from-orange-500/8 to-violet-500/5 border border-orange-500/20 rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">LABOS Tenant</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${industry.tone}`}>
              {industry.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{industry.subtitle}</p>
        </div>
        {platform.monthly_revenue > 0 && (
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">MRR</div>
            <div className="text-lg font-bold text-emerald-400">${platform.monthly_revenue}</div>
          </div>
        )}
      </div>

      {platform.admin_url && (
        <a
          href={platform.admin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full px-3 py-2.5 mb-3 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-200 rounded-lg text-sm font-medium transition-colors"
        >
          <span>Open operator admin →</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      )}

      {hubs.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Hubs ({hubs.length})</div>
          <div className="flex flex-wrap gap-1">
            {hubs.map(h => (
              <span key={h} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-300 border border-white/10">
                {HUB_DISPLAY[h] || h}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/5 text-xs">
        {platform.supabase_project_id && (
          <div className="col-span-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Supabase project</div>
            <div className="font-mono text-gray-400 truncate" title={platform.supabase_project_id}>{platform.supabase_project_id}</div>
          </div>
        )}
        {platform.platform_type && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Type</div>
            <div className="text-gray-300">{platform.platform_type}</div>
          </div>
        )}
        {platform.launched_at && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Launched</div>
            <div className="text-gray-300">{new Date(platform.launched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
        )}
      </div>

      {isKec && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Demo links</div>
          <div className="space-y-1 text-xs">
            <a href="https://admin.liftori.ai/csc/portal/1df597304f32b172c6ee05811531bda0" target="_blank" rel="noopener noreferrer"
               className="block text-blue-300/80 hover:text-blue-200 truncate">
              → Portal: Sage &amp; Smoke Hartford
            </a>
            <a href="https://admin.liftori.ai/csc/verify/D6D3D506713F" target="_blank" rel="noopener noreferrer"
               className="block text-blue-300/80 hover:text-blue-200 truncate">
              → Verify: threshold violation cert
            </a>
            <a href="https://admin.liftori.ai/csc/tech" target="_blank" rel="noopener noreferrer"
               className="block text-blue-300/80 hover:text-blue-200 truncate">
              → Tech mobile-web app
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
