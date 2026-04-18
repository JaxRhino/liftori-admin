import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Minus, Video, Send, Paperclip, Smile, File as FileIcon, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { usePopoutChat } from '../../contexts/PopoutChatContext'
import { useVideoCallContext } from '../../contexts/VideoCallContext'
import * as chatSvc from '../../lib/chatService'
import TypingIndicator from './TypingIndicator'
import EmojiPicker from './EmojiPicker'
import { playSendSwoosh } from '../../lib/chatSounds'

/**
 * Messenger-style DM pop-out window.
 *
 * - Fixed position on the right edge of the viewport.
 * - Header (always visible) collapses the body when minimized.
 * - Subscribes to new messages + typing presence for this channel.
 * - Sends messages on Enter; Shift+Enter inserts a newline.
 * - Video call button hands off to VideoCallContext.startCall().
 * - Supports file/image uploads (multiple) + emoji picker.
 * - Renders avatars on every message (mine + theirs) and inline attachments.
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
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const scrollRef = useRef(null)
  const typingChannelRef = useRef(null)
  const typingDebounceRef = useRef(null)
  const myselfTypingRef = useRef(false)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

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

  // Mark channel as read whenever the popout is expanded (or un-minimized).
  // Covers: first open, minimize → expand, and every render while expanded+viewing.
  useEffect(() => {
    if (!channelId || !user?.id || minimized) return
    chatSvc.markNotificationsRead(channelId, user.id).catch(() => {})
    try {
      window.dispatchEvent(new CustomEvent('chat-dm-viewed', { detail: { channelId } }))
    } catch { /* no-op */ }
  }, [channelId, user?.id, minimized])

  // Subscribe to new/edited/deleted messages
  useEffect(() => {
    if (!channelId) return
    const sub = chatSvc.subscribeToChannel(
      channelId,
      (newMsg) => {
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        // If we're expanded and visible, instantly clear the badge + persist read state.
        if (!minimized && user?.id && newMsg.sender_id !== user.id) {
          chatSvc.markNotificationsRead(channelId, user.id).catch(() => {})
          try {
            window.dispatchEvent(new CustomEvent('chat-dm-viewed', { detail: { channelId } }))
          } catch { /* no-op */ }
        }
      },
      (updatedMsg) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
      },
      (deletedId) => {
        setMessages(prev => prev.filter(m => m.id !== deletedId))
      }
    )
    return () => chatSvc.unsubscribe(sub)
  }, [channelId, minimized, user?.id])

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
    // Swoosh on send (synchronous — survives optimistic failures too)
    playSendSwoosh()
    try {
      const saved = await chatSvc.sendMessage(channelId, { content: text }, user)
      if (saved) {
        setMessages(prev => prev.some(m => m.id === saved.id) ? prev : [...prev, saved])
      }
      if (myselfTypingRef.current) {
        myselfTypingRef.current = false
        broadcastTyping(false)
      }
    } catch (err) {
      console.error('DMPopout send failed:', err)
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

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !channelId) {
      e.target.value = ''
      return
    }

    const oversized = files.filter(f => f.size > 10 * 1024 * 1024)
    if (oversized.length > 0) {
      // eslint-disable-next-line no-alert
      alert(`These files are over 10MB and won't upload:\n${oversized.map(f => f.name).join('\n')}`)
    }
    const accepted = files.filter(f => f.size <= 10 * 1024 * 1024)
    if (!accepted.length) {
      e.target.value = ''
      return
    }

    setUploadingFiles(true)
    try {
      const attachments = await Promise.all(
        accepted.map(f => chatSvc.uploadFile(f, user.id))
      )

      const content = accepted.length === 1
        ? `Shared ${attachments[0].file_type}: ${attachments[0].filename}`
        : `Shared ${accepted.length} files`

      const saved = await chatSvc.sendMessage(
        channelId,
        { content, attachments },
        user,
      )
      if (saved) {
        setMessages(prev => prev.some(m => m.id === saved.id) ? prev : [...prev, saved])
        playSendSwoosh()
      }
    } catch (err) {
      console.error('DMPopout file upload failed:', err)
      // eslint-disable-next-line no-alert
      alert('File upload failed. Please try again.')
    } finally {
      setUploadingFiles(false)
      e.target.value = ''
    }
  }

  const handleEmojiSelect = (emoji) => {
    setDraft(prev => prev + emoji)
    setTimeout(() => textareaRef.current?.focus(), 0)
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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden">
            {channel?.other_user?.avatar_url ? (
              <img src={channel.other_user.avatar_url} alt={otherUserName} className="w-full h-full object-cover" />
            ) : (
              (otherUserName || '?').charAt(0).toUpperCase()
            )}
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
            className="flex-1 overflow-y-auto px-3 py-2 bg-slate-950 space-y-2"
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
              const avatarUrl = isMine
                ? (profile?.avatar_url || m.sender_avatar_url || null)
                : (m.sender_avatar_url || channel?.other_user?.avatar_url || null)
              const displayName = isMine
                ? (profile?.full_name || user?.email || 'Me')
                : (m.sender_name || otherUserName)
              const initial = (displayName || '?').charAt(0).toUpperCase()
              const attachments = Array.isArray(m.attachments) ? m.attachments : []
              const hasContent = !!(m.content && String(m.content).trim().length > 0)

              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMine && (
                    avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-slate-700"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                        {initial}
                      </div>
                    )
                  )}

                  <div className={`flex flex-col gap-1 max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                    {hasContent && (
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                          isMine
                            ? 'bg-sky-500 text-white rounded-br-sm'
                            : 'bg-emerald-500 text-white rounded-bl-sm'
                        }`}
                      >
                        {m.content}
                      </div>
                    )}

                    {attachments.length > 0 && (
                      <div className="flex flex-col gap-1 w-full">
                        {attachments.map((att, idx) => (
                          <div
                            key={`${m.id}-att-${idx}`}
                            className="rounded-lg overflow-hidden border border-slate-700 bg-slate-800 max-w-[260px]"
                          >
                            {att.file_type === 'image' ? (
                              <img
                                src={att.url}
                                alt={att.filename}
                                className="w-full h-auto max-h-64 object-cover cursor-pointer"
                                onClick={() => window.open(att.url, '_blank', 'noopener')}
                              />
                            ) : (
                              <div className="flex items-center gap-2 p-2">
                                <FileIcon className="w-5 h-5 text-sky-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-white truncate">{att.filename}</p>
                                  {typeof att.size === 'number' && (
                                    <p className="text-[10px] text-slate-400">
                                      {(att.size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={att.url}
                                  download={att.filename}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isMine && (
                    avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-slate-700"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
                        {initial}
                      </div>
                    )
                  )}
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
            className="flex items-end gap-1 px-2 py-2 border-t border-slate-700 bg-slate-900"
          >
            {/* Hidden file input — supports multiple selection */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
            />

            {/* Upload button */}
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={uploadingFiles}
              title="Attach files or images"
              aria-label="Attach files"
              className="p-2 rounded-full text-slate-300 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {uploadingFiles ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            {/* Emoji picker */}
            <EmojiPicker
              onSelect={handleEmojiSelect}
              trigger={
                <button
                  type="button"
                  title="Add emoji"
                  aria-label="Add emoji"
                  className="p-2 rounded-full text-slate-300 hover:text-sky-300 hover:bg-slate-800 transition-colors flex-shrink-0"
                >
                  <Smile className="w-4 h-4" />
                </button>
              }
            />

            <textarea
              ref={textareaRef}
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
