/**
 * startOrJoinDmCall — unified semantics for "click video in a DM."
 *
 * Old behavior (broken): DMPopout.handleVideoCall always called
 *   videoCall.startCall([otherUserId], channelId, 'video')
 * — which spawned a NEW call every tap, even when the other party was
 * already ringing us. Result: both users sit in separate rooms listening
 * to rings that never resolve.
 *
 * New behavior: look up the channel's active video_calls row first.
 *   - If one exists (status in 'ringing' | 'active') → join it
 *   - Otherwise → start a fresh one
 *
 * The actual start/join is delegated to the VideoCallContext hooks, which
 * already handle signaling/stream management. This helper is a pure DB
 * lookup + decision.
 */

import { supabase } from './supabase';

/**
 * Look up an active (ringing or live) video call in a given channel.
 * Returns the row (id, call_type, started_by, created_at) or null.
 */
export async function lookupActiveCallInChannel(channelId) {
  if (!channelId) return null;
  const { data, error } = await supabase
    .from('video_calls')
    .select('id, call_type, started_by, created_at, status')
    .eq('channel_id', channelId)
    .in('status', ['ringing', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    // 42P01 = relation does not exist; tolerate for repos without video_calls yet
    if (error.code === '42P01') return null;
    console.error('[startOrJoinDmCall] lookup failed:', error);
    return null;
  }
  return data || null;
}

/**
 * Decide whether to join an existing call or start a new one.
 *
 * Usage:
 *   const result = await decideStartOrJoin(channelId);
 *   if (result.mode === 'join') await videoCall.joinCall(result.callId);
 *   else await videoCall.startCall([otherUserId], channelId, 'video');
 *
 * Keeping the decision pure (no context refs) so this can be unit-tested
 * and reused by both DMPopout and the mobile client.
 */
export async function decideStartOrJoin(channelId) {
  const active = await lookupActiveCallInChannel(channelId);
  if (active) {
    return { mode: 'join', callId: active.id, callType: active.call_type };
  }
  return { mode: 'start', callId: null, callType: null };
}
