"""
WebSocket Connection Manager for Company Chat
Handles real-time connections, broadcasting, and room management
"""

from fastapi import WebSocket
from typing import Dict, List, Set, Optional
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        # Map of channel_id -> Set of WebSocket connections
        self.channel_connections: Dict[str, Set[WebSocket]] = {}
        
        # Map of user_id -> WebSocket connection (for direct user messaging)
        self.user_connections: Dict[str, WebSocket] = {}
        
        # Map of WebSocket -> user_id (reverse lookup)
        self.connection_users: Dict[WebSocket, str] = {}
        
        # Map of user_id -> Set of channel_ids (which channels user is in)
        self.user_channels: Dict[str, Set[str]] = {}
        
        # Typing status: channel_id -> Dict of {user_id: user_name}
        self.typing_status: Dict[str, Dict[str, str]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept WebSocket connection and register user"""
        await websocket.accept()
        self.user_connections[user_id] = websocket
        self.connection_users[websocket] = user_id
        self.user_channels[user_id] = set()
        
        logger.info(f"User {user_id} connected via WebSocket")
        
        # Broadcast user online status
        await self.broadcast_presence(user_id, "online")
    
    async def connect_accepted(self, websocket: WebSocket, user_id: str):
        """Register user for an already-accepted WebSocket connection (for Kubernetes ingress compatibility)"""
        self.user_connections[user_id] = websocket
        self.connection_users[websocket] = user_id
        self.user_channels[user_id] = set()
        
        logger.info(f"User {user_id} connected via WebSocket (pre-accepted)")
        
        # Broadcast user online status
        await self.broadcast_presence(user_id, "online")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection and cleanup"""
        user_id = self.connection_users.get(websocket)
        
        if user_id:
            # Remove from all channels
            if user_id in self.user_channels:
                for channel_id in self.user_channels[user_id]:
                    if channel_id in self.channel_connections:
                        self.channel_connections[channel_id].discard(websocket)
                del self.user_channels[user_id]
            
            # Remove from user connections
            if user_id in self.user_connections:
                del self.user_connections[user_id]
            
            # Remove from connection users map
            del self.connection_users[websocket]
            
            # Remove from typing status
            for channel_id in self.typing_status:
                if user_id in self.typing_status[channel_id]:
                    del self.typing_status[channel_id][user_id]
            
            logger.info(f"User {user_id} disconnected from WebSocket")
    
    def join_channel(self, websocket: WebSocket, channel_id: str):
        """Add connection to a channel room"""
        user_id = self.connection_users.get(websocket)
        
        if not user_id:
            return
        
        # Add to channel connections
        if channel_id not in self.channel_connections:
            self.channel_connections[channel_id] = set()
        self.channel_connections[channel_id].add(websocket)
        
        # Track user's channels
        if user_id not in self.user_channels:
            self.user_channels[user_id] = set()
        self.user_channels[user_id].add(channel_id)
        
        logger.info(f"User {user_id} joined channel {channel_id}")
    
    def leave_channel(self, websocket: WebSocket, channel_id: str):
        """Remove connection from a channel room"""
        user_id = self.connection_users.get(websocket)
        
        if channel_id in self.channel_connections:
            self.channel_connections[channel_id].discard(websocket)
        
        if user_id and user_id in self.user_channels:
            self.user_channels[user_id].discard(channel_id)
        
        logger.info(f"User {user_id} left channel {channel_id}")
    
    async def broadcast_to_channel(self, channel_id: str, message: dict, exclude: WebSocket = None):
        """Send message to all connections in a channel"""
        if channel_id not in self.channel_connections:
            return
        
        disconnected = []
        for connection in self.channel_connections[channel_id]:
            if connection == exclude:
                continue
            
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to channel {channel_id}: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to a specific user"""
        if user_id not in self.user_connections:
            return False
        
        try:
            await self.user_connections[user_id].send_json(message)
            return True
        except Exception as e:
            logger.error(f"Error sending to user {user_id}: {e}")
            # Clean up disconnected connection
            websocket = self.user_connections.get(user_id)
            if websocket:
                self.disconnect(websocket)
            return False
    
    async def broadcast_presence(self, user_id: str, status: str):
        """Broadcast user presence status to all relevant channels"""
        message = {
            "type": "presence",
            "user_id": user_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Send to all channels where this user is present
        if user_id in self.user_channels:
            for channel_id in self.user_channels[user_id]:
                await self.broadcast_to_channel(channel_id, message)
    
    async def broadcast_typing(self, channel_id: str, user_id: str, user_name: str, is_typing: bool):
        """Broadcast typing status to channel"""
        if channel_id not in self.typing_status:
            self.typing_status[channel_id] = {}
        
        if is_typing:
            self.typing_status[channel_id][user_id] = user_name
        else:
            if user_id in self.typing_status[channel_id]:
                del self.typing_status[channel_id][user_id]
        
        # Get list of user names currently typing (excluding this user)
        typing_users = [name for uid, name in self.typing_status[channel_id].items() if uid != user_id]
        
        message = {
            "type": "typing",
            "channel_id": channel_id,
            "user_id": user_id,
            "user_name": user_name,
            "is_typing": is_typing,
            "typing_users": typing_users,  # Now contains user names instead of IDs
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.broadcast_to_channel(channel_id, message)
    
    async def broadcast_message(self, channel_id: str, message_data: dict):
        """Broadcast new message to channel"""
        message = {
            "type": "message",
            "channel_id": channel_id,
            "message": message_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.broadcast_to_channel(channel_id, message)
    
    async def broadcast_read_status(self, channel_id: str, user_id: str):
        """Broadcast read status update"""
        message = {
            "type": "read_status",
            "channel_id": channel_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await self.broadcast_to_channel(channel_id, message)
    
    def get_online_users(self) -> List[str]:
        """Get list of currently online user IDs"""
        return list(self.user_connections.keys())
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if a user is currently online"""
        return user_id in self.user_connections
    
    def get_channel_members_count(self, channel_id: str) -> int:
        """Get count of active connections in a channel"""
        if channel_id not in self.channel_connections:
            return 0
        return len(self.channel_connections[channel_id])
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected users (for communications hub)"""
        disconnected = []
        for user_id, connection in self.user_connections.items():
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to user {user_id}: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected:
            self.disconnect(connection)

    # ========================
    # Video Call Methods
    # ========================
    
    async def send_call_signal(self, from_user_id: str, to_user_id: str, signal_type: str, signal_data: dict, session_id: str):
        """
        Send WebRTC signaling data to a specific user
        signal_type: 'offer', 'answer', 'ice-candidate'
        """
        message = {
            "type": f"webrtc:{signal_type}",
            "session_id": session_id,
            "from_user_id": from_user_id,
            "signal_data": signal_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        success = await self.send_to_user(to_user_id, message)
        if success:
            logger.debug(f"Sent {signal_type} from {from_user_id} to {to_user_id}")
        else:
            logger.warning(f"Failed to send {signal_type} to {to_user_id} - user may be offline")
        
        return success
    
    async def broadcast_to_call_participants(self, participant_user_ids: List[str], message: dict, exclude_user_id: str = None):
        """
        Broadcast a message to all participants in a video call
        """
        disconnected_users = []
        
        for user_id in participant_user_ids:
            if user_id == exclude_user_id:
                continue
            
            if user_id not in self.user_connections:
                continue
            
            try:
                await self.user_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending to call participant {user_id}: {e}")
                disconnected_users.append(user_id)
        
        # Clean up disconnected connections
        for user_id in disconnected_users:
            websocket = self.user_connections.get(user_id)
            if websocket:
                self.disconnect(websocket)
    
    async def notify_incoming_call(self, to_user_id: str, caller_id: str, caller_name: str, session_id: str, call_type: str, video_enabled: bool = True):
        """
        Send incoming call notification to a user
        """
        message = {
            "type": "incoming_call",
            "session_id": session_id,
            "call_type": call_type,
            "caller_id": caller_id,
            "caller_name": caller_name,
            "video_enabled": video_enabled,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        success = await self.send_to_user(to_user_id, message)
        if success:
            logger.info(f"Sent incoming call notification to {to_user_id} from {caller_name}")
        
        return success
    
    async def notify_call_event(self, user_id: str, event_type: str, session_id: str, data: dict = None):
        """
        Notify a user about a call event (participant joined/left, call ended, etc.)
        """
        message = {
            "type": event_type,
            "session_id": session_id,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        return await self.send_to_user(user_id, message)


# Global connection manager instance
manager = ConnectionManager()
