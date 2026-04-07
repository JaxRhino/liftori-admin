from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
from uuid import uuid4
import os
import aiofiles
import logging

from auth import get_current_user

logger = logging.getLogger(__name__)

# Will be initialized by server.py
db = None
websocket_manager = None

def init_chat_routes(database, ws_manager=None):
    """Initialize the chat routes with database and WebSocket manager"""
    global db, websocket_manager
    db = database
    websocket_manager = ws_manager

router = APIRouter()

# Pydantic Models
class Channel(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    type: str  # public, private, direct, job
    job_id: Optional[str] = None
    members: List[str] = []
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    unread_count: int = 0

class Message(BaseModel):
    id: Optional[str] = None
    channel_id: str
    sender_id: str
    sender_name: str
    content: str
    attachments: List[dict] = []
    thread_id: Optional[str] = None
    created_at: Optional[str] = None
    edited_at: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    attachments: List[dict] = []
    thread_id: Optional[str] = None
    linked_job_id: Optional[str] = None
    linked_contact_id: Optional[str] = None


# System message types
SYSTEM_MESSAGE_TYPES = {
    "job_stage_change": "📋 Job Stage Changed",
    "automation_fired": "⚡ Automation Triggered",
    "call_logged": "📞 Call Logged",
    "task_assigned": "✅ Task Assigned",
    "file_uploaded": "📎 File Uploaded"
}

# Prime system user constant
PRIME_SYSTEM_USER = {
    "user_id": "prime-system",
    "sender_name": "🔱 Prime",
    "is_system": True
}


async def post_system_message(
    channel_id: str,
    content: str,
    event_type: str,
    metadata: dict = None,
    linked_job: dict = None,
    linked_contact: dict = None
):
    """Post a system message to a channel (used by automations, hooks, etc.)"""
    global db, websocket_manager
    
    message_dict = {
        "id": str(uuid4()),
        "channel_id": channel_id,
        "sender_id": "system",
        "sender_name": SYSTEM_MESSAGE_TYPES.get(event_type, "🔔 System"),
        "content": content,
        "attachments": [],
        "thread_id": None,
        "mentions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "edited_at": None,
        "message_type": "system",
        "system_event": {
            "type": event_type,
            "metadata": metadata or {}
        },
        "linked_job": linked_job,
        "linked_contact": linked_contact
    }
    
    await db.chat_messages.insert_one(message_dict.copy())
    
    # Update channel activity
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Broadcast via WebSocket
    if websocket_manager:
        await websocket_manager.broadcast_message(channel_id, message_dict)
    
    return message_dict


async def post_prime_message(
    channel_id: str,
    content: str,
    linked_job: dict = None,
    linked_contact: dict = None
):
    """Post a message from Prime AI to a channel"""
    global db, websocket_manager
    
    message_dict = {
        "id": str(uuid4()),
        "channel_id": channel_id,
        "sender_id": PRIME_SYSTEM_USER["user_id"],
        "sender_name": PRIME_SYSTEM_USER["sender_name"],
        "content": content,
        "attachments": [],
        "thread_id": None,
        "mentions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "edited_at": None,
        "message_type": "prime",
        "linked_job": linked_job,
        "linked_contact": linked_contact
    }
    
    await db.chat_messages.insert_one(message_dict.copy())
    
    # Update channel activity
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Broadcast via WebSocket
    if websocket_manager:
        await websocket_manager.broadcast_message(channel_id, message_dict)
    
    return message_dict


# Channel Endpoints
@router.get("/chat/channels")
async def get_channels(
    current_user: dict = Depends(get_current_user)
):
    """Get all channels user has access to"""
    
    # Get channels where user is a member or public channels
    channels = await db.chat_channels.find({
        "$or": [
            {"type": "public"},
            {"members": current_user["user_id"]}
        ]
    }, {"_id": 0}).sort("name", 1).to_list(1000)
    
    # Get unread counts for each channel
    for channel in channels:
        # Get last read timestamp for user in this channel
        last_read = await db.chat_read_status.find_one({
            "user_id": current_user["user_id"],
            "channel_id": channel["id"]
        })
        
        if last_read:
            # Count messages after last read
            unread = await db.chat_messages.count_documents({
                "channel_id": channel["id"],
                "created_at": {"$gt": last_read["last_read_at"]},
                "sender_id": {"$ne": current_user["user_id"]}
            })
            channel["unread_count"] = unread
        else:
            # Count all messages if never read
            unread = await db.chat_messages.count_documents({
                "channel_id": channel["id"],
                "sender_id": {"$ne": current_user["user_id"]}
            })
            channel["unread_count"] = unread
    
    return {"channels": channels}

# Direct Messages
@router.get("/chat/direct-messages")
async def get_direct_messages(
    current_user: dict = Depends(get_current_user)
):
    """Get all DM conversations for the user"""
    
    # Get DM channels where user is a member
    dms = await db.chat_channels.find({
        "type": "direct",
        "members": current_user["user_id"]
    }, {"_id": 0}).sort("last_activity", -1).to_list(1000)
    
    # Also find DMs where user_id might be stored differently
    alt_dms = await db.chat_channels.find({
        "type": "direct",
        "members": {"$in": [current_user["user_id"], current_user.get("email", "")]},
    }, {"_id": 0}).sort("last_activity", -1).to_list(1000)

    # Merge, dedup by id
    seen_ids = set(dm["id"] for dm in dms)
    for adm in alt_dms:
        if adm["id"] not in seen_ids:
            dms.append(adm)
            seen_ids.add(adm["id"])

    # Enrich with other user info and unread counts
    enriched_dms = []
    for dm in dms:
        try:
            # Get other user ID - filter out current user (check both user_id and email)
            my_ids = {current_user["user_id"], current_user.get("email", "")}
            other_user_ids = [uid for uid in dm.get("members", []) if uid not in my_ids]

            if not other_user_ids:
                # Skip if no other user found
                continue

            other_user_id = other_user_ids[0]

            # Get other user info — try id, then user_id, then email
            other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
            if not other_user:
                other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
            if not other_user:
                other_user = await db.users.find_one({"email": other_user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})

            if other_user:
                dm["other_user_name"] = f"{other_user.get('first_name', '')} {other_user.get('last_name', '')}".strip() or other_user.get("email", "Unknown")
                dm["other_user_id"] = other_user_id
            else:
                dm["other_user_name"] = "Unknown User"
                dm["other_user_id"] = other_user_id

            # Get unread count
            last_read = await db.chat_read_status.find_one({
                "user_id": current_user["user_id"],
                "channel_id": dm["id"]
            })

            if last_read:
                unread = await db.chat_messages.count_documents({
                    "channel_id": dm["id"],
                    "created_at": {"$gt": last_read["last_read_at"]},
                    "sender_id": {"$ne": current_user["user_id"]}
                })
                dm["unread_count"] = unread
            else:
                unread = await db.chat_messages.count_documents({
                    "channel_id": dm["id"],
                    "sender_id": {"$ne": current_user["user_id"]}
                })
                dm["unread_count"] = unread

            enriched_dms.append(dm)
        except Exception as e:
            import logging
            logging.error(f"Error enriching DM {dm.get('id')}: {e}")
            dm["other_user_name"] = dm.get("description", "").replace("Direct message with ", "") or "Unknown"
            dm["unread_count"] = 0
            enriched_dms.append(dm)

    return {"direct_messages": enriched_dms}

@router.post("/chat/direct-messages")
async def create_or_get_dm(
    other_user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create or get existing DM with another user"""
    
    # Check if DM already exists
    existing_dm = await db.chat_channels.find_one({
        "type": "direct",
        "members": {"$all": [current_user["user_id"], other_user_id]}
    }, {"_id": 0})
    
    if existing_dm:
        # Enrich with other user info before returning
        other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
        if other_user:
            other_user_name = f"{other_user.get('first_name', '')} {other_user.get('last_name', '')}".strip() or other_user.get("email", "Unknown")
            existing_dm["other_user_name"] = other_user_name
            existing_dm["other_user_id"] = other_user_id
        return existing_dm
    
    # Get other user info
    other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "first_name": 1, "last_name": 1, "email": 1})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    other_user_name = f"{other_user.get('first_name', '')} {other_user.get('last_name', '')}".strip() or other_user.get("email", "Unknown")
    
    # Create new DM channel
    dm_channel = {
        "id": str(uuid4()),
        "name": f"dm-{current_user['user_id']}-{other_user_id}",
        "description": f"Direct message with {other_user_name}",
        "type": "direct",
        "members": [current_user["user_id"], other_user_id],
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_activity": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chat_channels.insert_one(dm_channel.copy())
    
    # Add enriched data for response
    dm_channel["other_user_name"] = other_user_name
    dm_channel["other_user_id"] = other_user_id
    
    return dm_channel

@router.post("/chat/channels")
async def create_channel(
    channel: Channel,
    current_user: dict = Depends(get_current_user)
):
    """Create a new channel"""
    
    # Check if user can create channels (admin or manager)
    allowed_roles = ["super_admin", "admin", "leadership", "ceo", "president", 
                     "general_manager", "director_of_sales", "sales_manager"]
    
    if current_user["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to create channels")
    
    # Check if channel name already exists
    existing = await db.chat_channels.find_one({"name": channel.name})
    if existing:
        raise HTTPException(status_code=400, detail="Channel name already exists")
    
    channel_dict = channel.dict()
    channel_dict["id"] = str(uuid4())
    channel_dict["created_by"] = current_user["user_id"]
    channel_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    channel_dict["last_activity"] = datetime.now(timezone.utc).isoformat()
    
    # Creator is automatically a member
    if current_user["user_id"] not in channel_dict["members"]:
        channel_dict["members"].append(current_user["user_id"])
    
    # Insert a copy to avoid MongoDB adding _id to our dict
    await db.chat_channels.insert_one(channel_dict.copy())
    
    return channel_dict

@router.get("/chat/channels/{channel_id}")
async def get_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get channel details"""
    
    channel = await db.chat_channels.find_one({"id": channel_id}, {"_id": 0})
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check access
    if channel["type"] == "private" and current_user["user_id"] not in channel["members"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this channel")
    
    return channel

# Message Endpoints
@router.get("/chat/channels/{channel_id}/messages")
async def get_messages(
    channel_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get messages in a channel"""
    
    # Verify channel access
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["type"] == "private" and current_user["user_id"] not in channel["members"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this channel")
    
    # Get messages
    messages = await db.chat_messages.find(
        {"channel_id": channel_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Reverse to show oldest first
    messages.reverse()
    
    # Update read status for user
    await db.chat_read_status.update_one(
        {
            "user_id": current_user["user_id"],
            "channel_id": channel_id
        },
        {
            "$set": {
                "last_read_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Enrich messages with latest sender info (name + avatar) from users collection
    sender_ids = list(set(m.get("sender_id") for m in messages if m.get("sender_id")))
    sender_map = {}
    if sender_ids:
        sender_docs = await db.users.find(
            {"$or": [{"id": {"$in": sender_ids}}, {"user_id": {"$in": sender_ids}}]},
            {"_id": 0, "id": 1, "user_id": 1, "first_name": 1, "last_name": 1, "profile_picture": 1, "avatar_url": 1}
        ).to_list(500)
        for s in sender_docs:
            key = s.get("id") or s.get("user_id")
            if key:
                sender_map[key] = s

    for message in messages:
        sid = message.get("sender_id")
        if sid and sid in sender_map:
            s = sender_map[sid]
            name = f"{s.get('first_name', '')} {s.get('last_name', '')}".strip()
            if name:
                message["sender_name"] = name
            avatar = s.get("profile_picture") or s.get("avatar_url")
            if avatar:
                message["sender_avatar"] = avatar

    # Track read receipts for each message
    for message in messages:
        await db.message_read_receipts.update_one(
            {"message_id": message["id"], "user_id": current_user["user_id"]},
            {
                "$set": {
                    "message_id": message["id"],
                    "user_id": current_user["user_id"],
                    "read_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )

    return {"messages": messages}

@router.post("/chat/channels/{channel_id}/messages")
async def create_message(
    channel_id: str,
    message: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to a channel"""
    
    # Verify channel access
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel["type"] == "private" and current_user["user_id"] not in channel["members"]:
        raise HTTPException(status_code=403, detail="Not authorized to post in this channel")
    
    # Get sender's full name, role, and avatar from database
    # Try lookup by 'id' first, then 'user_id', then email as fallback
    user = await db.users.find_one({"id": current_user["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "role": 1, "profile_picture": 1, "avatar_url": 1})
    if not user:
        user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "role": 1, "profile_picture": 1, "avatar_url": 1})
    if not user and current_user.get("email"):
        user = await db.users.find_one({"email": current_user["email"]}, {"_id": 0, "first_name": 1, "last_name": 1, "role": 1, "profile_picture": 1, "avatar_url": 1})

    sender_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else ""
    # Fallback to JWT token fields, then email
    if not sender_name:
        sender_name = f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip()
    if not sender_name:
        sender_name = current_user.get("email", "Unknown User")
    sender_role = user.get("role", current_user.get("role", "")) if user else current_user.get("role", "")
    sender_avatar = user.get("profile_picture") or user.get("avatar_url") or None if user else None
    
    # Parse mentions from message content
    import re
    mention_pattern = r'@(\w+)'
    mentioned_usernames = re.findall(mention_pattern, message.content)
    mentioned_user_ids = []
    
    if mentioned_usernames:
        # Find users by matching username (email prefix or name)
        for username in mentioned_usernames:
            mentioned_user = await db.users.find_one({
                "$or": [
                    {"email": {"$regex": f"^{username}", "$options": "i"}},
                    {"first_name": {"$regex": f"^{username}", "$options": "i"}},
                    {"last_name": {"$regex": f"^{username}", "$options": "i"}}
                ]
            }, {"_id": 0, "id": 1})
            
            if mentioned_user:
                mentioned_user_ids.append(mentioned_user["id"])
    
    message_dict = {
        "id": str(uuid4()),
        "channel_id": channel_id,
        "sender_id": current_user["user_id"],
        "sender_name": sender_name,
        "sender_role": sender_role,
        "sender_avatar": sender_avatar,
        "content": message.content,
        "attachments": message.attachments,
        "thread_id": message.thread_id,
        "mentions": mentioned_user_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "edited_at": None,
        "message_type": "user",
        "linked_job": None,
        "linked_contact": None
    }
    
    # Handle linked job
    if message.linked_job_id:
        job = await db.jobs.find_one({"id": message.linked_job_id}, {"_id": 0, "id": 1, "name": 1, "stage": 1})
        if job:
            message_dict["linked_job"] = {
                "id": job["id"],
                "name": job.get("name", "Unnamed Job"),
                "stage": job.get("stage", "unknown")
            }
    
    # Handle linked contact
    if message.linked_contact_id:
        contact = await db.contacts.find_one({"id": message.linked_contact_id}, {"_id": 0, "id": 1, "first_name": 1, "last_name": 1})
        if contact:
            message_dict["linked_contact"] = {
                "id": contact["id"],
                "name": f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
            }
    
    # Insert message and remove MongoDB's _id from the dict for return
    await db.chat_messages.insert_one(message_dict.copy())
    
    # Check if this is a Prime channel and handle snooze commands
    is_prime_channel = channel.get("is_prime_channel") or "prime-system" in channel.get("members", []) or "dm-prime" in channel.get("name", "")
    if is_prime_channel:
        content_lower = message.content.lower().strip()
        snooze_keywords = ["snooze", "remind me later", "not now", "later"]
        if any(kw in content_lower for kw in snooze_keywords):
            # Import and call the snooze handler
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"http://localhost:8001/api/prime/digest/handle-snooze-reply",
                        json={"user_id": current_user["user_id"], "message": message.content}
                    )
            except Exception as e:
                # Log but don't fail the message send
                import logging
                logging.error(f"Failed to process snooze command: {e}")
    
    # Create notifications for mentioned users
    if mentioned_user_ids:
        for mentioned_id in mentioned_user_ids:
            if mentioned_id != current_user["user_id"]:  # Don't notify self
                notification = {
                    "notification_id": str(uuid4()),
                    "user_id": mentioned_id,
                    "message": f"{sender_name} mentioned you in #{channel.get('name', 'chat')}",
                    "link": f"/chat?channel={channel_id}",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.notifications.insert_one(notification)
    
    # Create notifications for DM messages
    if channel.get("type") == "direct":
        for member_id in channel.get("members", []):
            if member_id != current_user["user_id"]:  # Don't notify self
                notification = {
                    "notification_id": str(uuid4()),
                    "user_id": member_id,
                    "message": f"New message from {sender_name}",
                    "link": f"/chat?channel={channel_id}",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.notifications.insert_one(notification)
    
    # Update channel's last activity
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update sender's read status so they don't see their own message as unread
    await db.chat_read_status.update_one(
        {
            "user_id": current_user["user_id"],
            "channel_id": channel_id
        },
        {
            "$set": {
                "last_read_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Broadcast message via WebSocket
    if websocket_manager:
        await websocket_manager.broadcast_message(channel_id, message_dict)
    
    return message_dict

@router.put("/chat/messages/{message_id}")
async def update_message(
    message_id: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    """Edit a message"""
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender can edit
    if message["sender_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this message")
    
    await db.chat_messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "content": content,
                "edited_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True}

@router.delete("/chat/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message"""
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Only sender or admin can delete
    admin_roles = ["super_admin", "admin"]
    if message["sender_id"] != current_user["user_id"] and current_user["role"] not in admin_roles:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    
    await db.chat_messages.delete_one({"id": message_id})
    
    return {"success": True}

# Thread Management
@router.get("/chat/messages/{message_id}/thread")
async def get_thread_messages(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all messages in a thread"""
    
    # Verify parent message exists
    parent_message = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    if not parent_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Get all thread replies
    thread_messages = await db.chat_messages.find(
        {"thread_id": message_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {
        "parent_message": parent_message,
        "replies": thread_messages,
        "reply_count": len(thread_messages)
    }

@router.get("/chat/channels/{channel_id}/thread-counts")
async def get_thread_counts(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get thread reply counts for messages in a channel"""
    
    # Aggregate to count replies per parent message
    pipeline = [
        {"$match": {"channel_id": channel_id, "thread_id": {"$ne": None}}},
        {"$group": {"_id": "$thread_id", "count": {"$sum": 1}}}
    ]
    
    counts = await db.chat_messages.aggregate(pipeline).to_list(None)
    
    # Convert to dict
    thread_counts = {item["_id"]: item["count"] for item in counts}
    
    return {"thread_counts": thread_counts}

# Mark Channel Notifications as Read
@router.get("/chat/notifications")
async def get_chat_notifications(
    current_user: dict = Depends(get_current_user)
):
    """Get all chat notifications for the current user"""
    
    # Get all chat notifications (those with link starting with /chat)
    notifications = await db.notifications.find({
        "user_id": current_user["user_id"],
        "link": {"$regex": "^/chat"}
    }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    # Count unread
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "link": {"$regex": "^/chat"},
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@router.post("/chat/notifications/{notification_id}/mark-read")
async def mark_chat_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a specific chat notification as read"""
    
    result = await db.notifications.update_one(
        {
            "notification_id": notification_id,
            "user_id": current_user["user_id"]
        },
        {
            "$set": {"read": True}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}

@router.post("/chat/channels/{channel_id}/mark-notifications-read")
async def mark_channel_notifications_read(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark all notifications for this channel as read"""
    
    # Mark all notifications with this channel link as read
    await db.notifications.update_many(
        {
            "user_id": current_user["user_id"],
            "link": {"$regex": f"channel={channel_id}"},
            "read": False
        },
        {
            "$set": {"read": True}
        }
    )
    
    return {"success": True}


@router.post("/chat/notifications/mark-all-viewed")
async def mark_all_chat_notifications_viewed(
    current_user: dict = Depends(get_current_user)
):
    """Mark all chat notifications as viewed/read for the current user"""
    
    result = await db.notifications.update_many(
        {
            "user_id": current_user["user_id"],
            "link": {"$regex": "^/chat"},
            "read": False
        },
        {
            "$set": {
                "read": True,
                "viewed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "marked_count": result.modified_count
    }


# Read Receipts
@router.get("/chat/messages/{message_id}/read-receipts")
async def get_read_receipts(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get who has read a message"""
    
    receipts = await db.message_read_receipts.find(
        {"message_id": message_id},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with user info
    readers = []
    for receipt in receipts:
        user = await db.users.find_one(
            {"id": receipt["user_id"]},
            {"_id": 0, "first_name": 1, "last_name": 1, "email": 1}
        )
        if user:
            readers.append({
                "user_id": receipt["user_id"],
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get("email", "Unknown"),
                "read_at": receipt["read_at"]
            })
    
    return {"readers": readers, "read_count": len(readers)}

# AI Summaries
@router.post("/chat/channels/{channel_id}/summarize")
async def summarize_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate AI summary of channel messages"""
    
    # Get recent messages (last 100)
    messages = await db.chat_messages.find(
        {"channel_id": channel_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    if not messages:
        return {"summary": "No messages to summarize."}
    
    # Reverse to chronological order
    messages.reverse()
    
    # Format messages for AI
    conversation = "\n".join([
        f"{msg['sender_name']} ({msg['created_at']}): {msg['content']}"
        for msg in messages
    ])
    
    # Call OpenAI via emergentintegrations
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        prompt = f"""Please provide a concise summary of this chat conversation. Include:
1. Main topics discussed
2. Key decisions or action items
3. Important information shared

Conversation:
{conversation}

Provide a clear, organized summary in 3-5 paragraphs."""

        chat = LlmChat(
            api_key=os.getenv("EMERGENT_LLM_KEY"),
            session_id=f"summary-{channel_id}",
            system_message="You are a helpful assistant that summarizes conversations."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return {
            "summary": response,
            "message_count": len(messages),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        print(f"Error generating summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

# Users for mentions/DMs
@router.get("/chat/users")
async def get_users_for_chat(
    current_user: dict = Depends(get_current_user)
):
    """Get all users for mentions and DMs"""
    
    users = await db.users.find(
        {},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "email": 1}
    ).to_list(1000)
    
    # Format user list
    user_list = []
    for u in users:
        name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
        user_list.append({
            "id": u["id"],
            "name": name or u.get("email", "Unknown"),
            "email": u.get("email", ""),
            "username": u.get("email", "").split("@")[0] if u.get("email") else ""
        })
    
    return {"users": user_list}

# Search
@router.get("/chat/search")
async def search_messages(
    query: str,
    current_user: dict = Depends(get_current_user)
):
    """Search messages across all accessible channels"""
    
    if not query or len(query) < 2:
        return {"results": []}
    
    # Get all accessible channels
    accessible_channels = await db.chat_channels.find({
        "$or": [
            {"type": "public"},
            {"members": current_user["user_id"]}
        ]
    }, {"_id": 0, "id": 1}).to_list(1000)
    
    channel_ids = [ch["id"] for ch in accessible_channels]
    
    # Search messages in accessible channels
    messages = await db.chat_messages.find({
        "channel_id": {"$in": channel_ids},
        "content": {"$regex": query, "$options": "i"}
    }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    # Enrich with channel info
    for message in messages:
        channel = await db.chat_channels.find_one({"id": message["channel_id"]}, {"_id": 0, "name": 1, "type": 1})
        if channel:
            message["channel_name"] = channel["name"]
            message["channel_type"] = channel["type"]
    
    return {"results": messages, "count": len(messages)}

# Reactions
class ReactionAdd(BaseModel):
    emoji: str

@router.post("/chat/messages/{message_id}/reactions")
async def add_reaction(
    message_id: str,
    reaction: ReactionAdd,
    current_user: dict = Depends(get_current_user)
):
    """Add or remove a reaction to a message"""
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    user_id = current_user["user_id"]
    emoji = reaction.emoji
    
    # Get existing reactions
    reactions = message.get("reactions", {})
    
    # Initialize emoji array if doesn't exist
    if emoji not in reactions:
        reactions[emoji] = []
    
    # Toggle reaction (add if not present, remove if present)
    if user_id in reactions[emoji]:
        reactions[emoji].remove(user_id)
        # Remove empty emoji array
        if not reactions[emoji]:
            del reactions[emoji]
    else:
        reactions[emoji].append(user_id)
    
    # Update message in database
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    return {"success": True, "reactions": reactions}

# Thread Endpoints
@router.get("/chat/messages/{message_id}/thread")
async def get_thread_replies(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all replies in a thread"""
    
    replies = await db.chat_messages.find({
        "thread_id": message_id
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    return {"replies": replies, "count": len(replies)}

@router.post("/chat/messages/{message_id}/reply")
async def reply_to_message(
    message_id: str,
    content: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Reply to a message in a thread"""
    
    # Get parent message
    parent = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent message not found")
    
    # Create reply message
    reply = {
        "id": str(uuid4()),
        "channel_id": parent["channel_id"],
        "thread_id": message_id,  # Link to parent
        "sender_id": current_user["user_id"],
        "sender_name": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "content": content,
        "attachments": [],
        "reactions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "edited_at": None
    }
    
    await db.chat_messages.insert_one(reply.copy())
    
    # Broadcast via WebSocket
    if websocket_manager:
        await websocket_manager.broadcast_message(parent["channel_id"], reply)
    
    return reply

# Pin Message Endpoints
@router.post("/chat/channels/{channel_id}/pin/{message_id}")
async def pin_message(
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pin a message in a channel"""
    
    # Update message
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {"pinned": True, "pinned_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Add to channel's pinned messages list
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$addToSet": {"pinned_messages": message_id}}
    )
    
    return {"success": True, "message": "Message pinned"}

@router.delete("/chat/channels/{channel_id}/pin/{message_id}")
async def unpin_message(
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unpin a message from a channel"""
    
    # Update message
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {"pinned": False}, "$unset": {"pinned_at": ""}}
    )
    
    # Remove from channel's pinned messages list
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$pull": {"pinned_messages": message_id}}
    )
    
    return {"success": True, "message": "Message unpinned"}

@router.get("/chat/channels/{channel_id}/pinned")
async def get_pinned_messages(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all pinned messages in a channel"""
    
    messages = await db.chat_messages.find({
        "channel_id": channel_id,
        "pinned": True
    }, {"_id": 0}).sort("pinned_at", -1).to_list(100)
    
    return {"pinned_messages": messages, "count": len(messages)}

# File Upload
@router.post("/chat/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file for chat"""
    
    # Create uploads directory if it doesn't exist
    upload_dir = "/app/uploads/chat"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    # Get file size
    file_size = len(content)
    
    # Determine file type
    file_type = "file"
    if file.content_type:
        if file.content_type.startswith("image/"):
            file_type = "image"
        elif file.content_type.startswith("video/"):
            file_type = "video"
        elif file.content_type.startswith("audio/"):
            file_type = "audio"
        elif "pdf" in file.content_type:
            file_type = "pdf"
    
    return {
        "file_id": unique_filename,
        "filename": file.filename,
        "file_type": file_type,
        "file_size": file_size,
        "url": f"/uploads/chat/{unique_filename}"
    }

# Member Management
@router.post("/chat/channels/{channel_id}/members")
async def add_member(
    channel_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a member to a channel"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if user can add members (admin or channel creator)
    admin_roles = ["super_admin", "admin"]
    if current_user["user_id"] != channel["created_by"] and current_user["role"] not in admin_roles:
        raise HTTPException(status_code=403, detail="Not authorized to add members")
    
    if user_id in channel["members"]:
        return {"message": "User already a member"}
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$push": {"members": user_id}}
    )
    
    return {"success": True}

@router.delete("/chat/channels/{channel_id}/members/{user_id}")
async def remove_member(
    channel_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from a channel"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if user can remove members (admin or channel creator)
    admin_roles = ["super_admin", "admin"]
    if current_user["user_id"] != channel["created_by"] and current_user["role"] not in admin_roles:
        # Users can remove themselves
        if user_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to remove members")
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$pull": {"members": user_id}}
    )
    
    return {"success": True}


# ===============================
# PHASE 2: Channel Management
# ===============================

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    topic: Optional[str] = None

@router.patch("/chat/channels/{channel_id}")
async def update_channel(
    channel_id: str,
    update: ChannelUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update channel settings (name, description, topic)"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if user can edit channel (admin or channel creator)
    admin_roles = ["super_admin", "admin", "ceo"]
    if current_user["user_id"] != channel.get("created_by") and current_user.get("role") not in admin_roles:
        raise HTTPException(status_code=403, detail="Not authorized to edit this channel")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.chat_channels.update_one(
            {"id": channel_id},
            {"$set": update_data}
        )
    
    updated_channel = await db.chat_channels.find_one({"id": channel_id}, {"_id": 0})
    return updated_channel

@router.post("/chat/channels/{channel_id}/archive")
async def archive_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive a channel"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    admin_roles = ["super_admin", "admin", "ceo"]
    if current_user["user_id"] != channel.get("created_by") and current_user.get("role") not in admin_roles:
        raise HTTPException(status_code=403, detail="Not authorized to archive this channel")
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": "Channel archived"}

@router.post("/chat/channels/{channel_id}/unarchive")
async def unarchive_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unarchive a channel"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    admin_roles = ["super_admin", "admin", "ceo"]
    if current_user["user_id"] != channel.get("created_by") and current_user.get("role") not in admin_roles:
        raise HTTPException(status_code=403, detail="Not authorized to unarchive this channel")
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$set": {"archived": False}, "$unset": {"archived_at": ""}}
    )
    
    return {"success": True, "message": "Channel unarchived"}

@router.delete("/chat/channels/{channel_id}")
async def delete_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a channel (admin only)"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    admin_roles = ["super_admin", "admin", "ceo"]
    if current_user.get("role") not in admin_roles:
        raise HTTPException(status_code=403, detail="Only admins can delete channels")
    
    # Delete all messages in channel
    await db.chat_messages.delete_many({"channel_id": channel_id})
    
    # Delete the channel
    await db.chat_channels.delete_one({"id": channel_id})
    
    return {"success": True, "message": "Channel deleted"}

@router.post("/chat/channels/{channel_id}/leave")
async def leave_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Leave a channel"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if channel.get("type") == "direct":
        raise HTTPException(status_code=400, detail="Cannot leave a direct message")
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$pull": {"members": current_user["user_id"]}}
    )
    
    return {"success": True, "message": "Left channel"}

# ===============================
# PHASE 2: User Preferences (Star, Mute)
# ===============================

@router.post("/chat/channels/{channel_id}/star")
async def star_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Star a channel for quick access"""
    
    user_id = current_user["user_id"]
    
    # Get or create user preferences
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id})
    if not prefs:
        prefs = {"user_id": user_id, "starred_channels": [], "muted_channels": [], "notification_settings": {}}
        await db.chat_user_preferences.insert_one(prefs)
    
    if channel_id not in prefs.get("starred_channels", []):
        await db.chat_user_preferences.update_one(
            {"user_id": user_id},
            {"$addToSet": {"starred_channels": channel_id}}
        )
    
    return {"success": True, "starred": True}

@router.delete("/chat/channels/{channel_id}/star")
async def unstar_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unstar a channel"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$pull": {"starred_channels": channel_id}}
    )
    
    return {"success": True, "starred": False}

@router.post("/chat/channels/{channel_id}/mute")
async def mute_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mute notifications for a channel"""
    
    user_id = current_user["user_id"]
    
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id})
    if not prefs:
        prefs = {"user_id": user_id, "starred_channels": [], "muted_channels": [], "notification_settings": {}}
        await db.chat_user_preferences.insert_one(prefs)
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$addToSet": {"muted_channels": channel_id}}
    )
    
    return {"success": True, "muted": True}

@router.delete("/chat/channels/{channel_id}/mute")
async def unmute_channel(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unmute notifications for a channel"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$pull": {"muted_channels": channel_id}}
    )
    
    return {"success": True, "muted": False}

@router.get("/chat/preferences")
async def get_user_preferences(
    current_user: dict = Depends(get_current_user)
):
    """Get user's chat preferences (starred channels, muted channels, etc.)"""
    
    user_id = current_user["user_id"]
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    
    if not prefs:
        prefs = {
            "user_id": user_id,
            "starred_channels": [],
            "muted_channels": [],
            "notification_settings": {
                "desktop_notifications": True,
                "sound_enabled": True,
                "dnd_enabled": False,
                "dnd_start": None,
                "dnd_end": None
            }
        }
    
    return prefs

class NotificationSettings(BaseModel):
    desktop_notifications: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    dnd_enabled: Optional[bool] = None
    dnd_start: Optional[str] = None
    dnd_end: Optional[str] = None

@router.patch("/chat/preferences/notifications")
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification settings"""
    
    user_id = current_user["user_id"]
    
    # Get or create preferences
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id})

# ===============================
# PHASE 3: Advanced Search
# ===============================

@router.get("/chat/search/advanced")
async def advanced_search(
    query: Optional[str] = None,
    sender_id: Optional[str] = None,
    channel_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    has_files: Optional[bool] = None,
    has_links: Optional[bool] = None,
    is_pinned: Optional[bool] = None,
    in_thread: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Advanced message search with multiple filters"""
    
    # Get all accessible channels
    accessible_channels = await db.chat_channels.find({
        "$or": [
            {"type": "public"},
            {"members": current_user["user_id"]}
        ]
    }, {"_id": 0, "id": 1}).to_list(1000)
    
    accessible_channel_ids = [ch["id"] for ch in accessible_channels]
    
    # Build query
    search_query = {"channel_id": {"$in": accessible_channel_ids}}
    
    if query:
        search_query["content"] = {"$regex": query, "$options": "i"}
    
    if sender_id:
        search_query["sender_id"] = sender_id
    
    if channel_id:
        if channel_id in accessible_channel_ids:
            search_query["channel_id"] = channel_id
        else:
            return {"results": [], "total": 0}
    
    if start_date:
        search_query["created_at"] = {"$gte": start_date}
    
    if end_date:
        if "created_at" in search_query:
            search_query["created_at"]["$lte"] = end_date
        else:
            search_query["created_at"] = {"$lte": end_date}
    
    if has_files:
        search_query["attachments"] = {"$exists": True, "$ne": []}
    
    if has_links:
        search_query["content"] = {"$regex": "https?://", "$options": "i"}
    
    if is_pinned:
        # Get all pinned message IDs
        channels = await db.chat_channels.find(
            {"id": {"$in": accessible_channel_ids}},
            {"pinned_messages": 1}
        ).to_list(1000)
        pinned_ids = []
        for ch in channels:
            pinned_ids.extend(ch.get("pinned_messages", []))
        search_query["id"] = {"$in": pinned_ids}
    
    if in_thread:
        search_query["thread_id"] = {"$exists": True, "$ne": None}
    
    # Execute search
    total = await db.chat_messages.count_documents(search_query)
    messages = await db.chat_messages.find(
        search_query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with channel info
    for message in messages:
        channel = await db.chat_channels.find_one(
            {"id": message["channel_id"]},
            {"_id": 0, "name": 1, "type": 1}
        )
        if channel:
            message["channel_name"] = channel["name"]
            message["channel_type"] = channel["type"]
    
    return {
        "results": messages,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# ===============================
# PHASE 3: Channel Groups (Custom Sidebar Organization)
# ===============================

class ChannelGroup(BaseModel):
    name: str
    channels: List[str] = []
    color: Optional[str] = None
    collapsed: bool = False

@router.get("/chat/channel-groups")
async def get_channel_groups(
    current_user: dict = Depends(get_current_user)
):
    """Get user's custom channel groups for sidebar organization"""
    
    user_id = current_user["user_id"]
    
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    
    if not prefs or "channel_groups" not in prefs:
        # Return default groups
        return {
            "groups": [
                {"id": "starred", "name": "Starred", "channels": prefs.get("starred_channels", []) if prefs else [], "system": True},
                {"id": "channels", "name": "Channels", "channels": [], "system": True},
                {"id": "direct", "name": "Direct Messages", "channels": [], "system": True}
            ]
        }
    
    return {"groups": prefs.get("channel_groups", [])}

@router.post("/chat/channel-groups")
async def create_channel_group(
    group: ChannelGroup,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom channel group"""
    
    user_id = current_user["user_id"]
    
    group_data = {
        "id": str(uuid4()),
        "name": group.name,
        "channels": group.channels,
        "color": group.color,
        "collapsed": group.collapsed,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$push": {"channel_groups": group_data}},
        upsert=True
    )
    
    return group_data

@router.patch("/chat/channel-groups/{group_id}")
async def update_channel_group(
    group_id: str,
    group: ChannelGroup,
    current_user: dict = Depends(get_current_user)
):
    """Update a custom channel group"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id, "channel_groups.id": group_id},
        {"$set": {
            "channel_groups.$.name": group.name,
            "channel_groups.$.channels": group.channels,
            "channel_groups.$.color": group.color,
            "channel_groups.$.collapsed": group.collapsed
        }}
    )
    
    return {"success": True}

@router.delete("/chat/channel-groups/{group_id}")
async def delete_channel_group(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom channel group"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$pull": {"channel_groups": {"id": group_id}}}
    )
    
    return {"success": True}

@router.post("/chat/channel-groups/{group_id}/channels/{channel_id}")
async def add_channel_to_group(
    group_id: str,
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a channel to a custom group"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id, "channel_groups.id": group_id},
        {"$addToSet": {"channel_groups.$.channels": channel_id}}
    )
    
    return {"success": True}

@router.delete("/chat/channel-groups/{group_id}/channels/{channel_id}")
async def remove_channel_from_group(
    group_id: str,
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a channel from a custom group"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id, "channel_groups.id": group_id},
        {"$pull": {"channel_groups.$.channels": channel_id}}
    )
    
    return {"success": True}

# ===============================
# PHASE 3: Announcements
# ===============================

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    priority: str = "normal"  # low, normal, high, urgent
    channel_ids: Optional[List[str]] = None  # None = all channels
    requires_acknowledgment: bool = False
    expires_at: Optional[str] = None

@router.post("/chat/announcements")
async def create_announcement(
    announcement: AnnouncementCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a company-wide or channel-specific announcement (Admin only)"""
    
    admin_roles = ["super_admin", "admin", "ceo"]
    if current_user.get("role") not in admin_roles:
        raise HTTPException(status_code=403, detail="Only admins can create announcements")
    
    announcement_data = {
        "id": str(uuid4()),
        "title": announcement.title,
        "content": announcement.content,
        "priority": announcement.priority,
        "channel_ids": announcement.channel_ids,
        "requires_acknowledgment": announcement.requires_acknowledgment,
        "expires_at": announcement.expires_at,
        "created_by": current_user["user_id"],
        "created_by_name": current_user.get('email', 'System Admin'),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "acknowledged_by": [],
        "is_active": True
    }
    
    await db.chat_announcements.insert_one(announcement_data)
    
    # Get target channels
    if announcement.channel_ids:
        channel_ids = announcement.channel_ids
    else:
        channels = await db.chat_channels.find(
            {"type": {"$ne": "direct"}},
            {"id": 1}
        ).to_list(1000)
        channel_ids = [ch["id"] for ch in channels]
    
    # Post announcement message to each channel
    for channel_id in channel_ids:
        message = {
            "id": str(uuid4()),
            "channel_id": channel_id,
            "sender_id": "system",
            "sender_name": "Company Announcement",
            "content": f"📢 **{announcement.title}**\n\n{announcement.content}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_announcement": True,
            "announcement_id": announcement_data["id"],
            "announcement_priority": announcement.priority
        }
        await db.chat_messages.insert_one(message)
        
        # Broadcast via WebSocket
        if websocket_manager:
            await websocket_manager.broadcast_to_channel(
                channel_id,
                {"type": "new_message", "message": {k: v for k, v in message.items() if k != "_id"}}
            )
    
    # Create audit log
    await create_audit_log(
        action="create_announcement",
        entity_type="announcement",
        entity_id=announcement_data["id"],
        user=current_user,
        details={
            "title": announcement.title,
            "channel_count": len(channel_ids),
            "priority": announcement.priority
        }
    )
    
    # Return announcement data without MongoDB _id
    return {k: v for k, v in announcement_data.items() if k != "_id"}

@router.get("/chat/announcements")
async def get_announcements(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all announcements"""
    
    query = {}
    if active_only:
        query["is_active"] = True
        query["$or"] = [
            {"expires_at": None},
            {"expires_at": {"$gte": datetime.now(timezone.utc).isoformat()}}
        ]
    
    announcements = await db.chat_announcements.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Check if current user has acknowledged
    for ann in announcements:
        ann["user_acknowledged"] = current_user["user_id"] in ann.get("acknowledged_by", [])
    
    return {"announcements": announcements}

@router.post("/chat/announcements/{announcement_id}/acknowledge")
async def acknowledge_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Acknowledge reading an announcement"""
    
    await db.chat_announcements.update_one(
        {"id": announcement_id},
        {"$addToSet": {"acknowledged_by": current_user["user_id"]}}
    )
    
    return {"success": True}

@router.delete("/chat/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete/deactivate an announcement (Admin only)"""
    
    admin_roles = ["super_admin", "admin", "ceo"]
    if current_user.get("role") not in admin_roles:
        raise HTTPException(status_code=403, detail="Only admins can delete announcements")
    
    await db.chat_announcements.update_one(
        {"id": announcement_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True}

# ===============================
# PHASE 3: Quick Actions (CRM Integration Hooks)
# ===============================

class QuickAction(BaseModel):
    action_type: str  # "create_lead", "assign_job", "create_task", "schedule_appointment"
    message_id: str
    data: Optional[dict] = None

@router.post("/chat/quick-actions")
async def execute_quick_action(
    action: QuickAction,
    current_user: dict = Depends(get_current_user)
):
    """Execute a quick action from a chat message (CRM integration)"""
    
    message = await db.chat_messages.find_one({"id": action.message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    result = {
        "action_type": action.action_type,
        "message_id": action.message_id,
        "status": "created",
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    if action.action_type == "create_lead":
        # Create a lead from message content
        lead_data = {
            "id": str(uuid4()),
            "source": "chat",
            "source_message_id": action.message_id,
            "notes": message.get("content", ""),
            "created_by": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "new",
            **(action.data or {})
        }
        await db.leads.insert_one(lead_data)
        result["lead_id"] = lead_data["id"]
        result["message"] = "Lead created from chat message"
        
    elif action.action_type == "create_task":
        # Create a task from message
        task_data = {
            "id": str(uuid4()),
            "title": action.data.get("title", f"Task from chat: {message.get('content', '')[:50]}..."),
            "description": message.get("content", ""),
            "source": "chat",
            "source_message_id": action.message_id,
            "created_by": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",
            "assigned_to": action.data.get("assigned_to"),
            **(action.data or {})
        }
        await db.tasks.insert_one(task_data)
        result["task_id"] = task_data["id"]
        result["message"] = "Task created from chat message"
        
    elif action.action_type == "schedule_appointment":
        result["message"] = "Appointment scheduling - redirect to calendar"
        result["redirect_url"] = "/calendar/new"
        result["prefill_data"] = {
            "notes": message.get("content", ""),
            "source": "chat"
        }
    
    # Log the quick action
    await db.chat_quick_actions_log.insert_one({
        "id": str(uuid4()),
        **result
    })
    
    return result

@router.get("/chat/messages/{message_id}/quick-actions")
async def get_available_quick_actions(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get available quick actions for a message based on content analysis"""
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    content = message.get("content", "").lower()
    actions = []
    
    # Analyze content for relevant actions
    lead_keywords = ["interested", "quote", "estimate", "inquiry", "contact", "customer", "client"]
    task_keywords = ["todo", "task", "follow up", "remind", "action item", "need to"]
    appointment_keywords = ["schedule", "meeting", "appointment", "calendar", "book", "call"]
    
    if any(kw in content for kw in lead_keywords):
        actions.append({
            "type": "create_lead",
            "label": "Create Lead",
            "icon": "user-plus"
        })
    
    if any(kw in content for kw in task_keywords):
        actions.append({
            "type": "create_task",
            "label": "Create Task",
            "icon": "check-square"
        })
    
    if any(kw in content for kw in appointment_keywords):
        actions.append({
            "type": "schedule_appointment",
            "label": "Schedule Appointment",
            "icon": "calendar"
        })
    
    # Always available actions
    actions.extend([
        {"type": "copy_text", "label": "Copy Text", "icon": "copy"},
        {"type": "save_message", "label": "Save Message", "icon": "bookmark"}
    ])
    
    return {"actions": actions, "message_id": message_id}

# ===============================
# PHASE 3: Saved Messages
# ===============================

@router.post("/chat/messages/{message_id}/save")
async def save_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Save a message for later reference"""
    
    user_id = current_user["user_id"]
    
    message = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Add to saved messages
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$addToSet": {"saved_messages": {
            "message_id": message_id,
            "saved_at": datetime.now(timezone.utc).isoformat()
        }}},
        upsert=True
    )
    
    return {"success": True, "message": "Message saved"}

@router.delete("/chat/messages/{message_id}/save")
async def unsave_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a message from saved messages"""
    
    user_id = current_user["user_id"]
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$pull": {"saved_messages": {"message_id": message_id}}}
    )
    
    return {"success": True, "message": "Message unsaved"}

@router.get("/chat/saved-messages")
async def get_saved_messages(
    current_user: dict = Depends(get_current_user)
):
    """Get all saved messages for the current user"""
    
    user_id = current_user["user_id"]
    
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id}, {"_id": 0})
    saved = prefs.get("saved_messages", []) if prefs else []
    
    # Fetch full message data
    messages = []
    for item in saved:
        message = await db.chat_messages.find_one({"id": item["message_id"]}, {"_id": 0})
        if message:
            message["saved_at"] = item["saved_at"]
            # Get channel info
            channel = await db.chat_channels.find_one({"id": message["channel_id"]}, {"_id": 0, "name": 1})
            if channel:
                message["channel_name"] = channel["name"]
            messages.append(message)
    
    return {"messages": messages, "count": len(messages)}


# ===============================
# PHASE 4: Admin & Security Controls
# ===============================

# Helper function to check if user is admin
def is_admin(user: dict) -> bool:
    admin_roles = ["super_admin", "admin", "ceo"]
    return user.get("role") in admin_roles

# Audit Log Entry Model
class AuditLogEntry(BaseModel):
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    user_name: str
    details: Optional[dict] = None
    timestamp: Optional[str] = None

async def create_audit_log(
    action: str,
    entity_type: str,
    entity_id: str,
    user: dict,
    details: dict = None
):
    """Create an audit log entry"""
    log_entry = {
        "id": str(uuid4()),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user.get("user_id"),
        "user_name": user.get("email", "Unknown"),
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_address": user.get("ip_address"),
    }
    await db.chat_audit_logs.insert_one(log_entry)
    return log_entry

# Admin: Edit any message
@router.patch("/chat/admin/messages/{message_id}")
async def admin_edit_message(
    message_id: str,
    content: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to edit any message"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    original_content = message.get("content")
    
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {
            "content": content,
            "edited_at": datetime.now(timezone.utc).isoformat(),
            "edited_by_admin": True,
            "admin_editor_id": current_user["user_id"]
        }}
    )
    
    # Create audit log
    await create_audit_log(
        action="admin_edit_message",
        entity_type="message",
        entity_id=message_id,
        user=current_user,
        details={
            "original_content": original_content[:100] if original_content else None,
            "new_content": content[:100],
            "channel_id": message.get("channel_id")
        }
    )
    
    return {"success": True, "message": "Message edited by admin"}

# Admin: Delete any message
@router.delete("/chat/admin/messages/{message_id}")
async def admin_delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to delete any message"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    message = await db.chat_messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Soft delete - mark as deleted but keep for audit
    await db.chat_messages.update_one(
        {"id": message_id},
        {"$set": {
            "deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by_admin": True,
            "admin_deleter_id": current_user["user_id"]
        }}
    )
    
    # Create audit log
    await create_audit_log(
        action="admin_delete_message",
        entity_type="message",
        entity_id=message_id,
        user=current_user,
        details={
            "content_preview": message.get("content", "")[:100],
            "sender_id": message.get("sender_id"),
            "channel_id": message.get("channel_id")
        }
    )
    
    # Broadcast deletion via WebSocket
    if websocket_manager:
        await websocket_manager.broadcast_to_channel(
            message.get("channel_id"),
            {
                "type": "message_deleted",
                "message_id": message_id,
                "deleted_by_admin": True
            }
        )
    
    return {"success": True, "message": "Message deleted by admin"}

# Admin: Get all channel memberships overview
@router.get("/chat/admin/channels/overview")
async def admin_get_channels_overview(
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to get overview of all channels and their memberships"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    channels = await db.chat_channels.find({"type": {"$ne": "direct"}}, {"_id": 0}).to_list(1000)
    
    overview = []
    for channel in channels:
        member_count = len(channel.get("members", []))
        message_count = await db.chat_messages.count_documents({"channel_id": channel["id"]})
        
        overview.append({
            "id": channel["id"],
            "name": channel.get("name"),
            "type": channel.get("type"),
            "member_count": member_count,
            "message_count": message_count,
            "created_at": channel.get("created_at"),
            "created_by": channel.get("created_by"),
            "archived": channel.get("archived", False)
        })
    
    return {"channels": overview, "total": len(overview)}

# Admin: Get detailed channel info with all members
@router.get("/chat/admin/channels/{channel_id}/details")
async def admin_get_channel_details(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to get detailed channel info including all members"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    channel = await db.chat_channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Get detailed member info
    member_ids = channel.get("members", [])
    members = []
    for member_id in member_ids:
        user = await db.users.find_one({"id": member_id}, {"_id": 0, "password": 0})
        if user:
            presence = await db.chat_presence.find_one({"user_id": member_id}, {"_id": 0})
            user["presence"] = presence or {"status": "offline"}
            members.append(user)
    
    # Get message stats
    message_count = await db.chat_messages.count_documents({"channel_id": channel_id})
    last_message = await db.chat_messages.find_one(
        {"channel_id": channel_id},
        sort=[("created_at", -1)]
    )
    
    return {
        "channel": channel,
        "members": members,
        "stats": {
            "message_count": message_count,
            "member_count": len(members),
            "last_activity": last_message.get("created_at") if last_message else None
        }
    }

# Admin: Force add user to channel
@router.post("/chat/admin/channels/{channel_id}/members/{user_id}")
async def admin_add_member_to_channel(
    channel_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to force add a user to any channel"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$addToSet": {"members": user_id}}
    )
    
    # Create audit log
    await create_audit_log(
        action="admin_add_member",
        entity_type="channel",
        entity_id=channel_id,
        user=current_user,
        details={
            "added_user_id": user_id,
            "added_user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "channel_name": channel.get("name")
        }
    )
    
    return {"success": True, "message": f"User added to channel by admin"}

# Admin: Force remove user from channel
@router.delete("/chat/admin/channels/{channel_id}/members/{user_id}")
async def admin_remove_member_from_channel(
    channel_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to force remove a user from any channel"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    user = await db.users.find_one({"id": user_id})
    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() if user else "Unknown"
    
    await db.chat_channels.update_one(
        {"id": channel_id},
        {"$pull": {"members": user_id}}
    )
    
    # Create audit log
    await create_audit_log(
        action="admin_remove_member",
        entity_type="channel",
        entity_id=channel_id,
        user=current_user,
        details={
            "removed_user_id": user_id,
            "removed_user_name": user_name,
            "channel_name": channel.get("name")
        }
    )
    
    return {"success": True, "message": f"User removed from channel by admin"}

# Get Audit Logs
@router.get("/chat/admin/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get audit logs with optional filtering"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    
    total = await db.chat_audit_logs.count_documents(query)
    logs = await db.chat_audit_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }

# Get specific audit log
@router.get("/chat/admin/audit-logs/{log_id}")
async def get_audit_log(
    log_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific audit log entry"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    log = await db.chat_audit_logs.find_one({"id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    
    return log

# Role-based permissions check
@router.get("/chat/permissions")
async def get_chat_permissions(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's chat permissions based on their role"""
    
    role = current_user.get("role", "user")
    
    # Define role-based permissions
    permissions = {
        "can_create_channel": role in ["super_admin", "admin", "ceo", "manager"],
        "can_create_private_channel": role in ["super_admin", "admin", "ceo", "manager"],
        "can_delete_channel": role in ["super_admin", "admin", "ceo"],
        "can_archive_channel": role in ["super_admin", "admin", "ceo", "manager"],
        "can_edit_any_message": role in ["super_admin", "admin", "ceo"],
        "can_delete_any_message": role in ["super_admin", "admin", "ceo"],
        "can_manage_members": role in ["super_admin", "admin", "ceo", "manager"],
        "can_view_audit_logs": role in ["super_admin", "admin", "ceo"],
        "can_pin_messages": True,  # All users can pin
        "can_send_messages": True,  # All users can send
        "is_admin": is_admin(current_user)
    }
    
    return {
        "user_id": current_user["user_id"],
        "role": role,
        "permissions": permissions
    }

# Admin: Get user activity summary
@router.get("/chat/admin/users/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's chat activity summary"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get message count
    message_count = await db.chat_messages.count_documents({"sender_id": user_id})
    
    # Get channels the user is in
    channels = await db.chat_channels.find(
        {"members": user_id, "type": {"$ne": "direct"}},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(100)
    
    # Get last activity
    last_message = await db.chat_messages.find_one(
        {"sender_id": user_id},
        sort=[("created_at", -1)]
    )
    
    # Get presence
    presence = await db.chat_presence.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get recent audit logs for this user
    recent_actions = await db.chat_audit_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    return {
        "user": user,
        "stats": {
            "message_count": message_count,
            "channel_count": len(channels),
            "last_message_at": last_message.get("created_at") if last_message else None
        },
        "channels": channels,
        "presence": presence or {"status": "offline"},
        "recent_actions": recent_actions
    }

# Admin: Broadcast system message to all channels
@router.post("/chat/admin/broadcast")
async def admin_broadcast_message(
    content: str = Body(..., embed=True),
    channel_ids: List[str] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Admin endpoint to broadcast a system message to channels"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # If no channel_ids specified, broadcast to all non-DM channels
    if not channel_ids:
        channels = await db.chat_channels.find(
            {"type": {"$ne": "direct"}},
            {"id": 1}
        ).to_list(1000)
        channel_ids = [c["id"] for c in channels]
    
    broadcast_results = []
    for channel_id in channel_ids:
        message = {
            "id": str(uuid4()),
            "channel_id": channel_id,
            "sender_id": "system",
            "sender_name": "System Announcement",
            "content": content,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_system_message": True,
            "broadcast_by": current_user["user_id"]
        }
        await db.chat_messages.insert_one(message)
        
        # Broadcast via WebSocket
        if websocket_manager:
            await websocket_manager.broadcast_to_channel(
                channel_id,
                {"type": "new_message", "message": {k: v for k, v in message.items() if k != "_id"}}
            )
        
        broadcast_results.append(channel_id)
    
    # Create audit log
    await create_audit_log(
        action="admin_broadcast",
        entity_type="system",
        entity_id="broadcast",
        user=current_user,
        details={
            "content_preview": content[:100],
            "channel_count": len(broadcast_results)
        }
    )
    
    return {
        "success": True,
        "message": f"Broadcast sent to {len(broadcast_results)} channels",
        "channels": broadcast_results
    }

# Export chat data for compliance
@router.get("/chat/admin/export/{channel_id}")
async def export_channel_data(
    channel_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export channel messages for compliance/backup"""
    
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    channel = await db.chat_channels.find_one({"id": channel_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    query = {"channel_id": channel_id}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    messages = await db.chat_messages.find(query, {"_id": 0}).to_list(10000)
    
    # Create audit log
    await create_audit_log(
        action="admin_export",
        entity_type="channel",
        entity_id=channel_id,
        user=current_user,
        details={
            "message_count": len(messages),
            "start_date": start_date,
            "end_date": end_date
        }
    )
    
    return {
        "channel": channel,
        "messages": messages,
        "export_date": datetime.now(timezone.utc).isoformat(),
        "exported_by": current_user["user_id"],
        "message_count": len(messages)
    }

    if not prefs:
        prefs = {
            "user_id": user_id,
            "starred_channels": [],
            "muted_channels": [],
            "notification_settings": {}
        }
        await db.chat_user_preferences.insert_one(prefs)
    
    # Update notification settings
    update_data = {f"notification_settings.{k}": v for k, v in settings.dict().items() if v is not None}
    if update_data:
        await db.chat_user_preferences.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
    
    return await db.chat_user_preferences.find_one({"user_id": user_id}, {"_id": 0})

class ChannelNotificationSetting(BaseModel):
    setting: str  # "all", "mentions", "none"

@router.patch("/chat/channels/{channel_id}/notifications")
async def set_channel_notification_level(
    channel_id: str,
    notification: ChannelNotificationSetting,
    current_user: dict = Depends(get_current_user)
):
    """Set notification level for a specific channel"""
    
    user_id = current_user["user_id"]
    
    prefs = await db.chat_user_preferences.find_one({"user_id": user_id})
    if not prefs:
        prefs = {
            "user_id": user_id,
            "starred_channels": [],
            "muted_channels": [],
            "notification_settings": {},
            "channel_notifications": {}
        }
        await db.chat_user_preferences.insert_one(prefs)
    
    await db.chat_user_preferences.update_one(
        {"user_id": user_id},
        {"$set": {f"channel_notifications.{channel_id}": notification.setting}}
    )
    
    return {"success": True, "channel_id": channel_id, "setting": notification.setting}

# ===============================
# PHASE 2: User Presence & Status
# ===============================

class UserStatus(BaseModel):
    status: str  # "online", "away", "dnd", "offline"
    custom_status: Optional[str] = None
    custom_emoji: Optional[str] = None

@router.get("/chat/presence")
async def get_all_presence(
    current_user: dict = Depends(get_current_user)
):
    """Get presence status for all users"""
    
    presences = await db.chat_presence.find({}, {"_id": 0}).to_list(1000)
    return {"presences": presences}

@router.get("/chat/presence/{user_id}")
async def get_user_presence(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get presence status for a specific user"""
    
    presence = await db.chat_presence.find_one({"user_id": user_id}, {"_id": 0})
    if not presence:
        return {
            "user_id": user_id,
            "status": "offline",
            "last_seen": None,
            "custom_status": None,
            "custom_emoji": None
        }
    return presence

@router.put("/chat/presence")
async def update_presence(
    status: UserStatus,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's presence status"""
    
    user_id = current_user["user_id"]
    
    presence_data = {
        "user_id": user_id,
        "status": status.status,
        "custom_status": status.custom_status,
        "custom_emoji": status.custom_emoji,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chat_presence.update_one(
        {"user_id": user_id},
        {"$set": presence_data},
        upsert=True
    )
    
    # Broadcast presence update via WebSocket
    if websocket_manager:
        await websocket_manager.broadcast_presence(user_id, status.status)
    
    return presence_data

@router.get("/chat/channels/{channel_id}/members/details")
async def get_channel_members_details(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed member info for a channel including presence"""
    
    channel = await db.chat_channels.find_one({"id": channel_id})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    member_ids = channel.get("members", [])
    members = []
    
    for member_id in member_ids:
        # Get user info
        user = await db.users.find_one({"id": member_id}, {"_id": 0, "password": 0})
        if user:
            # Get presence
            presence = await db.chat_presence.find_one({"user_id": member_id}, {"_id": 0})
            user["presence"] = presence or {"status": "offline"}
            members.append(user)
    
    return {"members": members, "count": len(members)}


# ─── Seed Default Channels ───

DEFAULT_CHANNELS = [
    {"name": "general", "description": "Company-wide announcements and general discussion", "type": "public"},
    {"name": "sales", "description": "Sales team coordination and deal updates", "type": "public"},
    {"name": "leads", "description": "New leads, lead assignments, and lead status updates", "type": "public"},
    {"name": "lead-setting", "description": "Lead-setting team coordination and scheduling", "type": "public"},
    {"name": "service", "description": "Service team updates and customer support", "type": "public"},
    {"name": "production", "description": "Production scheduling, crew updates, and job progress", "type": "public"},
    {"name": "random", "description": "Non-work banter, memes, and fun stuff", "type": "public"},
    {"name": "google-5-star-reviews", "description": "Celebrate 5-star Google reviews and track review goals", "type": "public"},
]

@router.post("/chat/seed-channels")
async def seed_default_channels(
    current_user: dict = Depends(get_current_user)
):
    """Seed default channels if they don't already exist (super_admin only)"""

    if current_user["role"] not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="Admin only")

    created = []
    skipped = []

    for ch in DEFAULT_CHANNELS:
        existing = await db.chat_channels.find_one({"name": ch["name"]})
        if existing:
            skipped.append(ch["name"])
            continue

        channel_dict = {
            "id": str(uuid4()),
            "name": ch["name"],
            "description": ch["description"],
            "type": ch["type"],
            "members": [current_user["user_id"]],
            "created_by": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat(),
        }
        await db.chat_channels.insert_one(channel_dict.copy())
        created.append(ch["name"])

    return {"created": created, "skipped": skipped, "total": len(created)}
