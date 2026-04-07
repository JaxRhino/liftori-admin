import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchConversations, fetchMessages, sendMessage, createConversation,
  updateConversation, deleteConversation, markConversationRead,
  fetchTemplates, fetchCommsStats, subscribeToConversation, unsubscribeFromConversation,
} from '../../lib/commsService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  MessageSquare, Search, Plus, Send, Inbox, Clock, CheckCircle,
  MoreVertical, Trash2, MessageCircle, RefreshCw, Loader,
} from 'lucide-react';
import { toast } from 'sonner';

const BUCKETS = [
  { value: 'all', label: 'All' },
  { value: 'lead_intake', label: 'Lead Intake' },
  { value: 'production', label: 'Production' },
  { value: 'service', label: 'Service' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'general', label: 'General' },
];

const BUCKET_COLORS = {
  lead_intake: 'bg-blue-500',
  production: 'bg-orange-500',
  service: 'bg-purple-500',
  marketing: 'bg-green-500',
  general: 'bg-gray-500',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function Communications() {
  const { user } = useAuth();

  // List state
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Thread state
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const realtimeChannelRef = useRef(null);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({
    customer_name: '', customer_phone: '', bucket: 'lead_intake',
  });

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load conversations + stats
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const [convsRes, statsRes] = await Promise.all([
        fetchConversations({ bucket, status: statusFilter, search }),
        fetchCommsStats(),
      ]);
      setConversations(convsRes.data || []);
      setStats(statsRes);
    } catch (e) {
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [bucket, statusFilter, search]);

  useEffect(() => { loadConversations(); }, [bucket, statusFilter]);

  // Select conversation → load messages + subscribe to real-time
  const selectConversation = useCallback(async (conv) => {
    if (selectedConv?.id === conv.id) return;

    // Unsubscribe from previous
    if (realtimeChannelRef.current) {
      unsubscribeFromConversation(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    setSelectedConv(conv);
    setMessages([]);
    setMessagesLoading(true);
    try {
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);
      // Mark read
      await markConversationRead(conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch (e) {
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }

    // Subscribe to real-time messages
    realtimeChannelRef.current = subscribeToConversation(conv.id, (newMsg) => {
      setMessages(prev => [...prev, newMsg]);
    });
  }, [selectedConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        unsubscribeFromConversation(realtimeChannelRef.current);
      }
    };
  }, []);

  async function handleSend() {
    if (!reply.trim() || !selectedConv) return;
    setSending(true);
    try {
      await sendMessage(selectedConv.id, { body: reply, channel: 'internal' });
      setReply('');
      const msgs = await fetchMessages(selectedConv.id);
      setMessages(msgs);
    } catch (e) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function handleCreateConversation() {
    if (!composeForm.customer_name) {
      toast.error('Customer name is required');
      return;
    }
    try {
      const conv = await createConversation({
        customer_name: composeForm.customer_name,
        customer_phone: composeForm.customer_phone,
        bucket: composeForm.bucket,
        status: 'open',
        channel: 'sms',
      });
      toast.success('Conversation created');
      setComposeOpen(false);
      setComposeForm({ customer_name: '', customer_phone: '', bucket: 'lead_intake' });
      await loadConversations();
      selectConversation(conv);
    } catch (e) {
      toast.error('Failed to create conversation');
    }
  }

  async function handleDelete(convId) {
    try {
      await deleteConversation(convId);
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setMessages([]);
      }
      setConversations(prev => prev.filter(c => c.id !== convId));
      toast.success('Conversation deleted');
      setDeleteConfirm(null);
    } catch (e) {
      toast.error('Failed to delete conversation');
    }
  }

  async function handleStatusChange(convId, status) {
    try {
      await updateConversation(convId, { status });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, status } : c));
      if (selectedConv?.id === convId) setSelectedConv(prev => ({ ...prev, status }));
    } catch (e) {
      toast.error('Failed to update status');
    }
  }

  const filteredConvs = conversations.filter(c => {
    if (!search) return true;
    return c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-navy-950 p-0">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-brand-blue" />
            <h1 className="text-xl font-bold text-white">Communications Hub</h1>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="flex gap-2">
                <Badge className="bg-navy-700 text-gray-300 gap-1"><Inbox className="w-3 h-3" />{stats.open} Open</Badge>
                {stats.unread > 0 && <Badge className="bg-red-500 text-white">{stats.unread} Unread</Badge>}
              </div>
            )}
            <Button onClick={() => setComposeOpen(true)} className="bg-brand-blue hover:bg-blue-600 text-white gap-2 text-sm">
              <Plus className="w-4 h-4" /> New Conversation
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel — Conversation List */}
          <div className="w-80 border-r border-navy-700 flex flex-col bg-navy-900">
            {/* Search + Filters */}
            <div className="p-3 space-y-2 border-b border-navy-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadConversations()}
                  placeholder="Search..." className="pl-9 bg-navy-800 border-navy-700 text-white text-sm h-8" />
              </div>
              <div className="flex gap-1 flex-wrap">
                {['all', 'open', 'waiting', 'closed'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${statusFilter === s ? 'bg-brand-blue text-white' : 'bg-navy-800 text-gray-400 hover:text-white'}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {BUCKETS.map(b => (
                  <button key={b.value} onClick={() => setBucket(b.value)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${bucket === b.value ? 'bg-navy-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation List */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-8"><Loader className="w-5 h-5 text-brand-blue animate-spin" /></div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">No conversations</div>
              ) : (
                <div className="divide-y divide-navy-700/50">
                  {filteredConvs.map(conv => (
                    <div key={conv.id} onClick={() => selectConversation(conv)}
                      className={`p-3 cursor-pointer hover:bg-navy-800/50 transition-colors ${selectedConv?.id === conv.id ? 'bg-navy-800/70 border-l-2 border-brand-blue' : ''}`}>
                      <div className="flex items-start gap-2">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-navy-700 text-xs text-white">{getInitials(conv.customer_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm font-medium truncate">{conv.customer_name || 'Unknown'}</span>
                            <span className="text-gray-500 text-xs flex-shrink-0">{timeAgo(conv.last_message_at || conv.updated_at)}</span>
                          </div>
                          <p className="text-gray-400 text-xs truncate mt-0.5">{conv.last_message || 'No messages'}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {conv.bucket && <span className={`w-1.5 h-1.5 rounded-full ${BUCKET_COLORS[conv.bucket] || 'bg-gray-500'}`} />}
                            <span className="text-gray-500 text-xs">{conv.bucket?.replace('_', ' ')}</span>
                            {conv.unread_count > 0 && (
                              <Badge className="bg-brand-blue text-white text-xs h-4 px-1 ml-auto">{conv.unread_count}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Panel — Message Thread */}
          <div className="flex-1 flex flex-col bg-navy-950">
            {selectedConv ? (
              <>
                {/* Thread Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-navy-700 bg-navy-900">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-navy-700 text-white text-sm">{getInitials(selectedConv.customer_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{selectedConv.customer_name}</h3>
                      <div className="flex items-center gap-2">
                        {selectedConv.customer_phone && <span className="text-xs text-gray-400">{selectedConv.customer_phone}</span>}
                        <Badge className={`${BUCKET_COLORS[selectedConv.bucket] || 'bg-gray-500'} text-white text-xs`}>
                          {selectedConv.bucket?.replace('_', ' ')}
                        </Badge>
                        <Badge className={`text-xs ${selectedConv.status === 'open' ? 'bg-green-600' : selectedConv.status === 'waiting' ? 'bg-yellow-600' : 'bg-gray-600'} text-white`}>
                          {selectedConv.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConv.status !== 'closed' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedConv.id, 'closed')}
                        className="border-navy-600 text-gray-300 hover:text-white text-xs gap-1">
                        <CheckCircle className="w-3 h-3" /> Close
                      </Button>
                    )}
                    {selectedConv.status === 'closed' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(selectedConv.id, 'open')}
                        className="border-navy-600 text-gray-300 hover:text-white text-xs">
                        Reopen
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-navy-800 border-navy-700">
                        <DropdownMenuItem onClick={() => setDeleteConfirm(selectedConv.id)} className="text-red-400 focus:text-red-400 cursor-pointer">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Conversation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-5">
                  {messagesLoading ? (
                    <div className="flex justify-center py-8"><Loader className="w-5 h-5 text-brand-blue animate-spin" /></div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No messages yet. Start the conversation.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                            msg.direction === 'outbound'
                              ? 'bg-brand-blue text-white rounded-br-sm'
                              : 'bg-navy-800 text-white rounded-bl-sm'
                          }`}>
                            <p className="text-sm leading-relaxed">{msg.body}</p>
                            <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-blue-200' : 'text-gray-500'}`}>
                              {new Date(msg.sent_at || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Compose */}
                <div className="p-4 border-t border-navy-700 bg-navy-900">
                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                      placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                      className="flex-1 bg-navy-800 border-navy-700 text-white resize-none text-sm min-h-[60px] max-h-32"
                      rows={2}
                    />
                    <Button onClick={handleSend} disabled={!reply.trim() || sending}
                      className="bg-brand-blue hover:bg-blue-600 text-white self-end px-4">
                      {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-gray-400 font-medium">Select a conversation</h3>
                  <p className="text-gray-600 text-sm mt-1">or create a new one to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>New Conversation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Customer Name *</label>
              <Input value={composeForm.customer_name} onChange={e => setComposeForm({ ...composeForm, customer_name: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
              <Input value={composeForm.customer_phone} onChange={e => setComposeForm({ ...composeForm, customer_phone: e.target.value })}
                className="bg-navy-800 border-navy-700 text-white" placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Bucket</label>
              <select value={composeForm.bucket} onChange={e => setComposeForm({ ...composeForm, bucket: e.target.value })}
                className="w-full bg-navy-800 border border-navy-700 rounded text-white text-sm px-3 py-2">
                {BUCKETS.filter(b => b.value !== 'all').map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={handleCreateConversation} className="bg-brand-blue hover:bg-blue-600 text-white">Create Conversation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-navy-900 border-navy-700 text-white">
          <DialogHeader><DialogTitle>Delete Conversation</DialogTitle></DialogHeader>
          <p className="text-gray-400">This will permanently delete this conversation and all its messages.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-navy-700 text-white hover:bg-navy-800">Cancel</Button>
            <Button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-700 text-white">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
