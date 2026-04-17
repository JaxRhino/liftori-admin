import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { useWS } from '../contexts/WebSocketContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import MessageActions from '../components/chat/MessageActions';
import EmojiPicker from '../components/chat/EmojiPicker';
import ThreadPanel from '../components/chat/ThreadPanel';
import DateDivider from '../components/chat/DateDivider';
import ChannelSettings from '../components/chat/ChannelSettings';
import UserStatusSelector from '../components/chat/UserStatusSelector';
import NotificationSettings from '../components/chat/NotificationSettings';
import PresenceIndicator from '../components/chat/PresenceIndicator';
import { usePresence } from '../hooks/usePresence';
import AdminPanel from '../components/chat/AdminPanel';
import AdvancedSearch from '../components/chat/AdvancedSearch';
import SavedMessages from '../components/chat/SavedMessages';
import { AnnouncementBanner, AnnouncementMessage, CreateAnnouncementDialog } from '../components/chat/Announcements';
import { VoiceCallDialog, VideoCallDialog, HuddleDialog, QuickCallButtons } from '../components/chat/VoiceVideoHuddle';
import { QuickCallButtons as VideoQuickCallButtons, PreCallSettings } from '../components/chat/VideoCallWindow';
import { RallyButton } from '../components/chat/RallyVideoCall';
import { useVideoCallContext } from '../contexts/VideoCallContext';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import UserAvatar from '../components/UserAvatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Hash, 
  Plus, 
  Search, 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical,
  Users,
  Pin,
  FileText,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  X,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Eye,
  Settings,
  Bell,
  Star,
  Archive,
  Shield,
  Bookmark,
  Megaphone,
  Filter,
  Phone,
  Video,
  Briefcase,
  User,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import * as chatSvc from '../lib/chatService';

export const Chat = () => {
  const { user, profile, token } = useAuth();
  const { sidebarOpen } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const onlineUsers = usePresence();
  
  // Check if user is viewing as another user (impersonation mode)
  const isImpersonating = localStorage.getItem('is_impersonating') === 'true';
  const ws = useWS();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingChannelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const previousChannelRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Track if we've handled the channel param from URL
  const channelParamHandledRef = useRef(false);
  // Ref to track selected channel in global subscription closure
  const selectedChannelIdRef = useRef(null);

  // Thread state
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadParentMessage, setThreadParentMessage] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadReplyText, setThreadReplyText] = useState('');
  const [threadCounts, setThreadCounts] = useState({});
  
  // Phase 1: Edit message state
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');

  // Reactions
  const [messageReactions, setMessageReactions] = useState({});
  const [emojiPickerOpenFor, setEmojiPickerOpenFor] = useState(null);

  // File upload
  const [uploadingFile, setUploadingFile] = useState(false);

  // Users and DM Dialog (Team)
  const [users, setUsers] = useState([]);
  const [newDMDialogOpen, setNewDMDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Customer DMs
  const [customerUsers, setCustomerUsers] = useState([]);
  const [customerDMs, setCustomerDMs] = useState([]);
  const [newCustomerDMDialogOpen, setNewCustomerDMDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Sidebar section collapse
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [teamDMsOpen, setTeamDMsOpen] = useState(true);
  const [customerDMsOpen, setCustomerDMsOpen] = useState(true);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Mentions
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  // AI Summary
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Read Receipts
  const [readReceiptsDialogOpen, setReadReceiptsDialogOpen] = useState(false);
  const [selectedMessageForReceipts, setSelectedMessageForReceipts] = useState(null);
  const [readReceipts, setReadReceipts] = useState([]);

  // Phase 2: Channel Settings & Preferences
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const [userPreferences, setUserPreferences] = useState({
    starred_channels: [],
    muted_channels: []
  });
  const [userStatus, setUserStatus] = useState(null);
  
  // Phase 3: Advanced Search, Saved Messages, Announcements
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [savedMessagesOpen, setSavedMessagesOpen] = useState(false);
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  
  // Phase 4: Admin Panel
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [chatPermissions, setChatPermissions] = useState(null);

  // Phase 5: Voice, Video, Huddles (Future-ready)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [showPreCallSettings, setShowPreCallSettings] = useState(false);
  const [pendingCallTarget, setPendingCallTarget] = useState(null);
  
  // Phase 5+: WebRTC Video Calls - use global context
  const videoCall = useVideoCallContext();

  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    type: 'public',
    members: []
  });

  useEffect(() => {
    fetchChannels();
    fetchDirectMessages();
    fetchCustomerDMs();
    fetchUsers();
    fetchCustomerUsers();
    fetchUserPreferences();
    fetchUserStatus();
    fetchChatPermissions();
    fetchAnnouncements();

    // Subscribe to channel list changes
    const channelSub = chatSvc.subscribeToChannels(() => {
      fetchChannels();
    });

    // Global message subscription — track unread counts for non-active channels
    const globalMsgSub = supabase
      .channel('global-chat-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        const msg = payload.new;
        if (!msg || msg.sender_id === user?.id || msg.thread_id) return;
        // Skip the currently active channel — user is already viewing it
        if (msg.channel_id === selectedChannelIdRef.current) return;

        // Increment unread on channels list (non-DM)
        setChannels(prev => prev.map(ch =>
          ch.id === msg.channel_id ? { ...ch, unread_count: (ch.unread_count || 0) + 1 } : ch
        ));
        // Increment unread on team DMs
        setDirectMessages(prev => prev.map(dm =>
          dm.id === msg.channel_id ? { ...dm, unread_count: (dm.unread_count || 0) + 1 } : dm
        ));
        // Increment unread on customer DMs
        setCustomerDMs(prev => prev.map(dm =>
          dm.id === msg.channel_id ? { ...dm, unread_count: (dm.unread_count || 0) + 1 } : dm
        ));
      })
      .subscribe();

    return () => {
      chatSvc.unsubscribe(channelSub);
      supabase.removeChannel(globalMsgSub);
    };
  }, []);

  // Supabase Realtime: Subscribe to messages for selected channel
  useEffect(() => {
    if (!selectedChannel) return;

    // Keep ref in sync for global subscription
    selectedChannelIdRef.current = selectedChannel.id;

    fetchMessages(selectedChannel.id);
    fetchThreadCounts();
    setTypingUsers([]); // Clear typing users when switching channels
    markChannelNotificationsRead(selectedChannel.id);

    const msgSub = chatSvc.subscribeToChannel(
      selectedChannel.id,
      // onNewMessage
      (newMsg) => {
        setMessages(prev => {
          // Dedup: already in list by ID
          if (prev.some(m => m.id === newMsg.id)) return prev;
          // Check if this is our own message arriving via realtime — replace the optimistic version
          const pendingIdx = prev.findIndex(m => m.pending && m.sender_id === newMsg.sender_id);
          if (pendingIdx !== -1) {
            const updated = [...prev];
            updated[pendingIdx] = { ...newMsg, reactions: [] };
            return updated;
          }
          return [...prev, { ...newMsg, reactions: [] }];
        });
        // Keep last_read_at current while viewing this channel — prevents unread badges from coming back
        if (newMsg.sender_id !== user?.id) {
          chatSvc.markNotificationsRead(selectedChannel.id, user?.id).catch(() => {});
        }
      },
      // onMessageUpdate
      (updatedMsg) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
      },
      // onMessageDelete
      (deletedId) => {
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      }
    );

    previousChannelRef.current = selectedChannel;

    // Typing indicator via Supabase Realtime broadcast
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
    }
    const typingChannel = supabase.channel(`typing:${selectedChannel.id}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === user.id) return; // ignore own typing
        setTypingUsers(prev => {
          if (payload.is_typing) {
            if (prev.some(u => u.id === payload.user_id)) return prev;
            return [...prev, { id: payload.user_id, name: payload.user_name }];
          } else {
            return prev.filter(u => u.id !== payload.user_id);
          }
        });
        // Auto-clear after 4 seconds in case stop event is missed
        if (payload.is_typing) {
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.id !== payload.user_id));
          }, 4000);
        }
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      chatSvc.unsubscribe(msgSub);
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [selectedChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reactions are now handled via direct Supabase queries (no WebSocket needed)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChannels = async () => {
    try {
      const { channels: allChannels } = await chatSvc.fetchChannels(user?.id);

      // Only set non-DM channels - DMs are fetched separately with more details
      // Force active channel unread to 0 — user is already viewing it
      const activeId = selectedChannelIdRef.current;
      setChannels(allChannels
        .filter(c => c.type !== 'direct')
        .map(c => c.id === activeId ? { ...c, unread_count: 0 } : c)
      );

      // Check for channel param in URL (deep-link from admin widget)
      const channelIdFromUrl = searchParams.get('channel');
      if (channelIdFromUrl && !channelParamHandledRef.current) {
        channelParamHandledRef.current = true;
        const targetChannel = allChannels.find(c => c.id === channelIdFromUrl);
        if (targetChannel) {
          setSelectedChannel(targetChannel);
          setSearchParams({}, { replace: true });
          return;
        }
      }

      // Auto-select first channel if none selected
      if (!selectedChannel && allChannels.length > 0) {
        const nonDmChannel = allChannels.find(c => c.type !== 'direct');
        if (nonDmChannel) {
          setSelectedChannel(nonDmChannel);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (channelId) => {
    try {
      const { messages: msgs } = await chatSvc.fetchMessages(channelId);
      setMessages(msgs);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedChannel) return;

    // Stop typing indicator
    if (isTyping) {
      broadcastTyping(selectedChannel.id, false);
      setIsTyping(false);
    }

    // Optimistic UI update
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      channel_id: selectedChannel.id,
      sender_id: user.id,
      sender_name: (profile?.full_name || user?.email || 'User'),
      sender_role: profile?.role || 'customer',
      sender_title: profile?.title || '',
      content: newMessage,
      attachments: [],
      created_at: new Date().toISOString(),
      pending: true
    };

    const messageContent = newMessage;
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');

    try {
      const savedMsg = await chatSvc.sendMessage(selectedChannel.id, {
        content: optimisticMessage.content,
        attachments: []
      }, user);

      // Replace optimistic message with real one (Realtime may also deliver it — dedup handles that)
      setMessages(prev => prev.map(m =>
        m.id === optimisticMessage.id ? { ...savedMsg, reactions: [] } : m
      ));
    } catch (error) {
      console.error('Error sending message:', error);
      setTimeout(() => {
        setMessages(prev => {
          const stillPending = prev.find(m => m.id === optimisticMessage.id && m.pending);
          if (stillPending) return prev.filter(m => m.id !== optimisticMessage.id);
          return prev;
        });
      }, 2000);
    }
  };

  const broadcastTyping = (channelId, isTypingNow) => {
    if (!typingChannelRef.current) return;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        user_name: profile?.full_name || user?.email || 'User',
        is_typing: isTypingNow,
      }
    });
  };

  const handleTyping = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    // Check for mentions
    handleMentionInput(value);

    if (!selectedChannel) return;

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Send typing start
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      broadcastTyping(selectedChannel.id, true);
    }

    // Set timeout to send typing stop
    const timeout = setTimeout(() => {
      setIsTyping(false);
      broadcastTyping(selectedChannel.id, false);
    }, 3000);

    setTypingTimeout(timeout);
  };

  // Thread functions
  const openThread = async (message) => {
    setThreadParentMessage(message);
    setThreadOpen(true);
    
    try {
      const { replies } = await chatSvc.fetchThread(message.id);
      setThreadMessages(replies);
    } catch (error) {
      console.error('Error fetching thread:', error);
      toast.error('Failed to load thread');
    }
  };

  const closeThread = () => {
    setThreadOpen(false);
    setThreadParentMessage(null);
    setThreadMessages([]);
    setThreadReplyText('');
  };

  const sendThreadReply = async (e) => {
    e.preventDefault();
    
    if (!threadReplyText.trim() || !threadParentMessage) return;

    try {
      const reply = await chatSvc.sendMessage(selectedChannel.id, {
        content: threadReplyText,
        attachments: [],
        thread_id: threadParentMessage.id
      }, user);

      setThreadMessages(prev => [...prev, reply]);
      setThreadReplyText('');

      setThreadCounts(prev => ({
        ...prev,
        [threadParentMessage.id]: (prev[threadParentMessage.id] || 0) + 1
      }));
    } catch (error) {
      console.error('Error sending thread reply:', error);
      toast.error('Failed to send reply');
    }
  };

  const fetchThreadCounts = async () => {
    if (!selectedChannel) return;
    
    try {
      const { thread_counts } = await chatSvc.fetchThreadCounts(selectedChannel.id);
      setThreadCounts(thread_counts);
    } catch (error) {
      console.error('Error fetching thread counts:', error);
    }
  };

  // Reaction functions
  const toggleReaction = async (messageId, emoji) => {
    try {
      const profileName = user?.user_metadata?.full_name || user?.email || '';
      const { reactions } = await chatSvc.toggleReaction(messageId, emoji, user.id, profileName);

      setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
      // Also update inline reactions on messages
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    } catch (error) {
      console.error('Error toggling reaction:', error);
      toast.error('Failed to add reaction');
    }
  };

  // File upload functions
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);

    try {
      const attachment = await chatSvc.uploadFile(file, user.id);

      // Send message with attachment
      await chatSvc.sendMessage(selectedChannel.id, {
        content: `Shared ${attachment.file_type}: ${attachment.filename}`,
        attachments: [attachment]
      }, user);

      toast.success('File uploaded successfully');
      fetchMessages(selectedChannel.id);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Direct Messages functions — Team (admin) DMs
  const fetchDirectMessages = async () => {
    try {
      const { direct_messages } = await chatSvc.fetchDirectMessages(user.id, 'admin');
      // Force active channel unread to 0 — user is already viewing it
      const activeId = selectedChannelIdRef.current;
      setDirectMessages(direct_messages.map(dm => dm.id === activeId ? { ...dm, unread_count: 0 } : dm));
    } catch (error) {
      console.error('Error fetching team DMs:', error);
    }
  };

  // Customer DMs
  const fetchCustomerDMs = async () => {
    try {
      const { direct_messages } = await chatSvc.fetchDirectMessages(user.id, 'customer');
      // Force active channel unread to 0 — user is already viewing it
      const activeId = selectedChannelIdRef.current;
      setCustomerDMs(direct_messages.map(dm => dm.id === activeId ? { ...dm, unread_count: 0 } : dm));
    } catch (error) {
      console.error('Error fetching customer DMs:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { users: allUsers } = await chatSvc.fetchUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchCustomerUsers = async () => {
    try {
      const { users: customers } = await chatSvc.fetchCustomerUsers();
      setCustomerUsers(customers);
    } catch (error) {
      console.error('Error fetching customer users:', error);
    }
  };

  const createOrGetCustomerDM = async (customerId) => {
    try {
      const dmChannel = await chatSvc.createOrGetDM(user.id, customerId);
      setSelectedChannel(dmChannel);
      setNewCustomerDMDialogOpen(false);
      setSelectedCustomerId('');
      fetchCustomerDMs();
    } catch (error) {
      console.error('Error creating customer DM:', error);
      toast.error('Failed to create direct message');
    }
  };

  // Phase 2: Fetch user preferences (starred, muted channels)
  const fetchUserPreferences = async () => {
    try {
      const prefs = await chatSvc.fetchUserPreferences(user.id);
      setUserPreferences(prefs || { starred_channels: [], muted_channels: [] });
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  // Phase 2: Fetch user status/presence
  const fetchUserStatus = async () => {
    try {
      const status = await chatSvc.fetchUserStatus(user?.id);
      setUserStatus(status);
    } catch (error) {
      console.error('Error fetching user status:', error);
    }
  };

  // Phase 4: Fetch chat permissions
  const fetchChatPermissions = async () => {
    try {
      const perms = await chatSvc.fetchChatPermissions(user?.id);
      setChatPermissions({ permissions: perms });
    } catch (error) {
      console.error('Error fetching chat permissions:', error);
    }
  };

  // Phase 3: Fetch announcements
  const fetchAnnouncements = async () => {
    try {
      const { announcements: anns } = await chatSvc.fetchAnnouncements(user.id);
      setAnnouncements(anns);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  // Phase 3: Acknowledge announcement
  const handleAcknowledgeAnnouncement = async (announcementId) => {
    try {
      await chatSvc.acknowledgeAnnouncement(announcementId, user.id);
      setAnnouncements(announcements.map(a =>
        a.id === announcementId ? { ...a, user_acknowledged: true } : a
      ));
      toast.success('Announcement acknowledged');
    } catch (error) {
      toast.error('Failed to acknowledge announcement');
    }
  };

  // Phase 3: Save/unsave message
  const handleSaveMessage = async (message) => {
    try {
      const result = await chatSvc.saveMessage(message.id, user.id);
      toast.success(result.saved ? 'Message saved' : 'Message unsaved');
    } catch (error) {
      toast.error('Failed to save message');
    }
  };

  const createOrGetDM = async (targetUserId) => {
    try {
      const dmChannel = await chatSvc.createOrGetDM(user.id, targetUserId);
      setSelectedChannel(dmChannel);
      setNewDMDialogOpen(false);
      setSelectedUserId('');
      fetchDirectMessages();
    } catch (error) {
      console.error('Error creating DM:', error);
      toast.error('Failed to create direct message');
    }
  };

  // Search functions
  const handleSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { results } = await chatSvc.searchMessages(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const jumpToMessage = (result) => {
    // Find and select the channel
    const channel = channels.find(c => c.id === result.channel_id) || 
                    directMessages.find(d => d.id === result.channel_id);
    
    if (channel) {
      setSelectedChannel(channel);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      
      // Scroll to message (future enhancement)
      toast.success('Jumped to message');
    }
  };

  // Mention functions
  const handleMentionInput = (text) => {
    // Check if @ was just typed
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Only trigger if @ is at start OR preceded by whitespace (avoids email addresses etc.)
      const charBeforeAt = lastAtIndex === 0 ? ' ' : text[lastAtIndex - 1];
      if (!/\s/.test(charBeforeAt)) {
        setShowMentionSuggestions(false);
        return;
      }

      const textAfterAt = text.substring(lastAtIndex + 1);
      const spaceIndex = textAfterAt.indexOf(' ');

      if (spaceIndex === -1) {
        // Still typing mention — no space yet after @
        setMentionSearchText(textAfterAt);
        const filtered = users.filter(u =>
          u.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          u.username.toLowerCase().includes(textAfterAt.toLowerCase())
        ).slice(0, 8);
        setMentionSuggestions(filtered);
        setMentionSelectedIndex(0);
        setShowMentionSuggestions(filtered.length > 0);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const insertMention = (user) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const beforeMention = newMessage.substring(0, lastAtIndex);

    const newText = beforeMention + `@${user.username} `;
    setNewMessage(newText);
    setShowMentionSuggestions(false);
    setMentionSelectedIndex(0);
  };

  const handleMentionKeyDown = (e) => {
    if (!showMentionSuggestions || mentionSuggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionSelectedIndex(i => (i + 1) % mentionSuggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionSelectedIndex(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const picked = mentionSuggestions[mentionSelectedIndex] || mentionSuggestions[0];
      if (picked) insertMention(picked);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionSuggestions(false);
      return true;
    }
    return false;
  };

  // Mark chat notifications as read when viewing channel
  const markChannelNotificationsRead = async (channelId) => {
    // Immediately clear unread badge in UI
    setChannels(prev => prev.map(ch =>
      ch.id === channelId ? { ...ch, unread_count: 0 } : ch
    ));
    setDirectMessages(prev => prev.map(dm =>
      dm.id === channelId ? { ...dm, unread_count: 0 } : dm
    ));
    setCustomerDMs(prev => prev.map(dm =>
      dm.id === channelId ? { ...dm, unread_count: 0 } : dm
    ));
    try {
      await chatSvc.markNotificationsRead(channelId, user.id);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // AI Summary functions
  const generateSummary = async () => {
    if (!selectedChannel) return;

    setGeneratingSummary(true);
    setSummaryDialogOpen(true);

    try {
      // AI summary requires API key configuration — placeholder for now
      setSummary('AI summary will be available once an API key is configured. Check Settings > Integrations.');
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummary('Failed to generate summary. Please try again.');
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Read Receipts functions
  const showReadReceipts = async (message) => {
    setSelectedMessageForReceipts(message);
    setReadReceiptsDialogOpen(true);

    try {
      // Read receipts will be enhanced later
      setReadReceipts([]);
    } catch (error) {
      console.error('Error fetching read receipts:', error);
      toast.error('Failed to load read receipts');
    }
  };


  // Phase 1 Feature Handlers
  
  // Edit message
  const handleEditMessage = (message) => {
    setEditingMessage(message);
    setEditText(message.content);
  };

  const saveEditMessage = async () => {
    if (!editText.trim() || !editingMessage) return;

    try {
      await chatSvc.editMessage(editingMessage.id, editText);

      // Update local state
      setMessages(messages.map(m =>
        m.id === editingMessage.id
          ? { ...m, content: editText, edited_at: new Date().toISOString() }
          : m
      ));

      setEditingMessage(null);
      setEditText('');
      toast.success('Message updated');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  // Delete message
  const handleDeleteMessage = async (message) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;

    try {
      await chatSvc.deleteMessage(message.id);

      // Remove from local state
      setMessages(messages.filter(m => m.id !== message.id));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  // React to message
  const handleReactToMessage = async (message, emoji) => {
    try {
      const profileName = user?.user_metadata?.full_name || user?.email || '';
      const { reactions } = await chatSvc.toggleReaction(message.id, emoji, user.id, profileName);

      setMessages(messages.map(m =>
        m.id === message.id ? { ...m, reactions } : m
      ));
    } catch (error) {
      console.error('Error reacting to message:', error);
      toast.error('Failed to add reaction');
    }
  };

  // Reply in thread
  const handleReplyInThread = (message) => {
    openThread(message);
  };

  // Pin message
  const handlePinMessage = async (message) => {
    try {
      await chatSvc.togglePin(selectedChannel.id, message.id, !!message.pinned);
      toast.success(message.pinned ? 'Message unpinned' : 'Message pinned');

      setMessages(messages.map(m =>
        m.id === message.id ? { ...m, pinned: !m.pinned, is_pinned: !m.is_pinned } : m
      ));
    } catch (error) {
      console.error('Error pinning message:', error);
      toast.error('Failed to pin message');
    }
  };

  // Copy message link
  const handleCopyLink = (message) => {
    const link = `${window.location.origin}/chat?channel=${selectedChannel.id}&message=${message.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach((message, index) => {
      const messageDate = new Date(message.created_at).toDateString();
      
      if (messageDate !== currentDate) {
        groups.push({ type: 'date', date: message.created_at });
        currentDate = messageDate;
      }
      
      // Check if should group with previous message (same sender, within 5 minutes)
      const prevMessage = messages[index - 1];
      const shouldGroup = prevMessage && 
        prevMessage.sender_id === message.sender_id &&
        new Date(message.created_at) - new Date(prevMessage.created_at) < 5 * 60 * 1000;
      
      groups.push({ type: 'message', message, grouped: shouldGroup });
    });

    return groups;
  };

  const handleCreateChannel = async () => {
    if (!channelForm.name.trim()) {
      toast.error('Channel name is required');
      return;
    }

    try {
      await chatSvc.createChannel(channelForm, user.id);
      toast.success('Channel created successfully');
      setChannelDialogOpen(false);
      setChannelForm({ name: '', description: '', type: 'public', members: [] });
      fetchChannels();
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Failed to create channel');
    }
  };

  const getChannelIcon = (type) => {
    if (type === 'private') return <Lock className="h-4 w-4" />;
    if (type === 'direct') return <MessageSquare className="h-4 w-4" />;
    return <Hash className="h-4 w-4" />;
  };

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading chat...</div>
      </div>
    );
  }

  return (
    <div>

      <div className={`fixed right-0 bottom-0 top-12 flex bg-navy-900 transition-all duration-200 ${sidebarOpen !== false ? 'left-60' : 'left-16'}`}>
        {/* Channel Sidebar */}
        <div className="w-64 border-r bg-card flex flex-col h-full overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Quick Access */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-1 flex-wrap">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => setAdvancedSearchOpen(true)}
              >
                <Filter className="h-3 w-3 mr-1" />
                Search
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => setSavedMessagesOpen(true)}
              >
                <Bookmark className="h-3 w-3 mr-1" />
                Saved
              </Button>
              {chatPermissions?.permissions?.is_admin && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setCreateAnnouncementOpen(true)}
                >
                  <Megaphone className="h-3 w-3 mr-1" />
                  Announce
                </Button>
              )}
            </div>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto">
            {/* Starred Channels Section */}
            {userPreferences.starred_channels?.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground mb-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  Starred
                </div>
                <div className="space-y-1">
                  {filteredChannels
                    .filter(c => userPreferences.starred_channels?.includes(c.id))
                    .map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannel(channel)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          selectedChannel?.id === channel.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {getChannelIcon(channel.type)}
                        <span className="flex-1 text-left truncate">{channel.name}</span>
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Channels Section */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setChannelsOpen(o => !o)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-white transition-colors">
                  {channelsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Channels
                </button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setChannelDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {channelsOpen && <div className="space-y-1">
                {filteredChannels
                  .filter(c => !userPreferences.starred_channels?.includes(c.id))
                  .map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                        selectedChannel?.id === channel.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      } ${userPreferences.muted_channels?.includes(channel.id) ? 'opacity-50' : ''}`}
                    >
                      {getChannelIcon(channel.type)}
                      <span className="flex-1 text-left truncate">{channel.name}</span>
                      {userPreferences.muted_channels?.includes(channel.id) && (
                        <Bell className="h-3 w-3 line-through" />
                      )}
                      {channel.unread_count > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                          {channel.unread_count}
                        </Badge>
                      )}
                    </button>
                  ))}
              </div>}
            </div>

            {/* Team Direct Messages Section */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setTeamDMsOpen(o => !o)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-white transition-colors">
                  {teamDMsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Team Messages
                </button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNewDMDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {teamDMsOpen && <div className="space-y-1">
                {directMessages.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No team messages yet
                  </div>
                ) : (
                  directMessages.map((dm) => {
                    // Detect Prime DM channel
                    const isPrimeChannel = dm.is_prime_channel || dm.members?.includes('prime-system') || dm.name?.includes('dm-prime');
                    const userName = isPrimeChannel ? '🔱 Prime' : (dm.other_user_name || dm.description?.replace('Direct message with ', '') || 'Unknown User');
                    // Ensure the dm object has other_user_name when selected
                    const enrichedDM = { ...dm, other_user_name: userName, is_prime_channel: isPrimeChannel };
                    return (
                      <button
                        key={dm.id}
                        onClick={() => setSelectedChannel(enrichedDM)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          selectedChannel?.id === dm.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        <div className="relative">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className={`text-xs ${isPrimeChannel ? 'bg-purple-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                              {userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {!isPrimeChannel && dm.other_user_id && onlineUsers.has(dm.other_user_id) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#060B18]" title="Online" />
                          )}
                        </div>
                        <span className="flex-1 text-left truncate">{userName}</span>
                        {dm.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                            {dm.unread_count}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>}
            </div>

            {/* Customer Messages Section */}
            <div className="p-3 border-t border-navy-700/30">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setCustomerDMsOpen(o => !o)} className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-white transition-colors">
                  {customerDMsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Customer Messages
                </button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNewCustomerDMDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {customerDMsOpen && <div className="space-y-1">
                {customerDMs.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    No customer messages yet
                  </div>
                ) : (
                  customerDMs.map((dm) => {
                    const customerName = dm.other_user_name || 'Customer';
                    const enrichedDM = { ...dm, other_user_name: customerName };
                    return (
                      <button
                        key={dm.id}
                        onClick={() => setSelectedChannel(enrichedDM)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                          selectedChannel?.id === dm.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        <div className="relative">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs bg-emerald-600 text-white">
                              {customerName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {dm.other_user_id && onlineUsers.has(dm.other_user_id) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#060B18]" title="Online" />
                          )}
                        </div>
                        <span className="flex-1 text-left truncate">{customerName}</span>
                        {dm.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                            {dm.unread_count}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>}
            </div>
          </div>

          {/* User Status Section */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <PresenceIndicator 
                  status={userStatus?.status || 'online'} 
                  size="xs"
                  className="absolute -bottom-0.5 -right-0.5"
                />
              </div>
              <div className="flex-1 min-w-0 truncate">
                <UserStatusSelector 
                  currentStatus={userStatus} 
                  onStatusChange={setUserStatus}
                />
              </div>
              {chatPermissions?.permissions?.is_admin && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => setAdminPanelOpen(true)}
                  title="Admin Panel"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 flex-shrink-0"
                onClick={() => setNotificationSettingsOpen(true)}
                title="Notification settings"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        {selectedChannel ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Channel Header */}
            <div className="h-14 border-b px-4 flex items-center justify-between bg-card flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getChannelIcon(selectedChannel.type)}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate">
                    {selectedChannel.type === 'direct' 
                      ? (() => {
                          // For DMs, show the other user's name, never the internal ID
                          if (selectedChannel.other_user_name) {
                            return selectedChannel.other_user_name;
                          }
                          // Extract from description
                          const desc = selectedChannel.description || '';
                          const match = desc.match(/Direct message with (.+)/);
                          if (match && match[1]) {
                            return match[1];
                          }
                          // Last resort - never show the dm-xxx ID
                          return 'Direct Message';
                        })()
                      : selectedChannel.name
                    }
                  </h2>
                  {selectedChannel.type !== 'direct' && selectedChannel.description && (
                    <p className="text-xs text-muted-foreground truncate">{selectedChannel.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Connection Status — Supabase Realtime */}
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mr-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live</span>
                </div>
                
                <Button variant="ghost" size="icon" onClick={() => setChannelSettingsOpen(true)} title="Channel members">
                  <Users className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={generateSummary} title="AI Summary">
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} title="Search messages">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Pin className="h-4 w-4" />
                </Button>
                
                {/* Phase 5: Voice/Video/Huddle Buttons - Now featuring Rally */}
                <div className="border-l pl-2 ml-1 flex items-center gap-2">
                  <RallyButton
                    size="sm"
                    onClick={() => {
                      console.log('Starting Charge, selectedChannel:', selectedChannel);
                      if (selectedChannel?.type === 'direct' && selectedChannel?.other_user_id) {
                        setPendingCallTarget({
                          type: 'one_on_one',
                          participantIds: [selectedChannel.other_user_id],
                          channelId: selectedChannel.id
                        });
                      } else if (selectedChannel) {
                        setPendingCallTarget({
                          type: 'group',
                          participantIds: [],
                          channelId: selectedChannel.id
                        });
                      }
                      setShowPreCallSettings(true);
                    }}
                    disabled={!selectedChannel}
                  />
                </div>
                
                <Button variant="ghost" size="icon" onClick={() => setChannelSettingsOpen(true)} title="Channel settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Be the first to start the conversation in #{selectedChannel.name}
                  </p>
                </div>
              ) : (
                groupMessagesByDate(messages).map((item, index) => 
                  item.type === 'date' ? (
                    <DateDivider key={`date-${index}`} date={item.date} />
                  ) : (
                    <div key={item.message.id} className={`group flex gap-3 hover:bg-muted/50 rounded-lg p-2 -mx-2 ${item.grouped ? 'mt-1' : 'mt-4'}`}>
                      {!item.grouped && (
                        item.message.sender_role === 'system' || item.message.sender_name === 'Sage' ? (
                          <img src="/sage-avatar.png" alt="Sage" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                        ) : item.message.sender_id === 'prime-system' || item.message.is_prime_auto_reply ? (
                          <Avatar className="h-9 w-9">
                            <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-lg font-bold">
                              🔱
                            </div>
                          </Avatar>
                        ) : (
                          <UserAvatar name={item.message.sender_name} avatarUrl={item.message.sender_avatar_url} size="md" />
                        )
                      )}
                      {item.grouped && <div className="w-9" />}
                      
                      <div className="flex-1 min-w-0">
                        {!item.grouped && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{item.message.sender_name}</span>
                            {item.message.sender_title && (
                              <span className="text-xs text-muted-foreground font-medium">{item.message.sender_title}</span>
                            )}
                            {item.message.sender_role === 'system' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium">
                                Sage AI
                              </span>
                            )}
                            {item.message.sender_role === 'tester' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                                Platform Tester
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.message.created_at).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            {item.message.edited_at && (
                              <span className="text-xs text-muted-foreground italic">(edited)</span>
                            )}
                            {item.message.pinned && (
                              <Pin className="h-3 w-3 text-primary" />
                            )}
                            {item.message.pending && (
                              <span className="text-xs text-muted-foreground italic">Sending...</span>
                            )}
                          </div>
                        )}
                        
                        {/* Edit mode */}
                        {editingMessage && editingMessage.id === item.message.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="min-h-[60px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEditMessage}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingMessage(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Message content with formatting */}
                            <div className={`text-sm whitespace-pre-wrap break-words ${item.message.pending ? 'opacity-60' : ''}`}>
                              {item.message.content.split(/(\*\*.*?\*\*|__.*?__|@\w+)/g).map((part, idx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={idx}>{part.slice(2, -2)}</strong>;
                                } else if (part.startsWith('__') && part.endsWith('__')) {
                                  return <em key={idx}>{part.slice(2, -2)}</em>;
                                } else if (part.startsWith('@')) {
                                  return (
                                    <span key={idx} className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 rounded font-medium">
                                      {part}
                                    </span>
                                  );
                                }
                                return part;
                              })}
                            </div>

                            {/* File Attachments remain the same but I'll keep them here for completeness */}
                            {item.message.attachments && item.message.attachments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {item.message.attachments.map((att, idx) => (
                                  <div key={idx} className="border rounded-lg overflow-hidden max-w-md">
                                    {att.file_type === 'image' ? (
                                      <div className="relative group/image">
                                        <img 
                                          src={att.url}
                                          alt={att.filename}
                                          className="w-full h-auto max-h-80 object-contain bg-muted cursor-pointer"
                                          onClick={() => window.open(att.url, '_blank')}
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3 p-3 bg-muted/50">
                                        <div className="p-2 bg-background rounded">
                                          <FileIcon className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{att.filename}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {(att.file_size / 1024).toFixed(1)} KB
                                          </p>
                                        </div>
                                        <a
                                          href={att.url}
                                          download={att.filename}
                                        >
                                          <Button size="icon" variant="ghost" className="h-8 w-8">
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Linked Entities (Job/Contact) */}
                            {(item.message.linked_job || item.message.linked_contact) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {item.message.linked_job && (
                                  <button
                                    onClick={() => window.open(`/jobs/${item.message.linked_job.id}`, '_blank')}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                  >
                                    <Briefcase className="h-3 w-3" />
                                    {item.message.linked_job.name}
                                    {item.message.linked_job.stage && (
                                      <span className="text-blue-500 dark:text-blue-400">• {item.message.linked_job.stage}</span>
                                    )}
                                  </button>
                                )}
                                {item.message.linked_contact && (
                                  <button
                                    onClick={() => window.open(`/contacts/${item.message.linked_contact.id}`, '_blank')}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                  >
                                    <User className="h-3 w-3" />
                                    {item.message.linked_contact.name}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* System Message Badge */}
                            {item.message.message_type === 'system' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                                  <Zap className="h-3 w-3" />
                                  {item.message.system_event?.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </div>
                            )}

                            {/* Prime Message Badge */}
                            {item.message.message_type === 'prime' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                  🔱 Prime AI
                                </span>
                              </div>
                            )}

                            {/* Reactions */}
                            {item.message.reactions && item.message.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.message.reactions.map((reaction, idx) => (
                                  <Button
                                    key={idx}
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleReactToMessage(item.message, reaction.emoji)}
                                  >
                                    {reaction.emoji} {reaction.count}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {/* Thread Reply Count */}
                            {threadCounts[item.message.id] > 0 && (
                              <button 
                                onClick={() => handleReplyInThread(item.message)}
                                className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {threadCounts[item.message.id]} {threadCounts[item.message.id] === 1 ? 'reply' : 'replies'}
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Message Actions Menu */}
                      <div className={`transition-opacity ${emojiPickerOpenFor === item.message.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className="flex items-center gap-1">
                          <EmojiPicker
                            onSelect={(emoji) => handleReactToMessage(item.message, emoji)}
                            onOpenChange={(isOpen) => setEmojiPickerOpenFor(isOpen ? item.message.id : null)}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Smile className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <MessageActions
                            message={item.message}
                            currentUserId={user.id}
                            onEdit={handleEditMessage}
                            onDelete={handleDeleteMessage}
                            onReply={handleReplyInThread}
                            onReact={(msg) => setEmojiPickerOpenFor(msg.id)}
                            onPin={handlePinMessage}
                            onCopyLink={handleCopyLink}
                          />
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Thread Panel (conditional) */}
            {threadOpen && threadParentMessage && (
              <ThreadPanel
                parentMessage={threadParentMessage}
                channelId={selectedChannel.id}
                currentUser={user}
                onClose={() => {
                  setThreadOpen(false);
                  setThreadParentMessage(null);
                }}
              />
            )}

            {/* Original message input section continues below... */}
            {!threadOpen && (
              <>
                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="px-4 py-2 bg-muted/30 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span>
                        {typingUsers.length === 1
                          ? `${typingUsers[0].name} is typing...`
                          : typingUsers.length === 2
                          ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`
                          : `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`
                        }
                      </span>
                    </div>
                  </div>
                )}

                {/* Message Input */}
                <div className="border-t p-4 bg-card flex-shrink-0">
                  {/* Mention Suggestions */}
                  {showMentionSuggestions && mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
                        People {mentionSearchText ? `matching "${mentionSearchText}"` : ''}
                      </div>
                      {mentionSuggestions.map((u, idx) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertMention(u)}
                      onMouseEnter={() => setMentionSelectedIndex(idx)}
                      className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left ${
                        idx === mentionSelectedIndex ? 'bg-accent' : 'hover:bg-accent/60'
                      }`}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {u.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">@{u.username}{u.role ? ` · ${u.role}` : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="relative">
                <Textarea
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder="Enter chat here"
                  className="pr-24 resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    // Mention dropdown captures keys first
                    if (handleMentionKeyDown(e)) return;
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="absolute right-2 bottom-2 flex gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={handleFileSelect}
                    disabled={uploadingFile}
                    title="Upload file"
                  >
                    {uploadingFile ? (
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                  <EmojiPicker
                    onSelect={(emoji) => setNewMessage(prev => prev + emoji)}
                    trigger={
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Add emoji">
                        <Smile className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button type="submit" size="icon" className="h-8 w-8">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to send, 
                <kbd className="px-1 py-0.5 bg-muted rounded ml-1">Shift + Enter</kbd> for new line
              </p>
            </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Welcome to Company Chat</h3>
              <p className="text-muted-foreground">
                Select a channel from the sidebar to start chatting with your team
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Channel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Channel Name *</label>
              <Input
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                placeholder="e.g. marketing-team"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={channelForm.description}
                onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                placeholder="What's this channel about?"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Channel Type</label>
              <select
                value={channelForm.type}
                onChange={(e) => setChannelForm({ ...channelForm, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-navy-900 text-white border-navy-600"
              >
                <option value="public" className="bg-navy-900 text-white">Public - Anyone can join</option>
                <option value="private" className="bg-navy-900 text-white">Private - Invite only</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateChannel}>Create Channel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thread Sidebar */}
      {threadOpen && threadParentMessage && (
        <div className="fixed right-0 top-12 bottom-0 w-96 bg-background border-l shadow-xl z-50 flex flex-col">
          {/* Thread Header */}
          <div className="border-b p-4 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Thread
            </h3>
            <Button variant="ghost" size="icon" onClick={closeThread}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Parent Message */}
          <div className="border-b p-4 bg-muted/30">
            <div className="flex gap-3">
              <UserAvatar name={threadParentMessage.sender_name} avatarUrl={threadParentMessage.sender_avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{threadParentMessage.sender_name}</span>
                  {threadParentMessage.sender_title && (
                    <span className="text-xs text-muted-foreground font-medium">{threadParentMessage.sender_title}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(threadParentMessage.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                  {threadParentMessage.content}
                </div>
              </div>
            </div>
          </div>

          {/* Thread Replies */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {threadMessages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground mt-8">
                No replies yet. Be the first to reply!
              </div>
            ) : (
              threadMessages.map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <UserAvatar name={reply.sender_name} avatarUrl={reply.sender_avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm">{reply.sender_name}</span>
                      {reply.sender_title && (
                        <span className="text-xs text-muted-foreground font-medium">{reply.sender_title}</span>
                      )}
                      {reply.sender_role === 'tester' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">
                          Platform Tester
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(reply.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                      {reply.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Thread Reply Input */}
          <div className="border-t p-4 bg-card">
            <form onSubmit={sendThreadReply}>
              <Textarea
                value={threadReplyText}
                onChange={(e) => setThreadReplyText(e.target.value)}
                placeholder="Reply in thread..."
                className="mb-2 resize-none"
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!threadReplyText.trim()}>
                  <Send className="h-4 w-4 mr-1" />
                  Send
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New DM Dialog */}
      <Dialog open={newDMDialogOpen} onOpenChange={setNewDMDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md bg-navy-900 text-white border-navy-600 focus:ring-2 focus:ring-brand-blue"
              >
                <option value="" className="bg-navy-900 text-gray-400">Choose a user...</option>
                {users.filter(u => u.id !== user.id).map((u) => (
                  <option key={u.id} value={u.id} className="bg-navy-900 text-white">
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDMDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createOrGetDM(selectedUserId)} disabled={!selectedUserId}>
              Start Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer DM Dialog */}
      <Dialog open={newCustomerDMDialogOpen} onOpenChange={setNewCustomerDMDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message a Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md bg-navy-900 text-white border-navy-600 focus:ring-2 focus:ring-brand-blue"
              >
                <option value="" className="bg-navy-900 text-gray-400">Choose a customer...</option>
                {customerUsers.map((u) => (
                  <option key={u.id} value={u.id} className="bg-navy-900 text-white">
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustomerDMDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createOrGetCustomerDM(selectedCustomerId)} disabled={!selectedCustomerId}>
              Start Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Summary Dialog */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI Channel Summary
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {generatingSummary ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
                <p className="text-sm text-muted-foreground">Generating summary...</p>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm">
                  {summary || 'No summary available.'}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read Receipts Dialog */}
      <Dialog open={readReceiptsDialogOpen} onOpenChange={setReadReceiptsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Read Receipts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {readReceipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No one has read this message yet
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {readReceipts.map((receipt) => (
                  <div key={receipt.user_id} className="flex items-center gap-3 p-2 rounded hover:bg-accent">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {receipt.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{receipt.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Read {new Date(receipt.read_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-blue-500">
                      <Eye className="h-4 w-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadReceiptsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Search Messages</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search in all channels..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                className="flex-1"
              />
              {searching && <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mt-2" />}
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {searchResults.length === 0 && searchQuery.length >= 2 && !searching ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages found
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Type to search messages...
                </div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => jumpToMessage(result)}
                    className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{result.sender_name}</span>
                          <span className="text-xs text-muted-foreground">
                            in #{result.channel_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(result.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {result.content}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phase 2: Channel Settings Dialog */}
      <ChannelSettings
        channel={selectedChannel}
        isOpen={channelSettingsOpen}
        onClose={() => setChannelSettingsOpen(false)}
        onUpdate={() => {
          fetchChannels();
          fetchUserPreferences();
        }}
        currentUser={user}
        users={users}
      />

      {/* Phase 2: Notification Settings Dialog */}
      <NotificationSettings
        isOpen={notificationSettingsOpen}
        onClose={() => setNotificationSettingsOpen(false)}
      />

      {/* Phase 4: Admin Panel */}
      <AdminPanel
        isOpen={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
        currentUser={user}
      />

      {/* Phase 3: Advanced Search */}
      <AdvancedSearch
        isOpen={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        channels={channels}
        users={users}
        onResultClick={(result) => {
          const channel = channels.find(c => c.id === result.channel_id);
          if (channel) {
            setSelectedChannel(channel);
          }
        }}
      />

      {/* Phase 3: Saved Messages */}
      <SavedMessages
        isOpen={savedMessagesOpen}
        onClose={() => setSavedMessagesOpen(false)}
        onMessageClick={(message) => {
          const channel = channels.find(c => c.id === message.channel_id);
          if (channel) {
            setSelectedChannel(channel);
          }
        }}
      />

      {/* Phase 3: Create Announcement */}
      <CreateAnnouncementDialog
        isOpen={createAnnouncementOpen}
        onClose={() => setCreateAnnouncementOpen(false)}
        channels={channels}
        onCreated={() => {
          fetchAnnouncements();
          fetchMessages(selectedChannel?.id);
        }}
      />

      {/* Phase 5: Voice, Video, Huddles (Future-ready) */}
      <VoiceCallDialog
        isOpen={voiceCallOpen}
        onClose={() => setVoiceCallOpen(false)}
        participant={selectedChannel?.type === 'direct' ? selectedChannel?.other_user_name : null}
        channelName={selectedChannel?.name}
      />

      <VideoCallDialog
        isOpen={videoCallOpen}
        onClose={() => setVideoCallOpen(false)}
        participant={selectedChannel?.type === 'direct' ? selectedChannel?.other_user_name : null}
        channelName={selectedChannel?.name}
      />

      <HuddleDialog
        isOpen={huddleOpen}
        onClose={() => setHuddleOpen(false)}
        channelName={selectedChannel?.name}
        participants={[]}
      />
      
      {/* Pre-Call Settings Dialog - shows device selection before starting call */}
      {showPreCallSettings && pendingCallTarget && (
        <PreCallSettings
          onStart={async (settings) => {
            setShowPreCallSettings(false);
            if (settings.stream && pendingCallTarget) {
              try {
                await videoCall.startCallWithStream(
                  pendingCallTarget.participantIds,
                  pendingCallTarget.channelId,
                  'video',
                  settings.stream
                );
              } catch (error) {
                console.error('Error starting call:', error);
              }
            }
            setPendingCallTarget(null);
          }}
          onCancel={() => {
            setShowPreCallSettings(false);
            setPendingCallTarget(null);
          }}
          callType="video"
        />
      )}
      
      {/* Video call UI is now rendered globally via GlobalVideoCall component */}
    </div>
  );
};

export default Chat;
