import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Minus, Video, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { usePopoutChat } from '../../contexts/PopoutChatContext'
import { useVideoCallContext } from '../../contexts/VideoCallContext'
import * as chatSvc from '../../lib/chatService'
import TypingIndicator from './TypingIndicator'

/**
 * Messenger-style DM pop-out window.
 *
 * - Fixed position on the right edge of the viewport.
 * - Header (always visible) collapses the body when minimized.
 * - Subscribes to new messages + typing presence for this channel.
 * - Sends messages on Enter; Shift+Enter inserts a newline.
 * - Video call button hands off to VideoCallContext.startCall().
 */
export default function DMPopout({ entry, offsetIndex }) {
  const { channel, channelId, minimized } = entry
  const { user, profile } = useAuth()
  const { closePopout, toggleMinimize } = usePopoutChat()
  const videoCall = useVideoCallContext()

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])

  const scrollRef = useRef(null)
  const typingChannelRef = useRef(null)
  const typingDebounceRef = useRef(null)
  const myselfTypingRef = useRef(false)

  const otherUserName =
    channel?.other_user_name ||
    channel?.other_user?.full_name ||
    channel?.name ||
    'Direct message'

  const otherUserId = channel?.other_user_id || channel?.other_user?.id

  // Load initial messages
  useEffect(() => {
    let cancelled = false
    if (!channelId) return
    chatSvc.fetchMessages(channelId)
      .then(rows => {
        if (cancelled) return
        setMessages(Array.isArray(rows) ? rows : (rows?.messages || []))
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => { cancelled = true }
  }, [channelId])

  // Subscribe to new/edited/deleted messages
  useEffect(() => {
    if (!channelId) return
    const sub = chatSvc.subscribeToChannel(
      channelId,
      (newMsg) => {
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      },
      (updatedMsg) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
      },
      (deletedId) => {
        setMessages(prev => prev.filter(m => m.id !== deletedId))
      }
    )
    return () => chatSvc.unsubscribe(sub)
  }, [channelId])

  // Subscribe to typing presence
  useEffect(() => {
    if (!channelId || !user?.id) return
    const ch = supabase.channel(`typing:${channelId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === user.id) return
        setTypingUsers(prev => {
          if (payload.is_typing) {
            if (prev.some(u => u.id === payload.user_id)) return prev
            return [...prev, { id: payload.user_id, name: payload.user_name }]
          }
          return prev.filter(u => u.id !== payload.user_id)
        })
        if (payload.is_typing) {
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.id !== payload.user_id))
          }, 4000)
        }
      })
      .subscribe()
    typingChannelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      typingChannelRef.current = null
    }
  }, [channelId, user?.id])

  // Auto-scroll to bottom on new messages (only when expanded)
  useEffect(() => {
    if (minimized) return
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, typingUsers.length, minimized])

  const broadcastTyping = useCallback((isTypingNow) => {
    if (!typingChannelRef.current) return
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        user_name: profile?.full_name || user?.email || 'User',
        is_typing: isTypingNow,
      },
    })
  }, [user, profile])

  const handleDraftChange = (e) => {
    setDraft(e.target.value)
    if (!myselfTypingRef.current) {
      myselfTypingRef.current = true
      broadcastTyping(true)
    }
    clearTimeout(typingDebounceRef.current)
    typingDebounceRef.current = setTimeout(() => {
      myselfTypingRef.current = false
      broadcastTyping(false)
    }, 2000)
  }

  const handleSend = async (e) => {
    e?.preventDefault?.()
    const text = draft.trim()
    if (!text || sending || !channelId) return
    setSending(true)
    setDraft('')
    try {
      const saved = await chatSvc.sendMessage(channelId, { content: text }, user)
      if (saved) {
        setMessages(prev => prev.some(m => m.id === saved.id) ? prev : [...prev, saved])
      }
      // Clear my own typing state
      if (myselfTypingRef.current) {
        myselfTypingRef.current = false
        broadcastTyping(false)
      }
    } catch (err) {
      console.error('DMPopout send failed:', err)
      // Restore the draft so user doesn't lose their text
      setDraft(text)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const handleVideoCall = () => {
    if (!otherUserId) return
    try {
      videoCall.startCall([otherUserId], channelId, 'video')
    } catch (err) {
      console.error('Failed to start video call:', err)
    }
  }

  // Stagger pop-outs across the right edge: 320px wide each + 12px gap.
  const right = 16 + offsetIndex * 332
  const width = 328
  const expandedHeight = 440
  const collapsedHeight = 44

  return (
    <div
      className="fixed bottom-0 z-50 bg-slate-900 rounded-t-lg shadow-2xl border border-slate-700 flex flex-col overflow-hidden"
      style={{
        right: `${right}px`,
        width: `${width}px`,
        height: `${minimized ? collapsedHeight : expandedHeight}px`,
        transition: 'height 0.18s ease-out',
      }}
      role="dialog"
      aria-label={`Chat with ${otherUserName}`}
    >
      {/* Header — always visible, click to toggle minimize */}
      <button
        type="button"
        onClick={() => toggleMinimize(channelId)}
        className="flex items-center justify-between w-full px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {(otherUserName || '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium truncate">{otherUserName}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!minimized && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleVideoCall() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleVideoCall() } }}
              className="p-1 rounded hover:bg-slate-700 cursor-pointer"
              title="Start video call"
            >
              <Video className="w-4 h-4" />
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggleMinimize(channelId) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleMinimize(channelId) } }}
            className="p-1 rounded hover:bg-slate-700 cursor-pointer"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            <Minus className="w-4 h-4" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); closePopout(channelId) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); closePopout(channelId) } }}
            className="p-1 rounded hover:bg-slate-700 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </span>
        </div>
      </button>

      {/* Body (hidden when minimized) */}
      {!minimized && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-2 bg-slate-950 space-y-1.5"
          >
            {!loaded && (
              <div className="text-xs text-slate-500 text-center py-4">Loading...</div>
            )}
            {loaded && messages.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-4">
                No messages yet. Say hello.
              </div>
            )}
            {messages.map((m) => {
              const isMine = m.sender_id === user?.id
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-3 py-1.5 rounded-2xl text-sm break-words ${
                      isMine
                        ? 'bg-sky-500 text-white rounded-br-sm'
                        : 'bg-emerald-500 text-white rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              )
            })}
            {typingUsers.length > 0 && (
              <div className="flex justify-start pt-1">
                <TypingIndicator users={typingUsers} />
              </div>
            )}
          </div>

          <form
            onSubmit={handleSend}
            className="flex items-end gap-1.5 px-2 py-2 border-t border-slate-700 bg-slate-900"
          >
            <textarea
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handleKeyDown}
              placeholder="Aa"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-700 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-slate-800 max-h-24"
              style={{ minHeight: '32px' }}
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  )
}
