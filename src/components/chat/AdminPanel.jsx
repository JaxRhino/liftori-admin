import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  MessageSquare, 
  FileText, 
  AlertTriangle,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  UserPlus,
  UserMinus,
  Download,
  Send,
  Clock,
  Eye
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const AdminPanel = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelDetails, setChannelDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [broadcastContent, setBroadcastContent] = useState('');
  const [permissions, setPermissions] = useState(null);
  const [userActivity, setUserActivity] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchPermissions();
      fetchChannelsOverview();
      fetchAuditLogs();
    }
  }, [isOpen]);

  const fetchPermissions = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.user.id)
        .single();

      setPermissions({
        permissions: {
          is_admin: ['super_admin', 'admin'].includes(profile?.role)
        }
      });
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchChannelsOverview = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .select('id, name, type, archived');

      if (error) throw error;

      // Enrich with member and message counts
      const channelsWithStats = await Promise.all(
        (data || []).map(async (ch) => {
          const { count: memberCount } = await supabase
            .from('chat_channel_members')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id);

          const { count: messageCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', ch.id);

          return {
            ...ch,
            member_count: memberCount || 0,
            message_count: messageCount || 0
          };
        })
      );

      setChannels(channelsWithStats);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to fetch channels overview');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, content, created_at, sender_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Enrich with user info
      const enrichedLogs = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();

          return {
            id: msg.id,
            user_name: profile?.full_name || 'Unknown',
            action: 'message_sent',
            entity_type: 'message',
            details: { content_preview: msg.content?.substring(0, 100) },
            timestamp: msg.created_at
          };
        })
      );

      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const fetchChannelDetails = async (channelId) => {
    setLoading(true);
    try {
      const { data: channel, error: channelError } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (channelError) throw channelError;

      const { data: members, error: membersError } = await supabase
        .from('chat_channel_members')
        .select('user_id')
        .eq('channel_id', channelId);

      if (membersError) throw membersError;

      const memberIds = members?.map(m => m.user_id) || [];
      let profileMembers = [];
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', memberIds);
        profileMembers = profiles || [];
      }

      const { count: messageCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId);

      setChannelDetails({
        channel,
        members: profileMembers,
        stats: {
          member_count: profileMembers.length,
          message_count: messageCount || 0,
          last_activity: channel.updated_at
        }
      });
      setSelectedChannel(channelId);
    } catch (error) {
      toast.error('Failed to fetch channel details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserActivity = async (userId) => {
    setLoading(true);
    try {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      const { count: messageCount } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userId);

      const { data: channels } = await supabase
        .from('chat_channel_members')
        .select('channel_id')
        .eq('user_id', userId);

      const channelIds = channels?.map(c => c.channel_id) || [];
      let userChannels = [];
      if (channelIds.length > 0) {
        const { data: chData } = await supabase
          .from('chat_channels')
          .select('id, name')
          .in('id', channelIds);
        userChannels = chData || [];
      }

      setUserActivity({
        user,
        stats: {
          message_count: messageCount || 0,
          channel_count: userChannels.length
        },
        channels: userChannels,
        presence: { status: 'offline' },
        recent_actions: []
      });
    } catch (error) {
      toast.error('Failed to fetch user activity');
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastContent.trim()) {
      toast.error('Please enter a message to broadcast');
      return;
    }

    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      // Get all channels
      const { data: channels } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('archived', false);

      const channelIds = channels?.map(c => c.id) || [];

      // Insert broadcast message to each channel
      for (const channelId of channelIds) {
        await supabase
          .from('chat_messages')
          .insert({
            content: broadcastContent,
            channel_id: channelId,
            sender_id: authUser.user.id,
            is_announcement: true
          });
      }

      toast.success(`Broadcast sent to ${channelIds.length} channels`);
      setBroadcastContent('');
      fetchAuditLogs();
    } catch (error) {
      toast.error('Failed to send broadcast');
    }
  };

  const handleExportChannel = async (channelId) => {
    try {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channelId);

      const { data: channel } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('id', channelId)
        .single();

      const exportData = {
        channel,
        messages
      };

      const data = JSON.stringify(exportData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `channel-export-${channelId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Channel data exported');
      fetchAuditLogs();
    } catch (error) {
      toast.error('Failed to export channel data');
    }
  };

  const handleRemoveMember = async (channelId, userId) => {
    if (!window.confirm('Remove this member from the channel?')) return;
    try {
      const { error } = await supabase
        .from('chat_channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Member removed');
      fetchChannelDetails(channelId);
      fetchAuditLogs();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('edit')) return 'secondary';
    if (action.includes('add') || action.includes('create')) return 'default';
    if (action.includes('broadcast')) return 'outline';
    return 'secondary';
  };

  if (!permissions?.permissions?.is_admin) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Admin Access Required</h3>
            <p className="text-muted-foreground mt-2">
              You do not have permission to access the admin panel.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Chat Admin Panel
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Channels</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            <TabsTrigger value="users">User Activity</TabsTrigger>
          </TabsList>

          {/* Channels Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">All Channels ({channels.length})</h3>
                <Button variant="outline" size="sm" onClick={fetchChannelsOverview}>
                  Refresh
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channels.map((channel) => (
                    <TableRow key={channel.id}>
                      <TableCell className="font-medium">#{channel.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{channel.type}</Badge>
                      </TableCell>
                      <TableCell>{channel.member_count}</TableCell>
                      <TableCell>{channel.message_count}</TableCell>
                      <TableCell>
                        {channel.archived ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => fetchChannelDetails(channel.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportChannel(channel.id)}>
                              <Download className="h-4 w-4 mr-2" />
                              Export Data
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Channel Details Panel */}
              {channelDetails && (
                <div className="mt-6 p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-lg">#{channelDetails.channel.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {channelDetails.channel.description || 'No description'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setChannelDetails(null)}>
                      Close
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{channelDetails.stats.member_count}</p>
                      <p className="text-sm text-muted-foreground">Members</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{channelDetails.stats.message_count}</p>
                      <p className="text-sm text-muted-foreground">Messages</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium truncate">
                        {channelDetails.stats.last_activity 
                          ? new Date(channelDetails.stats.last_activity).toLocaleDateString()
                          : 'No activity'}
                      </p>
                      <p className="text-sm text-muted-foreground">Last Activity</p>
                    </div>
                  </div>

                  <h5 className="font-medium mb-2">Members</h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {channelDetails.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {member.first_name?.charAt(0) || member.email?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveMember(channelDetails.channel.id, member.id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Recent Activity</h3>
                <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                  Refresh
                </Button>
              </div>

              <div className="space-y-2">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p>No audit logs found</p>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="p-2 bg-muted rounded-full">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{log.user_name}</span>
                          <Badge variant={getActionBadgeColor(log.action)}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {log.entity_type}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {log.details.content_preview || 
                             log.details.channel_name ||
                             log.details.added_user_name ||
                             log.details.removed_user_name ||
                             JSON.stringify(log.details).substring(0, 100)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Broadcast Tab */}
          <TabsContent value="broadcast" className="flex-1 mt-4">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">System Broadcast</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      This will send a system message to all channels. Use for important announcements only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Textarea
                  placeholder="Enter your broadcast message..."
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  rows={4}
                />
                <Button onClick={handleBroadcast} disabled={!broadcastContent.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Broadcast to All Channels
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* User Activity Tab */}
          <TabsContent value="users" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter user ID to view activity..."
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={() => fetchUserActivity(selectedUserId)} disabled={!selectedUserId}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {userActivity && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {userActivity.user.first_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">
                        {userActivity.user.first_name} {userActivity.user.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">{userActivity.user.email}</p>
                      <Badge variant="outline">{userActivity.user.role}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{userActivity.stats.message_count}</p>
                      <p className="text-sm text-muted-foreground">Messages Sent</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{userActivity.stats.channel_count}</p>
                      <p className="text-sm text-muted-foreground">Channels</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        {userActivity.presence?.status || 'offline'}
                      </p>
                      <p className="text-sm text-muted-foreground">Current Status</p>
                    </div>
                  </div>

                  <h5 className="font-medium mb-2">Channels</h5>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {userActivity.channels.map((ch) => (
                      <Badge key={ch.id} variant="secondary">#{ch.name}</Badge>
                    ))}
                  </div>

                  <h5 className="font-medium mb-2">Recent Actions</h5>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userActivity.recent_actions.map((action, idx) => (
                      <div key={idx} className="text-sm p-2 bg-muted rounded">
                        <span className="font-medium">{action.action}</span>
                        <span className="text-muted-foreground ml-2">
                          {new Date(action.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
