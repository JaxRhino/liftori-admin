import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Smile, File as FileIcon, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import * as chatSvc from '../../lib/chatService';
import UserAvatar from '../UserAvatar';
import EmojiPicker from './EmojiPicker';
import { playSendSwoosh } from '../../lib/chatSounds';

/**
 * Thread side panel — shows a parent message + its replies.
 * Matches main channel chat: avatars, bubbles (sky for me / emerald for theirs),
 * attachment rendering, swoosh on send, multi-file upload + emoji picker.
 */
const ThreadPanel = ({ parentMessage, channelId, currentUser, onClose }) => {
  const { user, profile } = useAuth();
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchThreadReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMessage.id]);

  // Realtime subscription for new replies in this thread
  useEffect(() => {
    if (!parentMessage?.id) return;
    const channel = supabase
      .channel(`thread-${parentMessage.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${parentMessage.id}`,
        },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;
          setReplies((prev) => {
            if (prev.some((r) => r.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentMessage?.id]);

  // Auto-scroll on new replies
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  const fetchThreadReplies = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(
          'id, content, created_at, sender_id, sender_name, sender_avatar_url, sender_role, sender_title, attachments, thread_id'
        )
        .eq('thread_id', parentMessage.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (error) {
      console.error('Error fetching thread replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const reply = await chatSvc.sendMessage(
        channelId,
        { content: text, attachments: [], thread_id: parentMessage.id },
        user
      );
      setReplies((prev) =>
        prev.some((r) => r.id === reply.id) ? prev : [...prev, reply]
      );
      setReplyText('');
      playSendSwoosh();
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 10MB cap per file
    const tooBig = files.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      alert(`File "${tooBig.name}" exceeds 10MB limit`);
      e.target.value = '';
      return;
    }

    setUploadingFiles(true);
    try {
      const attachments = await Promise.all(
        files.map((f) => chatSvc.uploadFile(f, user))
      );
      const summary =
        attachments.length === 1
          ? `Shared ${attachments[0].file_type}: ${attachments[0].filename}`
          : `Shared ${attachments.length} files`;
      const reply = await chatSvc.sendMessage(
        channelId,
        { content: summary, attachments, thread_id: parentMessage.id },
        user
      );
      setReplies((prev) =>
        prev.some((r) => r.id === reply.id) ? prev : [...prev, reply]
      );
      playSendSwoosh();
    } catch (err) {
      console.error('Thread file upload failed:', err);
      alert('Upload failed. Try again.');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (emoji) => {
    setReplyText((prev) => prev + emoji);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Compose-time helpers (parent + replies render the same way)
  const renderMessage = (m, isParent = false) => {
    const isMine = m.sender_id === user?.id;
    const displayName = isMine
      ? profile?.full_name || user?.email || 'Me'
      : m.sender_name || 'Unknown';
    const avatarUrl = isMine
      ? profile?.avatar_url || m.sender_avatar_url || null
      : m.sender_avatar_url || null;
    const attachments = Array.isArray(m.attachments) ? m.attachments : [];
    const hasContent = !!(m.content && String(m.content).trim().length > 0);

    return (
      <div
        key={m.id}
        className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${
          isParent ? '' : ''
        }`}
      >
        {!isMine && (
          <UserAvatar name={displayName} avatarUrl={avatarUrl} size="sm" />
        )}

        <div
          className={`flex flex-col gap-1 max-w-[78%] ${
            isMine ? 'items-end' : 'items-start'
          }`}
        >
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-semibold">{displayName}</span>
            {m.sender_title && !isMine && (
              <span className="text-muted-foreground">{m.sender_title}</span>
            )}
            <span>
              {new Date(m.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {hasContent && (
            <div
              className={`px-3 py-1.5 rounded-2xl text-sm break-words whitespace-pre-wrap shadow-sm ${
                isMine
                  ? 'bg-sky-500 text-white rounded-br-sm'
                  : 'bg-emerald-500 text-white rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-col gap-1 w-full">
              {attachments.map((att, idx) => (
                <div
                  key={`${m.id}-att-${idx}`}
                  className="rounded-lg overflow-hidden border border-border bg-muted max-w-[260px]"
                >
                  {att.file_type === 'image' ? (
                    <img
                      src={att.url}
                      alt={att.filename}
                      className="w-full h-auto max-h-64 object-cover cursor-pointer"
                      onClick={() => window.open(att.url, '_blank', 'noopener')}
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2">
                      <FileIcon className="w-5 h-5 text-sky-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {att.filename}
                        </p>
                        {typeof att.size === 'number' && (
                          <p className="text-[10px] text-muted-foreground">
                            {(att.size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      <a
                        href={att.url}
                        download={att.filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isMine && (
          <UserAvatar name={displayName} avatarUrl={avatarUrl} size="sm" />
        )}
      </div>
    );
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
      <div className="p-3 border-b bg-muted/30">{renderMessage(parentMessage, true)}</div>

      {/* Thread Replies */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Loading replies...
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No replies yet. Start the conversation.
          </div>
        ) : (
          replies.map((reply) => renderMessage(reply, false))
        )}
      </div>

      {/* Reply Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendReply();
        }}
        className="p-3 border-t flex items-end gap-1.5"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Upload */}
        <button
          type="button"
          onClick={handleFileSelect}
          disabled={uploadingFiles}
          title="Attach files"
          aria-label="Attach files"
          className="p-2 rounded-full text-muted-foreground hover:text-sky-500 hover:bg-accent transition-colors flex-shrink-0 disabled:opacity-50"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Emoji */}
        <EmojiPicker
          onSelect={handleEmojiSelect}
          trigger={
            <button
              type="button"
              title="Add emoji"
              aria-label="Add emoji"
              className="p-2 rounded-full text-muted-foreground hover:text-sky-500 hover:bg-accent transition-colors flex-shrink-0"
            >
              <Smile className="w-4 h-4" />
            </button>
          }
        />

        <textarea
          ref={textareaRef}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Reply in thread..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent max-h-24"
          style={{ minHeight: '32px' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendReply();
            }
          }}
        />

        <button
          type="submit"
          disabled={!replyText.trim() || sending}
          className="p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors flex-shrink-0"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ThreadPanel;
