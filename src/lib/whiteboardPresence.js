// whiteboardPresence.js
// Realtime cursor + selection presence for the Dev Team Whiteboard.
// Wraps Supabase Realtime broadcast into a hook that returns a
// `collaborators` Map shaped exactly the way Excalidraw expects it.
//
// Pattern: each whiteboard canvas gets its own ephemeral broadcast channel
// `whiteboard:<canvasId>`. Every connected client publishes its pointer
// position, button state, and selected element ids on `onPointerUpdate`.
// We accumulate the latest message per remote user into a Map and feed
// it into <Excalidraw collaborators={...} />.
//
// Authored by Socrates (Mike's agent) for Wave F1.

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'

const PALETTE = [
  '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24',
  '#34d399', '#fb7185', '#60a5fa', '#f59e0b',
]

function hashStringToInt(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function colorForUser(userId) {
  if (!userId) return PALETTE[0]
  return PALETTE[hashStringToInt(userId) % PALETTE.length]
}

export function useWhiteboardPresence(canvasId, me) {
  const [collaborators, setCollaborators] = useState(new Map())
  const [remoteEditing, setRemoteEditing] = useState([])
  const channelRef = useRef(null)
  const meRef = useRef(me)
  useEffect(() => { meRef.current = me }, [me])

  useEffect(() => {
    if (!canvasId || !me?.id) return
    const ch = supabase.channel(`whiteboard:${canvasId}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    })

    ch.on('broadcast', { event: 'pointer' }, ({ payload }) => {
      if (!payload?.userId || payload.userId === meRef.current?.id) return
      setCollaborators(prev => {
        const next = new Map(prev)
        const existing = next.get(payload.userId) || {}
        next.set(payload.userId, {
          ...existing,
          pointer: payload.pointer,
          button: payload.button,
          username: payload.username || existing.username || 'Anonymous',
          color: payload.color || existing.color || colorForUser(payload.userId),
        })
        return next
      })
    })

    ch.on('broadcast', { event: 'selection' }, ({ payload }) => {
      if (!payload?.userId || payload.userId === meRef.current?.id) return
      setCollaborators(prev => {
        const next = new Map(prev)
        const existing = next.get(payload.userId) || {}
        next.set(payload.userId, {
          ...existing,
          selectedElementIds: payload.selectedElementIds || {},
          username: payload.username || existing.username || 'Anonymous',
          color: payload.color || existing.color || colorForUser(payload.userId),
        })
        return next
      })
    })

    ch.on('broadcast', { event: 'editing' }, ({ payload }) => {
      if (!payload?.userId || payload.userId === meRef.current?.id) return
      setRemoteEditing(prev => {
        const without = prev.filter(p => p.userId !== payload.userId)
        return payload.isEditing
          ? [...without, { userId: payload.userId, username: payload.username || 'Someone' }]
          : without
      })
    })

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const liveIds = new Set(Object.keys(state))
      setCollaborators(prev => {
        const next = new Map()
        for (const [id, val] of prev) if (liveIds.has(id)) next.set(id, val)
        return next
      })
      setRemoteEditing(prev => prev.filter(p => liveIds.has(p.userId)))
    })

    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ userId: me.id, username: me.username || 'Anonymous', online_at: new Date().toISOString() })
      }
    })

    channelRef.current = ch
    return () => {
      try { ch.untrack() } catch {}
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [canvasId, me?.id])

  const broadcastPointer = useCallback((payload) => {
    const ch = channelRef.current
    const m = meRef.current
    if (!ch || !m?.id) return
    ch.send({
      type: 'broadcast',
      event: 'pointer',
      payload: {
        userId: m.id,
        username: m.username,
        color: colorForUser(m.id),
        pointer: payload?.pointer,
        button: payload?.button,
      },
    })
  }, [])

  const broadcastSelection = useCallback((selectedElementIds) => {
    const ch = channelRef.current
    const m = meRef.current
    if (!ch || !m?.id) return
    ch.send({
      type: 'broadcast',
      event: 'selection',
      payload: {
        userId: m.id,
        username: m.username,
        color: colorForUser(m.id),
        selectedElementIds: selectedElementIds || {},
      },
    })
  }, [])

  const announceEditing = useCallback((isEditing) => {
    const ch = channelRef.current
    const m = meRef.current
    if (!ch || !m?.id) return
    ch.send({
      type: 'broadcast',
      event: 'editing',
      payload: { userId: m.id, username: m.username, isEditing: !!isEditing },
    })
  }, [])

  return { collaborators, broadcastPointer, broadcastSelection, remoteEditing, announceEditing }
}
