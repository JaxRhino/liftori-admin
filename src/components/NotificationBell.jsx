import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useVideoCallContext } from '../contexts/VideoCallContext'
import { toast } from 'sonner'

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { triggerIncomingCall } = useVideoCallContext()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (user) fetchNotifications()
  }, [user])

  // Play notification sound
  const playAlert = useCallback((isRally = false) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.value = 0.3

      if (isRally) {
        // Urgent double-chime for Rally calls
        osc.frequency.value = 880
        osc.type = 'sine'
        osc.start(ctx.currentTime)
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.45)
        gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.55)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
        osc.stop(ctx.currentTime + 0.7)
      } else {
        // Single soft chime for regular notifications
        osc.frequency.value = 660
        osc.type = 'sine'
        osc.start(ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.stop(ctx.currentTime + 0.35)
      }
    } catch (e) { /* audio context not available */ }
  }, [])

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const notif = payload.new
        setNotifications(prev => [notif, ...prev])
        setUnreadCount(prev => prev + 1)

        // Check if this is a Rally notification
        const isRally = notif.title?.toLowerCase().includes('rally') || notif.link?.includes('rally')

        // Play sound
        playAlert(isRally)

        // Show toast
        if (isRally) {
          // Extract callId from link (e.g. /admin/chat?callId=xxx)
          const callIdMatch = notif.link?.match(/callId=([^&]+)/);
          toast.warning(notif.title, {
            description: notif.body,
            duration: 15000,
            action: callIdMatch ? {
              label: 'Join Call',
              onClick: () => {
                // Directly trigger the incoming call modal
                triggerIncomingCall(callIdMatch[1]);
                // Navigate to chat if not already there
                if (!window.location.pathname.includes('/chat')) {
                  navigate('/admin/chat');
                }
              }
            } : notif.link ? { label: 'Open Rally', onClick: () => { navigate(notif.link) } } : undefined,
          })
        } else {
          toast(notif.title, {
            description: notif.body,
            duration: 5000,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, playAlert])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.read).length)
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    }
  }

  function handleClick(notif) {
    if (!notif.read) markAsRead(notif.id)
    // If it's a Rally call notification, trigger the incoming call modal directly
    const callIdMatch = notif.link?.match(/callId=([^&]+)/);
    if (callIdMatch) {
      triggerIncomingCall(callIdMatch[1]);
      if (!window.location.pathname.includes('/chat')) {
        navigate('/admin/chat');
      }
    } else if (notif.link) {
      navigate(notif.link)
    }
    setOpen(false)
  }

  function timeAgo(dateStr) {
    const now = new Date()
    const date = new Date(dateStr)
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const TYPE_ICONS = {
    ticket: '🎫',
    ticket_reply: '💬',
    message: '✉️',
    project_update: '📋',
    general: '🔔'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full bottom-0 ml-2 w-80 bg-navy-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                    !notif.read ? 'bg-sky-500/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-base mt-0.5">{TYPE_ICONS[notif.type] || TYPE_ICONS.general}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${!notif.read ? 'text-white' : 'text-gray-400'}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 bg-sky-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      {notif.body && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
