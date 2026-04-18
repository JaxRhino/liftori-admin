import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

/**
 * Global state for Messenger-style DM pop-outs.
 *
 * - Pop-outs persist across route changes because the provider lives at
 *   AdminLayout level (above <Outlet />).
 * - Cap of 4 simultaneous pop-outs; oldest is dropped when a 5th opens.
 * - Persisted to sessionStorage so a hard nav (e.g. logo click) keeps state
 *   alive within a tab session. Cleared on logout.
 */

const STORAGE_KEY = 'liftori_dm_popouts'
const MAX_POPOUTS = 4

const PopoutChatContext = createContext(null)

export const usePopoutChat = () => {
  const ctx = useContext(PopoutChatContext)
  if (!ctx) throw new Error('usePopoutChat must be used within PopoutChatProvider')
  return ctx
}

function loadInitial() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_POPOUTS)
  } catch {
    return []
  }
}

export function PopoutChatProvider({ children }) {
  const [popouts, setPopouts] = useState(loadInitial)

  // Persist to sessionStorage so pop-outs survive route changes / refreshes.
  useEffect(() => {
    try {
      // Keep payload small — only the bare ids/names needed to re-hydrate.
      const slim = popouts.map(p => ({
        channelId: p.channelId,
        channel: {
          id: p.channel?.id,
          name: p.channel?.name,
          type: p.channel?.type,
          other_user_id: p.channel?.other_user_id,
          other_user_name: p.channel?.other_user_name,
          other_user: p.channel?.other_user,
        },
        minimized: !!p.minimized,
      }))
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
    } catch {
      // sessionStorage might be unavailable in some embeds — fail silent.
    }
  }, [popouts])

  const openPopout = useCallback((channel) => {
    if (!channel?.id) return
    setPopouts(prev => {
      const existing = prev.find(p => p.channelId === channel.id)
      if (existing) {
        // Already open — un-minimize and bring to front (move to end).
        const others = prev.filter(p => p.channelId !== channel.id)
        return [...others, { ...existing, minimized: false, channel }]
      }
      const next = [...prev, { channelId: channel.id, channel, minimized: false }]
      // Drop oldest if over cap.
      return next.length > MAX_POPOUTS ? next.slice(-MAX_POPOUTS) : next
    })
  }, [])

  const closePopout = useCallback((channelId) => {
    setPopouts(prev => prev.filter(p => p.channelId !== channelId))
  }, [])

  const toggleMinimize = useCallback((channelId) => {
    setPopouts(prev => prev.map(p =>
      p.channelId === channelId ? { ...p, minimized: !p.minimized } : p
    ))
  }, [])

  const minimizeAll = useCallback(() => {
    setPopouts(prev => prev.map(p => ({ ...p, minimized: true })))
  }, [])

  const closeAll = useCallback(() => {
    setPopouts([])
  }, [])

  const isOpen = useCallback((channelId) => {
    return popouts.some(p => p.channelId === channelId)
  }, [popouts])

  const value = {
    popouts,
    openPopout,
    closePopout,
    toggleMinimize,
    minimizeAll,
    closeAll,
    isOpen,
  }

  return (
    <PopoutChatContext.Provider value={value}>
      {children}
    </PopoutChatContext.Provider>
  )
}

export default PopoutChatContext
