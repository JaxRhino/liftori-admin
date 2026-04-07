"""
Video Service - Provider-abstracted video conferencing for L10 meetings
Supports multiple providers with adapter pattern for easy swapping
"""
import os
import logging
import httpx
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class VideoProvider(ABC):
    """Abstract base class for video providers"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name identifier"""
        pass
    
    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider is properly configured"""
        pass
    
    @abstractmethod
    async def create_room(self, room_name: str, meeting_id: str, **kwargs) -> Dict[str, Any]:
        """Create a video room"""
        pass
    
    @abstractmethod
    async def delete_room(self, room_id: str) -> bool:
        """Delete a video room"""
        pass
    
    @abstractmethod
    async def create_token(self, room_name: str, user_id: str, user_name: str, is_moderator: bool = False, **kwargs) -> Dict[str, Any]:
        """Create a meeting token for a user"""
        pass
    
    @abstractmethod
    def get_join_url(self, room_name: str, token: str = None) -> str:
        """Get the URL to join a room"""
        pass


class DailyProvider(VideoProvider):
    """Daily.co video provider implementation"""
    
    def __init__(self):
        self.api_key = os.environ.get('DAILY_API_KEY')
        self.domain = os.environ.get('DAILY_DOMAIN', '')  # e.g., yourcompany.daily.co
        self.base_url = "https://api.daily.co/v1"
    
    @property
    def name(self) -> str:
        return "daily"
    
    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)
    
    async def create_room(self, room_name: str, meeting_id: str, **kwargs) -> Dict[str, Any]:
        """Create a Daily room"""
        if not self.is_configured:
            return {"error": "Daily API key not configured", "room_id": None}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/rooms",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "name": room_name,
                        "properties": {
                            "enable_prejoin_ui": True,
                            "enable_screenshare": True,
                            "enable_chat": True,
                            "enable_knocking": False,
                            "max_participants": kwargs.get('max_participants', 20),
                            "exp": int((datetime.now(timezone.utc) + timedelta(hours=4)).timestamp())
                        }
                    },
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    return {
                        "room_id": data.get('name'),
                        "room_url": data.get('url'),
                        "provider": self.name,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    logger.error(f"Daily create room failed: {response.text}")
                    return {"error": f"Failed to create room: {response.text}", "room_id": None}
                    
        except Exception as e:
            logger.error(f"Daily create room error: {str(e)}")
            return {"error": str(e), "room_id": None}
    
    async def delete_room(self, room_id: str) -> bool:
        """Delete a Daily room"""
        if not self.is_configured:
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/rooms/{room_id}",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=30.0
                )
                return response.status_code in [200, 204, 404]  # 404 means already deleted
        except Exception as e:
            logger.error(f"Daily delete room error: {str(e)}")
            return False
    
    async def create_token(self, room_name: str, user_id: str, user_name: str, is_moderator: bool = False, **kwargs) -> Dict[str, Any]:
        """Create a Daily meeting token"""
        if not self.is_configured:
            return {"error": "Daily API key not configured", "token": None}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/meeting-tokens",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "properties": {
                            "room_name": room_name,
                            "user_name": user_name,
                            "user_id": user_id,
                            "is_owner": is_moderator,
                            "enable_screenshare": True,
                            "start_audio_off": False,
                            "start_video_off": False,
                            "exp": int((datetime.now(timezone.utc) + timedelta(hours=4)).timestamp())
                        }
                    },
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    return {
                        "token": data.get('token'),
                        "room_name": room_name,
                        "user_id": user_id,
                        "provider": self.name
                    }
                else:
                    logger.error(f"Daily create token failed: {response.text}")
                    return {"error": f"Failed to create token: {response.text}", "token": None}
                    
        except Exception as e:
            logger.error(f"Daily create token error: {str(e)}")
            return {"error": str(e), "token": None}
    
    def get_join_url(self, room_name: str, token: str = None) -> str:
        """Get Daily join URL"""
        base = f"https://{self.domain}/{room_name}" if self.domain else f"https://yourcompany.daily.co/{room_name}"
        if token:
            return f"{base}?t={token}"
        return base


class LiveKitProvider(VideoProvider):
    """LiveKit video provider implementation (for future use)"""
    
    def __init__(self):
        self.api_key = os.environ.get('LIVEKIT_API_KEY')
        self.api_secret = os.environ.get('LIVEKIT_API_SECRET')
        self.host = os.environ.get('LIVEKIT_HOST', '')
    
    @property
    def name(self) -> str:
        return "livekit"
    
    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_secret and self.host)
    
    async def create_room(self, room_name: str, meeting_id: str, **kwargs) -> Dict[str, Any]:
        """Create a LiveKit room - placeholder for future implementation"""
        if not self.is_configured:
            return {"error": "LiveKit not configured", "room_id": None}
        # TODO: Implement LiveKit room creation
        return {"error": "LiveKit not yet implemented", "room_id": None}
    
    async def delete_room(self, room_id: str) -> bool:
        """Delete a LiveKit room - placeholder"""
        return False
    
    async def create_token(self, room_name: str, user_id: str, user_name: str, is_moderator: bool = False, **kwargs) -> Dict[str, Any]:
        """Create a LiveKit token - placeholder"""
        if not self.is_configured:
            return {"error": "LiveKit not configured", "token": None}
        # TODO: Implement LiveKit token generation
        return {"error": "LiveKit not yet implemented", "token": None}
    
    def get_join_url(self, room_name: str, token: str = None) -> str:
        """Get LiveKit join URL"""
        return f"{self.host}/room/{room_name}"


class MockVideoProvider(VideoProvider):
    """Mock video provider for development/testing when no provider is configured"""
    
    def __init__(self):
        self._rooms = {}
    
    @property
    def name(self) -> str:
        return "mock"
    
    @property
    def is_configured(self) -> bool:
        return True  # Always available
    
    async def create_room(self, room_name: str, meeting_id: str, **kwargs) -> Dict[str, Any]:
        """Create a mock room"""
        room_id = f"mock-{room_name}"
        self._rooms[room_id] = {
            "name": room_name,
            "meeting_id": meeting_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        return {
            "room_id": room_id,
            "room_url": f"/video/mock/{room_name}",
            "provider": self.name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_mock": True
        }
    
    async def delete_room(self, room_id: str) -> bool:
        """Delete a mock room"""
        if room_id in self._rooms:
            del self._rooms[room_id]
        return True
    
    async def create_token(self, room_name: str, user_id: str, user_name: str, is_moderator: bool = False, **kwargs) -> Dict[str, Any]:
        """Create a mock token"""
        return {
            "token": f"mock-token-{user_id}-{room_name}",
            "room_name": room_name,
            "user_id": user_id,
            "user_name": user_name,
            "is_moderator": is_moderator,
            "provider": self.name,
            "is_mock": True
        }
    
    def get_join_url(self, room_name: str, token: str = None) -> str:
        """Get mock join URL"""
        return f"/video/mock/{room_name}?token={token or 'none'}"


class VideoService:
    """
    Video service with provider abstraction
    Automatically selects the best available provider
    """
    
    def __init__(self):
        self.providers: Dict[str, VideoProvider] = {
            "daily": DailyProvider(),
            "livekit": LiveKitProvider(),
            "mock": MockVideoProvider()
        }
        self._active_provider = None
    
    @property
    def active_provider(self) -> VideoProvider:
        """Get the active/configured provider"""
        if self._active_provider:
            return self._active_provider
        
        # Auto-select first configured provider
        for name in ["daily", "livekit"]:  # Priority order
            provider = self.providers.get(name)
            if provider and provider.is_configured:
                self._active_provider = provider
                logger.info(f"Video service using provider: {name}")
                return provider
        
        # Fall back to mock
        self._active_provider = self.providers["mock"]
        logger.warning("Video service using MOCK provider - configure DAILY_API_KEY for real video")
        return self._active_provider
    
    def set_provider(self, provider_name: str) -> bool:
        """Manually set the active provider"""
        provider = self.providers.get(provider_name)
        if provider:
            self._active_provider = provider
            return True
        return False
    
    def get_provider_status(self) -> Dict[str, Any]:
        """Get status of all providers"""
        return {
            "active": self.active_provider.name,
            "providers": {
                name: {
                    "configured": provider.is_configured,
                    "active": provider == self.active_provider
                }
                for name, provider in self.providers.items()
            }
        }
    
    async def create_room(self, room_name: str, meeting_id: str, **kwargs) -> Dict[str, Any]:
        """Create a video room using the active provider"""
        return await self.active_provider.create_room(room_name, meeting_id, **kwargs)
    
    async def delete_room(self, room_id: str) -> bool:
        """Delete a video room"""
        return await self.active_provider.delete_room(room_id)
    
    async def create_token(self, room_name: str, user_id: str, user_name: str, is_moderator: bool = False, **kwargs) -> Dict[str, Any]:
        """Create a meeting token for a user"""
        return await self.active_provider.create_token(room_name, user_id, user_name, is_moderator, **kwargs)
    
    def get_join_url(self, room_name: str, token: str = None) -> str:
        """Get the URL to join a room"""
        return self.active_provider.get_join_url(room_name, token)


# Singleton instance
video_service = VideoService()


def get_video_service() -> VideoService:
    """Get the video service instance"""
    return video_service
