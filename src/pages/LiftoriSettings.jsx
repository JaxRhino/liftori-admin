// ============================================================
// LiftoriSettings.jsx -- /admin/liftori-settings
// Liftori-team config home. Consolidates the CRM library tools
// (Reports, Automations, Estimate Templates, Email Templates)
// under one tabbed surface. Workforce is a launcher tab: it
// opens the full Workforce workspace at /admin/workforce.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Reports from './Reports'
import Automations from './Automations'
import EstimateTemplates from './EstimateTemplates'
import EmailTemplates from './EmailTemplates'

const TABS = [
  { key: 'reports',            label: 'Reports' },
  { key: 'automations',        label: 'Automations' },
  { key: 'estimate-templates', label: 'Estimate Templates' },
  { key: 'email-templates',    label: 'Email Templates' },
  { key: 'workforce',          label: 'Workforce', to: '/admin/workforce' },
]

export default function LiftoriSettings() {
  const [tab, setTab] = useState('reports')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="border-b border-navy-700/50 bg-navy-900/60 px-4 pt-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold text-slate-100">Liftori Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Internal CRM library, workflow tools, and the Workforce roster. These configure what the team works from.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => (t.to ? navigate(t.to) : setTab(t.key))}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === t.key
                    ? 'border-brand-cyan text-brand-cyan'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {tab === 'reports'            && <Reports />}
        {tab === 'automations'        && <Automations />}
        {tab === 'estimate-templates' && <EstimateTemplates />}
        {tab === 'email-templates'    && <EmailTemplates />}
      </div>
    </div>
  )
}
