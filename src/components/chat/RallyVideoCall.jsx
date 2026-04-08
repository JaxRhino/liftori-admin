/**
 * Rally - Liftori's Premium Video Calling Feature
 * 
 * Features:
 * - Multiple view modes: Grid, Presenter, Sidebar
 * - Up to 100 participants
 * - Screen sharing with annotation tools
 * - Raise hand, reactions
 * - In-call chat
 * - Recording capability
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff,
  Users, Settings, Maximize2, Minimize2, X, LayoutGrid, Presentation,
  Pin, PinOff, Hand, MessageSquare, MoreVertical, ChevronDown,
  Pencil, Eraser, Circle, Square, Type, Pointer, Palette, Undo,
  Zap, PanelLeftClose, PanelLeft, Volume2, VolumeX, Copy, Share2,
  Disc as RecordIcon, StopCircle, Sparkles, UserPlus
} from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

// ========================
// Rally Icon Component
// ========================
export const RallyIcon = ({ className = "h-5 w-5", animated = false }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    className={cn(className, animated && "animate-pulse")}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Rally flag / megaphone inspired icon */}
    <path 
      d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" 
      fill="currentColor"
      className="text-orange-500"
    />
    <path 
      d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" 
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-orange-400"
    />
    {/* Flag pole */}
    <line x1="4" y1="22" x2="4" y2="15" stroke="currentColor" strokeWidth="2" className="text-orange-600" />
  </svg>
);

// ========================
// View Mode Types
// ========================
const VIEW_MODES = {
  GRID: 'grid',
  PRESENTER: 'presenter',
  SIDEBAR: 'sidebar',
  SPOTLIGHT: 'spotlight'
};

// Screen share view modes
const SCREEN_SHARE_MODES = {
  SCREEN_WITH_PARTICIPANTS: 'screen_with_participants',
  SCREEN_ONLY: 'screen_only'
};

// ========================
// Simple Annotation Canvas - No complex state
// ========================
const SimpleAnnotationCanvas = ({ 
  isActive, 
  onClose, 
  tool, 
  color, 
  strokeWidth,
  canInteract
}) => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, [isActive]);

  const handleMouseDown = (e) => {
    if (canInteract) return;
    isDrawingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDrawingRef.current || canInteract) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#000' : color;
    ctx.lineWidth = tool === 'highlighter' ? strokeWidth * 3 : strokeWidth;
    ctx.lineCap = 'round';
    ctx.globalAlpha = tool === 'highlighter' ? 0.3 : 1;
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    }
    
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(e.clientX, e.clientY);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  if (!isActive) return null;

  return (
    <div 
      className="fixed inset-0 z-[150]"
      style={{ pointerEvents: canInteract ? 'none' : 'auto' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ 
          pointerEvents: canInteract ? 'none' : 'auto',
          cursor: canInteract ? 'default' : 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {/* Simple Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2" style={{ pointerEvents: 'auto' }}>
        <div className="bg-slate-800 rounded-lg px-4 py-2 flex items-center gap-3 shadow-xl border border-slate-700">
          <span className={cn(
            "px-2 py-1 rounded text-xs",
            canInteract ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
          )}>
            {canInteract ? 'Interact' : 'Drawing'}
          </span>
          <Button variant="ghost" size="sm" onClick={clearCanvas}>Clear</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
};

// ========================
// Participant Tile Component
// ========================
const ParticipantTile = ({ 
  stream, 
  participant, 
  isSelf = false, 
  isPinned = false,
  isActiveSpeaker = false,
  onPin,
  onMute,
  size = 'normal' // normal, large, small
}) => {
  const videoRef = useRef(null);
  const name = isSelf ? 'You' : (participant?.user_name || 'Participant');
  
  // Debug log
  useEffect(() => {
    if (isSelf) {
      const tracks = stream?.getTracks() || [];
      console.log(`🎥 Rally ParticipantTile [${name}]:`, {
        hasStream: !!stream,
        tracks: tracks.map(t => `${t.kind}:${t.enabled}:${t.readyState}`),
        mediaState: participant?.media_state
      });
    }
  }, [stream, name, isSelf, participant]);
  
  // Bind stream to video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream) {
      console.log(`🎥 Rally [${name}]: Binding stream`);
      videoElement.srcObject = stream;
      
      // Ensure video plays
      const playVideo = async () => {
        try {
          await videoElement.play();
          console.log(`🎥 Rally [${name}]: Playing, ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        } catch (err) {
          console.warn(`🎥 Rally [${name}]: Play failed:`, err.message);
        }
      };
      
      playVideo();
      videoElement.onloadedmetadata = () => {
        console.log(`🎥 Rally [${name}]: Metadata loaded`);
        playVideo();
      };
    }
  }, [stream, name]);
  
  // Check if we have video - simple check: stream exists and has video tracks
  const hasVideoStream = stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideoStream;
  
  const hasAudio = (participant?.media_state?.audioEnabled ?? 
                    participant?.media_state?.audio_enabled) !== false;
  const isScreenSharing = participant?.media_state?.screenSharing || 
                          participant?.media_state?.screen_sharing;
  
  const sizeClasses = {
    small: 'aspect-video min-h-[120px]',
    normal: 'aspect-video',
    large: 'aspect-video min-h-[400px]'
  };
  
  return (
    <div 
      className={cn(
        "relative bg-slate-800 rounded-xl overflow-hidden group transition-all",
        sizeClasses[size],
        isActiveSpeaker && "ring-2 ring-green-500",
        isPinned && "ring-2 ring-orange-500"
      )}
    >
      {/* Video Element - using inline styles like the working original */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isSelf && !isScreenSharing ? 'scaleX(-1)' : 'none',
          display: showVideo ? 'block' : 'none'
        }}
      />
      
      {/* Avatar Fallback - shown when video is off */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
          <Avatar className={cn(size === 'large' ? 'h-32 w-32' : size === 'small' ? 'h-12 w-12' : 'h-20 w-20')}>
            <AvatarFallback className={cn(
              "bg-gradient-to-br from-orange-500 to-red-500 text-white",
              size === 'large' ? 'text-4xl' : size === 'small' ? 'text-sm' : 'text-2xl'
            )}>
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* Screen Share Indicator */}
      {isScreenSharing && (
        <div className="absolute top-2 left-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
          <Monitor className="h-3 w-3" />
          Screen
        </div>
      )}
      
      {/* Name Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {!hasAudio && <MicOff className="h-4 w-4 text-red-400 flex-shrink-0" />}
            <span className="text-white text-sm font-medium truncate">
              {name}
            </span>
            {isSelf && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">You</Badge>
            )}
            {participant?.hand_raised && (
              <Hand className="h-4 w-4 text-yellow-400 animate-bounce" />
            )}
          </div>
          
          {/* Hover Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onPin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-black/50 hover:bg-black/70"
                onClick={onPin}
              >
                {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
            )}
            {!isSelf && onMute && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-black/50 hover:bg-black/70">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={onMute}>
                    {hasAudio ? 'Mute' : 'Request Unmute'}
                  </DropdownMenuItem>
                  <DropdownMenuItem>Remove from call</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ========================
// Self Video Tile - Special component for current user's video
// ========================
const SelfVideoTile = ({ stream: propStream, mediaState, userName, userAvatar }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('init');
  const [localStream, setLocalStream] = useState(null);
  
  // Get our own stream if the prop stream is bad or missing
  useEffect(() => {
    let cancelled = false;
    
    const checkAndGetStream = async () => {
      // Check if prop stream is valid
      if (propStream) {
        const videoTracks = propStream.getVideoTracks();
        const hasGoodTrack = videoTracks.some(t => t.enabled && t.readyState === 'live');
        
        if (hasGoodTrack) {
          console.log('🎥 Using prop stream');
          setLocalStream(propStream);
          setStatus('using-prop');
          return;
        }
      }
      
      // Prop stream is bad or missing, get our own
      console.log('🎥 Prop stream bad/missing, getting fresh stream');
      setStatus('getting-stream');
      
      try {
        const freshStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        if (!cancelled) {
          console.log('🎥 Got fresh stream:', freshStream.getVideoTracks().map(t => `${t.label}:${t.readyState}`));
          setLocalStream(freshStream);
          setStatus('fresh-stream');
        }
      } catch (err) {
        console.error('🎥 Failed to get fresh stream:', err);
        setStatus(`error-${err.name}`);
      }
    };
    
    checkAndGetStream();
    
    return () => {
      cancelled = true;
    };
  }, [propStream]);
  
  // Bind stream to video
  useEffect(() => {
    const videoEl = videoRef.current;
    
    if (!localStream || !videoEl) {
      return;
    }
    
    console.log('🎥 Binding stream to video element');
    videoEl.srcObject = localStream;
    
    videoEl.onloadedmetadata = () => {
      setStatus(`meta-${videoEl.videoWidth}x${videoEl.videoHeight}`);
    };
    
    videoEl.play()
      .then(() => {
        setStatus(`playing-${videoEl.videoWidth}x${videoEl.videoHeight}`);
        console.log('🎥 Video playing:', videoEl.videoWidth, 'x', videoEl.videoHeight);
      })
      .catch(err => {
        setStatus(`play-err-${err.name}`);
        console.error('🎥 Play error:', err);
      });
      
  }, [localStream]);
  
  const videoEnabled = mediaState?.videoEnabled !== false;
  
  return (
    <div className="absolute inset-0 bg-slate-800">
      {/* Status debug */}
      <div className="absolute top-2 left-2 z-50 text-xs bg-red-600 text-white px-2 py-1 rounded font-mono">
        {status}
      </div>
      
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)'
        }}
      />
      
      {/* Avatar when video disabled */}
      {!videoEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 z-20">
          <Avatar className="h-32 w-32">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="text-5xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                {userName?.charAt(0)?.toUpperCase() || 'Y'}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
      )}
    </div>
  );
};

// ========================
// In-Call Chat Panel
// ========================
const CallChatPanel = ({ isOpen, onClose, messages = [], onSendMessage }) => {
  const [message, setMessage] = useState('');
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          In-call Chat
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="flex gap-2">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-slate-600">
                    {msg.sender?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-white">{msg.sender}</span>
                    <span className="text-xs text-slate-500">{msg.time}</span>
                  </div>
                  <p className="text-sm text-slate-300 break-words">{msg.text}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="bg-slate-900 border-slate-600"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
            <Zap className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ========================
// Participants Panel
// ========================
const ParticipantsPanel = ({ isOpen, onClose, participants = [], currentUserId, onInvite }) => {
  if (!isOpen) return null;
  
  const connectedCount = participants.filter(p => p.status === 'connected').length;
  
  return (
    <div className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Users className="h-4 w-4" />
          Participants ({connectedCount})
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {participants.map((p) => (
            <div 
              key={p.user_id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg",
                p.user_id === currentUserId ? "bg-slate-700/50" : "hover:bg-slate-700/30"
              )}
            >
              <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-slate-600 text-sm">
                    {p.user_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                {p.status === 'connected' && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {p.user_name} {p.user_id === currentUserId && '(You)'}
                </p>
                <p className="text-xs text-slate-400">
                  {p.role === 'host' ? 'Host' : 'Participant'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!p.media_state?.audio_enabled && (
                  <MicOff className="h-4 w-4 text-red-400" />
                )}
                {!p.media_state?.video_enabled && (
                  <VideoOff className="h-4 w-4 text-red-400" />
                )}
                {p.hand_raised && (
                  <Hand className="h-4 w-4 text-yellow-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t border-slate-700">
        <Button variant="outline" className="w-full" onClick={onInvite}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Others
        </Button>
      </div>
    </div>
  );
};

// ========================
// Main Rally Video Call Window
// ========================
export const RallyVideoCallWindow = ({
  activeCall,
  participants = [],
  localStream,
  remoteStreams = {},
  mediaState,
  onLeave,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  isHost = false,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  channelName
}) => {
  // UI State
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Debug: Mock participants for testing multi-user
  const [mockParticipants, setMockParticipants] = useState([]);
  
  // Annotation State - simplified
  const [annotating, setAnnotating] = useState(false);
  const [annotationTool, setAnnotationTool] = useState('pen');
  const [annotationColor, setAnnotationColor] = useState('#FFD700');
  const [strokeWidth] = useState(3);
  const [canInteract, setCanInteract] = useState(false);
  
  // Screen share view mode
  const [screenShareMode, setScreenShareMode] = useState(SCREEN_SHARE_MODES.SCREEN_WITH_PARTICIPANTS);
  
  // Chat State — uses Supabase Realtime broadcast for in-call messaging
  const [chatMessages, setChatMessages] = useState([]);
  const chatChannelRef = useRef(null);
  
  // Position for dragging (when not fullscreen)
  // Default position at bottom-right corner when minimized for better screen interaction
  const [position, setPosition] = useState({ x: window.innerWidth - 450, y: window.innerHeight - 150 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);
  
  // Debug: Add mock participant
  const addMockParticipant = () => {
    const names = ['Alex Johnson', 'Sarah Miller', 'Mike Chen', 'Emily Davis', 'Chris Wilson', 'Lisa Brown', 'David Lee', 'Anna Garcia'];
    const randomName = names[mockParticipants.length % names.length];
    const newParticipant = {
      user_id: `mock-${Date.now()}`,
      user_name: randomName,
      status: 'connected',
      role: 'participant',
      media_state: { audioEnabled: Math.random() > 0.3, videoEnabled: false }
    };
    setMockParticipants(prev => [...prev, newParticipant]);
    toast.info(`${randomName} joined the Rally`);
  };
  
  // Debug: Remove mock participant
  const removeMockParticipant = () => {
    if (mockParticipants.length > 0) {
      const removed = mockParticipants[mockParticipants.length - 1];
      setMockParticipants(prev => prev.slice(0, -1));
      toast.info(`${removed.user_name} left the Rally`);
    }
  };
  
  // Computed values - include mock participants
  const connectedParticipants = [
    ...participants.filter(p => p.status === 'connected' && p.user_id !== currentUserId),
    ...mockParticipants
  ];
  const allParticipants = [
    { user_id: currentUserId, user_name: currentUserName || 'You', status: 'connected', role: isHost ? 'host' : 'participant', media_state: mediaState },
    ...connectedParticipants
  ];
  const participantCount = allParticipants.length;
  
  // Check if anyone is screen sharing (must be after allParticipants is defined)
  const screenSharingParticipant = allParticipants.find(p => 
    p.media_state?.screenSharing || p.media_state?.screen_sharing
  );
  const isScreenSharing = !!screenSharingParticipant || mediaState?.screenSharing;
  
  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || isFullscreen) return;
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMove = (e) => {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleUp = () => setIsDragging(false);
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);
  
  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (isFullscreen) {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    } else {
      windowRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    }
  };
  
  // ─── In-call chat via Supabase Realtime broadcast ───
  useEffect(() => {
    if (!activeCall?.id) return;

    const channel = supabase.channel(`rally-chat-${activeCall.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'chat_message' }, (payload) => {
        setChatMessages(prev => [...prev, payload.payload]);
      })
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      chatChannelRef.current = null;
    };
  }, [activeCall?.id]);

  // Handle send chat message
  const handleSendChatMessage = (text) => {
    const msg = {
      sender: currentUserName || 'You',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      userId: currentUserId,
    };

    // Add locally immediately
    setChatMessages(prev => [...prev, { ...msg, sender: 'You' }]);

    // Broadcast to other participants
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msg,
      });
    }
  };
  
  // Grid layout classes based on participant count and view mode
  const getGridLayout = () => {
    if (viewMode === VIEW_MODES.PRESENTER || viewMode === VIEW_MODES.SPOTLIGHT) {
      return 'grid-cols-1';
    }
    if (pinnedUserId) return 'grid-cols-4 grid-rows-2';
    if (participantCount <= 1) return 'grid-cols-1';
    if (participantCount === 2) return 'grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2 grid-rows-2';
    if (participantCount <= 6) return 'grid-cols-3 grid-rows-2';
    if (participantCount <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4 grid-rows-3';
  };
  
  // Minimized view - compact floating bar
  // When minimized, we ONLY render this small bar - nothing else that could block screen interactions
  if (isMinimized) {
    return (
      <div
        className="fixed z-[100] bg-slate-900/95 backdrop-blur rounded-2xl shadow-2xl cursor-move border border-slate-700/50"
        style={{ 
          left: position.x, 
          top: position.y, 
          maxWidth: '400px',
          // Ensure this small bar doesn't interfere with anything else
          pointerEvents: 'auto'
        }}
        onMouseDown={handleMouseDown}
        data-testid="rally-minimized-bar"
      >
        {/* Compact bar with controls */}
        <div className="p-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <RallyIcon className="h-5 w-5 text-yellow-500" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            <span className="text-white text-sm font-medium">{participantCount}</span>
          </div>
          
          {/* Mini participant avatars */}
          <div className="flex -space-x-2">
            {allParticipants.slice(0, 4).map((p, i) => (
              <Avatar key={p.user_id} className="h-7 w-7 border-2 border-slate-900">
                <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-red-500 text-white">
                  {p.user_name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {participantCount > 4 && (
              <div className="h-7 w-7 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs text-slate-300">
                +{participantCount - 4}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={mediaState.audioEnabled ? "ghost" : "destructive"}
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onToggleAudio}
              data-testid="rally-minimized-mic-toggle"
            >
              {mediaState.audioEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant={mediaState.videoEnabled ? "ghost" : "destructive"}
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onToggleVideo}
              data-testid="rally-minimized-video-toggle"
            >
              {mediaState.videoEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
            </Button>
            {isScreenSharing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-green-400"
                onClick={onToggleScreenShare}
                title="Stop sharing"
                data-testid="rally-minimized-stop-share"
              >
                <MonitorOff className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full" 
              onClick={() => {
                setAnnotating(false); // Ensure annotation is off when expanding
                setIsMinimized(false);
              }}
              data-testid="rally-expand-btn"
            >
              <Maximize2 className="h-3.5 w-3.5 text-white" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-full text-red-400" 
              onClick={onLeave}
              data-testid="rally-minimized-leave"
            >
              <PhoneOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Hint text when screen sharing */}
        {isScreenSharing && (
          <div className="px-3 pb-2 text-xs text-slate-400 border-t border-slate-700/50 pt-2">
            You're sharing your screen. Interact with your content below.
          </div>
        )}
      </div>
    );
  }
  
  return (
    <>
      {/* Simple Annotation Canvas - ONLY rendered when NOT minimized */}
      <SimpleAnnotationCanvas
        isActive={annotating}
        onClose={() => setAnnotating(false)}
        tool={annotationTool}
        color={annotationColor}
        strokeWidth={strokeWidth}
        canInteract={canInteract}
      />
      
      {/* Main Window */}
      <div
        ref={windowRef}
        className={cn(
          "fixed z-[100] bg-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700/50",
          isFullscreen ? "inset-0 rounded-none" : ""
        )}
        style={isFullscreen ? {} : { 
          left: position.x, 
          top: position.y, 
          width: showChat || showParticipants ? 1200 : 1000,
          height: 700,
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 40px)'
        }}
      >
        {/* Header */}
        <div 
          className="bg-gradient-to-r from-slate-800 to-slate-800/90 px-4 py-3 flex items-center justify-between cursor-move border-b border-slate-700/50"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <RallyIcon className="h-6 w-6 text-yellow-500" animated />
              <span className="font-bold text-white text-lg">Rally</span>
            </div>
            <div className="w-px h-5 bg-slate-600" />
            <span className="text-slate-300">{channelName || activeCall?.title || 'Video Call'}</span>
            <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse" />
              Live
            </Badge>
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-1.5" />
                Recording
              </Badge>
            )}
            {/* Screen sharing indicator */}
            {isScreenSharing && (
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                <Monitor className="h-3 w-3 mr-1" />
                Sharing
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
            
            {/* Minimize to work on shared screen */}
            {isScreenSharing && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-purple-400 border-purple-500/50 hover:bg-purple-500/20"
                onClick={() => {
                  // Disable annotation before minimizing to avoid any overlay blocking the screen
                  setAnnotating(false);
                  setCanInteract(false);
                  setIsMinimized(true);
                }}
                title="Minimize to interact with your screen"
                data-testid="rally-work-on-screen-btn"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="text-xs">Work on Screen</span>
              </Button>
            )}
            
            {/* Quick Add Test Participant Button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-green-400 border-green-500/50 hover:bg-green-500/20"
              onClick={addMockParticipant}
              title="Add test participant"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="text-xs">+Test</span>
            </Button>
            
            {/* View Mode Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  {viewMode === VIEW_MODES.GRID && 'Grid'}
                  {viewMode === VIEW_MODES.PRESENTER && 'Presenter'}
                  {viewMode === VIEW_MODES.SIDEBAR && 'Sidebar'}
                  {viewMode === VIEW_MODES.SPOTLIGHT && 'Spotlight'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => { setViewMode(VIEW_MODES.GRID); setPinnedUserId(null); }}>
                  <LayoutGrid className="h-4 w-4 mr-2" /> Grid View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode(VIEW_MODES.PRESENTER)}>
                  <Presentation className="h-4 w-4 mr-2" /> Presenter View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode(VIEW_MODES.SIDEBAR)}>
                  <PanelLeft className="h-4 w-4 mr-2" /> Sidebar View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setViewMode(VIEW_MODES.SPOTLIGHT)}>
                  <Sparkles className="h-4 w-4 mr-2" /> Spotlight
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="w-px h-5 bg-slate-600" />
            
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-400" onClick={onLeave}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Grid Area */}
          <div className="flex-1 p-3 bg-slate-900/50 overflow-hidden">
            {/* Screen Share Mode - when someone is sharing */}
            {isScreenSharing && screenShareMode === SCREEN_SHARE_MODES.SCREEN_ONLY ? (
              // Screen Only Mode - Full screen share view
              <div className="relative h-full">
                <div className="absolute inset-0 bg-slate-800 rounded-xl flex items-center justify-center">
                  {mediaState?.screenSharing ? (
                    <SelfVideoTile 
                      stream={localStream} 
                      mediaState={{...mediaState, videoEnabled: true}}
                      userName="Your Screen"
                      isScreenShare
                    />
                  ) : (
                    <div className="text-center">
                      <Monitor className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-400">{screenSharingParticipant?.user_name} is sharing their screen</p>
                    </div>
                  )}
                </div>
                {/* Floating self preview */}
                <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden shadow-xl border-2 border-slate-600">
                  <SelfVideoTile 
                    stream={localStream} 
                    mediaState={mediaState}
                    userName={currentUserName || 'You'}
                    userAvatar={currentUserAvatar}
                  />
                </div>
              </div>
            ) : isScreenSharing && screenShareMode === SCREEN_SHARE_MODES.SCREEN_WITH_PARTICIPANTS ? (
              // Screen + Participants Mode
              <div className="flex gap-3 h-full">
                {/* Screen share takes 2/3 */}
                <div className="flex-[2] relative bg-slate-800 rounded-xl overflow-hidden">
                  {mediaState?.screenSharing ? (
                    <SelfVideoTile 
                      stream={localStream} 
                      mediaState={{...mediaState, videoEnabled: true}}
                      userName="Your Screen"
                      isScreenShare
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Monitor className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-400">{screenSharingParticipant?.user_name} is sharing their screen</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Participants sidebar takes 1/3 */}
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
                  {allParticipants.map(p => (
                    <div key={p.user_id} className="flex-shrink-0">
                      <ParticipantTile
                        stream={p.user_id === currentUserId ? localStream : remoteStreams[p.user_id]}
                        participant={p}
                        isSelf={p.user_id === currentUserId}
                        size="small"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : viewMode === VIEW_MODES.SIDEBAR ? (
              // Sidebar View: Main video + sidebar with others
              <div className="flex gap-3 h-full">
                <div className="flex-1">
                  <ParticipantTile
                    stream={pinnedUserId === currentUserId ? localStream : (pinnedUserId ? remoteStreams[pinnedUserId] : localStream)}
                    participant={pinnedUserId ? connectedParticipants.find(p => p.user_id === pinnedUserId) : null}
                    isSelf={pinnedUserId === currentUserId || !pinnedUserId}
                    isPinned
                    size="large"
                    onPin={() => setPinnedUserId(null)}
                  />
                </div>
                <div className="w-48 space-y-2 overflow-y-auto">
                  {allParticipants
                    .filter(p => p.user_id !== pinnedUserId)
                    .map(p => (
                      <ParticipantTile
                        key={p.user_id}
                        stream={p.user_id === currentUserId ? localStream : remoteStreams[p.user_id]}
                        participant={p}
                        isSelf={p.user_id === currentUserId}
                        size="small"
                        onPin={() => setPinnedUserId(p.user_id)}
                      />
                    ))}
                </div>
              </div>
            ) : viewMode === VIEW_MODES.PRESENTER || viewMode === VIEW_MODES.SPOTLIGHT ? (
              // Presenter/Spotlight View: One large, thumbnails at bottom
              <div className="flex flex-col gap-3 h-full">
                <div className="flex-1">
                  <ParticipantTile
                    stream={pinnedUserId === currentUserId ? localStream : (pinnedUserId ? remoteStreams[pinnedUserId] : localStream)}
                    participant={pinnedUserId ? connectedParticipants.find(p => p.user_id === pinnedUserId) : null}
                    isSelf={pinnedUserId === currentUserId || !pinnedUserId}
                    isPinned
                    size="large"
                    onPin={() => setPinnedUserId(null)}
                  />
                </div>
                {participantCount > 1 && (
                  <div className="flex gap-2 justify-center overflow-x-auto pb-2">
                    {allParticipants
                      .filter(p => p.user_id !== pinnedUserId)
                      .slice(0, 8)
                      .map(p => (
                        <div key={p.user_id} className="w-32 flex-shrink-0">
                          <ParticipantTile
                            stream={p.user_id === currentUserId ? localStream : remoteStreams[p.user_id]}
                            participant={p}
                            isSelf={p.user_id === currentUserId}
                            size="small"
                            onPin={() => setPinnedUserId(p.user_id)}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : pinnedUserId ? (
              // Grid with pinned
              <div className="grid grid-cols-4 grid-rows-2 gap-2 h-full">
                <div className="col-span-3 row-span-2">
                  <ParticipantTile
                    stream={pinnedUserId === currentUserId ? localStream : remoteStreams[pinnedUserId]}
                    participant={pinnedUserId === currentUserId 
                      ? { user_id: currentUserId, user_name: 'You', media_state: mediaState }
                      : connectedParticipants.find(p => p.user_id === pinnedUserId)}
                    isSelf={pinnedUserId === currentUserId}
                    isPinned
                    size="large"
                    onPin={() => setPinnedUserId(null)}
                  />
                </div>
                {allParticipants
                  .filter(p => p.user_id !== pinnedUserId)
                  .slice(0, 2)
                  .map(p => (
                    <ParticipantTile
                      key={p.user_id}
                      stream={p.user_id === currentUserId ? localStream : remoteStreams[p.user_id]}
                      participant={p}
                      isSelf={p.user_id === currentUserId}
                      size="normal"
                      onPin={() => setPinnedUserId(p.user_id)}
                    />
                  ))}
              </div>
            ) : (
              // Standard Grid - show self tile with waiting message when alone
              <div className={cn("grid gap-3 h-full p-2", participantCount === 1 ? "grid-cols-1" : getGridLayout())}>
                {/* Self Video Tile - always show */}
                <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
                  {/* Video element for self */}
                  <SelfVideoTile 
                    stream={localStream} 
                    mediaState={mediaState}
                    userName={currentUserName || 'You'}
                    userAvatar={currentUserAvatar}
                  />
                  
                  {/* Waiting overlay when alone */}
                  {participantCount === 1 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 text-center">
                      <p className="text-white font-medium mb-1">Waiting for others to join...</p>
                      <div className="flex items-center justify-center gap-3 text-sm">
                        {/* Mic status */}
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full",
                          mediaState?.audioEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {mediaState?.audioEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                          <span>{mediaState?.audioEnabled ? 'Mic on' : 'Muted'}</span>
                        </div>
                        {/* Camera status */}
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-full",
                          mediaState?.videoEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {mediaState?.videoEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                          <span>{mediaState?.videoEnabled ? 'Camera on' : 'Camera off'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Name label when others are in call */}
                  {participantCount > 1 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <div className="flex items-center gap-2">
                        {!mediaState?.audioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
                        {!mediaState?.videoEnabled && <VideoOff className="h-4 w-4 text-red-400" />}
                        <span className="text-white text-sm font-medium">You</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Other Participants */}
                {connectedParticipants.slice(0, 11).map(p => (
                  <ParticipantTile
                    key={p.user_id}
                    stream={remoteStreams[p.user_id]}
                    participant={p}
                    onPin={() => setPinnedUserId(p.user_id)}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Chat Panel */}
          {showChat && (
            <CallChatPanel
              isOpen={showChat}
              onClose={() => setShowChat(false)}
              messages={chatMessages}
              onSendMessage={handleSendChatMessage}
            />
          )}
          
          {/* Participants Panel */}
          {showParticipants && (
            <ParticipantsPanel
              isOpen={showParticipants}
              onClose={() => setShowParticipants(false)}
              participants={allParticipants}
              currentUserId={currentUserId}
              onInvite={() => toast.info('Invite feature coming soon')}
            />
          )}
        </div>
        
        {/* Controls Bar */}
        <div className="bg-slate-800/95 backdrop-blur px-6 py-4 flex items-center justify-between border-t border-slate-700/50">
          {/* Left: Quick actions */}
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={handRaised ? "default" : "ghost"}
                    size="icon"
                    className={cn("h-10 w-10 rounded-full", handRaised && "bg-yellow-500 hover:bg-yellow-600")}
                    onClick={() => {
                      setHandRaised(!handRaised);
                      toast.info(handRaised ? 'Hand lowered' : 'Hand raised');
                    }}
                  >
                    <Hand className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Raise Hand</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Center: Main controls */}
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={mediaState.audioEnabled ? "secondary" : "destructive"}
                    size="lg"
                    className="h-12 w-12 rounded-full"
                    onClick={onToggleAudio}
                  >
                    {mediaState.audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{mediaState.audioEnabled ? 'Mute' : 'Unmute'}</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={mediaState.videoEnabled ? "secondary" : "destructive"}
                    size="lg"
                    className="h-12 w-12 rounded-full"
                    onClick={onToggleVideo}
                  >
                    {mediaState.videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{mediaState.videoEnabled ? 'Turn off camera' : 'Turn on camera'}</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={mediaState.screenSharing ? "default" : "secondary"}
                    size="lg"
                    className={cn("h-12 w-12 rounded-full", mediaState.screenSharing && "bg-green-600 hover:bg-green-700")}
                    onClick={onToggleScreenShare}
                  >
                    {mediaState.screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{mediaState.screenSharing ? 'Stop sharing' : 'Share screen'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Screen share view options - visible when anyone is screen sharing */}
            {isScreenSharing ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="lg" className="h-12 px-4 rounded-full gap-2">
                    {screenShareMode === SCREEN_SHARE_MODES.SCREEN_ONLY ? (
                      <><Maximize2 className="h-4 w-4" /> Screen Only</>
                    ) : (
                      <><LayoutGrid className="h-4 w-4" /> Screen + People</>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-[200]">
                  <DropdownMenuItem onClick={() => setScreenShareMode(SCREEN_SHARE_MODES.SCREEN_WITH_PARTICIPANTS)}>
                    <LayoutGrid className="h-4 w-4 mr-2" /> Screen + Participants
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setScreenShareMode(SCREEN_SHARE_MODES.SCREEN_ONLY)}>
                    <Maximize2 className="h-4 w-4 mr-2" /> Screen Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Debug: Show why screen share options aren't showing */
              <span className="text-xs text-slate-500 hidden">SS:{mediaState?.screenSharing ? 'Y' : 'N'}</span>
            )}
            
            {/* Annotation button */}
            {isScreenSharing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={annotating ? "default" : "secondary"}
                    size="lg"
                    className={cn("h-12 w-12 rounded-full", annotating && "bg-purple-600 hover:bg-purple-700")}
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 z-[200]">
                  <DropdownMenuItem onClick={() => { setAnnotating(true); setCanInteract(false); setAnnotationTool('pen'); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Draw (Pen)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setAnnotating(true); setCanInteract(false); setAnnotationTool('highlighter'); }}>
                    <Pencil className="h-4 w-4 mr-2 text-yellow-500" /> Highlighter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setAnnotating(true); setCanInteract(true); }}>
                    <Pointer className="h-4 w-4 mr-2 text-blue-400" /> Interact (Scroll)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 flex gap-1">
                    {['#FFD700', '#FF4444', '#4488FF', '#44FF44'].map(c => (
                      <button
                        key={c}
                        className={cn("w-6 h-6 rounded-full border-2", annotationColor === c ? "border-white" : "border-transparent")}
                        style={{ backgroundColor: c }}
                        onClick={() => setAnnotationColor(c)}
                      />
                    ))}
                  </div>
                  {annotating && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setAnnotating(false)}>
                        <X className="h-4 w-4 mr-2" /> Stop Annotating
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <div className="w-px h-10 bg-slate-600 mx-2" />
            
            {/* End Call */}
            <Button 
              variant="destructive" 
              size="lg" 
              className="h-12 px-6 rounded-full font-semibold"
              onClick={isHost ? onEnd : onLeave}
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              {isHost ? 'End Rally' : 'Leave'}
            </Button>
          </div>
          
          {/* Right: Side panel toggles */}
          <div className="flex items-center gap-2">
            <Button
              variant={showParticipants ? "default" : "ghost"}
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); }}
              title="Participants"
            >
              <Users className="h-5 w-5" />
            </Button>
            
            <Button
              variant={showChat ? "default" : "ghost"}
              size="icon"
              className="h-10 w-10 rounded-full relative"
              onClick={() => { setShowChat(!showChat); setShowParticipants(false); }}
              title="Chat"
            >
              <MessageSquare className="h-5 w-5" />
              {chatMessages.length > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
                  {chatMessages.length}
                </div>
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" title="More options">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[200]">
                <DropdownMenuItem onClick={() => {
                  setIsRecording(!isRecording);
                  toast.info(isRecording ? 'Recording stopped' : 'Recording started');
                }}>
                  {isRecording ? <StopCircle className="h-4 w-4 mr-2 text-red-500" /> : <Circle className="h-4 w-4 mr-2" />}
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success('Invite link copied!');
                }}>
                  <Copy className="h-4 w-4 mr-2" /> Copy invite link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={addMockParticipant}>
                  <UserPlus className="h-4 w-4 mr-2 text-green-500" /> Add Test Participant
                </DropdownMenuItem>
                {mockParticipants.length > 0 && (
                  <DropdownMenuItem onClick={removeMockParticipant}>
                    <X className="h-4 w-4 mr-2 text-red-500" /> Remove Test Participant ({mockParticipants.length})
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
};

// ========================
// Rally Button for Channel/DM Headers
// ========================
export const RallyButton = ({ onClick, disabled = false, size = 'default', variant = 'default' }) => {
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    default: 'h-9 px-4',
    lg: 'h-10 px-5'
  };
  
  const variantClasses = {
    default: 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-semibold',
    ghost: 'bg-transparent hover:bg-orange-500/20 text-orange-500',
    outline: 'border border-orange-500/50 hover:bg-orange-500/10 text-orange-500'
  };
  
  return (
    <Button
      className={cn(
        "rounded-full transition-all gap-2",
        sizeClasses[size],
        variantClasses[variant],
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <RallyIcon className="h-4 w-4" />
      <span>Rally</span>
    </Button>
  );
};

// ========================
// Incoming Rally Call Dialog
// ========================
export const IncomingRallyDialog = ({ call, onAccept, onDecline }) => {
  const [countdown, setCountdown] = useState(30);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDecline]);
  
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 w-[400px] text-center shadow-2xl border border-orange-500/30 animate-in zoom-in-95">
        {/* Animated rings */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-2 border-orange-500/30 animate-ping" style={{ animationDuration: '1.5s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full border-2 border-orange-500/50 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.2s' }} />
          </div>
          
          <div className="relative inline-block">
            <Avatar className="h-24 w-24 ring-4 ring-orange-500 ring-offset-4 ring-offset-slate-800">
              <AvatarFallback className="text-3xl bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold">
                {call?.caller_name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-2">
              <RallyIcon className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 mb-2">
          <RallyIcon className="h-6 w-6 text-orange-500" animated />
          <h2 className="text-2xl font-bold text-white">Incoming Rally</h2>
        </div>
        
        <p className="text-lg text-slate-300 mb-2">{call?.caller_name || 'Unknown'}</p>
        <p className="text-slate-400 mb-6">
          {call?.call_type === 'group' ? 'Group Video Call' : 'Video Call'}
        </p>
        
        <div className="text-slate-500 text-sm mb-6">
          Auto-declining in {countdown}s
        </div>
        
        <div className="flex justify-center gap-6">
          <Button
            variant="destructive"
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={onDecline}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
          <Button
            size="lg"
            className="h-16 w-16 rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white"
            onClick={onAccept}
          >
            <Video className="h-7 w-7" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default { 
  RallyVideoCallWindow, 
  RallyButton, 
  RallyIcon,
  IncomingRallyDialog 
};
