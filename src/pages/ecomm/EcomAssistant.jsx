// =====================================================================
// EcomAssistant - the in-CRM reseller/thrifter AI Assistant (Phase 1 MVP).
// Chat UI + mode picker (Quick/Standard/Deep), metered on credits via the
// assistant-chat edge fn (MAIN). Conversations persist in the tenant DB.
// =====================================================================
import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { HubPage } from '../crm/_shared'
import { useCrmClient } from './_ecomShared'
import { supabase as mainDb } from '../../lib/supabase'

const MODES = [
  { key: 'quick',    label: 'Quick',    credits: 1, hint: 'Fast answers & quick tips' },
  { key: 'standard', label: 'Standard', credits: 2, hint: 'Selling, pricing & marketing help' },
  { key: 'deep',     label: 'Deep',     credits: 6, hint: 'Deep strategy & analysis' },
]

export default function EcomAssistant() {
  const { client, platformId } = useCrmClient()
  const [convos, setConvos] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('standard')
  const [sending, setSending] = useState(false)
  const [balance, setBalance] = useState(null)
  const scrollRef = useRef(null)

  const modeDef = MODES.find(m => m.key === mode) || MODES[1]

  async function loadConvos() {
    const { data } = await client.from('assistant_conversations').select('id,title,mode,updated_at').order('updated_at', { ascending: false }).limit(30)
    setConvos(data || [])
  }
  async function loadBalance() {
    try {
      const { data } = await mainDb.functions.invoke('credits', { body: { action: 'get', platform_id: platformId } })
      if (data?.ok) setBalance(data.available)
    } catch (_) {}
  }
  useEffect(() => { if (platformId) { loadConvos(); loadBalance() } }, [platformId])

  async function openConvo(id) {
    setActiveId(id)
    const { data } = await client.from('assistant_messages').select('role,content,created_at').eq('conversation_id', id).order('created_at', { ascending: true })
    setMessages(data || [])
  }
  function newChat() { setActiveId(null); setMessages([]); setInput('') }

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    const userMsg = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    try {
      let convId = activeId
      if (!convId) {
        const { data: conv, error } = await client.from('assistant_conversations')
          .insert({ title: text.slice(0, 60), mode }).select('id').single()
        if (error) throw error
        convId = conv.id
        setActiveId(convId)
      }
      await client.from('assistant_messages').insert({ conversation_id: convId, role: 'user', content: text, mode })

      const { data, error } = await mainDb.functions.invoke('assistant-chat', {
        body: { platform_id: platformId, mode, messages: history.map(m => ({ role: m.role, content: m.content })) },
      })
      if (error) {
        let payload = null
        try { payload = await error.context.json() } catch (_) {}
        if (payload?.error === 'insufficient_credits') {
          toast.error(`Not enough credits (${payload.needed} needed). Add credits in Settings -> Billing.`)
          setMessages(messages)
          return
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
      console.error('assistant send', e)
      toast.error('The assistant could not respond - try again.')
      setMessages(messages)
    } finally {
      setSending(false)
    }
  }

  return (
    <HubPage
      title="AI Assistant"
      subtitle="Your reselling co-pilot - sourcing, pricing, listings, marketing & platform help"
      actions={balance != null && <div className="text-sm text-gray-400">Credits: <span className="text-white font-semibold">{balance}</span></div>}
    >
      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[420px]">
        <div className="w-56 shrink-0 hidden md:flex flex-col bg-navy-900/60 border border-navy-700/50 rounded-xl p-3">
          <button onClick={newChat} className="flex items-center gap-2 px-3 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-sm font-medium mb-3">
            <Plus className="w-4 h-4" /> New chat
          </button>
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

        <div className="flex-1 flex flex-col bg-navy-900/40 border border-navy-700/50 rounded-xl overflow-hidden">
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
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-100 border border-navy-700/50'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-navy-800 border border-navy-700/50 rounded-2xl px-4 py-2.5 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-navy-700/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <select value={mode} onChange={e => setMode(e.target.value)}
                className="bg-navy-800 border border-navy-700/60 text-gray-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-blue">
                {MODES.map(m => <option key={m.key} value={m.key}>{m.label} - {m.credits} cr</option>)}
              </select>
              <span className="text-[11px] text-gray-500">{modeDef.hint} - {modeDef.credits} credit{modeDef.credits > 1 ? 's' : ''} per reply</span>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1}
                placeholder="Ask your assistant anything..."
                className="flex-1 resize-none bg-navy-800 border border-navy-700/60 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-blue max-h-32"
              />
              <button onClick={send} disabled={sending || !input.trim()}
                className="p-2.5 bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-40 text-white rounded-xl">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </HubPage>
  )
}
