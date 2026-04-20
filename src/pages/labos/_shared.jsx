// Shared primitives used by every LABOS hub page
import { useLabos } from '../../contexts/LabosContext'

export function HubPage({ title, subtitle, children, actions }) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}

export function StatCard({ label, value, accent = 'text-white', hint }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

export function EmptyState({ title, description, cta }) {
  return (
    <div className="bg-navy-800 border border-dashed border-navy-700/60 rounded-xl p-12 text-center">
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      {description && <p className="text-gray-400 text-sm max-w-md mx-auto mb-4">{description}</p>}
      {cta}
    </div>
  )
}

export function Section({ title, right, children }) {
  return (
    <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-navy-700/50 flex items-center justify-between">
        <h2 className="text-white font-semibold">{title}</h2>
        {right}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function useLabosClient() {
  const { client, platform, orgSettings, enabledHubs } = useLabos()
  return { client, platform, orgSettings, enabledHubs }
}
