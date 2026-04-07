// =============================================================
// Communications Service Layer — Supabase backend
// Unified inbox for all customer conversations
// =============================================================
import { supabase } from './supabase';

function handleError(error, context) {
  console.error(`[Comms] ${context}:`, error);
  throw error;
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

// ── STATS ─────────────────────────────────────────────────────
export async function fetchCommsStats() {
  const today = new Date().toISOString().split('T')[0];
  const [convsRes, unreadRes, todayMsgsRes] = await Promise.all([
    supabase.from('comms_conversations').select('status'),
    supabase.from('comms_conversations').select('unread_count').gt('unread_count', 0),
    supabase.from('comms_messages').select('id').gte('created_at', `${today}T00:00:00`),
  ]);

  const convs = convsRes.data || [];
  const totalUnread = (unreadRes.data || []).reduce((s, c) => s + (c.unread_count || 0), 0);

  return {
    total: convs.length,
    open: convs.filter(c => c.status === 'open').length,
    waiting: convs.filter(c => c.status === 'waiting').length,
    closed: convs.filter(c => c.status === 'closed').length,
    unread: totalUnread,
    messages_today: (todayMsgsRes.data || []).length,
  };
}

// ── CONVERSATIONS ─────────────────────────────────────────────
export async function fetchConversations({ status, bucket, channel, search, limit = 50, offset = 0 } = {}) {
  let q = supabase.from('comms_conversations')
    .select('*', { count: 'exact' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') q = q.eq('status', status);
  if (bucket && bucket !== 'all') q = q.eq('bucket', bucket);
  if (channel && channel !== 'all') q = q.eq('channel_type', channel);
  if (search) q = q.or(`customer_name.ilike.%${search}%,subject.ilike.%${search}%,last_message_preview.ilike.%${search}%`);

  const { data, error, count } = await q;
  if (error) handleError(error, 'fetchConversations');
  return { data: data || [], count: count || 0 };
}

export async function fetchConversation(id) {
  const { data, error } = await supabase.from('comms_conversations')
    .select('*').eq('id', id).single();
  if (error) handleError(error, 'fetchConversation');
  return data;
}

export async function createConversation(conversation) {
  const { data, error } = await supabase.from('comms_conversations')
    .insert(conversation).select().single();
  if (error) handleError(error, 'createConversation');
  return data;
}

export async function updateConversation(id, updates) {
  const { data, error } = await supabase.from('comms_conversations')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateConversation');
  return data;
}

export async function closeConversation(id) {
  return updateConversation(id, { status: 'closed' });
}

export async function reopenConversation(id) {
  return updateConversation(id, { status: 'open' });
}

export async function markConversationRead(id) {
  return updateConversation(id, { unread_count: 0 });
}

export async function deleteConversation(id) {
  const { error } = await supabase.from('comms_conversations').delete().eq('id', id);
  if (error) handleError(error, 'deleteConversation');
}

// ── MESSAGES ──────────────────────────────────────────────────
export async function fetchMessages(conversationId) {
  const { data, error } = await supabase.from('comms_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) handleError(error, 'fetchMessages');

  // Mark all unread as read
  const unread = (data || []).filter(m => !m.read_at && m.direction === 'inbound');
  if (unread.length > 0) {
    const now = new Date().toISOString();
    await supabase.from('comms_messages')
      .update({ read_at: now })
      .in('id', unread.map(m => m.id));
    await supabase.from('comms_conversations')
      .update({ unread_count: 0, updated_at: now })
      .eq('id', conversationId);
  }

  return data || [];
}

export async function sendMessage(conversationId, { body, channel = 'internal', direction = 'outbound', metadata = {} }) {
  const userId = await currentUserId();
  const { data: profile } = await supabase.from('profiles')
    .select('full_name').eq('id', userId).single();

  const { data, error } = await supabase.from('comms_messages').insert({
    conversation_id: conversationId,
    direction,
    channel,
    body,
    sender_id: userId,
    sender_name: profile?.full_name || 'Staff',
    metadata,
  }).select().single();
  if (error) handleError(error, 'sendMessage');

  // Update conversation last message
  await supabase.from('comms_conversations').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: body.substring(0, 100),
    status: 'open',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId);

  return data;
}

export async function deleteMessage(id) {
  const { error } = await supabase.from('comms_messages').delete().eq('id', id);
  if (error) handleError(error, 'deleteMessage');
}

// ── TEMPLATES ─────────────────────────────────────────────────
export async function fetchTemplates(channelType) {
  let q = supabase.from('comms_templates').select('*').eq('is_active', true).order('name');
  if (channelType) q = q.eq('channel_type', channelType);
  const { data, error } = await q;
  if (error) handleError(error, 'fetchTemplates');
  return data || [];
}

export async function createTemplate(template) {
  const userId = await currentUserId();
  const { data, error } = await supabase.from('comms_templates')
    .insert({ ...template, created_by: userId }).select().single();
  if (error) handleError(error, 'createTemplate');
  return data;
}

export async function updateTemplate(id, updates) {
  const { data, error } = await supabase.from('comms_templates')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateTemplate');
  return data;
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('comms_templates').delete().eq('id', id);
  if (error) handleError(error, 'deleteTemplate');
}

// ── CHANNELS ──────────────────────────────────────────────────
export async function fetchChannels() {
  const { data, error } = await supabase.from('comms_channels')
    .select('*').order('name');
  if (error) handleError(error, 'fetchChannels');
  return data || [];
}

export async function createChannel(channel) {
  const { data, error } = await supabase.from('comms_channels')
    .insert(channel).select().single();
  if (error) handleError(error, 'createChannel');
  return data;
}

export async function updateChannel(id, updates) {
  const { data, error } = await supabase.from('comms_channels')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateChannel');
  return data;
}

export async function deleteChannel(id) {
  const { error } = await supabase.from('comms_channels').delete().eq('id', id);
  if (error) handleError(error, 'deleteChannel');
}

// ── AUTOMATIONS ───────────────────────────────────────────────
export async function fetchAutomations() {
  const { data, error } = await supabase.from('comms_automations')
    .select('*, template:comms_templates(name)').order('name');
  if (error) handleError(error, 'fetchAutomations');
  return data || [];
}

export async function createAutomation(automation) {
  const { data, error } = await supabase.from('comms_automations')
    .insert(automation).select().single();
  if (error) handleError(error, 'createAutomation');
  return data;
}

export async function updateAutomation(id, updates) {
  const { data, error } = await supabase.from('comms_automations')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) handleError(error, 'updateAutomation');
  return data;
}

export async function deleteAutomation(id) {
  const { error } = await supabase.from('comms_automations').delete().eq('id', id);
  if (error) handleError(error, 'deleteAutomation');
}

export async function toggleAutomation(id, isActive) {
  const { data, error } = await supabase.from('comms_automations')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) handleError(error, 'toggleAutomation');
  return data;
}

// ── USERS (for assignment) ────────────────────────────────────
export async function fetchCommsUsers() {
  const { data, error } = await supabase.from('profiles')
    .select('id, full_name, avatar_url, email').order('full_name');
  if (error) handleError(error, 'fetchCommsUsers');
  return data || [];
}

export async function starConversation(id, isStarred) {
  return updateConversation(id, { is_starred: isStarred });
}

export async function assignConversation(id, assignedTo) {
  return updateConversation(id, { assigned_to: assignedTo });
}

// ── REAL-TIME SUBSCRIPTION ────────────────────────────────────
export function subscribeToConversation(conversationId, onMessage) {
  return supabase
    .channel(`comms:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comms_messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => onMessage(payload.new))
    .subscribe();
}

export function unsubscribeFromConversation(channel) {
  if (channel) supabase.removeChannel(channel);
}
