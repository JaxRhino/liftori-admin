/**
 * Rally Video — Supabase Service Layer
 * Replaces all FastAPI/axios video call endpoints with direct Supabase queries.
 * WebRTC signaling happens via Supabase Realtime subscriptions on video_signals table.
 */
import { supabase } from './supabase'

// ─── Calls ──────────────────────────────────────────────────

export async function createCall({ channelId, callType = 'video', participants = [] }, user) {
  const { data: call, error } = await supabase
    .from('video_calls')
    .insert({
      created_by: user.id,
      channel_id: channelId || null,
      call_type: callType,
      status: 'ringing',
    })
    .select()
    .single()

  if (error) throw error

  // Add creator as first participant
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  await supabase.from('video_call_participants').insert({
    call_id: call.id,
    user_id: user.id,
    display_name: profile?.full_name || user.email,
    is_audio_on: true,
    is_video_on: callType === 'video',
  })

  // Notify other participants about incoming call
  if (participants.length > 0) {
    const notifs = participants
      .filter(uid => uid !== user.id)
      .map(uid => ({
        user_id: uid,
        type: 'general',
        title: 'Incoming Video Call',
        body: `${profile?.full_name || 'Someone'} is calling you`,
        link: `/admin/chat?callId=${call.id}`,
      }))
    if (notifs.length > 0) {
      await supabase.from('notifications').insert(notifs)
    }
  }

  return call
}

export async function getCall(callId) {
  const { data, error } = await supabase
    .from('video_calls')
    .select('*, video_call_participants(*)')
    .eq('id', callId)
    .single()

  if (error) throw error
  return data
}

export async function getActiveCalls(userId) {
  // Find calls where this user is a participant and call is ringing/active
  const { data, error } = await supabase
    .from('video_call_participants')
    .select('call_id, video_calls!inner(id, status, created_by, call_type, channel_id, created_at)')
    .eq('user_id', userId)
    .in('video_calls.status', ['ringing', 'active'])
    .is('left_at', null)

  if (error) throw error
  return (data || []).map(d => d.video_calls)
}

export async function getIncomingCalls(userId) {
  // Find ringing calls where this user is NOT yet a participant but is in the channel
  // OR find ringing calls created for channels the user belongs to
  const { data: myChannels } = await supabase
    .from('chat_channel_members')
    .select('channel_id')
    .eq('user_id', userId)

  const channelIds = (myChannels || []).map(c => c.channel_id)

  if (channelIds.length === 0) return []

  const { data, error } = await supabase
    .from('video_calls')
    .select('*, video_call_participants(*)')
    .eq('status', 'ringing')
    .in('channel_id', channelIds)
    .neq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) throw error
  return data || []
}

export async function joinCall(callId, user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  // Upsert participant (in case they were added during creation)
  const { data, error } = await supabase
    .from('video_call_participants')
    .upsert({
      call_id: callId,
      user_id: user.id,
      display_name: profile?.full_name || user.email,
      joined_at: new Date().toISOString(),
      left_at: null,
      is_audio_on: true,
      is_video_on: true,
    }, { onConflict: 'call_id,user_id' })
    .select()
    .single()

  if (error) throw error

  // Update call to active if still ringing
  await supabase
    .from('video_calls')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', callId)
    .eq('status', 'ringing')

  return data
}

export async function leaveCall(callId, userId) {
  await supabase
    .from('video_call_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('call_id', callId)
    .eq('user_id', userId)

  // Check if any participants remain
  const { data: remaining } = await supabase
    .from('video_call_participants')
    .select('id')
    .eq('call_id', callId)
    .is('left_at', null)

  // If no one left, end the call
  if (!remaining || remaining.length === 0) {
    await endCall(callId)
  }
}

export async function endCall(callId) {
  const { data: call } = await supabase
    .from('video_calls')
    .select('started_at')
    .eq('id', callId)
    .single()

  const now = new Date()
  const duration = call?.started_at
    ? Math.round((now - new Date(call.started_at)) / 1000)
    : 0

  await supabase
    .from('video_calls')
    .update({
      status: 'ended',
      ended_at: now.toISOString(),
      duration_seconds: duration,
    })
    .eq('id', callId)

  // Mark all participants as left
  await supabase
    .from('video_call_participants')
    .update({ left_at: now.toISOString() })
    .eq('call_id', callId)
    .is('left_at', null)
}

export async function declineCall(callId, userId) {
  await supabase
    .from('video_call_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('call_id', callId)
    .eq('user_id', userId)

  // Check remaining participants
  const { data: remaining } = await supabase
    .from('video_call_participants')
    .select('id')
    .eq('call_id', callId)
    .is('left_at', null)

  if (!remaining || remaining.length <= 1) {
    await supabase
      .from('video_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', callId)
  }
}

export async function updateMediaState(callId, userId, { isAudioOn, isVideoOn, isScreenSharing }) {
  const updates = {}
  if (isAudioOn !== undefined) updates.is_audio_on = isAudioOn
  if (isVideoOn !== undefined) updates.is_video_on = isVideoOn
  if (isScreenSharing !== undefined) updates.is_screen_sharing = isScreenSharing

  await supabase
    .from('video_call_participants')
    .update(updates)
    .eq('call_id', callId)
    .eq('user_id', userId)
}

export async function raiseHand(callId, userId, raised) {
  await supabase
    .from('video_call_participants')
    .update({ is_hand_raised: raised })
    .eq('call_id', callId)
    .eq('user_id', userId)
}

// ─── WebRTC Signaling ───────────────────────────────────────

export async function sendSignal(callId, fromUser, toUser, signalType, payload) {
  const { error } = await supabase
    .from('video_signals')
    .insert({
      call_id: callId,
      from_user: fromUser,
      to_user: toUser,
      signal_type: signalType,
      payload,
    })

  if (error) throw error
}

export function subscribeToSignals(callId, userId, onSignal) {
  const channel = supabase
    .channel(`signals:${callId}:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'video_signals',
      filter: `to_user=eq.${userId}`
    }, (payload) => {
      if (payload.new.call_id === callId) {
        onSignal(payload.new)
      }
    })
    .subscribe()

  return channel
}

export function subscribeToCallParticipants(callId, onParticipantChange) {
  const channel = supabase
    .channel(`call-participants:${callId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'video_call_participants',
      filter: `call_id=eq.${callId}`
    }, (payload) => {
      onParticipantChange(payload)
    })
    .subscribe()

  return channel
}

export function subscribeToCallStatus(callId, onStatusChange) {
  const channel = supabase
    .channel(`call-status:${callId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'video_calls',
      filter: `id=eq.${callId}`
    }, (payload) => {
      onStatusChange(payload.new)
    })
    .subscribe()

  return channel
}

// ─── Call History ────────────────────────────────────────────

export async function getCallHistory(limit = 20) {
  const { data, error } = await supabase
    .from('video_calls')
    .select('*, video_call_participants(user_id, display_name, joined_at, left_at)')
    .eq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// ─── Rally Links ────────────────────────────────────────────

export async function createRallyLink({ label, linkType = 'one_time', maxGuests = 1, expiresAt }, userId) {
  const { data, error } = await supabase
    .from('rally_links')
    .insert({
      created_by: userId,
      label,
      link_type: linkType,
      max_guests: maxGuests,
      expires_at: expiresAt || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getRallyLinks(userId) {
  const { data, error } = await supabase
    .from('rally_links')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function revokeRallyLink(linkId) {
  const { error } = await supabase
    .from('rally_links')
    .update({ is_active: false })
    .eq('id', linkId)

  if (error) throw error
}

export async function getRallyLinkByCode(code) {
  const { data, error } = await supabase
    .from('rally_links')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (error) throw error
  return data
}

export async function useRallyLink(linkId) {
  // Increment use count and update last_used_at
  const { data: link } = await supabase
    .from('rally_links')
    .select('use_count, max_guests, link_type')
    .eq('id', linkId)
    .single()

  if (!link) throw new Error('Link not found')

  const newCount = (link.use_count || 0) + 1
  const updates = {
    use_count: newCount,
    last_used_at: new Date().toISOString(),
  }

  // Deactivate one-time links after use
  if (link.link_type === 'one_time' && newCount >= (link.max_guests || 1)) {
    updates.is_active = false
  }

  await supabase
    .from('rally_links')
    .update(updates)
    .eq('id', linkId)
}
