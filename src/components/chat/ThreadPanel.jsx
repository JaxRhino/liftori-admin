import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Textarea } from '../ui/textarea';
import { supabase } from '../../lib/supabase';

const ThreadPanel = ({ parentMessage, channelId, currentUser, onClose }) => {
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreadReplies();
  }, [parentMessage.id]);

  const fetchThreadReplies = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, content, created_at, sender_id, parent_message_id')
        .eq('parent_message_id', parentMessage.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Enrich with sender names from profiles
      const enrichedReplies = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .single();
          return {
            ...msg,
            sender_name: profile?.full_name || 'Unknown'
          };
        })
      );

      setReplies(enrichedReplies);
    } catch (error) {
      console.error('Error fetching thread replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            content: replyText,
            channel_id: channelId,
            sender_id: currentUser?.id,
            parent_message_id: parentMessage.id
          }
        ])
        .select('*')
        .single();

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser?.id)
        .single();

      const newReply = {
        ...data,
        sender_name: profile?.full_name || currentUser?.name || 'Unknown'
      };

      setReplies([...replies, newReply]);
      setReplyText('');
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  return (
    <div className="w-96 border-l bg-background flex flex-col h-full">
      {/* Thread Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Thread</h3>
          <p className="text-xs text-muted-foreground">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parent Message */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {parentMessage.sender_name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm">{parentMessage.sender_name}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(parentMessage.created_at).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            <div className="text-sm mt-1">{parentMessage.content}</div>
          </div>
        </div>
      </div>

      {/* Thread Replies */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Loading replies...
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No replies yet. Start the conversation!
          </div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {reply.sender_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{reply.sender_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(reply.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="text-sm mt-1">{reply.content}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
          />
          <Button 
            onClick={handleSendReply} 
            disabled={!replyText.trim()}
            size="icon"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThreadPanel;
