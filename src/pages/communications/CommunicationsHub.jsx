import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchConversations, fetchMessages, sendMessage, createConversation,
  updateConversation, markConversationRead, fetchCommsUsers,
  starConversation, assignConversation, deleteConversation,
} from '../../lib/commsService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Search, Send, Plus, Star, MessageCircle, Mail, Phone,
  Share2, Globe, MessageSquare, Trash2, Clock, Bot,
  ChevronDown, Check, AlertCircle,
} from 'lucide-react';

const CHANNELS = [
  { id: 'all', label: 'All', icon: MessageCircle },
  { id: 'internal', label: 'Internal', icon: Bot },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'facebook', label: 'Facebook', icon: Share2 },
  { id: 'instagram', label: 'Instagram', icon: Globe },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

const STATUS_OPTIONS = ['open', 'assigned', 'pending', 'resolved', 'closed'];
const STATUS_COLORS = {
  open: { bg: 'bg-sky-500/20', text: 'text-sky-400', label: 'Open' },
  assigned: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Assigned' },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
  resolved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Resolved' },
  closed: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Closed' },
};

export default function CommunicationsHub() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [internalAddresses, setInternalAddresses] = useState([]);
  const [internalChannelId, setInternalChannelId] = useState(null);

  // Filters
  const [filterTab, setFilterTab] = useState('all'); // all, unread, starred, assigned
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showCompose, setShowCompose] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [composing, setComposing] = useState({
    contact_name: '',
    contact_email: '',
    channel_type: 'email',
    body: '',
  });

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchData() {
    try {
      setLoading(true);
      const [convResult, usersData] = await Promise.all([
        fetchConversations({ limit: 100 }),
        fetchCommsUsers(),
      ]);
      setConversations(convResult.data || []);
      setUsers(usersData);
      // Load internal addresses + channel id for agent picker
      try {
        const { supabase } = await import('../../lib/supabase');
        const [addrRes, chanRes] = await Promise.all([
          supabase.from('internal_email_addresses').select('id, address, display_name, participant_type, agent_id').eq('active', true).order('participant_type').order('address'),
          supabase.from('comms_channels').select('id').eq('channel_type', 'internal').maybeSingle()
        ]);
        setInternalAddresses(addrRes.data || []);
        setInternalChannelId(chanRes.data?.id || null);
      } catch (ie) { console.warn('[Comms Hub] internal addresses load failed:', ie); }
      if ((convResult.data || []).length > 0) {
        selectConversation(convResult.data[0]);
      }
    } catch (err) {
      console.error('[Comms Hub] Fetch error:', err);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }

  async function selectConversation(conv) {
    setSelectedConv(conv);
    try {
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);
      await markConversationRead(conv.id);
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    } catch (err) {
      console.error('[Comms] Message fetch error:', err);
      toast.error('Failed to load messages');
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedConv) return;
    try {
      setSending(true);
      const msg = await sendMessage(selectedConv.id, { body: newMessage });
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
      toast.success('Message sent');
    } catch (err) {
      console.error('[Comms] Send error:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleCreateConversation() {
    if (!composing.contact_name.trim() || !composing.contact_email.trim()) {
      toast.error('Name and email required');
      return;
    }
    try {
      const convPayload = {
        contact_name: composing.contact_name,
        contact_email: composing.contact_email,
        channel_type: composing.channel_type,
        status: 'open',
        unread_count: 0,
        last_message_at: new Date().toISOString(),
      };
      if (composing.channel_type === 'internal' && internalChannelId) {
        convPayload.channel_id = internalChannelId;
      }
      const conv = await createConversation(convPayload);

      if (composing.body.trim()) {
        await sendMessage(conv.id, { body: composing.body });
      }

      setConversations(prev => [conv, ...prev]);
      setShowCompose(false);
      setComposing({ contact_name: '', contact_email: '', channel_type: 'email', body: '' });
      toast.success('Conversation created');
      selectConversation(conv);
    } catch (err) {
      console.error('[Comms] Create conv error:', err);
      toast.error('Failed to create conversation');
    }
  }

  async function handleToggleStar() {
    if (!selectedConv) return;
    try {
      const updated = await starConversation(selectedConv.id, !selectedConv.is_starred);
      setSelectedConv(updated);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? updated : c));
      toast.success(updated.is_starred ? 'Added to starred' : 'Removed from starred');
    } catch (err) {
      console.error('[Comms] Star error:', err);
      toast.error('Failed to update star');
    }
  }

  async function handleAssign(userId, userName) {
    if (!selectedConv) return;
    try {
      const updated = await assignConversation(selectedConv.id, userId);
      setSelectedConv(updated);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? updated : c));
      setShowAssign(false);
      toast.success(`Assigned to ${userName}`);
    } catch (err) {
      console.error('[Comms] Assign error:', err);
      toast.error('Failed to assign');
    }
  }

  async function handleStatusChange(status) {
    if (!selectedConv) return;
    try {
      const updated = await updateConversation(selectedConv.id, { status });
      setSelectedConv(updated);
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? updated : c));
      setShowStatusChange(false);
      toast.success(`Status changed to ${status}`);
    } catch (err) {
      console.error('[Comms] Status error:', err);
      toast.error('Failed to change status');
    }
  }

  async function handleDelete() {
    if (!selectedConv) return;
    try {
      await deleteConversation(selectedConv.id);
      setConversations(prev => prev.filter(c => c.id !== selectedConv.id));
      setSelectedConv(null);
      setMessages([]);
      setShowDeleteConfirm(false);
      toast.success('Conversation deleted');
    } catch (err) {
      console.error('[Comms] Delete error:', err);
      toast.error('Failed to delete conversation');
    }
  }

  // Apply filters
  let filtered = conversations;

  if (filterTab === 'unread') {
    filtered = filtered.filter(c => (c.unread_count || 0) > 0);
  } else if (filterTab === 'starred') {
    filtered = filtered.filter(c => c.is_starred);
  } else if (filterTab === 'assigned') {
    filtered = filtered.filter(c => c.assigned_to === user.id);
  }

  if (filterChannel !== 'all') {
    filtered = filtered.filter(c => c.channel_type === filterChannel);
  }

  if (filterStatus !== 'all') {
    filtered = filtered.filter(c => c.status === filterStatus);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      c.contact_name?.toLowerCase().includes(q) ||
      c.contact_email?.toLowerCase().includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-sky-500" />
          <p className="mt-4 text-gray-400">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900">
      {/* LEFT PANEL - Conversation List */}
      <div className="w-80 flex-shrink-0 border-r border-slate-700 bg-slate-800/50 flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-700 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Inbox</h1>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowCompose(true)}
              className="hover:bg-sky-500/20"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-700/50 border-slate-600 pl-9 text-white placeholder-gray-500"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-slate-700 px-4 py-3">
          <div className="mb-3 flex gap-2">
            {['all', 'unread', 'starred', 'assigned'].map(tab => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  filterTab === tab
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'unread' ? 'Unread' : tab === 'starred' ? 'Starred' : 'Assigned'}
              </button>
            ))}
          </div>

          {/* Channel Filter */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-400">Channel</label>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-sm text-white"
            >
              <option value="all">All channels</option>
              <option value="internal">Internal (Agents)</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-400">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-sm text-white"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_COLORS[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="h-8 w-8 text-gray-600 mb-2" />
              <p className="text-gray-400 text-sm">
                {conversations.length === 0
                  ? 'No conversations yet'
                  : 'No conversations match your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedConv?.id === conv.id
                      ? 'border-sky-500/30 bg-sky-500/10'
                      : 'border-slate-700 bg-slate-700/20 hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white truncate">{conv.contact_name}</h3>
                        {(conv.unread_count || 0) > 0 && (
                          <span className="rounded-full bg-sky-500 px-2 py-0.5 text-xs font-bold text-white">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{conv.contact_email}</p>
                    </div>
                    {conv.is_starred && (
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    )}
                  </div>

                  <p className="mb-2 truncate text-sm text-gray-400">
                    {conv.last_message_preview || 'No messages'}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-600/50 px-2 py-0.5 text-xs text-gray-300">
                      {conv.channel_type === 'email' && <Mail className="h-3 w-3" />}
                      {conv.channel_type === 'sms' && <Phone className="h-3 w-3" />}
                      {conv.channel_type === 'facebook' && <Share2 className="h-3 w-3" />}
                      {conv.channel_type === 'instagram' && <Globe className="h-3 w-3" />}
                      {conv.channel_type === 'internal' && <Bot className="h-3 w-3" />}
                      <span className="capitalize">{conv.channel_type}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : 'Just now'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CENTER PANEL - Message Thread */}
      <div className="flex-1 flex flex-col bg-slate-900">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="border-b border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">{selectedConv.contact_name}</h2>
                  <p className="text-sm text-gray-400">{selectedConv.contact_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`${STATUS_COLORS[selectedConv.status].bg} ${STATUS_COLORS[selectedConv.status].text}`}
                  >
                    {STATUS_COLORS[selectedConv.status].label}
                  </Badge>
                  <Badge className="bg-slate-700 text-gray-300">
                    {selectedConv.channel_type}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleStar}
                  className={selectedConv.is_starred ? 'border-yellow-500/30 bg-yellow-500/10' : ''}
                >
                  <Star
                    className={`h-4 w-4 ${selectedConv.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`}
                  />
                </Button>

                <Button size="sm" variant="outline" onClick={() => setShowStatusChange(true)}>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Status
                </Button>

                <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}>
                  <User className="h-4 w-4 mr-1" />
                  Assign
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-400 hover:bg-red-500/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="h-8 w-8 text-gray-600 mb-2" />
                  <p className="text-gray-400">No messages yet</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs rounded-lg px-4 py-3 ${
                        msg.direction === 'outbound'
                          ? 'bg-sky-500/20 text-white border border-sky-500/30'
                          : 'bg-slate-700 text-gray-100 border border-slate-600'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1.5">
                        <span>{msg.sender_name || 'Unknown'}</span>
                        {msg.sender_type === 'agent' && <span className="text-[9px] px-1 rounded bg-purple-900/40 text-purple-300 border border-purple-800/40 uppercase tracking-wider">AI</span>}
                      </p>
                      <p className="text-sm">{msg.body}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t border-slate-700 bg-slate-800/50 p-4">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey && !sending) {
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message... (Ctrl+Enter to send)"
                  className="flex-1 min-h-20 bg-slate-700/50 border-slate-600 text-white placeholder-gray-500 resize-none"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="self-end"
                >
                  {sending ? 'Sending...' : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <MessageCircle className="h-12 w-12 text-gray-600 mb-4" />
            <p className="text-gray-400">Select a conversation to start messaging</p>
          </div>
        )}
      </div>

      {/* Dialogs */}

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-400">Contact Name</label>
              <Input
                value={composing.contact_name}
                onChange={(e) => setComposing({ ...composing, contact_name: e.target.value })}
                placeholder="e.g., John Doe"
                className="mt-1 bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-400">{composing.channel_type === 'internal' ? 'Recipient (Agent or Person)' : 'Email'}</label>
              {composing.channel_type === 'internal' ? (
                <select
                  value={composing.contact_email}
                  onChange={(e) => {
                    const addr = internalAddresses.find(a => a.address === e.target.value);
                    setComposing({ ...composing, contact_email: e.target.value, contact_name: addr?.display_name || '' });
                  }}
                  className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
                >
                  <option value="">-- pick a recipient --</option>
                  <optgroup label="AI Agents">
                    {internalAddresses.filter(a => a.participant_type === 'agent').map(a => (
                      <option key={a.id} value={a.address}>{a.display_name} (@{a.address})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Humans">
                    {internalAddresses.filter(a => a.participant_type === 'human').map(a => (
                      <option key={a.id} value={a.address}>{a.display_name} (@{a.address})</option>
                    ))}
                  </optgroup>
                </select>
              ) : (
                <Input
                  value={composing.contact_email}
                  onChange={(e) => setComposing({ ...composing, contact_email: e.target.value })}
                  placeholder="john@example.com"
                  type="email"
                  className="mt-1 bg-slate-700/50 border-slate-600 text-white"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-400">Channel</label>
              <select
                value={composing.channel_type}
                onChange={(e) => setComposing({ ...composing, channel_type: e.target.value })}
                className="mt-1 w-full rounded bg-slate-700/50 border border-slate-600 px-3 py-2 text-white"
              >
                <option value="email">Email</option>
                <option value="internal">Internal (to Agent)</option>
                <option value="sms">SMS</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-400">Message (Optional)</label>
              <Textarea
                value={composing.body}
                onChange={(e) => setComposing({ ...composing, body: e.target.value })}
                placeholder="Type your opening message..."
                className="mt-1 bg-slate-700/50 border-slate-600 text-white resize-none"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConversation}>Create Conversation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Assign to Team Member</DialogTitle>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => handleAssign(u.id, u.full_name)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700/20 p-3 text-left hover:bg-slate-700/40 transition-colors"
              >
                <p className="font-semibold text-white">{u.full_name}</p>
                <p className="text-sm text-gray-400">{u.email}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusChange} onOpenChange={setShowStatusChange}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Change Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {STATUS_OPTIONS.map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`w-full rounded-lg border p-3 text-left font-semibold transition-colors ${
                  STATUS_COLORS[status].bg
                } ${STATUS_COLORS[status].text}`}
              >
                {STATUS_COLORS[status].label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Delete Conversation?
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400">
            This will permanently delete the conversation with {selectedConv?.contact_name} and all
            messages. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper icon component
function User(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
