import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { IDEA_FRAMEWORKS, CONTENT_PILLARS, fillPrompt } from '../../lib/creatorIdeaFrameworks'
import { PLATFORMS } from '../../lib/creatorTemplates'

const STATUS_COLORS = {
  new:         'bg-sky-500/15 text-sky-300',
  researching: 'bg-amber-500/15 text-amber-300',
  writing:     'bg-pink-500/15 text-pink-300',
  drafted:     'bg-emerald-500/15 text-emerald-300',
  shelved:     'bg-slate-500/15 text-slate-500',
}
const PRIORITY_COLORS = {
  low:    'text-slate-400',
  medium: 'text-amber-400',
  high:   'text-rose-400',
}

export default function AffiliateIdeas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)

  // Generator state
  const [niche, setNiche] = useState('')
  const [audience, setAudience] = useState('')
  const [topic, setTopic] = useState('')
  const [activeFramework, setActiveFramework] = useState(null)
  const [filterPillar, setFilterPillar] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('creator_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setIdeas(data || [])
    } catch (e) { console.error(e); toast.error('Failed to load ideas') }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // Live prompt preview — substitutes niche/audience/topic into each framework prompt
  const substitutions = useMemo(() => ({
    niche: niche.trim(),
    audience: audience.trim() || (niche ? `${niche} people` : ''),
    topic: topic.trim() || niche.trim(),
  }), [niche, audience, topic])

  async function saveIdea(title, framework) {
    if (!title.trim()) return
    try {
      const { error } = await supabase.from('creator_ideas').insert({
        user_id: user.id,
        title: title.trim(),
        pillar: framework?.pillar || null,
        source_framework: framework?.key || null,
        status: 'new',
        priority: 'medium',
      })
      if (error) throw error
      toast.success('Saved to your idea bank')
      load()
    } catch (e) { console.error(e); toast.error('Save failed') }
  }

  async function updateIdea(id, patch) {
    try {
      const { error } = await supabase.from('creator_ideas').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      load()
    } catch (e) { console.error(e); toast.error('Update failed') }
  }

  async function deleteIdea(id) {
    if (!window.confirm('Delete this idea?')) return
    try {
      const { error } = await supabase.from('creator_ideas').delete().eq('id', id)
      if (error) throw error
      toast.success('Deleted')
      load()
    } catch (e) { toast.error('Delete failed') }
  }

  async function sendToWriter(idea) {
    // Create a draft from the idea and navigate to Content Creator
    try {
      const { data, error } = await supabase.from('creator_drafts').insert({
        user_id: user.id,
        title: idea.title,
        body: `${idea.title}\n\n`,
        platform: idea.platform || 'instagram',
        content_type: 'caption',
        status: 'draft',
      }).select().single()
      if (error) throw error
      await updateIdea(idea.id, { status: 'writing', draft_id: data.id })
      toast.success('Draft created — opening Content Creator')
      navigate('/affiliate/content')
    } catch (e) { console.error(e); toast.error('Failed to create draft') }
  }

  const visibleIdeas = ideas.filter((i) => {
    if (filterPillar !== 'all' && i.pillar !== filterPillar) return false
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    return true
  })

  const pillarCounts = useMemo(() => {
    const m = {}
    ideas.forEach((i) => { if (i.pillar) m[i.pillar] = (m[i.pillar] || 0) + 1 })
    return m
  }, [ideas])

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><span>💡</span><span>Ideas Generator</span></h1>
        <p className="text-sm text-gray-400">Plug in your niche. Get endless content ideas from 12 proven frameworks. Save the good ones, toss the rest.</p>
      </div>

      {/* Niche input */}
      <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase text-gray-500">Your niche</span>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. fitness coaching, thrifting, SaaS founders" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase text-gray-500">Your audience</span>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. first-time founders, busy moms" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase text-gray-500">Core topic (optional)</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. email lists, meal prep" className="w-full bg-navy-900 border border-navy-700/50 rounded-md px-3 py-2 text-sm text-white" />
        </label>
      </div>

      {/* Content pillars row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {CONTENT_PILLARS.map((p) => (
          <button
            key={p.key}
            onClick={() => setFilterPillar(filterPillar === p.key ? 'all' : p.key)}
            className={`text-left rounded-lg p-3 border transition ${filterPillar === p.key ? 'bg-pink-500/15 border-pink-500/50' : 'bg-navy-800/40 border-navy-700/50 hover:border-pink-500/30'}`}
          >
            <div className="text-lg">{p.icon}</div>
            <div className="text-xs font-semibold text-white">{p.label} {pillarCounts[p.key] ? <span className="text-gray-500">({pillarCounts[p.key]})</span> : null}</div>
            <div className="text-[10px] text-gray-400 line-clamp-2">{p.desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — Framework generator */}
        <div className="space-y-3">
          <div className="text-xs uppercase font-bold text-gray-500">Idea frameworks</div>
          <div className="space-y-2">
            {IDEA_FRAMEWORKS.map((fw) => {
              const isOpen = activeFramework === fw.key
              return (
                <div key={fw.key} className="bg-navy-800/40 border border-navy-700/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setActiveFramework(isOpen ? null : fw.key)}
                    className="w-full text-left p-3 hover:bg-navy-800/60 transition flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{fw.name}</span>
                        <span className="text-[10px] uppercase text-gray-500">· {fw.pillar}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{fw.hint}</div>
                    </div>
                    <span className="text-gray-500 flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-navy-700/50 bg-navy-900/30 p-3 space-y-1.5">
                      {fw.prompts.map((p, i) => {
                        const filled = fillPrompt(p, substitutions)
                        const hasUnfilled = filled.includes('{{')
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <div className={`flex-1 text-sm ${hasUnfilled ? 'text-gray-500' : 'text-white'}`}>{filled}</div>
                            <button
                              onClick={() => saveIdea(filled, fw)}
                              disabled={hasUnfilled}
                              className="text-[10px] px-2 py-1 bg-pink-500 hover:bg-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded flex-shrink-0"
                              title={hasUnfilled ? 'Fill niche/audience/topic above to save' : 'Save to idea bank'}
                            >
                              + Save
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Saved ideas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-bold text-gray-500">Your idea bank ({visibleIdeas.length})</div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-navy-900 border border-navy-700/50 rounded px-2 py-1 text-[11px] text-white">
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="researching">Researching</option>
              <option value="writing">Writing</option>
              <option value="drafted">Drafted</option>
              <option value="shelved">Shelved</option>
            </select>
          </div>

          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading…</div>
          ) : visibleIdeas.length === 0 ? (
            <div className="text-center text-gray-500 py-12 italic">
              {ideas.length === 0
                ? 'No ideas yet. Fill in your niche above, expand a framework, save the prompts you like.'
                : 'No ideas match those filters.'}
            </div>
          ) : (
            <div className="space-y-2">
              {visibleIdeas.map((i) => (
                <div key={i.id} className="bg-navy-800/50 border border-navy-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[i.status]}`}>{i.status}</span>
                    <span className={`text-[10px] uppercase font-bold ${PRIORITY_COLORS[i.priority]}`}>{i.priority}</span>
                    {i.pillar && <span className="text-[10px] text-gray-500">· {i.pillar}</span>}
                  </div>
                  <div className="text-sm text-white">{i.title}</div>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <select
                      value={i.status}
                      onChange={(e) => updateIdea(i.id, { status: e.target.value })}
                      className="bg-navy-900 border border-navy-700/50 rounded px-1.5 py-0.5 text-[10px] text-white"
                    >
                      <option value="new">new</option>
                      <option value="researching">researching</option>
                      <option value="writing">writing</option>
                      <option value="drafted">drafted</option>
                      <option value="shelved">shelved</option>
                    </select>
                    <select
                      value={i.priority}
                      onChange={(e) => updateIdea(i.id, { priority: e.target.value })}
                      className="bg-navy-900 border border-navy-700/50 rounded px-1.5 py-0.5 text-[10px] text-white"
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                    {!i.draft_id && (
                      <button onClick={() => sendToWriter(i)} className="text-[10px] px-2 py-0.5 bg-pink-500 hover:bg-pink-600 text-white rounded">
                        ✍️ Start writing
                      </button>
                    )}
                    <button onClick={() => deleteIdea(i.id)} className="text-[10px] text-gray-500 hover:text-rose-400 ml-auto">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
