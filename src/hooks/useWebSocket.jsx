import { useEffect, useRef, useState, useCallback } from 'react';

// For local development, use localhost WebSocket, otherwise use the backend URL
const getWebSocketURL = () => {
  // If we're in development (localhost), use local WebSocket
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:8001';
  }
  // Otherwise use the backend URL converted to WebSocket protocol
  // Use /api prefix for proper routing through Kubernetes ingress
  return (import.meta.env.VITE_BACKEND_URL || '').replace('https://', 'wss://').replace('http://', 'ws://');
};

const WS_URL = getWebSocketURL();

// Build the WebSocket path - use /api/ws/chat for production routing
const getWebSocketPath = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/ws/chat';
  }
  // In production, route through /api/ prefix for ingress
  return '/api/ws/chat';
};

export const useWebSocket = (token) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsPath = getWebSocketPath();
      const ws = new WebSocket(`${WS_URL}${wsPath}?token=${token}`);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Send ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        ws.pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setIsConnected(false);

        // Clear ping interval
        if (ws.pingInterval) {
          clearInterval(ws.pingInterval);
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`🔄 Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttemptsRef.current); // Exponential backoff
        } else {
          console.log('❌ Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [token]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      if (wsRef.current.pingInterval) {
        clearInterval(wsRef.current.pingInterval);
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    console.warn('⚠️ WebSocket not connected, cannot send message');
    return false;
  }, []);

  const joinChannel = useCallback((channelId) => {
    send({ type: 'join_channel', channel_id: channelId });
  }, [send]);

  const leaveChannel = useCallback((channelId) => {
    send({ type: 'leave_channel', channel_id: channelId });
  }, [send]);

  const sendTyping = useCallback((channelId, userName, isTyping) => {
    send({
      type: 'typing',
      channel_id: channelId,
      user_name: userName,
      is_typing: isTyping
    });
  }, [send]);

  const sendReadStatus = useCallback((channelId) => {
    send({
      type: 'read_status',
      channel_id: channelId
    });
  }, [send]);

  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    joinChannel,
    leaveChannel,
    sendTyping,
    sendReadStatus,
    connect,
    disconnect
  };
};
