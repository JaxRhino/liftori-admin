import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Check,
  X,
  Clock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
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
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const priorityConfig = {
  low: { color: 'bg-gray-100 text-gray-800', icon: Info },
  normal: { color: 'bg-blue-100 text-blue-800', icon: Info },
  high: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  urgent: { color: 'bg-red-100 text-red-800', icon: AlertTriangle }
};

// Announcement Banner Component (shows at top of chat)
export const AnnouncementBanner = ({ announcements, onAcknowledge, onDismiss }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const unacknowledged = announcements.filter(a => 
    a.requires_acknowledgment && !a.user_acknowledged
  );
  
  const current = unacknowledged[currentIndex];
  
  if (!current) return null;
  
  const config = priorityConfig[current.priority] || priorityConfig.normal;
  const Icon = config.icon;

  return (
    <div className={`p-3 ${config.color} border-b flex items-center gap-3`}>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{current.title}</p>
        <p className="text-xs opacity-80 truncate">{current.content}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {unacknowledged.length > 1 && (
          <span className="text-xs">
            {currentIndex + 1} of {unacknowledged.length}
          </span>
        )}
        {current.requires_acknowledgment && (
          <Button 
            size="sm" 
            variant="secondary"
            onClick={() => onAcknowledge(current.id)}
          >
            <Check className="h-4 w-4 mr-1" />
            Acknowledge
          </Button>
        )}
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => {
            if (currentIndex < unacknowledged.length - 1) {
              setCurrentIndex(currentIndex + 1);
            } else {
              onDismiss && onDismiss();
            }
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Announcement Message Style (for messages in chat)
export const AnnouncementMessage = ({ message }) => {
  const priority = message.announcement_priority || 'normal';
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <div className={`my-4 p-4 rounded-lg border-2 ${config.color} border-current/20`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-white/50">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold">Company Announcement</span>
            <Badge variant="outline" className="text-xs">
              {priority.toUpperCase()}
            </Badge>
          </div>
          <div className="prose prose-sm max-w-none">
            {message.content.split('\n').map((line, i) => (
              <p key={i} className={i === 0 ? 'font-semibold' : ''}>
                {line.replace(/\*\*/g, '')}
              </p>
            ))}
          </div>
          <p className="text-xs opacity-60 mt-2">
            {new Date(message.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

// Create Announcement Dialog (Admin only)
export const CreateAnnouncementDialog = ({ isOpen, onClose, channels = [], onCreated }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [allChannels, setAllChannels] = useState(true);
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setLoading(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { data: announcement, error: announcementError } = await supabase
        .from('chat_announcements')
        .insert([{
          title,
          content,
          priority,
          requires_acknowledgment: requiresAcknowledgment,
          expires_at: expiresAt || null,
          created_by: authUser.user.id
        }])
        .select()
        .single();

      if (announcementError) throw announcementError;

      // Get target channels
      let targetChannelIds = selectedChannels;
      if (allChannels) {
        const { data: allChans } = await supabase
          .from('chat_channels')
          .select('id');
        targetChannelIds = allChans?.map(c => c.id) || [];
      }

      // Send announcements to channels (as special messages)
      for (const channelId of targetChannelIds) {
        await supabase
          .from('chat_messages')
          .insert({
            content,
            channel_id: channelId,
            sender_id: authUser.user.id,
            is_announcement: true,
            announcement_id: announcement.id,
            announcement_priority: priority
          });
      }

      toast.success(`Announcement created and sent to ${targetChannelIds.length} channels`);
      onCreated && onCreated(announcement);
      onClose();

      // Reset form
      setTitle('');
      setContent('');
      setPriority('normal');
      setSelectedChannels([]);
      setAllChannels(true);
      setRequiresAcknowledgment(false);
      setExpiresAt('');
    } catch (error) {
      toast.error(error?.message || 'Failed to create announcement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Create Announcement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Important Update"
            />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement message..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expires</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={allChannels} 
                onCheckedChange={setAllChannels}
              />
              <span className="text-sm">Send to all channels</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={requiresAcknowledgment} 
                onCheckedChange={setRequiresAcknowledgment}
              />
              <span className="text-sm">Require acknowledgment from users</span>
            </label>
          </div>

          {!allChannels && (
            <div className="space-y-2">
              <Label>Select Channels</Label>
              <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                {channels.filter(c => c.type !== 'direct').map((channel) => (
                  <label key={channel.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedChannels.includes(channel.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedChannels([...selectedChannels, channel.id]);
                        } else {
                          setSelectedChannels(selectedChannels.filter(id => id !== channel.id));
                        }
                      }}
                    />
                    <span className="text-sm">#{channel.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : 'Create Announcement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default { AnnouncementBanner, AnnouncementMessage, CreateAnnouncementDialog };
