import { useEffect, useRef, useState } from 'react'
import { HubPage, useLabosClient } from './_shared'

export default function LabosChat() {
  const { client } = useLabosClient()
  const [channels, setChannels] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!client) return
    async function load() {
      const { data } = await client.from('chat_channels').select('*').order('created_at')
      setChannels(data || [])
      if (data?.length && !activeId) setActiveId(data[0].id)
    }
    load()
  }, [client])

  useEffect(() => {
    if (!client || !activeId) return
    async function load() {
      const { data } = await client.from('chat_messages').select('*').eq('channel_id', activeId).order('created_at').limit(100)
      setMessages(data || [])
    }
    load()
    const sub = client
      .channel(`labos-chat-${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeId}` }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => { client.removeChannel(sub) }
  }, [client, activeId])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [messages])

  async function send(e) {
    e.preventDefault()
    if (!draft.trim() || !activeId) return
    const body = draft.trim()
    setDraft('')
    await client.from('chat_messages').insert({ channel_id: activeId, body, sender_name: 'You' })
  }

  const activeChannel = channels.find(c => c.id === activeId)

  return (
    <HubPage title="Chat" subtitle="Team channels + direct line to Liftori support">
      <div className="bg-navy-800 border border-navy-700/50 rounded-xl overflow-hidden h-[calc(100vh-180px)] flex">
        {/* Channel list */}
        <aside className="w-56 border-r border-navy-700/50 flex flex-col">
          <div className="px-4 py-3 border-b border-navy-700/50 text-xs uppercase tracking-wider text-gray-500">Channels</div>
          <div className="flex-1 overflow-y-auto">
            {channels.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${activeId === c.id ? 'bg-brand-blue/15 text-brand-blue' : 'text-gray-400 hover:bg-navy-700/30 hover:text-white'}`}
              >
                {c.channel_type === 'liftori_dm' ? '🛟 ' : '# '}{c.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Thread */}
        <div className="flex-1 flex flex-col">
          <div className="px-5 py-3 border-b border-navy-700/50">
            <div className="text-white font-semibold">{activeChannel?.name || 'Select a channel'}</div>
            {activeChannel?.description && <div className="text-xs text-gray-500">{activeChannel.description}</div>}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-gray-500 text-center pt-8">No messages yet — say hi.</div>
            ) : messages.map(m => (
              <div key={m.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {(m.sender_name || 'U').charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{m.sender_name || 'User'}</span>
                    <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-0.5">{m.body}</div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="px-4 py-3 border-t border-navy-700/50 flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Select a channel'}
              className="flex-1 bg-navy-900 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-blue/50"
              disabled={!activeId}
            />
            <button type="submit" disabled={!activeId || !draft.trim()} className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 disabled:opacity-40 text-white text-sm rounded-lg">
              Send
            </button>
          </form>
        </div>
      </div>
    </HubPage>
  )
}
