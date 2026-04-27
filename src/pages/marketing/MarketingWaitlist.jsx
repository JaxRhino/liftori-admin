// MarketingWaitlist — per-product waitlist viewer at /admin/marketing/waitlist.
// Shows all waitlist_signups, grouped + filterable by product_interest. CSV export
// respects the active filter so you can hand a clean per-product list to the team.

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

const PRODUCT_LABELS = {
  bolo_go: 'BOLO Go',
  crm: 'CRM',
  general: 'General',
}

const PRODUCT_TONES = {
  all:     { chip: 'bg-sky-500 text-white',                    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  bolo_go: { chip: 'bg-emerald-500 text-white',                badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  crm:     { chip: 'bg-blue-500 text-white',                   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  general: { chip: 'bg-slate-600 text-white',                  badge: 'bg-slate-700/30 text-slate-300 border-slate-500/30' },
  other:   { chip: 'bg-violet-500 text-white',                 badge: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(rows, filename) {
  const headers = ['full_name', 'email', 'product_interest', 'app_type', 'build_idea', 'referral_code', 'created_at']
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function MarketingWaitlist() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('waitlist_signups')
        .select('id, full_name, email, build_idea, app_type, product_interest, referral_code, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      setRows(data || [])
    } catch (err) {
      console.error('waitlist load:', err)
    } finally {
      setLoading(false)
    }
  }

  // Tally counts per product (always includes 'all')
  const counts = useMemo(() => {
    const c = { all: rows.length, bolo_go: 0, crm: 0, general: 0, other: 0 }
    for (const r of rows) {
      const p = r.product_interest || 'general'
      if (p === 'bolo_go' || p === 'crm' || p === 'general') c[p]++
      else c.other++
    }
    return c
  }, [rows])

  const filtered = useMemo(() => {
    let out = rows
    if (filter !== 'all') {
      out = out.filter((r) => {
        const p = r.product_interest || 'general'
        if (filter === 'other') return p !== 'bolo_go' && p !== 'crm' && p !== 'general'
        return p === filter
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((r) =>
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.build_idea || '').toLowerCase().includes(q) ||
        (r.app_type || '').toLowerCase().includes(q),
      )
    }
    return out
  }, [rows, filter, search])

  const todayCount = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return rows.filter((r) => new Date(r.created_at) >= today).length
  }, [rows])

  const last7Count = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    return rows.filter((r) => new Date(r.created_at) >= cutoff).length
  }, [rows])

  function exportFiltered() {
    const tag = filter === 'all' ? 'all' : filter
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(filtered, `liftori_waitlist_${tag}_${date}.csv`)
  }

  function chipFor(key, label) {
    const active = filter === key
    const tone = PRODUCT_TONES[key] || PRODUCT_TONES.other
    return (
      <button
        key={key}
        onClick={() => setFilter(key)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-2 ${
          active ? tone.chip : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
        }`}
      >
        {label}
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${active ? 'bg-black/25 text-white/95' : 'bg-slate-900 text-slate-400'}`}>
          {counts[key] ?? 0}
        </span>
      </button>
    )
  }

  function badge(productKey) {
    const tone = PRODUCT_TONES[productKey] || PRODUCT_TONES.other
    return (
      <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone.badge}`}>
        {PRODUCT_LABELS[productKey] || productKey || 'general'}
      </span>
    )
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Waitlist Signups</h1>
          <p className="text-slate-400 text-sm mt-1">All pre-launch signups across Liftori products. Tagged by which page they signed up from.</p>
        </div>
        <button
          onClick={exportFiltered}
          disabled={filtered.length === 0}
          className="bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Export {filter === 'all' ? 'all' : PRODUCT_LABELS[filter] || filter} ({filtered.length}) → CSV
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">Total signups</div>
          <div className="text-2xl font-bold text-white">{rows.length.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">Last 7 days</div>
          <div className="text-2xl font-bold text-emerald-400">+{last7Count.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">Today</div>
          <div className="text-2xl font-bold text-sky-400">+{todayCount.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">BOLO Go vs CRM</div>
          <div className="text-2xl font-bold text-white">
            <span className="text-emerald-400">{counts.bolo_go}</span>
            <span className="text-slate-500 mx-2">/</span>
            <span className="text-blue-400">{counts.crm}</span>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {chipFor('all',     'All')}
        {chipFor('bolo_go', 'BOLO Go')}
        {chipFor('crm',     'CRM')}
        {chipFor('general', 'General (liftori.ai)')}
        {counts.other > 0 && chipFor('other', 'Other')}
        <input
          type="text"
          placeholder="Search name / email / idea..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500 w-72"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-900/40">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Type / Trade</th>
                <th className="px-4 py-3 font-medium">Idea / Notes</th>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                  {rows.length === 0 ? 'No signups yet.' : 'No signups match this filter.'}
                </td></tr>
              ) : (
                filtered.map((r) => {
                  const product = r.product_interest || 'general'
                  const productKey = (product === 'bolo_go' || product === 'crm' || product === 'general') ? product : 'other'
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">{badge(productKey)}</td>
                      <td className="px-4 py-3 text-white">{r.full_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{r.email}</td>
                      <td className="px-4 py-3 text-slate-400">{r.app_type || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-md truncate" title={r.build_idea || ''}>
                        {r.build_idea || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {r.referral_code ? <span className="text-amber-400">{r.referral_code}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs text-right whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
