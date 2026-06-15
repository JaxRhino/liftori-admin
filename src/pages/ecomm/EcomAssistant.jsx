// =====================================================================
// EcomAssistant - in-CRM reseller AI Assistant (Phase 4, Cowork-style).
// Left rail: New chat / Projects / Scheduled / Customize / Recent.
// Chat metered on credits via assistant-chat (MAIN). Conversations,
// projects, settings & scheduled tasks persist in the tenant DB.
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { CalendarClock, FolderKanban, LifeBuoy, Loader2, Pencil, Plus, Send, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { HubPage } from '../crm/_shared'
import { useCrmClient } from './_ecomShared'
import { supabase as mainDb } from '../../lib/supabase'

const MODES = [
  { key: 'quick',    label: 'Quick',    credits: 1, hint: 'Fast answers & quick tips' },
  { key: 'standard', label: 'Standard', credits: 2, hint: 'Selling, pricing & marketing help' },
  { key: 'deep',     label: 'Deep',     credits: 6, hint: 'Deep strategy & analysis' },
]
const CADENCES = [
  { key: 'daily', label: 'Every day' },
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
]

export default function EcomAssistant() {
  const { client, platformId } = useCrmClient()
  const [view, setView] = useState('chat')
  const [convos, setConvos] = useState([])
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('standard')
  const [sending, setSending] = useState(false)
  const [balance, setBalance] = useState(null)
  const [settings, setSettings] = useState({ custom_instructions: '', default_mode: 'standard' })
  const [scheduled, setScheduled] = useState([])
  const scrollRef = useRef(null)

  const modeDef = MODES.find(m => m.key === mode) || MODES[1]
  const activeProject = projects.find(p => p.id === activeProjectId) || null

  async function loadConvos() {
    const { data } = await client.from('assistant_conversations').select('id,title,mode,project_id,updated_at').order('updated_at', { ascending: false }).limit(40)
    setConvos(data || [])
  }
  async function loadProjects() {
    const { data } = await client.from('assistant_projects').select('*').order('updated_at', { ascending: false })
    setProjects(data || [])
  }
  async function loadSettings() {
    const { data } = await client.from('assistant_settings').select('*').limit(1).maybeSingle()
    if (data) { setSettings(data); setMode(data.default_mode || 'standard') }
  }
  async function loadScheduled() {
    const { data } = await client.from('assistant_scheduled').select('*').order('created_at', { ascending: false })
    setScheduled(data || [])
  }
  async function loadBalance() {
    try { const { data } = await mainDb.functions.invoke('credits', { body: { action: 'get', platform_id: platformId } }); if (data?.ok) setBalance(data.available) } catch (_) {}
  }
  useEffect(() => { if (platformId) { loadConvos(); loadProjects(); loadSettings(); loadBalance() } }, [platformId])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])

  async function openConvo(id) {
    const conv = convos.find(c => c.id === id)
    setActiveId(id); setActiveProjectId(conv?.project_id || null); setView('chat')
    const { data } = await client.from('assistant_messages').select('role,content').eq('conversation_id', id).order('created_at', { ascending: true })
    setMessages(data || [])
  }
  function newChat(projectId = null) { setActiveId(null); setMessages([]); setInput(''); setActiveProjectId(projectId); setView('chat') }

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput(''); setSending(true)
    const history = [...messages, { role: 'user', content: text }]
    setMessages(history)
    try {
      let convId = activeId
      if (!convId) {
        const { data: conv, error } = await client.from('assistant_conversations').insert({ title: text.slice(0, 60), mode, project_id: activeProjectId }).select('id').single()
        if (error) throw error
        convId = conv.id; setActiveId(convId)
      }
      await client.from('assistant_messages').insert({ conversation_id: convId, role: 'user', content: text, mode })
      const { data, error } = await mainDb.functions.invoke('assistant-chat', {
        body: {
          platform_id: platformId, mode,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          custom_instructions: settings.custom_instructions || '',
          project_instructions: activeProject?.instructions || '',
        },
      })
      if (error) {
        let payload = null
        try { payload = await error.context.json() } catch (_) {}
        if (payload?.error === 'insufficient_credits') {
          toast.error(`Not enough credits (${payload.needed} needed). Add credits in Settings -> Billing.`)
          setMessages(messages); return
        }
        throw error
      }
      const reply = data?.reply || 'Sorry, I could not generate a response.'
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      await client.from('assistant_messages').insert({ conversation_id: convId, role: 'assistant', content: reply, mode, credits_charged: data?.charged || 0 })
      await client.from('assistant_conversations').update({ updated_at: new Date().toISOString(), mode }).eq('id', convId)
      if (typeof data?.available === 'number') setBalance(data.available)
      loadConvos()
    } catch (e) {
      console.error('assistant send', e); toast.error('The assistant could not respond - try again.'); setMessages(messages)
    } finally { setSending(false) }
  }

  // ---- projects ----
  async function createProject() {
    const name = window.prompt('Project name')
    if (!name) return
    const { data, error } = await client.from('assistant_projects').insert({ name }).select('*').single()
    if (error) return toast.error('Could not create project')
    setProjects(p => [data, ...p]); toast.success('Project created')
  }
  async function saveProject(id, fields) {
    await client.from('assistant_projects').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
    loadProjects()
  }
  async function deleteProject(id) {
    if (!window.confirm('Delete this project? Chats stay but lose the project.')) return
    await client.from('assistant_projects').delete().eq('id', id)
    if (activeProjectId === id) setActiveProjectId(null)
    loadProjects()
  }

  // ---- settings ----
  async function saveSettings() {
    const payload = { custom_instructions: settings.custom_instructions || '', default_mode: settings.default_mode || 'standard', updated_at: new Date().toISOString() }
    if (settings.id) await client.from('assistant_settings').update(payload).eq('id', settings.id)
    else { const { data } = await client.from('assistant_settings').insert(payload).select('*').single(); if (data) setSettings(data) }
    toast.success('Saved')
  }

  async function contactSupport() {
    const message = window.prompt('Message to Liftori support (a question, bug, or request):')
    if (!message || !message.trim()) return
    try {
      const { error } = await mainDb.functions.invoke('support-request', { body: { platform_id: platformId, message } })
      if (error) throw error
      toast.success('Sent to Liftori support - we will follow up by email.')
    } catch (e) { console.error('support', e); toast.error('Could not send - try again.') }
  }

  // ---- scheduled ----
  const [sForm, setSForm] = useState({ title: '', prompt: '', mode: 'standard', cadence: 'weekly', hour: 9 })
  async function createScheduled() {
    if (!sForm.title.trim() || !sForm.prompt.trim()) return toast.error('Add a title and a prompt')
    const { error } = await client.from('assistant_scheduled').insert({ ...sForm })
    if (error) return toast.error('Could not save')
    setSForm({ title: '', prompt: '', mode: 'standard', cadence: 'weekly', hour: 9 }); loadScheduled(); toast.success('Scheduled')
  }
  async function toggleScheduled(id, is_active) { await client.from('assistant_scheduled').update({ is_active }).eq('id', id); loadScheduled() }
  async function deleteScheduled(id) { await client.from('assistant_scheduled').delete().eq('id', id); loadScheduled() }

  const RailBtn = ({ icon: Icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${active ? 'bg-navy-700/70 text-white' : 'text-gray-300 hover:bg-navy-800/60'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  )

  return (
    <HubPage
      title="AI Assistant"
      subtitle="Your reselling co-pilot - sourcing, pricing, listings, marketing & platform help"
      actions={balance != null && <div className="text-sm text-gray-400">Credits: <span className="text-white font-semibold">{balance}</span></div>}
    >
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[440px]">
        {/* LEFT RAIL */}
        <div className="w-56 shrink-0 hidden md:flex flex-col bg-navy-900/60 border border-navy-700/50 rounded-xl p-3">
          <button onClick={() => newChat(null)} className="flex items-center gap-2 px-3 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium mb-3">
            <Plus className="w-4 h-4" /> New chat
          </button>
          <div className="space-y-0.5 mb-3">
            <RailBtn icon={FolderKanban} label="Projects" active={view === 'projects'} onClick={() => setView('projects')} />
            <RailBtn icon={CalendarClock} label="Scheduled" active={view === 'scheduled'} onClick={() => { setView('scheduled'); loadScheduled() }} />
            <RailBtn icon={SlidersHorizontal} label="Customize" active={view === 'customize'} onClick={() => setView('customize')} />
            <RailBtn icon={LifeBuoy} label="Contact support" active={false} onClick={contactSupport} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 px-1 mb-1">Recent</div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {convos.length === 0 && <div className="text-xs text-gray-600 px-1 py-2">No chats yet</div>}
            {convos.map(c => (
              <button key={c.id} onClick={() => openConvo(c.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-sm truncate ${activeId === c.id ? 'bg-navy-700/70 text-white' : 'text-gray-300 hover:bg-navy-800/60'}`}>
                {c.title || 'New chat'}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN PANE */}
        <div className="flex-1 flex flex-col bg-navy-900/40 border border-navy-700/50 rounded-xl overflow-hidden">
          {view === 'chat' && (
            <>
              {activeProject && <div className="px-4 py-2 border-b border-navy-700/50 text-xs text-brand-light flex items-center gap-2"><FolderKanban className="w-3.5 h-3.5" /> Project: {activeProject.name}</div>}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                    <Sparkles className="w-8 h-8 text-brand-blue mb-3" />
                    <div className="text-white font-medium">How can I help you sell today?</div>
                    <div className="text-sm mt-1 max-w-sm">Ask me to price an item, write a listing, plan a markdown, draft a promo post, or figure out a Liftori feature.</div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-100 border border-navy-700/50'}`}>{m.content}</div>
                  </div>
                ))}
                {sending && <div className="flex justify-start"><div className="bg-navy-800 border border-navy-700/50 rounded-2xl px-4 py-2.5 text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</div></div>}
              </div>
              <div className="border-t border-navy-700/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <select value={mode} onChange={e => setMode(e.target.value)} className="bg-navy-800 border border-navy-700/60 text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-blue">
                    {MODES.map(m => <option key={m.key} value={m.key}>{m.label} - {m.credits} cr</option>)}
                  </select>
                  <span className="text-[11px] text-gray-500">{modeDef.hint} - {modeDef.credits} credit{modeDef.credits > 1 ? 's' : ''} per reply</span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1}
                    placeholder="Ask your assistant anything..." className="flex-1 resize-none bg-navy-800 border border-navy-700/60 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue max-h-32" />
                  <button onClick={send} disabled={sending || !input.trim()} className="p-2.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white rounded-xl"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          )}

          {view === 'projects' && (
            <div className="p-5 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Projects</h3>
                <button onClick={createProject} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm"><Plus className="w-4 h-4" /> New project</button>
              </div>
              <p className="text-xs text-gray-500 mb-4">Group related chats and give the assistant standing context (e.g. "I sell vintage denim; always suggest cross-listing to Poshmark").</p>
              {projects.length === 0 && <div className="text-sm text-gray-500">No projects yet.</div>}
              <div className="grid sm:grid-cols-2 gap-3">
                {projects.map(p => (
                  <div key={p.id} className="rounded-xl border border-navy-700/50 bg-navy-800/50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="text-white font-medium">{p.name}</div>
                      <button onClick={() => deleteProject(p.id)} className="text-gray-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <textarea defaultValue={p.instructions || ''} onBlur={e => saveProject(p.id, { instructions: e.target.value })} placeholder="Project instructions / goals..."
                      className="mt-2 w-full resize-none bg-navy-900/60 border border-navy-700/50 text-gray-200 rounded-lg px-2.5 py-2 text-xs h-20 focus:outline-none focus:ring-1 focus:ring-brand-blue" />
                    <button onClick={() => newChat(p.id)} className="mt-2 text-xs text-brand-light hover:underline">Start a chat in this project -&gt;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'customize' && (
            <div className="p-5 overflow-y-auto max-w-xl">
              <h3 className="text-white font-semibold mb-1">Customize your assistant</h3>
              <p className="text-xs text-gray-500 mb-4">Standing instructions the assistant follows in every chat - your niche, tone, goals, and how you like answers.</p>
              <label className="text-xs text-gray-400">Custom instructions</label>
              <textarea value={settings.custom_instructions || ''} onChange={e => setSettings(s => ({ ...s, custom_instructions: e.target.value }))} rows={6}
                placeholder="e.g. I resell vintage and Y2K clothing. Keep advice budget-friendly. Always give me a price range and 3 title options."
                className="mt-1 w-full resize-none bg-navy-800 border border-navy-700/60 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue" />
              <label className="text-xs text-gray-400 block mt-3">Default mode</label>
              <select value={settings.default_mode || 'standard'} onChange={e => setSettings(s => ({ ...s, default_mode: e.target.value }))} className="mt-1 bg-navy-800 border border-navy-700/60 text-gray-200 text-sm rounded-lg px-2 py-1.5">
                {MODES.map(m => <option key={m.key} value={m.key}>{m.label} - {m.credits} cr</option>)}
              </select>
              <div><button onClick={saveSettings} className="mt-4 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium">Save</button></div>
            </div>
          )}

          {view === 'scheduled' && (
            <div className="p-5 overflow-y-auto">
              <h3 className="text-white font-semibold mb-1">Scheduled tasks</h3>
              <p className="text-xs text-gray-500 mb-4">Have the assistant run a prompt on a schedule - e.g. weekly "what should I mark down?" or month-end "summarize my sales." Results are delivered automatically (auto-run rolling out soon).</p>
              <div className="rounded-xl border border-navy-700/50 bg-navy-800/50 p-4 mb-4 grid sm:grid-cols-2 gap-2">
                <input value={sForm.title} onChange={e => setSForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g. Weekly markdown review)" className="bg-navy-900/60 border border-navy-700/50 text-white rounded-lg px-2.5 py-2 text-sm sm:col-span-2" />
                <textarea value={sForm.prompt} onChange={e => setSForm(f => ({ ...f, prompt: e.target.value }))} placeholder="What should the assistant do?" className="bg-navy-900/60 border border-navy-700/50 text-white rounded-lg px-2.5 py-2 text-sm sm:col-span-2 h-16 resize-none" />
                <select value={sForm.cadence} onChange={e => setSForm(f => ({ ...f, cadence: e.target.value }))} className="bg-navy-900/60 border border-navy-700/50 text-gray-200 text-sm rounded-lg px-2 py-2">{CADENCES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                <select value={sForm.mode} onChange={e => setSForm(f => ({ ...f, mode: e.target.value }))} className="bg-navy-900/60 border border-navy-700/50 text-gray-200 text-sm rounded-lg px-2 py-2">{MODES.map(m => <option key={m.key} value={m.key}>{m.label} - {m.credits} cr</option>)}</select>
                <div className="sm:col-span-2"><button onClick={createScheduled} className="px-3 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm">Add scheduled task</button></div>
              </div>
              {scheduled.length === 0 && <div className="text-sm text-gray-500">No scheduled tasks yet.</div>}
              <div className="space-y-2">
                {scheduled.map(s => (
                  <div key={s.id} className="rounded-xl border border-navy-700/50 bg-navy-800/40 p-3 flex items-start justify-between">
                    <div>
                      <div className="text-white text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-gray-500">{CADENCES.find(c => c.key === s.cadence)?.label || s.cadence} - {MODES.find(m => m.key === s.mode)?.label} - {s.is_active ? 'Active' : 'Paused'}</div>
                      <div className="text-xs text-gray-400 mt-1 line-clamp-2">{s.prompt}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleScheduled(s.id, !s.is_active)} className="text-xs text-gray-400 hover:text-white">{s.is_active ? 'Pause' : 'Resume'}</button>
                      <button onClick={() => deleteScheduled(s.id)} className="text-gray-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </HubPage>
  )
}
