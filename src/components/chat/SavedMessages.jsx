import React, { useState, useEffect } from 'react';
import { Bookmark, Trash2, ExternalLink, Hash, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

const SavedMessages = ({ isOpen, onClose, onMessageClick }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSavedMessages();
    }
  }, [isOpen]);

  const fetchSavedMessages = async () => {
    setLoading(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) {
        setLoading(false);
        return;
      }

      const { data: savedMsgs, error } = await supabase
        .from('chat_saved_messages')
        .select('message_id, created_at')
        .eq('user_id', authUser.user.id);

      if (error) throw error;

      const messageIds = savedMsgs?.map(s => s.message_id) || [];
      if (messageIds.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id, content, created_at, sender_id, channel_id')
        .in('id', messageIds);

      // Enrich with sender and channel info
      const enrichedMessages = await Promise.all(
        (msgs || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();

          const { data: channel } = await supabase
            .from('chat_channels')
            .select('name')
            .eq('id', msg.channel_id)
            .single();

          const savedRecord = savedMsgs?.find(s => s.message_id === msg.id);

          return {
            ...msg,
            sender_name: profile?.full_name || 'Unknown',
            channel_name: channel?.name || 'Unknown',
            saved_at: savedRecord?.created_at
          };
        })
      );

      setMessages(enrichedMessages);
    } catch (error) {
      console.error('Error fetching saved messages:', error);
      toast.error('Failed to load saved messages');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (messageId) => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.id) return;

      const { error } = await supabase
        .from('chat_saved_messages')
        .delete()
        .eq('user_id', authUser.user.id)
        .eq('message_id', messageId);

      if (error) throw error;
      setMessages(messages.filter(m => m.id !== messageId));
      toast.success('Message removed from saved');
    } catch (error) {
      toast.error('Failed to remove message');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Saved Messages ({messages.length})
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No saved messages</p>
              <p className="text-sm mt-1">
                Click the bookmark icon on any message to save it for later
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-sm">
                        {message.sender_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{message.sender_name}</span>
                        {message.channel_name && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {message.channel_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {message.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                        {message.saved_at && (
                          <span>
                            Saved {new Date(message.saved_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          onMessageClick && onMessageClick(message);
                          onClose();
                        }}
                        title="Go to message"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleUnsave(message.id)}
                        title="Remove from saved"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SavedMessages;
