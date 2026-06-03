// ============================================================
// Reports.jsx — /admin/reports (Wave E.1 — 2026-06-03)
// Saved-reports library: favorites, by-category, schedule.
// Auth: any signed-in member.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CATEGORIES = [
  { key: 'all',       label: 'All',       color: '#94a3b8' },
  { key: 'favorite',  label: 'Favorites', color: '#fbbf24' },
  { key: 'sales',     label: 'Sales',     color: '#06b6d4' },
  { key: 'finance',   label: 'Finance',   color: '#10b981' },
  { key: 'marketing', label: 'Marketing', color: '#a855f7' },
  { key: 'ops',       label: 'Ops',       color: '#f59e0b' },
  { key: 'executive', label: 'Executive', color: '#ef4444' },
]

const VIZ_ICON = {
  table: '☷',  bar: '▮', line: '⌇', pie: '◔',
  number: '#', funnel: '⌒', heatmap: '▤',
}

export default function Reports() {
  const { user, profile } = useAuth()
  const [reports, setReports]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [cat, setCat]           = useState('all')
  const [q, setQ]               = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('crm_reports')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('updated_at',  { ascending: false })
      if (!cancelled) {
        if (error) console.warn('reports load error', error)
        setReports(data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    return (reports || []).filter(r => {
      if (cat === 'favorite' && !r.is_favorite) return false
      if (cat !== 'all' && cat !== 'favorite' && r.category !== cat) return false
      if (q && !`${r.name} ${r.description || ''}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [reports, cat, q])

  const counts = useMemo(() => ({
    total: reports.length,
    favorites: reports.filter(r => r.is_favorite).length,
    scheduled: reports.filter(r => r.is_scheduled).length,
  }), [reports])

  async function toggleFavorite(r) {
    const next = !r.is_favorite
    setReports(prev => prev.map(x => x.id === r.id ? { ...x, is_favorite: next } : x))
    await supabase.from('crm_reports').update({ is_favorite: next }).eq('id', r.id)
  }

  if (!user) return <div className="p-6 text-slate-300">Not signed in.</div>

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Reports</h1>
            <p className="mt-1 text-sm text-slate-400">Saved reports across every CRM surface. Star the ones you check daily.</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-cyan px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90">
            + New Report
          </button>
        </header>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat label="Saved reports" value={counts.total} />
          <Stat label="Favorites"     value={counts.favorites} accent="#fbbf24" />
          <Stat label="Scheduled"     value={counts.scheduled} accent="#10b981" />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                cat === c.key
                  ? 'border-transparent bg-brand-cyan text-navy-950'
                  : 'border-navy-700/60 bg-navy-800/40 text-slate-300 hover:border-brand-cyan/40 hover:text-brand-cyan'
              }`}
              style={cat === c.key ? {} : { borderLeftColor: c.color, borderLeftWidth: 3 }}
            >
              {c.label}
            </button>
          ))}
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search reports..."
            className="ml-auto w-64 rounded-md border border-navy-700/60 bg-navy-900/60 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
          />
        </div>

        {loading ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">Loading reports…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">
            No reports match. Try a different category or clear search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(r => (
              <article
                key={r.id}
                className="group rounded-xl border border-navy-700/50 bg-navy-800/60 p-4 transition hover:border-brand-cyan/40 hover:bg-navy-800/80"
              >
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-900/60 text-base text-brand-cyan">
                      {VIZ_ICON[r.visualization] || '◇'}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{r.name}</h3>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{r.category || 'general'} · {r.visualization}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleFavorite(r)}
                    className="text-base transition"
                    style={{ color: r.is_favorite ? '#fbbf24' : '#475569' }}
                    title={r.is_favorite ? 'Unstar' : 'Star'}
                  >
                    ★
                  </button>
                </header>
                {r.description && <p className="mb-3 line-clamp-2 text-xs text-slate-400">{r.description}</p>}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <Chip>{r.source_table.replace(/_/g, ' ')}</Chip>
                  <Chip>{r.date_range.replace(/_/g, ' ')}</Chip>
                  {r.is_scheduled && <Chip color="#10b981">scheduled</Chip>}
                  {r.last_run_at && (
                    <span className="ml-auto text-slate-500">
                      ran {new Date(r.last_run_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-navy-700/40 pt-3">
                  <button className="text-xs font-medium text-brand-cyan hover:text-brand-cyan/80">Run →</button>
                  <button className="text-xs text-slate-500 hover:text-slate-300">Edit</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent || '#f1f5f9' }}>{value}</p>
    </div>
  )
}
function Chip({ children, color }) {
  return (
    <span
      className="rounded-full border bg-navy-900/40 px-2 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ borderColor: (color || '#475569') + '60', color: color || '#94a3b8' }}
    >{children}</span>
  )
}
