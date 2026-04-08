import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../lib/AuthContext';

const WebSocketContext = createContext(null);

export const useWS = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWS must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const ws = useWebSocket(token);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadCounts, setUnreadCounts] = useState({});

  // Get current user ID for filtering own messages
  const currentUserId = user?.id;

  // Handle incoming WebSocket messages
  // NOTE: Video call events are now handled via Supabase Realtime in VideoCallContext.
  useEffect(() => {
    if (!ws.lastMessage) return;

    const { type, ...data } = ws.lastMessage;

    switch (type) {
      case 'message':
        // New message received
        setMessages(prev => [...prev, data.message]);

        // Update unread count if message is not from current user
        if (data.channel_id && data.message?.sender_id !== currentUserId) {
          setUnreadCounts(prev => ({
            ...prev,
            [data.channel_id]: (prev[data.channel_id] || 0) + 1
          }));
        }
        break;

      case 'typing':
        // Update typing status
        if (data.channel_id && data.typing_users) {
          setTypingUsers(prev => {
            const updated = { ...prev };
            if (data.typing_users.length > 0) {
              updated[data.channel_id] = {
                typing_users: data.typing_users
              };
            } else {
              delete updated[data.channel_id];
            }
            return updated;
          });
        }
        break;

      case 'presence':
        // Update user presence
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          if (data.status === 'online') {
            updated.add(data.user_id);
          } else {
            updated.delete(data.user_id);
          }
          return updated;
        });
        break;

      case 'read_status':
        // Clear unread count for channel
        if (data.channel_id) {
          setUnreadCounts(prev => {
            const updated = { ...prev };
            delete updated[data.channel_id];
            return updated;
          });
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }, [ws.lastMessage, currentUserId]);

  const clearUnreadCount = (channelId) => {
    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[channelId];
      return updated;
    });
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const value = {
    ...ws,
    messages,
    typingUsers,
    onlineUsers,
    unreadCounts,
    clearUnreadCount,
    clearMessages
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
