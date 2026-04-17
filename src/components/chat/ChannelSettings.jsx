import React, { useState, useEffect } from 'react';
import { X, Hash, Lock, Users, Bell, Star, Archive, Trash2, Settings, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Switch } from '../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const ChannelSettings = ({ channel, isOpen, onClose, onUpdate, currentUser, users = [] }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notificationSetting, setNotificationSetting] = useState('all');
  const [isStarred, setIsStarred] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name || '');
      setDescription(channel.description || '');
      setTopic(channel.topic || '');
      fetchChannelMembers();
      fetchUserPreferences();
    }
  }, [channel]);

  const fetchChannelMembers = async () => {
    if (!channel) return;
    try {
      const { data, error } = await supabase
        .from('chat_channel_members')
        .select('user_id')
        .eq('channel_id', channel.id);

      if (error) throw error;

      // Enrich with profile data
      const memberIds = data?.map(m => m.user_id) || [];
      if (memberIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, email, role, title, avatar_url')
          .in('id', memberIds);

        if (profileError) throw profileError;
        setMembers(profiles || []);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      // Fallback to basic member list
      setMembers(channel.members || []);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data, error } = await supabase
        .from('chat_user_preferences')
        .select('starred_channels, muted_channels, channel_notifications')
        .eq('user_id', authUser.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      const prefs = data || {};
      setIsStarred(prefs?.starred_channels?.includes(channel?.id) || false);
      setIsMuted(prefs?.muted_channels?.includes(channel?.id) || false);
      setNotificationSetting(prefs?.channel_notifications?.[channel?.id] || 'all');
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const handleSave = async () => {
    if (!channel) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_channels')
        .update({
          name,
          description,
          topic
        })
        .eq('id', channel.id);

      if (error) throw error;
      toast.success('Channel updated');
      onUpdate && onUpdate();
    } catch (error) {
      toast.error(error?.message || 'Failed to update channel');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStar = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const newStarred = !isStarred;

      const { error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          starred_channels: newStarred
            ? [...(isStarred ? [] : [channel.id])]
            : []
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      setIsStarred(newStarred);
      toast.success(newStarred ? 'Channel starred' : 'Channel unstarred');
    } catch (error) {
      toast.error('Failed to update starred status');
    }
  };

  const handleToggleMute = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const newMuted = !isMuted;

      const { error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          muted_channels: newMuted
            ? [...(isMuted ? [] : [channel.id])]
            : []
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      setIsMuted(newMuted);
      toast.success(newMuted ? 'Channel muted' : 'Channel unmuted');
    } catch (error) {
      toast.error('Failed to update mute status');
    }
  };

  const handleNotificationChange = async (value) => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { error } = await supabase
        .from('chat_user_preferences')
        .upsert({
          user_id: authUser.user.id,
          channel_notifications: {
            [channel.id]: value
          }
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      setNotificationSetting(value);
      toast.success('Notification settings updated');
    } catch (error) {
      toast.error('Failed to update notifications');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Are you sure you want to archive this channel?')) return;
    try {
      const { error } = await supabase
        .from('chat_channels')
        .update({ archived: true })
        .eq('id', channel.id);

      if (error) throw error;
      toast.success('Channel archived');
      onClose();
      onUpdate && onUpdate();
    } catch (error) {
      toast.error(error?.message || 'Failed to archive channel');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this channel? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('chat_channels')
        .delete()
        .eq('id', channel.id);

      if (error) throw error;
      toast.success('Channel deleted');
      onClose();
      onUpdate && onUpdate();
    } catch (error) {
      toast.error(error?.message || 'Failed to delete channel');
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this channel?')) return;
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { error } = await supabase
        .from('chat_channel_members')
        .delete()
        .eq('channel_id', channel.id)
        .eq('user_id', authUser.user.id);

      if (error) throw error;
      toast.success('Left channel');
      onClose();
      onUpdate && onUpdate();
    } catch (error) {
      toast.error(error?.message || 'Failed to leave channel');
    }
  };

  const handleAddMember = async (userId) => {
    try {
      const { error } = await supabase
        .from('chat_channel_members')
        .insert([{
          channel_id: channel.id,
          user_id: userId
        }]);

      if (error) throw error;
      toast.success('Member added');
      fetchChannelMembers();
    } catch (error) {
      toast.error(error?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      const { error } = await supabase
        .from('chat_channel_members')
        .delete()
        .eq('channel_id', channel.id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Member removed');
      fetchChannelMembers();
    } catch (error) {
      toast.error(error?.message || 'Failed to remove member');
    }
  };

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'ceo';
  const isCreator = channel?.created_by === currentUser?.id;
  const canEdit = isAdmin || isCreator;

  if (!channel) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel.type === 'private' ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
            {channel.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {canEdit ? (
              <>
                <div className="space-y-2">
                  <Label>Channel Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. marketing-team"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this channel about?"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Current focus or discussion topic"
                  />
                </div>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{description || 'No description'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Topic</Label>
                  <p className="text-sm">{topic || 'No topic set'}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className={`h-4 w-4 ${isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                  <span className="text-sm">Star this channel</span>
                </div>
                <Switch checked={isStarred} onCheckedChange={handleToggleStar} />
              </div>
            </div>

            {canEdit && (
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-medium text-destructive">Danger Zone</h4>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleArchive}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive Channel
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" onClick={handleDelete}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Channel
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!isCreator && channel.type !== 'direct' && (
              <div className="pt-4 border-t">
                <Button variant="outline" onClick={handleLeave}>
                  Leave Channel
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            {canEdit && (
              <div className="flex gap-2">
                <Select onValueChange={handleAddMember}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Add member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter(u => !members.some(m => (m.id || m) === u.id))
                      .map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {members.map((member) => {
                const memberId = member.id || member;
                const firstLast = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
                const memberName = member.full_name
                  || (firstLast || null)
                  || member.email
                  || 'Unknown user';
                const isCurrentUser = memberId === currentUser?.id;
                const presence = member.presence?.status || 'offline';
                
                return (
                  <div key={memberId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {memberName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                          presence === 'online' ? 'bg-green-500' :
                          presence === 'away' ? 'bg-yellow-500' :
                          presence === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {memberName}
                          {isCurrentUser && <span className="text-muted-foreground"> (you)</span>}
                        </p>
                        {member.role && (
                          <p className="text-xs text-muted-foreground capitalize">{member.role.replace('_', ' ')}</p>
                        )}
                      </div>
                    </div>
                    {canEdit && !isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(memberId)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Mute Channel</p>
                  <p className="text-sm text-muted-foreground">You won't receive any notifications</p>
                </div>
                <Switch checked={isMuted} onCheckedChange={handleToggleMute} />
              </div>

              <div className="space-y-2">
                <Label>Notification Level</Label>
                <Select value={notificationSetting} onValueChange={handleNotificationChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All messages</SelectItem>
                    <SelectItem value="mentions">Mentions only</SelectItem>
                    <SelectItem value="none">Nothing</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {notificationSetting === 'all' && 'You will be notified for all messages'}
                  {notificationSetting === 'mentions' && 'You will only be notified when mentioned'}
                  {notificationSetting === 'none' && 'You will not receive any notifications for this channel'}
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelSettings;
