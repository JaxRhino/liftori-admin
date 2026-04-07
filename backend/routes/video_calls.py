"""
Video Call Routes for Platform Chat
Handles video call session management and WebRTC signaling
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from typing import List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging
import os
import sys

from auth import get_current_user

# Add the models folder to path for video_call_models
_models_path = os.path.join(os.path.dirname(__file__), '..', 'models')
if _models_path not in sys.path:
    sys.path.insert(0, _models_path)
from video_call_models import (
    VideoCallSession, VideoCallParticipant, MediaState,
    CreateCallRequest, JoinCallRequest, UpdateMediaStateRequest,
    CallResponse, IncomingCallNotification,
    CallType, CallStatus, ParticipantStatus, CallEventType
)

logger = logging.getLogger(__name__)

# Will be initialized by server.py
db = None
websocket_manager = None

def init_video_routes(database, ws_manager=None):
    """Initialize video routes with database and WebSocket manager"""
    global db, websocket_manager
    db = database
    websocket_manager = ws_manager

router = APIRouter()

# Default ICE servers (public STUN servers)
DEFAULT_ICE_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
    {"urls": "stun:stun2.l.google.com:19302"},
    {"urls": "stun:stun3.l.google.com:19302"},
    {"urls": "stun:stun4.l.google.com:19302"},
]

MAX_PARTICIPANTS = 20


# ========================
# Helper Functions
# ========================

async def get_user_name(user_id: str) -> str:
    """Get user's display name from database"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
    if user:
        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        return name if name else user.get("email", "Unknown User")
    return "Unknown User"


async def notify_user_of_call(user_id: str, notification: dict):
    """Send call notification to a specific user via WebSocket"""
    logger.info(f"Attempting to notify user {user_id} of incoming call")
    if websocket_manager:
        result = await websocket_manager.send_to_user(user_id, notification)
        logger.info(f"Notification sent to {user_id}: result={result}")
    else:
        logger.warning("WebSocket manager not initialized - cannot send notification")


async def broadcast_call_event(session_id: str, event_type: str, data: dict):
    """Broadcast call event to all participants in a session"""
    participants = await db.video_call_participants.find(
        {"session_id": session_id, "status": ParticipantStatus.CONNECTED.value},
        {"_id": 0, "user_id": 1}
    ).to_list(100)
    
    logger.info(f"Broadcasting {event_type} to {len(participants)} participants in session {session_id}")
    
    event = {
        "type": event_type,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **data
    }
    
    if websocket_manager:
        for p in participants:
            result = await websocket_manager.send_to_user(p["user_id"], event)
            logger.info(f"  -> Sent to {p['user_id']}: {result}")


# ========================
# Call Session Endpoints
# ========================

@router.post("/video/calls")
async def create_call(
    request: CreateCallRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Initiate a new video call
    Creates session and invites specified participants
    """
    user_id = current_user["user_id"]
    user_name = await get_user_name(user_id)
    
    # Validate participant count
    if len(request.participant_user_ids) >= MAX_PARTICIPANTS:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot invite more than {MAX_PARTICIPANTS - 1} participants"
        )
    
    # Create session
    session_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Get channel name if channel_id provided
    channel_name = None
    if request.channel_id:
        channel = await db.chat_channels.find_one({"id": request.channel_id}, {"_id": 0, "name": 1})
        if channel:
            channel_name = channel.get("name")
    
    session = {
        "id": session_id,
        "channel_id": request.channel_id,
        "call_type": request.call_type.value,
        "title": request.title,
        "initiated_by": user_id,
        "initiated_by_name": user_name,
        "participant_ids": [user_id] + request.participant_user_ids,
        "status": CallStatus.PENDING.value,
        "max_participants": MAX_PARTICIPANTS,
        "created_at": now,
        "started_at": None,
        "ended_at": None,
        "duration_seconds": None,
        "recording_enabled": False,
        "recording_url": None,
        "settings": {
            "video_enabled": request.video_enabled,
            "audio_enabled": request.audio_enabled
        }
    }
    
    await db.video_call_sessions.insert_one(session.copy())
    
    # Create participant record for initiator (host)
    host_participant = {
        "id": str(uuid4()),
        "session_id": session_id,
        "user_id": user_id,
        "user_name": user_name,
        "status": ParticipantStatus.CONNECTED.value,
        "role": "host",
        "media_state": {
            "audio_enabled": request.audio_enabled,
            "video_enabled": request.video_enabled,
            "screen_sharing": False,
            "speaking": False
        },
        "invited_at": now,
        "joined_at": now,
        "left_at": None,
        "connection_quality": None,
        "peer_id": None
    }
    await db.video_call_participants.insert_one(host_participant.copy())
    
    participants = [host_participant]
    
    # Create participant records for invited users and notify them
    for invitee_id in request.participant_user_ids:
        invitee_name = await get_user_name(invitee_id)
        
        participant = {
            "id": str(uuid4()),
            "session_id": session_id,
            "user_id": invitee_id,
            "user_name": invitee_name,
            "status": ParticipantStatus.RINGING.value,
            "role": "participant",
            "media_state": {
                "audio_enabled": True,
                "video_enabled": True,
                "screen_sharing": False,
                "speaking": False
            },
            "invited_at": now,
            "joined_at": None,
            "left_at": None,
            "connection_quality": None,
            "peer_id": None
        }
        await db.video_call_participants.insert_one(participant.copy())
        participants.append(participant)
        
        # Send incoming call notification
        notification = {
            "type": "incoming_call",
            "session_id": session_id,
            "call_type": request.call_type.value,
            "caller_id": user_id,
            "caller_name": user_name,
            "channel_id": request.channel_id,
            "channel_name": channel_name,
            "video_enabled": request.video_enabled,
            "timestamp": now
        }
        await notify_user_of_call(invitee_id, notification)
    
    logger.info(f"Video call created: {session_id} by {user_name}")
    
    return {
        "session": session,
        "participants": participants,
        "ice_servers": DEFAULT_ICE_SERVERS
    }


@router.get("/video/calls/active")
async def get_active_calls(
    current_user: dict = Depends(get_current_user)
):
    """Get user's active calls and incoming call invitations"""
    user_id = current_user["user_id"]
    
    # Get sessions where user is a connected participant or ringing
    participant_records = await db.video_call_participants.find(
        {
            "user_id": user_id,
            "status": {"$in": [ParticipantStatus.CONNECTED.value, ParticipantStatus.RINGING.value]}
        },
        {"_id": 0, "session_id": 1, "status": 1}
    ).to_list(10)
    
    session_ids = [p["session_id"] for p in participant_records]
    
    if not session_ids:
        return {"active_calls": [], "incoming_calls": []}
    
    sessions = await db.video_call_sessions.find(
        {
            "id": {"$in": session_ids},
            "status": {"$in": [CallStatus.PENDING.value, CallStatus.ACTIVE.value]}
        },
        {"_id": 0}
    ).to_list(10)
    
    # Categorize
    active_calls = []
    incoming_calls = []
    
    for session in sessions:
        participant = next((p for p in participant_records if p["session_id"] == session["id"]), None)
        if participant:
            if participant["status"] == ParticipantStatus.RINGING.value:
                incoming_calls.append(session)
            else:
                active_calls.append(session)
    
    return {"active_calls": active_calls, "incoming_calls": incoming_calls}


@router.get("/video/calls/{session_id}")
async def get_call(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get call session details"""
    user_id = current_user["user_id"]
    
    session = await db.video_call_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    
    # Check if user is participant
    if user_id not in session.get("participant_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized to view this call")
    
    participants = await db.video_call_participants.find(
        {"session_id": session_id},
        {"_id": 0}
    ).to_list(MAX_PARTICIPANTS)
    
    return {
        "session": session,
        "participants": participants,
        "ice_servers": DEFAULT_ICE_SERVERS
    }


@router.post("/video/calls/{session_id}/join")
async def join_call(
    session_id: str,
    request: JoinCallRequest,
    current_user: dict = Depends(get_current_user)
):
    """Join an existing video call"""
    user_id = current_user["user_id"]
    user_name = await get_user_name(user_id)
    now = datetime.now(timezone.utc).isoformat()
    
    # Get session
    session = await db.video_call_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    
    if session["status"] == CallStatus.ENDED.value:
        raise HTTPException(status_code=400, detail="Call has already ended")
    
    # Check participant count
    connected_count = await db.video_call_participants.count_documents({
        "session_id": session_id,
        "status": ParticipantStatus.CONNECTED.value
    })
    
    if connected_count >= MAX_PARTICIPANTS:
        raise HTTPException(status_code=400, detail="Call is at maximum capacity")
    
    # Check if user has a participant record
    participant = await db.video_call_participants.find_one(
        {"session_id": session_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if participant:
        # Update existing participant
        await db.video_call_participants.update_one(
            {"session_id": session_id, "user_id": user_id},
            {"$set": {
                "status": ParticipantStatus.CONNECTED.value,
                "joined_at": now,
                "media_state.audio_enabled": request.audio_enabled,
                "media_state.video_enabled": request.video_enabled
            }}
        )
    else:
        # Create new participant record (for joining via link)
        participant = {
            "id": str(uuid4()),
            "session_id": session_id,
            "user_id": user_id,
            "user_name": user_name,
            "status": ParticipantStatus.CONNECTED.value,
            "role": "participant",
            "media_state": {
                "audio_enabled": request.audio_enabled,
                "video_enabled": request.video_enabled,
                "screen_sharing": False,
                "speaking": False
            },
            "invited_at": now,
            "joined_at": now,
            "left_at": None,
            "connection_quality": None,
            "peer_id": None
        }
        await db.video_call_participants.insert_one(participant.copy())
        
        # Add to session participant_ids
        await db.video_call_sessions.update_one(
            {"id": session_id},
            {"$addToSet": {"participant_ids": user_id}}
        )
    
    # If this is the first join (or second for 1:1), activate the call
    if session["status"] == CallStatus.PENDING.value:
        await db.video_call_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": CallStatus.ACTIVE.value,
                "started_at": now
            }}
        )
    
    # Broadcast participant joined event
    await broadcast_call_event(session_id, "call:participant_joined", {
        "user_id": user_id,
        "user_name": user_name,
        "media_state": {
            "audio_enabled": request.audio_enabled,
            "video_enabled": request.video_enabled,
            "screen_sharing": False
        }
    })
    
    # Get updated session and participants
    session = await db.video_call_sessions.find_one({"id": session_id}, {"_id": 0})
    participants = await db.video_call_participants.find(
        {"session_id": session_id},
        {"_id": 0}
    ).to_list(MAX_PARTICIPANTS)
    
    logger.info(f"User {user_name} joined call {session_id}")
    
    return {
        "session": session,
        "participants": participants,
        "ice_servers": DEFAULT_ICE_SERVERS
    }


@router.post("/video/calls/{session_id}/leave")
async def leave_call(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Leave a video call"""
    user_id = current_user["user_id"]
    user_name = await get_user_name(user_id)
    now = datetime.now(timezone.utc).isoformat()
    
    # Update participant status
    result = await db.video_call_participants.update_one(
        {"session_id": session_id, "user_id": user_id},
        {"$set": {
            "status": ParticipantStatus.LEFT.value,
            "left_at": now
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Participant not found in call")
    
    # Broadcast participant left event
    await broadcast_call_event(session_id, "call:participant_left", {
        "user_id": user_id,
        "user_name": user_name
    })
    
    # Check if any participants remain
    remaining = await db.video_call_participants.count_documents({
        "session_id": session_id,
        "status": ParticipantStatus.CONNECTED.value
    })
    
    # If no participants remain, end the call
    if remaining == 0:
        session = await db.video_call_sessions.find_one({"id": session_id}, {"_id": 0})
        started_at = session.get("started_at")
        
        duration = None
        if started_at:
            start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            end = datetime.now(timezone.utc)
            duration = int((end - start).total_seconds())
        
        await db.video_call_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": CallStatus.ENDED.value,
                "ended_at": now,
                "duration_seconds": duration
            }}
        )
        
        await broadcast_call_event(session_id, "call:ended", {
            "reason": "all_participants_left",
            "duration_seconds": duration
        })
        
        logger.info(f"Call {session_id} ended - all participants left")
    
    logger.info(f"User {user_name} left call {session_id}")
    
    return {"success": True, "remaining_participants": remaining}


@router.post("/video/calls/{session_id}/end")
async def end_call(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End a video call (host only)"""
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Verify user is the host
    host = await db.video_call_participants.find_one({
        "session_id": session_id,
        "user_id": user_id,
        "role": "host"
    })
    
    if not host:
        raise HTTPException(status_code=403, detail="Only the host can end the call")
    
    session = await db.video_call_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    
    started_at = session.get("started_at")
    duration = None
    if started_at:
        start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
        end = datetime.now(timezone.utc)
        duration = int((end - start).total_seconds())
    
    # Update session
    await db.video_call_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": CallStatus.ENDED.value,
            "ended_at": now,
            "duration_seconds": duration
        }}
    )
    
    # Update all connected participants
    await db.video_call_participants.update_many(
        {"session_id": session_id, "status": ParticipantStatus.CONNECTED.value},
        {"$set": {
            "status": ParticipantStatus.LEFT.value,
            "left_at": now
        }}
    )
    
    # Broadcast call ended event
    await broadcast_call_event(session_id, "call:ended", {
        "reason": "host_ended",
        "duration_seconds": duration
    })
    
    logger.info(f"Call {session_id} ended by host")
    
    return {"success": True, "duration_seconds": duration}


@router.post("/video/calls/{session_id}/decline")
async def decline_call(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Decline an incoming call"""
    user_id = current_user["user_id"]
    user_name = await get_user_name(user_id)
    now = datetime.now(timezone.utc).isoformat()
    
    # Update participant status
    result = await db.video_call_participants.update_one(
        {"session_id": session_id, "user_id": user_id, "status": ParticipantStatus.RINGING.value},
        {"$set": {
            "status": ParticipantStatus.DECLINED.value,
            "left_at": now
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No ringing call found to decline")
    
    # Notify the caller
    session = await db.video_call_sessions.find_one({"id": session_id}, {"_id": 0})
    if session:
        await notify_user_of_call(session["initiated_by"], {
            "type": "call_declined",
            "session_id": session_id,
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": now
        })
        
        # For 1:1 calls, if declined, mark session as declined
        if session["call_type"] == CallType.ONE_ON_ONE.value:
            await db.video_call_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    "status": CallStatus.DECLINED.value,
                    "ended_at": now
                }}
            )
    
    logger.info(f"User {user_name} declined call {session_id}")
    
    return {"success": True}


# ========================
# Media Control Endpoints
# ========================

@router.patch("/video/calls/{session_id}/media")
async def update_media_state(
    session_id: str,
    request: UpdateMediaStateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update participant's media state (mute/unmute, camera on/off, screen share)"""
    user_id = current_user["user_id"]
    user_name = await get_user_name(user_id)
    
    # Build update dict
    update_fields = {}
    if request.audio_enabled is not None:
        update_fields["media_state.audio_enabled"] = request.audio_enabled
    if request.video_enabled is not None:
        update_fields["media_state.video_enabled"] = request.video_enabled
    if request.screen_sharing is not None:
        update_fields["media_state.screen_sharing"] = request.screen_sharing
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No media state changes provided")
    
    result = await db.video_call_participants.update_one(
        {"session_id": session_id, "user_id": user_id, "status": ParticipantStatus.CONNECTED.value},
        {"$set": update_fields}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Participant not found in active call")
    
    # Broadcast media change event
    event_type = "call:media_changed"
    if request.screen_sharing is True:
        event_type = "call:screen_share_started"
    elif request.screen_sharing is False:
        event_type = "call:screen_share_stopped"
    
    await broadcast_call_event(session_id, event_type, {
        "user_id": user_id,
        "user_name": user_name,
        "audio_enabled": request.audio_enabled,
        "video_enabled": request.video_enabled,
        "screen_sharing": request.screen_sharing
    })
    
    return {"success": True}


# ========================
# WebRTC Signaling Endpoints
# ========================

@router.post("/video/calls/{session_id}/signal")
async def relay_signal(
    session_id: str,
    signal_type: str = Query(..., description="Signal type: offer, answer, ice-candidate"),
    to_user_id: str = Query(..., description="Target user ID"),
    signal_data: dict = Body(..., description="WebRTC signal data"),
    current_user: dict = Depends(get_current_user)
):
    """
    Relay WebRTC signaling message to another participant
    This endpoint forwards SDP offers/answers and ICE candidates
    """
    from_user_id = current_user["user_id"]
    
    # Verify both users are in the call
    from_participant = await db.video_call_participants.find_one({
        "session_id": session_id,
        "user_id": from_user_id,
        "status": ParticipantStatus.CONNECTED.value
    })
    
    to_participant = await db.video_call_participants.find_one({
        "session_id": session_id,
        "user_id": to_user_id,
        "status": ParticipantStatus.CONNECTED.value
    })
    
    if not from_participant:
        raise HTTPException(status_code=403, detail="You are not in this call")
    
    if not to_participant:
        raise HTTPException(status_code=404, detail="Target participant not found in call")
    
    # Relay signal via WebSocket
    signal_message = {
        "type": f"webrtc:{signal_type}",
        "session_id": session_id,
        "from_user_id": from_user_id,
        "from_user_name": from_participant.get("user_name"),
        "signal_data": signal_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if websocket_manager:
        result = await websocket_manager.send_to_user(to_user_id, signal_message)
        logger.info(f"Signal {signal_type} from {from_user_id[:8]} to {to_user_id[:8]}: sent={result}")
    else:
        logger.warning("WebSocket manager not available for signaling")
    
    return {"success": True}


# ========================
# Call History Endpoints
# ========================

@router.get("/video/calls")
async def get_call_history(
    limit: int = 20,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's call history"""
    user_id = current_user["user_id"]
    
    query = {"participant_ids": user_id}
    if status:
        query["status"] = status
    
    calls = await db.video_call_sessions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"calls": calls, "count": len(calls)}


# ========================
# Channel Video Call Helpers
# ========================

@router.get("/video/calls/channel/{channel_id}/active")
async def get_channel_active_call(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if there's an active call in a channel"""
    
    active_call = await db.video_call_sessions.find_one(
        {
            "channel_id": channel_id,
            "status": {"$in": [CallStatus.PENDING.value, CallStatus.ACTIVE.value]}
        },
        {"_id": 0}
    )
    
    if not active_call:
        return {"has_active_call": False, "session": None}
    
    # Get participant count
    participant_count = await db.video_call_participants.count_documents({
        "session_id": active_call["id"],
        "status": ParticipantStatus.CONNECTED.value
    })
    
    return {
        "has_active_call": True,
        "session": active_call,
        "participant_count": participant_count
    }
