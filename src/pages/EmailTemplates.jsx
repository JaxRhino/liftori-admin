// ============================================================
// EmailTemplates.jsx — /admin/email-templates (Wave E.1)
// Comms template library: by category, channel chips, sequences entry.
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const CHANNEL_COLOR = { email: '#06b6d4', sms: '#10b981', call_script: '#a855f7' }
const CHANNEL_ICON  = { email: '✉', sms: '✆', call_script: '☎' }

export default function EmailTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [sequences, setSequences] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('templates')
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [tplRes, catRes, seqRes] = await Promise.all([
        supabase.from('comms_templates').select('*').order('usage_count', { ascending: false }),
        supabase.from('comms_template_categories').select('*').order('display_order'),
        supabase.from('email_sequences').select('*').order('status').order('updated_at', { ascending: false }),
      ])
      if (!cancelled) {
        setTemplates(tplRes.data || [])
        setCategories(catRes.data || [])
        setSequences(seqRes.data || [])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    return (templates || []).filter(t => {
      if (cat !== 'all' && t.category !== cat) return false
      if (q && !`${t.name} ${t.subject || ''} ${t.body || ''}`.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
  }, [templates, cat, q])

  if (!user) return <div className="p-6 text-slate-300">Not signed in.</div>

  return (
    <div className="min-h-screen bg-navy-950 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Communication Templates</h1>
            <p className="mt-1 text-sm text-slate-400">Email + SMS templates and multi-step sequences. Variables auto-fill from the contact record.</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-cyan px-4 py-2 text-sm font-semibold text-navy-950 transition hover:bg-brand-cyan/90">
            + New {tab === 'sequences' ? 'Sequence' : 'Template'}
          </button>
        </header>

        <div className="mb-5 flex items-center gap-2 border-b border-navy-700/40">
          {['templates', 'sequences'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t
                  ? 'border-brand-cyan text-brand-cyan'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'templates' ? `Templates (${templates.length})` : `Sequences (${sequences.length})`}
            </button>
          ))}
        </div>

        {tab === 'templates' && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCat('all')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  cat === 'all' ? 'border-transparent bg-brand-cyan text-navy-950' : 'border-navy-700/60 bg-navy-800/40 text-slate-300 hover:text-brand-cyan'
                }`}
              >All</button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCat(c.name)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    cat === c.name ? 'border-transparent bg-brand-cyan text-navy-950' : 'border-navy-700/60 bg-navy-800/40 text-slate-300 hover:text-brand-cyan'
                  }`}
                  style={cat === c.name ? {} : { borderLeftColor: c.color || '#64748b', borderLeftWidth: 3 }}
                >{c.name}</button>
              ))}
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search templates..."
                className="ml-auto w-64 rounded-md border border-navy-700/60 bg-navy-900/60 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-cyan focus:outline-none focus:ring-1 focus:ring-brand-cyan/40"
              />
            </div>

            {loading ? (
              <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">Loading templates…</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(t => (
                  <article
                    key={t.id}
                    onClick={() => setPreview(t)}
                    className="cursor-pointer rounded-xl border border-navy-700/50 bg-navy-800/60 p-4 transition hover:border-brand-cyan/40 hover:bg-navy-800/80"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md text-sm" style={{ background: (CHANNEL_COLOR[t.channel_type] || '#64748b') + '20', color: CHANNEL_COLOR[t.channel_type] || '#64748b' }}>
                          {CHANNEL_ICON[t.channel_type] || '◇'}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-100">{t.name}</h3>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.channel_type} · {t.category || 'general'}</p>
                        </div>
                      </div>
                      {t.is_active ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-300">live</span>
                      ) : (
                        <span className="rounded-full border border-navy-700/60 px-2 py-0.5 text-[10px] uppercase text-slate-500">draft</span>
                      )}
                    </div>
                    {t.subject && <p className="mb-1 truncate text-xs text-slate-200">{t.subject}</p>}
                    <p className="line-clamp-3 text-[11px] text-slate-500">{t.body}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Used {t.usage_count || 0}x</p>
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'sequences' && (
          <div className="space-y-2">
            {sequences.map(s => (
              <article key={s.id} className="rounded-lg border border-navy-700/50 bg-navy-800/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">{s.name}</h3>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ borderColor: s.status === 'active' ? '#10b98160' : '#64748b60', color: s.status === 'active' ? '#10b981' : '#94a3b8' }}>
                        {s.status}
                      </span>
                      {s.goal && (
                        <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] uppercase text-purple-300">
                          goal: {s.goal.replace(/_/g,' ')}
                        </span>
                      )}
                    </div>
                    {s.description && <p className="mt-1 text-xs text-slate-400">{s.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span>{s.total_enrolled || 0} enrolled</span>
                      <span>{s.total_completed || 0} completed</span>
                      <span style={{ color: '#06b6d4' }}>{s.total_replied || 0} replied</span>
                      <span style={{ color: '#10b981' }}>{s.total_booked || 0} booked</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {sequences.length === 0 && (
              <div className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-10 text-center text-slate-500">No sequences yet.</div>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-navy-700/50 bg-navy-900 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{preview.name}</h2>
                <p className="text-xs text-slate-500">{preview.channel_type} · {preview.category}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-500 hover:text-slate-200">✕</button>
            </div>
            {preview.subject && (
              <div className="mb-3 rounded-md border border-navy-700/50 bg-navy-800/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Subject</p>
                <p className="mt-0.5 text-sm text-slate-100">{preview.subject}</p>
              </div>
            )}
            <div className="rounded-md border border-navy-700/50 bg-navy-800/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Body</p>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{preview.body}</pre>
            </div>
            {preview.variables && Object.keys(preview.variables).length > 0 && (
              <div className="mt-3 rounded-md border border-navy-700/50 bg-navy-800/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Variables</p>
                <code className="mt-1 block text-xs text-cyan-300">{Object.keys(preview.variables).map(k => `{{${k}}}`).join('  ')}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
