"""
Video Call Models for Platform Chat
Defines database schemas and Pydantic models for video calling functionality
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum


class CallType(str, Enum):
    """Type of video call"""
    ONE_ON_ONE = "one_on_one"
    GROUP = "group"


class CallStatus(str, Enum):
    """Status of a video call session"""
    PENDING = "pending"          # Call initiated, waiting for participants
    ACTIVE = "active"            # Call in progress
    ENDED = "ended"              # Call ended normally
    MISSED = "missed"            # Call not answered
    DECLINED = "declined"        # Call was declined


class ParticipantStatus(str, Enum):
    """Status of a participant in a call"""
    INVITED = "invited"          # Invited but not yet joined
    RINGING = "ringing"          # Being notified of incoming call
    JOINING = "joining"          # In process of joining
    CONNECTED = "connected"      # Actively in the call
    RECONNECTING = "reconnecting"  # Lost connection, trying to rejoin
    LEFT = "left"                # Left the call
    DECLINED = "declined"        # Declined the invitation


class MediaState(BaseModel):
    """Media state for a participant"""
    audio_enabled: bool = True
    video_enabled: bool = True
    screen_sharing: bool = False
    speaking: bool = False


# ========================
# Database Document Schemas
# ========================

class VideoCallSession(BaseModel):
    """
    Video Call Session Document
    Stored in: video_call_sessions collection
    """
    id: str = Field(..., description="Unique session ID")
    channel_id: Optional[str] = Field(None, description="Associated chat channel (for group calls)")
    
    # Call metadata
    call_type: CallType = Field(CallType.ONE_ON_ONE, description="Type of call")
    title: Optional[str] = Field(None, description="Optional call title for group calls")
    
    # Initiator info
    initiated_by: str = Field(..., description="User ID who started the call")
    initiated_by_name: str = Field(..., description="Name of call initiator")
    
    # Participant IDs (for quick lookup)
    participant_ids: List[str] = Field(default_factory=list, description="List of all participant user IDs")
    
    # Call state
    status: CallStatus = Field(CallStatus.PENDING, description="Current call status")
    max_participants: int = Field(20, description="Maximum allowed participants")
    
    # Timestamps
    created_at: str = Field(..., description="When session was created")
    started_at: Optional[str] = Field(None, description="When first participant joined")
    ended_at: Optional[str] = Field(None, description="When call ended")
    
    # Duration (in seconds, calculated on end)
    duration_seconds: Optional[int] = Field(None, description="Total call duration")
    
    # Recording (future feature)
    recording_enabled: bool = Field(False, description="Whether call is being recorded")
    recording_url: Optional[str] = Field(None, description="URL to recording if available")
    
    # Settings
    settings: Dict[str, Any] = Field(default_factory=dict, description="Call settings")


class VideoCallParticipant(BaseModel):
    """
    Video Call Participant Document
    Stored in: video_call_participants collection
    One document per participant per call
    """
    id: str = Field(..., description="Unique participant record ID")
    session_id: str = Field(..., description="Reference to VideoCallSession.id")
    user_id: str = Field(..., description="User's ID")
    user_name: str = Field(..., description="User's display name")
    
    # Participant state
    status: ParticipantStatus = Field(ParticipantStatus.INVITED)
    role: str = Field("participant", description="Role: host, co-host, participant")
    
    # Media state
    media_state: MediaState = Field(default_factory=MediaState)
    
    # Timestamps
    invited_at: str = Field(..., description="When user was invited")
    joined_at: Optional[str] = Field(None, description="When user joined the call")
    left_at: Optional[str] = Field(None, description="When user left the call")
    
    # Connection info (for WebRTC debugging)
    connection_quality: Optional[str] = Field(None, description="good, fair, poor")
    peer_id: Optional[str] = Field(None, description="WebRTC peer connection ID")


# ========================
# API Request/Response Models
# ========================

class CreateCallRequest(BaseModel):
    """Request to initiate a new video call"""
    call_type: CallType = CallType.ONE_ON_ONE
    channel_id: Optional[str] = None  # For group calls from a channel
    participant_user_ids: List[str] = Field(default_factory=list, description="Users to invite")
    title: Optional[str] = None
    video_enabled: bool = True
    audio_enabled: bool = True


class JoinCallRequest(BaseModel):
    """Request to join an existing call"""
    video_enabled: bool = True
    audio_enabled: bool = True


class UpdateMediaStateRequest(BaseModel):
    """Request to update participant's media state"""
    audio_enabled: Optional[bool] = None
    video_enabled: Optional[bool] = None
    screen_sharing: Optional[bool] = None


class CallResponse(BaseModel):
    """Response containing call session info"""
    session: VideoCallSession
    participants: List[VideoCallParticipant]
    ice_servers: List[Dict[str, Any]]  # TURN/STUN server configs


class IncomingCallNotification(BaseModel):
    """Notification sent via WebSocket for incoming call"""
    type: str = "incoming_call"
    session_id: str
    call_type: CallType
    caller_id: str
    caller_name: str
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    video_enabled: bool = True


# ========================
# WebRTC Signaling Models
# ========================

class SignalType(str, Enum):
    """Types of WebRTC signaling messages"""
    OFFER = "offer"
    ANSWER = "answer"
    ICE_CANDIDATE = "ice_candidate"
    RENEGOTIATE = "renegotiate"


class WebRTCSignal(BaseModel):
    """WebRTC signaling message sent via WebSocket"""
    type: str  # webrtc:offer, webrtc:answer, webrtc:ice-candidate
    session_id: str
    from_user_id: str
    to_user_id: str  # Target peer
    signal_data: Dict[str, Any]  # SDP or ICE candidate data


class CallEventType(str, Enum):
    """Types of call events broadcast via WebSocket"""
    CALL_STARTED = "call:started"
    CALL_ENDED = "call:ended"
    PARTICIPANT_JOINED = "call:participant_joined"
    PARTICIPANT_LEFT = "call:participant_left"
    PARTICIPANT_MEDIA_CHANGED = "call:media_changed"
    SCREEN_SHARE_STARTED = "call:screen_share_started"
    SCREEN_SHARE_STOPPED = "call:screen_share_stopped"


class CallEvent(BaseModel):
    """Call event broadcast via WebSocket"""
    type: CallEventType
    session_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
