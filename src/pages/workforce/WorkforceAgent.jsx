import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import WorkforceTalkPanel from './WorkforceTalkPanel'

const TABS = ['Overview', 'Talk', 'Configuration', 'Memories', 'Capabilities', 'Authority', 'Activity']

export default function WorkforceAgent() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [agent, setAgent] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (e) throw e
    setAgent(data)
  }, [slug])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        await reload()
      } catch (e) {
        if (alive) setError(e.message || String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [slug, reload])

  async function togglePause() {
    if (!agent) return
    setSaving(true)
    try {
      const { error: e } = await supabase
        .from('ai_agents')
        .update({ is_active: !agent.is_active, updated_at: new Date().toISOString() })
        .eq('id', agent.id)
      if (e) throw e
      await reload()
    } catch (e) {
      alert(`Failed: ${e.message || String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" /></div>
  }
  if (error || !agent) {
    return (
      <div className="bg-red-900/30 border border-red-800/50 text-red-200 rounded-lg px-4 py-3 text-sm">
        {error || 'Agent not found.'}
        <div className="mt-3"><Link to="/admin/workforce" className="text-brand-blue underline">Back to Workforce</Link></div>
      </div>
    )
  }

  const photoUrl = `/team/${(agent.slug || '').toLowerCase()}.jpg`

  return (
    <div>
      <div className="mb-4">
        <Link to="/admin/workforce" className="text-sm text-slate-400 hover:text-slate-200">&larr; Back to team</Link>
      </div>

      {/* Header */}
      <div className="bg-navy-900 border border-slate-800 rounded-xl p-5 mb-4 flex items-start gap-5">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-brand-blue font-bold text-3xl overflow-hidden ring-1 ring-slate-700 relative flex-shrink-0">
          <img src={photoUrl} alt={agent.name} className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.style.display='none'}} />
          <span className="absolute">{(agent.name||'?')[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${agent.is_active ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${agent.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {agent.is_active ? 'active' : 'paused'}
            </span>
            {agent.tier && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800/40 capitalize">{agent.tier}</span>}
          </div>
          <p className="text-sm text-brand-blue uppercase tracking-wider mt-1">{agent.role}</p>
          {agent.tagline && <p className="text-sm text-slate-300 italic mt-2">{agent.tagline}</p>}
        </div>
        <button
          onClick={togglePause}
          disabled={saving}
          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
            agent.is_active
              ? 'bg-amber-900/30 border-amber-700/50 text-amber-200 hover:bg-amber-900/50'
              : 'bg-emerald-900/30 border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/50'
          } disabled:opacity-50`}
        >
          {saving ? '...' : (agent.is_active ? 'Pause' : 'Activate')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t
                ? 'text-white border-brand-blue'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview'      && <OverviewTab agent={agent} />}
      {tab === 'Talk'          && <WorkforceTalkPanel agent={agent} />}
      {tab === 'Configuration' && <ConfigurationTab agent={agent} user={user} onSaved={reload} />}
      {tab === 'Memories'      && <MemoriesTab agent={agent} user={user} />}
      {tab === 'Capabilities'  && <CapabilitiesTab agent={agent} onSaved={reload} />}
      {tab === 'Authority'     && <AuthorityTab agent={agent} />}
      {tab === 'Activity'      && <ActivityTab agent={agent} />}
    </div>
  )
}

function Card({ children, className = '' }) {
  return <div className={`bg-navy-900 border border-slate-800 rounded-xl p-5 ${className}`}>{children}</div>
}
function SectionLabel({ children }) {
  return <h3 className="text-xs uppercase tracking-wider text-brand-blue mb-3">{children}</h3>
}

function OverviewTab({ agent }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <SectionLabel>About</SectionLabel>
        <p className="text-slate-300 leading-relaxed">{agent.description || 'No description yet. Add one in Configuration.'}</p>
      </Card>
      <Card>
        <SectionLabel>Profile</SectionLabel>
        <dl className="space-y-2 text-sm">
          {agent.pairs_with && <Row label="Pairs with" value={agent.pairs_with} />}
          {agent.tier && <Row label="Tier" value={<span className="capitalize">{agent.tier}</span>} />}
          {agent.llm_model && <Row label="Model" value={<code className="text-xs">{agent.llm_model}</code>} />}
          {agent.voice_name && <Row label="Voice" value={agent.voice_name} />}
          {agent.phone_number && <Row label="Phone" value={agent.phone_number} />}
          <Row label="Status" value={agent.is_active ? 'active' : 'paused'} />
        </dl>
      </Card>
    </div>
  )
}
function Row({ label, value }) {
  return <div className="flex justify-between gap-2"><dt className="text-slate-500">{label}</dt><dd className="text-slate-200 text-right">{value}</dd></div>
}

function ConfigurationTab({ agent, user, onSaved }) {
  const [prompt, setPrompt] = useState(agent.system_prompt || '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [versions, setVersions] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    setPrompt(agent.system_prompt || '')
  }, [agent.id, agent.system_prompt])

  async function loadVersions() {
    const { data } = await supabase
      .from('ai_agent_prompt_versions')
      .select('id, version_number, system_prompt, change_reason, created_at')
      .eq('agent_id', agent.id)
      .order('version_number', { ascending: false })
    setVersions(data || [])
  }

  async function save() {
    if (prompt.trim() === (agent.system_prompt || '').trim()) {
      alert('No changes to save.')
      return
    }
    if (!reason.trim()) {
      if (!confirm('Save without a change reason? Recommended to add one.')) return
    }
    setSaving(true)
    try {
      // Get current max version
      const { data: maxRow } = await supabase
        .from('ai_agent_prompt_versions')
        .select('version_number')
        .eq('agent_id', agent.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      const next = (maxRow?.version_number || 0) + 1
      // Insert version
      const { error: vErr } = await supabase
        .from('ai_agent_prompt_versions')
        .insert({
          agent_id: agent.id,
          system_prompt: prompt,
          version_number: next,
          change_reason: reason || null,
          created_by: user?.id || null,
        })
      if (vErr) throw vErr
      // Update live agent prompt
      const { error: uErr } = await supabase
        .from('ai_agents')
        .update({ system_prompt: prompt, updated_at: new Date().toISOString() })
        .eq('id', agent.id)
      if (uErr) throw uErr
      setReason('')
      await onSaved()
      await loadVersions()
      alert(`Saved as v${next}.`)
    } catch (e) {
      alert(`Save failed: ${e.message || String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  function rollbackTo(v) {
    if (!confirm(`Rollback to v${v.version_number}? This creates a new version with the old prompt.`)) return
    setPrompt(v.system_prompt)
    setReason(`rollback to v${v.version_number}`)
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-baseline justify-between mb-3">
          <SectionLabel>System prompt</SectionLabel>
          <button
            onClick={() => { if (!showHistory) loadVersions(); setShowHistory(!showHistory) }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            {showHistory ? 'hide' : 'show'} version history
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
          className="w-full border focus:border-brand-blue rounded-md px-3 py-2 text-sm font-mono leading-relaxed"
          placeholder="Define the agent's behavior, voice, and decision authority..."
        />
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change? (logged to version history)"
            style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
            className="flex-1 border focus:border-brand-blue rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={save}
            disabled={saving || prompt.trim() === (agent.system_prompt || '').trim()}
            className="px-4 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save new version'}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Saving creates a new version. Live agent behavior updates immediately.
        </div>
      </Card>

      {showHistory && (
        <Card>
          <SectionLabel>Version history</SectionLabel>
          {versions.length === 0
            ? <p className="text-sm text-slate-500">No saved versions yet.</p>
            : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.id} className="bg-navy-950 border border-slate-800 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-white">v{v.version_number}</span>
                        <span className="text-xs text-slate-500 ml-2">{new Date(v.created_at).toLocaleString()}</span>
                      </div>
                      <button onClick={() => rollbackTo(v)} className="text-xs text-brand-blue hover:underline">load into editor</button>
                    </div>
                    {v.change_reason && <div className="text-xs text-slate-400 mt-1 italic">{v.change_reason}</div>}
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">view prompt</summary>
                      <pre className="mt-2 text-xs text-slate-300 whitespace-pre-wrap font-mono bg-navy-900 p-2 rounded">{v.system_prompt}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )
          }
        </Card>
      )}

      <Card>
        <SectionLabel>Identity</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <ReadField label="Name" value={agent.name} />
          <ReadField label="Slug" value={agent.slug} />
          <ReadField label="Role" value={agent.role} />
          <ReadField label="Pairs with" value={agent.pairs_with || 'autonomous'} />
          <ReadField label="Tier" value={agent.tier || '-'} />
          <ReadField label="Sort order" value={agent.sort_order ?? '-'} />
        </div>
        <div className="text-xs text-slate-500 mt-3">Inline editing for these fields lands in Wave A.2.</div>
      </Card>
    </div>
  )
}
function ReadField({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  )
}

function MemoriesTab({ agent, user }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ kind: 'fact', title: '', content: '', importance: 5 })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('ai_agent_memories')
      .select('*')
      .eq('agent_id', agent.id)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
    setMemories(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [agent.id]) // eslint-disable-line

  async function add() {
    if (!form.title.trim() || !form.content.trim()) { alert('Title and content required.'); return }
    setAdding(true)
    try {
      const { error } = await supabase.from('ai_agent_memories').insert({
        agent_id: agent.id,
        kind: form.kind,
        title: form.title,
        content: form.content,
        importance: Number(form.importance) || 5,
        created_by: user?.id || null,
      })
      if (error) throw error
      setForm({ kind: 'fact', title: '', content: '', importance: 5 })
      await load()
    } catch (e) {
      alert(`Failed: ${e.message || String(e)}`)
    } finally { setAdding(false) }
  }
  async function remove(id) {
    if (!confirm('Delete this memory?')) return
    await supabase.from('ai_agent_memories').delete().eq('id', id)
    await load()
  }

  const KIND_COLORS = {
    fact: 'bg-slate-800 text-slate-300 border-slate-700',
    principle: 'bg-purple-900/30 text-purple-300 border-purple-800/40',
    identity: 'bg-brand-blue/20 text-brand-blue border-brand-blue/40',
    relationship: 'bg-rose-900/30 text-rose-300 border-rose-800/40',
    skill: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40',
    learning: 'bg-amber-900/30 text-amber-300 border-amber-800/40',
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Add a memory</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
            style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
            className="md:col-span-2 border rounded-md px-2 py-2 text-sm">
            <option value="fact">fact</option>
            <option value="principle">principle</option>
            <option value="identity">identity</option>
            <option value="relationship">relationship</option>
            <option value="skill">skill</option>
            <option value="learning">learning</option>
          </select>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="title (short)"
            style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
            className="md:col-span-7 border rounded-md px-3 py-2 text-sm" />
          <input type="number" min="1" max="10" value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value })}
            style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
            className="md:col-span-1 border rounded-md px-2 py-2 text-sm text-center" />
          <button onClick={add} disabled={adding}
            className="md:col-span-2 px-3 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50">
            {adding ? '...' : 'Add'}
          </button>
        </div>
        <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="content (the fact, principle, or learning the agent should remember)"
          rows={3}
          style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
          className="w-full mt-2 border rounded-md px-3 py-2 text-sm leading-relaxed" />
      </Card>

      <Card>
        <SectionLabel>Memories ({memories.length})</SectionLabel>
        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : memories.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No memories yet. Add one above.</div>
        ) : (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.id} className="bg-navy-950 border border-slate-800 rounded-md p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded border ${KIND_COLORS[m.kind] || KIND_COLORS.fact}`}>{m.kind}</span>
                      <span className="text-sm font-semibold text-white">{m.title}</span>
                      <span className="text-xs text-slate-600">importance {m.importance}/10</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{m.content}</p>
                    <div className="text-xs text-slate-600 mt-1.5">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => remove(m.id)} className="text-xs text-rose-400 hover:text-rose-300">delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function CapabilitiesTab({ agent }) {
  const caps = agent.capabilities || {}
  const entries = Object.entries(caps)
  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Capabilities</SectionLabel>
        {entries.length === 0 ? (
          <div>
            <p className="text-sm text-slate-400">No capabilities configured yet.</p>
            <p className="text-xs text-slate-600 mt-2">
              Capabilities are stored in the <code className="text-slate-400">capabilities</code> JSONB field.
              Tool runtime + scoped permission editor lands in Wave B.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between bg-navy-950 border border-slate-800 rounded-md p-3">
                <div>
                  <div className="text-sm font-semibold text-white">{k}</div>
                  <div className="text-xs text-slate-500">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                </div>
                <span className="text-xs text-slate-600">read-only</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <SectionLabel>Personality (raw JSON)</SectionLabel>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-navy-950 p-3 rounded border border-slate-800">{JSON.stringify(agent.personality || {}, null, 2)}</pre>
      </Card>
      <Card>
        <SectionLabel>Booking config (raw JSON)</SectionLabel>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-navy-950 p-3 rounded border border-slate-800">{JSON.stringify(agent.booking_config || {}, null, 2)}</pre>
      </Card>
    </div>
  )
}

function AuthorityTab({ agent }) {
  const [zones, setZones] = useState({ green: [], yellow: [], red: [], universal_red: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [perAgent, universal] = await Promise.all([
        supabase.from('ai_agent_decision_zones').select('zone, description').eq('agent_id', agent.id).order('sort_order', { ascending: true }),
        supabase.from('ai_agent_decision_zones').select('zone, description').is('agent_id', null).eq('zone', 'universal_red').order('sort_order', { ascending: true })
      ])
      if (!alive) return
      const grouped = { green: [], yellow: [], red: [], universal_red: [] }
      ;(perAgent.data || []).forEach(r => grouped[r.zone]?.push(r.description))
      grouped.universal_red = (universal.data || []).map(r => r.description)
      setZones(grouped)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [agent.id])

  if (loading) return <Card><div className="text-sm text-slate-500">Loading...</div></Card>

  const Section = ({ title, color, items, hint }) => (
    <Card>
      <div className={`flex items-center gap-2 mb-3`}>
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-slate-600">{items.length}</span>
      </div>
      {hint && <p className="text-xs text-slate-500 mb-3">{hint}</p>}
      {items.length === 0 ? (
        <div className="text-xs text-slate-600 italic">None defined.</div>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-300">
          {items.map((d, i) => <li key={i} className="leading-relaxed">- {d}</li>)}
        </ul>
      )}
    </Card>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Green - autonomous, report after" color="bg-emerald-400" items={zones.green} hint="Agent acts on its own, logs the action." />
      <Section title="Yellow - notify within 24h" color="bg-amber-400" items={zones.yellow} hint="Agent acts but Sage gets a notification for the founder digest." />
      <Section title="Red - approval required" color="bg-rose-400" items={zones.red} hint="Agent must get explicit founder approval before acting." />
      <Section title="Universal Red (all agents)" color="bg-rose-600" items={zones.universal_red} hint="These apply to every agent regardless of their per-agent zones." />
    </div>
  )
}

function ActivityTab({ agent }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('dev_team_agent_chat')
        .select('id, body, sender_display, sender_role, created_at, context')
        .ilike('sender_display', agent.name)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!alive) return
      setItems(data || [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [agent.id, agent.name])

  return (
    <Card>
      <SectionLabel>Recent activity ({items.length})</SectionLabel>
      {loading ? <div className="text-sm text-slate-500">Loading...</div> :
       items.length === 0 ? <div className="text-sm text-slate-500 italic">No activity logged yet.</div> :
       <ul className="space-y-3">
         {items.map((m) => (
           <li key={m.id} className="bg-navy-950 border border-slate-800 rounded-md p-3">
             <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{m.body}</div>
             <div className="text-xs text-slate-600 mt-1">{new Date(m.created_at).toLocaleString()}</div>
           </li>
         ))}
       </ul>
      }
    </Card>
  )
}

function TalkTab({ agent }) {
  const [task, setTask] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  async function loadRecent() {
    setLoadingRecent(true)
    const { data } = await supabase
      .from('ai_agent_invocations')
      .select('id, task, response, status, error, tokens_in, tokens_out, cost_usd, latency_ms, created_at')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setRecent(data || [])
    setLoadingRecent(false)
  }
  useEffect(() => { loadRecent() }, [agent.id]) // eslint-disable-line

  async function run() {
    if (!task.trim()) { alert('Task required.'); return }
    setRunning(true); setError(null); setResult(null)
    try {
      const { data, error: invErr } = await supabase.functions.invoke('invoke-agent', {
        body: { agent_id: agent.id, task: task },
      })
      if (invErr) throw invErr
      if (data?.error) throw new Error(data.error + (data.detail ? ': ' + JSON.stringify(data.detail) : ''))
      setResult(data)
      await loadRecent()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel>Talk to {agent.name}</SectionLabel>
        <p className="text-xs text-slate-500 mb-3">
          Sends task to the invoke-agent edge function. Loads {agent.name}'s system prompt + top 15 memories. Single-turn for now (multi-turn threading lands in Wave B.1).
        </p>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={5}
          style={{ backgroundColor: '#0a0e1a', color: '#e8eaf0', borderColor: '#334155' }}
          className="w-full border focus:border-brand-blue rounded-md px-3 py-2 text-sm leading-relaxed"
          placeholder={`Ask ${agent.name} something. Or give a task to do.`}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={run}
            disabled={running || !task.trim() || !agent.is_active}
            className="px-4 py-2 bg-brand-blue/20 border border-brand-blue text-white text-sm rounded-md hover:bg-brand-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? `${agent.name} is thinking...` : `Run ${agent.name}`}
          </button>
          {!agent.is_active && (
            <span className="text-xs text-amber-400">{agent.name} is paused. Activate to run.</span>
          )}
          <button
            onClick={() => { setTask(''); setResult(null); setError(null) }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300"
          >clear</button>
        </div>
      </Card>

      {error && (
        <Card className="border-red-800/50">
          <div className="text-sm text-red-300">
            <div className="font-semibold mb-1">Error</div>
            <div className="font-mono text-xs whitespace-pre-wrap">{error}</div>
          </div>
        </Card>
      )}

      {result && (
        <Card>
          <SectionLabel>{agent.name}'s response</SectionLabel>
          <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed bg-navy-950 border border-slate-800 rounded-md p-4">{result.response}</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Stat label="Tokens in"  value={result.tokens_in} />
            <Stat label="Tokens out" value={result.tokens_out} />
            <Stat label="Cost"       value={`$${(result.cost_usd || 0).toFixed(6)}`} />
            <Stat label="Latency"    value={`${result.latency_ms} ms`} />
          </div>
        </Card>
      )}

      <Card>
        <SectionLabel>Recent invocations ({recent.length})</SectionLabel>
        {loadingRecent ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No invocations yet. Run {agent.name} above.</div>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="bg-navy-950 border border-slate-800 rounded-md p-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    r.status === 'success' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/40'
                    : r.status === 'error' ? 'bg-rose-900/30 text-rose-300 border-rose-800/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>{r.status}</span>
                  <span className="text-xs text-slate-600">{new Date(r.created_at).toLocaleString()}</span>
                  {r.cost_usd > 0 && <span className="text-xs text-slate-600 ml-auto">${(r.cost_usd || 0).toFixed(6)} - {r.tokens_in}/{r.tokens_out} tok - {r.latency_ms}ms</span>}
                </div>
                <div className="text-slate-400 text-xs italic mb-1">Task: {r.task.slice(0, 200)}{r.task.length > 200 ? '...' : ''}</div>
                {r.response && (
                  <details>
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">view response</summary>
                    <div className="mt-2 text-slate-300 whitespace-pre-wrap leading-relaxed">{r.response}</div>
                  </details>
                )}
                {r.error && (
                  <div className="mt-1 text-xs text-rose-400 font-mono whitespace-pre-wrap">{r.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-navy-950 border border-slate-800 rounded-md p-2 text-center">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs text-slate-200 font-mono mt-0.5">{value}</div>
    </div>
  )
}
