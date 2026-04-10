/**
 * Rally Chat — Supabase Service Layer
 * Replaces all FastAPI/axios calls with direct Supabase queries.
 */
import { supabase } from './supabase'

// ─── Channels ────────────────────────────────────────────────

export async function fetchChannels(userId) {
  const { data, error } = await supabase
    .from('chat_channels')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  if (error) throw error

  const channels = data || []
  if (!userId || channels.length === 0) return { channels }

  // Fetch user's read timestamps for all channels
  const { data: readStates } = await supabase
    .from('chat_notification_reads')
    .select('channel_id, last_read_at')
    .eq('user_id', userId)

  const readMap = new Map()
  if (readStates) {
    readStates.forEach(r => readMap.set(r.channel_id, r.last_read_at))
  }

  // For each channel, count messages newer than last_read_at
  const channelIds = channels.map(c => c.id)
  const enriched = await Promise.all(channels.map(async (ch) => {
    const lastRead = readMap.get(ch.id)
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', ch.id)
      .eq('is_deleted', false)
      .is('thread_id', null)

    if (lastRead) {
      query = query.gt('created_at', lastRead)
    }
    // If no sender_id filter needed — count all unread including system messages
    if (userId) {
      query = query.neq('sender_id', userId)
    }

    const { count } = await query
    return { ...ch, unread_count: count || 0 }
  }))

  return { channels: enriched }
}

export async function createChannel({ name, description, type, members }, userId) {
  const { data, error } = await supabase
    .from('chat_channels')
    .insert({ name, description: description || '', type: type || 'public', created_by: userId })
    .select()
    .single()

  if (error) throw error

  // Add creator as owner
  await supabase.from('chat_channel_members').insert({
    channel_id: data.id,
    user_id: userId,
    role: 'owner'
  })

  // Add additional members
  if (members && members.length > 0) {
    const memberRows = members
      .filter(m => m !== userId)
      .map(m => ({ channel_id: data.id, user_id: m, role: 'member' }))
    if (memberRows.length > 0) {
      await supabase.from('chat_channel_members').insert(memberRows)
    }
  }

  return data
}

// ─── Messages ────────────────────────────────────────────────

export async function fetchMessages(channelId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .is('thread_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) throw error

  // Fetch reactions for these messages
  const messageIds = (data || []).map(m => m.id)
  let reactionsMap = {}

  if (messageIds.length > 0) {
    const { data: reactions } = await supabase
      .from('chat_reactions')
      .select('*')
      .in('message_id', messageIds)

    if (reactions) {
      reactionsMap = reactions.reduce((acc, r) => {
        if (!acc[r.message_id]) acc[r.message_id] = []
        const existing = acc[r.message_id].find(x => x.emoji === r.emoji)
        if (existing) {
          existing.users.push(r.user_id)
          existing.count++
        } else {
          acc[r.message_id].push({ emoji: r.emoji, users: [r.user_id], count: 1 })
        }
        return acc
      }, {})
    }
  }

  const messages = (data || []).map(m => ({
    ...m,
    reactions: reactionsMap[m.id] || []
  }))

  return { messages }
}

export async function sendMessage(channelId, { content, attachments = [], thread_id = null }, user) {
  const senderName = user.user_metadata?.full_name || user.email || ''
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, avatar_url')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      channel_id: channelId,
      sender_id: user.id,
      sender_name: profile?.full_name || senderName,
      sender_role: profile?.role || 'customer',
      sender_avatar_url: profile?.avatar_url || null,
      content,
      attachments: attachments || [],
      thread_id: thread_id || null
    })
    .select()
    .single()

  if (error) throw error

  // ─── Chat Notifications ───────────────────────────────────
  // Notify all channel members except the sender
  try {
    const { data: members } = await supabase
      .from('chat_channel_members')
      .select('user_id')
      .eq('channel_id', channelId)
      .neq('user_id', user.id)

    if (members && members.length > 0) {
      // Check for muted channels
      const memberIds = members.map(m => m.user_id)
      const { data: prefs } = await supabase
        .from('chat_user_preferences')
        .select('user_id, muted_channels')
        .in('user_id', memberIds)

      const mutedMap = new Map()
      if (prefs) {
        prefs.forEach(p => {
          if (p.muted_channels && p.muted_channels.includes(channelId)) {
            mutedMap.set(p.user_id, true)
          }
        })
      }

      // Get channel name for notification
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('name, type')
        .eq('id', channelId)
        .single()

      const channelLabel = channel?.type === 'direct'
        ? (profile?.full_name || senderName)
        : `#${channel?.name || 'chat'}`

      const preview = content.length > 80 ? content.substring(0, 80) + '...' : content

      const notifs = memberIds
        .filter(id => !mutedMap.get(id))
        .map(uid => ({
          user_id: uid,
          type: 'message',
          title: `New message in ${channelLabel}`,
          body: `${profile?.full_name || senderName}: ${preview}`,
          link: '/admin/chat',
        }))

      if (notifs.length > 0) {
        await supabase.from('notifications').insert(notifs)
      }
    }
  } catch (notifErr) {
    // Don't block message sending if notification fails
    console.error('Chat notification error:', notifErr)
  }

  return data
}

export async function editMessage(messageId, content) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', messageId)

  if (error) throw error
}

export async function deleteMessage(messageId) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ is_deleted: true })
    .eq('id', messageId)

  if (error) throw error
}

// ─── Threads ─────────────────────────────────────────────────

export async function fetchThread(messageId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', messageId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  return { replies: data || [] }
}

export async function fetchThreadCounts(channelId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('thread_id')
    .eq('channel_id', channelId)
    .not('thread_id', 'is', null)
    .eq('is_deleted', false)

  if (error) throw error

  const counts = (data || []).reduce((acc, m) => {
    acc[m.thread_id] = (acc[m.thread_id] || 0) + 1
    return acc
  }, {})

  return { thread_counts: counts }
}

// ─── Reactions ───────────────────────────────────────────────

export async function toggleReaction(messageId, emoji, userId, userName) {
  // Check if reaction exists
  const { data: existing } = await supabase
    .from('chat_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    // Remove reaction
    await supabase.from('chat_reactions').delete().eq('id', existing.id)
  } else {
    // Add reaction
    await supabase.from('chat_reactions').insert({
      message_id: messageId,
      user_id: userId,
      user_name: userName,
      emoji
    })
  }

  // Return updated reactions for this message
  const { data: allReactions } = await supabase
    .from('chat_reactions')
    .select('*')
    .eq('message_id', messageId)

  const grouped = (allReactions || []).reduce((acc, r) => {
    const existing = acc.find(x => x.emoji === r.emoji)
    if (existing) {
      existing.users.push(r.user_id)
      existing.count++
    } else {
      acc.push({ emoji: r.emoji, users: [r.user_id], count: 1 })
    }
    return acc
  }, [])

  return { reactions: grouped }
}

// ─── Direct Messages ─────────────────────────────────────────

export async function fetchDirectMessages(userId, filterRole = null) {
  // Get DM channels the user is a member of
  const { data: memberships } = await supabase
    .from('chat_channel_members')
    .select('channel_id')
    .eq('user_id', userId)

  if (!memberships || memberships.length === 0) return { direct_messages: [] }

  const channelIds = memberships.map(m => m.channel_id)

  const { data: dmChannels } = await supabase
    .from('chat_channels')
    .select('*')
    .in('id', channelIds)
    .eq('type', 'direct')
    .eq('is_archived', false)

  // For each DM, get the other user's info
  const dms = []
  for (const dm of (dmChannels || [])) {
    const { data: members } = await supabase
      .from('chat_channel_members')
      .select('user_id')
      .eq('channel_id', dm.id)
      .neq('user_id', userId)

    const otherUserId = members?.[0]?.user_id
    let otherUser = null
    if (otherUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', otherUserId)
        .single()
      otherUser = profile
    }

    // Filter by role if specified (e.g. 'admin' for team, 'customer' for customers)
    if (filterRole && otherUser?.role !== filterRole) continue

    // Get last message
    const { data: lastMsg } = await supabase
      .from('chat_messages')
      .select('content, created_at')
      .eq('channel_id', dm.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get unread count for this DM
    const { data: readState } = await supabase
      .from('chat_notification_reads')
      .select('last_read_at')
      .eq('channel_id', dm.id)
      .eq('user_id', userId)
      .maybeSingle()

    let unreadCount = 0
    let unreadQuery = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', dm.id)
      .eq('is_deleted', false)
      .is('thread_id', null)
      .neq('sender_id', userId)

    if (readState?.last_read_at) {
      unreadQuery = unreadQuery.gt('created_at', readState.last_read_at)
    }

    const { count } = await unreadQuery
    unreadCount = count || 0

    const displayName = otherUser?.full_name || otherUser?.email || 'Unknown'
    dms.push({
      ...dm,
      other_user: otherUser,
      other_user_name: displayName,
      other_user_id: otherUserId,
      name: displayName,
      last_message: lastMsg?.content || '',
      last_message_at: lastMsg?.created_at || dm.created_at,
      unread_count: unreadCount
    })
  }

  return { direct_messages: dms }
}

export async function fetchCustomerUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('role', 'customer')
    .order('full_name', { ascending: true })

  if (error) throw error
  return {
    users: (data || []).map(u => ({
      id: u.id,
      name: u.full_name || u.email || 'Unknown',
      username: (u.full_name || u.email || 'unknown').toLowerCase().replace(/\s+/g, '.'),
      email: u.email,
      role: u.role,
      avatar: null
    }))
  }
}

export async function createOrGetDM(currentUserId, otherUserId) {
  // Check if DM channel already exists between these two users
  const { data: myDMs } = await supabase
    .from('chat_channel_members')
    .select('channel_id')
    .eq('user_id', currentUserId)

  if (myDMs && myDMs.length > 0) {
    for (const m of myDMs) {
      const { data: ch } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('id', m.channel_id)
        .eq('type', 'direct')
        .single()

      if (ch) {
        const { data: otherMember } = await supabase
          .from('chat_channel_members')
          .select('user_id')
          .eq('channel_id', ch.id)
          .eq('user_id', otherUserId)
          .maybeSingle()

        if (otherMember) {
          return ch // Already exists
        }
      }
    }
  }

  // Get other user's name for channel name
  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', otherUserId)
    .single()

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', currentUserId)
    .single()

  // Create new DM channel
  const dmName = `${myProfile?.full_name || 'User'} & ${otherProfile?.full_name || 'User'}`
  const { data: newChannel, error } = await supabase
    .from('chat_channels')
    .insert({ name: dmName, type: 'direct', created_by: currentUserId })
    .select()
    .single()

  if (error) throw error

  // Add both users as members
  await supabase.from('chat_channel_members').insert([
    { channel_id: newChannel.id, user_id: currentUserId, role: 'owner' },
    { channel_id: newChannel.id, user_id: otherUserId, role: 'member' }
  ])

  return { ...newChannel, name: otherProfile?.full_name || otherProfile?.email || 'User' }
}

// ─── Users ───────────────────────────────────────────────────

export async function fetchUsers() {
  // Only return team members (admin role) — customers use a separate DM section
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('role', 'admin')
    .order('full_name', { ascending: true })

  if (error) throw error
  return {
    users: (data || []).map(u => ({
      id: u.id,
      name: u.full_name || u.email || 'Unknown',
      username: (u.full_name || u.email || 'unknown').toLowerCase().replace(/\s+/g, '.'),
      email: u.email,
      role: u.role,
      avatar: null
    }))
  }
}

// ─── Preferences ─────────────────────────────────────────────

export async function fetchUserPreferences(userId) {
  const { data } = await supabase
    .from('chat_user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return data || { starred_channels: [], muted_channels: [], status: 'online', status_text: '', status_emoji: '' }
}

export async function updateUserPreferences(userId, prefs) {
  const { error } = await supabase
    .from('chat_user_preferences')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() })

  if (error) throw error
}

// ─── Presence / Status ───────────────────────────────────────

export async function fetchUserStatus(userId) {
  const { data } = await supabase
    .from('chat_user_preferences')
    .select('status, status_text, status_emoji')
    .eq('user_id', userId)
    .maybeSingle()

  return data || { status: 'online', status_text: '', status_emoji: '' }
}

// ─── Permissions ─────────────────────────────────────────────

export async function fetchChatPermissions(userId) {
  // For now, admin gets full permissions, others get basic
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const isAdmin = profile?.role === 'admin'

  return {
    can_create_channels: true,
    can_create_private_channels: isAdmin,
    can_delete_any_message: isAdmin,
    can_pin_messages: true,
    can_manage_channels: isAdmin,
    can_create_announcements: isAdmin,
    is_admin: isAdmin
  }
}

// ─── Announcements ───────────────────────────────────────────

export async function fetchAnnouncements(userId) {
  const { data, error } = await supabase
    .from('chat_announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Check which ones user has acknowledged
  const { data: acks } = await supabase
    .from('chat_announcement_acks')
    .select('announcement_id')
    .eq('user_id', userId)

  const ackedIds = new Set((acks || []).map(a => a.announcement_id))

  return {
    announcements: (data || []).map(a => ({
      ...a,
      user_acknowledged: ackedIds.has(a.id)
    }))
  }
}

export async function acknowledgeAnnouncement(announcementId, userId) {
  const { error } = await supabase
    .from('chat_announcement_acks')
    .insert({ announcement_id: announcementId, user_id: userId })

  if (error && error.code !== '23505') throw error // Ignore duplicate
}

// ─── Saved Messages ──────────────────────────────────────────

export async function saveMessage(messageId, userId) {
  // Toggle: check if already saved
  const { data: existing } = await supabase
    .from('chat_saved_messages')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase.from('chat_saved_messages').delete().eq('id', existing.id)
    return { saved: false }
  } else {
    await supabase.from('chat_saved_messages').insert({ message_id: messageId, user_id: userId })
    return { saved: true }
  }
}

// ─── Pin Messages ────────────────────────────────────────────

export async function togglePin(channelId, messageId, currentlyPinned) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ is_pinned: !currentlyPinned })
    .eq('id', messageId)
    .eq('channel_id', channelId)

  if (error) throw error
}

// ─── Notifications ───────────────────────────────────────────

export async function markNotificationsRead(channelId, userId) {
  const { error } = await supabase
    .from('chat_notification_reads')
    .upsert({
      channel_id: channelId,
      user_id: userId,
      last_read_at: new Date().toISOString()
    })

  if (error) throw error
}

// ─── Search ──────────────────────────────────────────────────

export async function searchMessages(query) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, chat_channels(name)')
    .ilike('content', `%${query}%`)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return {
    results: (data || []).map(m => ({
      ...m,
      channel_name: m.chat_channels?.name || 'Unknown'
    }))
  }
}

// ─── File Upload (Supabase Storage) ──────────────────────────

export async function uploadFile(file, userId) {
  const ext = file.name.split('.').pop()
  const path = `chat/${userId}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from('chat-files')
    .upload(path, file)

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('chat-files')
    .getPublicUrl(path)

  return {
    filename: file.name,
    file_type: file.type.startsWith('image/') ? 'image' : 'file',
    url: urlData.publicUrl,
    size: file.size
  }
}

// ─── Realtime Subscriptions ──────────────────────────────────

export function subscribeToChannel(channelId, onNewMessage, onMessageUpdate, onMessageDelete) {
  const subscription = supabase
    .channel(`chat:${channelId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `channel_id=eq.${channelId}`
    }, (payload) => {
      if (payload.new && !payload.new.thread_id) {
        onNewMessage(payload.new)
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'chat_messages',
      filter: `channel_id=eq.${channelId}`
    }, (payload) => {
      if (payload.new.is_deleted) {
        onMessageDelete?.(payload.new.id)
      } else {
        onMessageUpdate?.(payload.new)
      }
    })
    .subscribe()

  return subscription
}

export function subscribeToReactions(channelId, onReactionChange) {
  const subscription = supabase
    .channel(`reactions:${channelId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chat_reactions'
    }, (payload) => {
      const messageId = payload.new?.message_id || payload.old?.message_id
      if (messageId) onReactionChange(messageId)
    })
    .subscribe()

  return subscription
}

export function subscribeToChannels(onChannelChange) {
  const subscription = supabase
    .channel('chat-channels')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chat_channels'
    }, () => {
      onChannelChange()
    })
    .subscribe()

  return subscription
}

export function unsubscribe(subscription) {
  if (subscription) {
    supabase.removeChannel(subscription)
  }
}
