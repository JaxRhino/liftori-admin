import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Paperclip,
  PhoneOff,
  X,
  Send,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useVideoCallContext } from '../contexts/VideoCallContext';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const VideoCallRoom = () => {
  const {
    activeCall,
    participants,
    localStream,
    remoteStreams,
    mediaState,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveCall,
    endCall,
    currentUserId,
  } = useVideoCallContext();

  const { user } = useAuth();

  // Local state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [duration, setDuration] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const localVideoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Timer effect
  useEffect(() => {
    if (!activeCall) return;

    const startTime = new Date(activeCall.started_at || activeCall.created_at).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setDuration(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  // Stable callback ref — only set srcObject when element or stream actually changes
  const setLocalVideoRef = useCallback((el) => {
    if (el && el !== localVideoRef.current) {
      localVideoRef.current = el;
      if (localStream) {
        el.srcObject = localStream;
      }
    } else if (!el) {
      localVideoRef.current = null;
    }
  }, [localStream]);

  // Re-bind if localStream changes after mount
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream]);

  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Send message
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newMessage = {
      id: Math.random().toString(36).substr(2, 9),
      sender_id: currentUserId,
      sender_name: user?.email || 'You',
      message: messageInput.trim(),
      timestamp: new Date(),
      file_url: null,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageInput('');

    // Reset unread count when sending
    if (!chatOpen) {
      setUnreadCount(0);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading('Uploading file...');

      // Upload to Supabase storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('call-files')
        .upload(fileName, file);

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from('call-files')
        .getPublicUrl(fileName);

      const fileUrl = publicData?.publicUrl;

      // Add message with file
      const newMessage = {
        id: Math.random().toString(36).substr(2, 9),
        sender_id: currentUserId,
        sender_name: user?.email || 'You',
        message: `Shared file: ${file.name}`,
        timestamp: new Date(),
        file_url: fileUrl,
        file_name: file.name,
      };

      setMessages((prev) => [...prev, newMessage]);
      toast.success('File uploaded');

      if (!chatOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    } catch (err) {
      toast.error('Upload error');
      console.error(err);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if current user is call creator
  const isCallCreator = activeCall?.created_by === currentUserId;

  // Don't render if no active call
  if (!activeCall) {
    return null;
  }

  // Get all participants including self — filter out current user from remote list
  // to avoid showing ourselves twice (once as "You" + once from DB participants)
  const remoteParticipants = participants.filter(
    (p) => p.peerId !== 'local' && p.peerId !== currentUserId && p.user_id !== currentUserId
  );
  const allParticipants = [
    {
      peerId: 'local',
      display_name: 'You',
      is_self: true,
      media_state: mediaState,
    },
    ...remoteParticipants,
  ];

  // Determine which video to show as large (shared screen or first remote)
  const screenShareParticipant = allParticipants.find(
    (p) => p.media_state?.screen_sharing
  );
  const largeVideoParticipant = screenShareParticipant || allParticipants[0];
  const smallVideoParticipants = screenShareParticipant
    ? allParticipants.filter((p) => p.peerId !== screenShareParticipant.peerId)
    : allParticipants.slice(1);

  return (
    <div className="fixed inset-0 z-40 bg-[#060B18] flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900/80 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">
            {activeCall.title || 'Video Call'}
          </h2>
          <span className="text-sm text-slate-400">
            {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-300">Connected</span>
          </div>
          <div className="text-sm font-mono text-slate-400">
            {formatDuration(duration)}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Large Video */}
          <div className="flex-1 bg-slate-900 rounded-lg overflow-hidden relative">
            {largeVideoParticipant.is_self ? (
              <video
                ref={setLocalVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : largeVideoParticipant.media_state?.video_enabled &&
              remoteStreams[largeVideoParticipant.peerId] ? (
              <RemoteVideo
                stream={remoteStreams[largeVideoParticipant.peerId]}
              />
            ) : (
              <VideoPlaceholder name={largeVideoParticipant.display_name} />
            )}

            {/* Name Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded text-sm text-white flex items-center gap-2">
              <span>{largeVideoParticipant.display_name}</span>
              {!largeVideoParticipant.media_state?.audio_enabled && (
                <MicOff size={14} className="text-red-500" />
              )}
            </div>

            {/* Screen Share Indicator */}
            {screenShareParticipant && (
              <div className="absolute top-4 right-4 bg-sky-500 px-3 py-1 rounded text-xs text-white font-medium flex items-center gap-1">
                <Monitor size={12} />
                Sharing screen
              </div>
            )}
          </div>

          {/* Small Videos Grid (if screen sharing) */}
          {screenShareParticipant && smallVideoParticipants.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 h-24">
              {smallVideoParticipants.map((participant) => (
                <div
                  key={participant.peerId}
                  className="bg-slate-900 rounded-lg overflow-hidden relative"
                >
                  {participant.is_self ? (
                    <video
                      ref={setLocalVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : participant.media_state?.video_enabled &&
                    remoteStreams[participant.peerId] ? (
                    <RemoteVideo stream={remoteStreams[participant.peerId]} />
                  ) : (
                    <VideoPlaceholder name={participant.display_name} size="sm" />
                  )}

                  <div className="absolute bottom-1 left-1 bg-black/50 px-2 py-0.5 rounded text-xs text-white">
                    {participant.display_name}
                  </div>

                  {!participant.media_state?.audio_enabled && (
                    <div className="absolute top-1 right-1 bg-red-500 p-1 rounded">
                      <MicOff size={10} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Grid Videos (if not screen sharing) */}
          {!screenShareParticipant && allParticipants.length > 1 && (
            <div
              className={`grid gap-2 ${
                allParticipants.length === 2
                  ? 'grid-cols-2'
                  : allParticipants.length === 3 || allParticipants.length === 4
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
              }`}
            >
              {allParticipants.map((participant) => (
                <div
                  key={participant.peerId}
                  className="bg-slate-900 rounded-lg overflow-hidden relative aspect-video"
                >
                  {participant.is_self ? (
                    <video
                      ref={setLocalVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : participant.media_state?.video_enabled &&
                    remoteStreams[participant.peerId] ? (
                    <RemoteVideo
                      stream={remoteStreams[participant.peerId]}
                    />
                  ) : (
                    <VideoPlaceholder name={participant.display_name} />
                  )}

                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                    <span>{participant.display_name}</span>
                    {!participant.media_state?.audio_enabled && (
                      <MicOff size={12} className="text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-80 bg-slate-900 border border-slate-700 rounded-lg flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-700 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Chat</h3>
              <button
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  No messages yet
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="space-y-0.5">
                    <div className="text-xs text-slate-400">
                      <span className="font-medium text-slate-300">
                        {msg.sender_name}
                      </span>
                      {' · '}
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {msg.file_url ? (
                      <a
                        href={msg.file_url}
                        download={msg.file_name}
                        className="text-sky-400 hover:text-sky-300 underline flex items-center gap-1 text-xs"
                      >
                        <Download size={12} />
                        {msg.file_name || 'Download file'}
                      </a>
                    ) : (
                      <p className="text-slate-200 break-words">{msg.message}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-700 p-3 flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={handleSendMessage}
                className="bg-sky-500 hover:bg-sky-600 text-white p-2 rounded transition"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="bg-slate-900/80 border-t border-slate-700 px-6 py-4 flex items-center justify-center gap-4">
        {/* Mic Toggle */}
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full transition ${
            mediaState.audioEnabled
              ? 'bg-slate-800 hover:bg-slate-700 text-white'
              : 'bg-red-600/20 hover:bg-red-600/30 text-red-500'
          }`}
          title={mediaState.audioEnabled ? 'Mute' : 'Unmute'}
        >
          {mediaState.audioEnabled ? (
            <Mic size={20} />
          ) : (
            <MicOff size={20} />
          )}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition ${
            mediaState.videoEnabled
              ? 'bg-slate-800 hover:bg-slate-700 text-white'
              : 'bg-red-600/20 hover:bg-red-600/30 text-red-500'
          }`}
          title={mediaState.videoEnabled ? 'Stop video' : 'Start video'}
        >
          {mediaState.videoEnabled ? (
            <Video size={20} />
          ) : (
            <VideoOff size={20} />
          )}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full transition ${
            mediaState.screenSharing
              ? 'bg-sky-500 hover:bg-sky-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
          title={mediaState.screenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {mediaState.screenSharing ? (
            <MonitorOff size={20} />
          ) : (
            <Monitor size={20} />
          )}
        </button>

        {/* File Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition"
          title="Share file"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          className="hidden"
          accept="*/*"
        />

        {/* Chat Toggle */}
        <button
          onClick={() => {
            setChatOpen(!chatOpen);
            setUnreadCount(0);
          }}
          className={`relative p-3 rounded-full transition ${
            chatOpen
              ? 'bg-sky-500 hover:bg-sky-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
          title="Toggle chat"
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Leave Call */}
        <button
          onClick={leaveCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition ml-4"
          title="Leave call"
        >
          <PhoneOff size={20} />
        </button>

        {/* End Call for All (only if creator) */}
        {isCallCreator && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  'End call for all participants? This cannot be undone.'
                )
              ) {
                endCall();
              }
            }}
            className="px-4 py-2 rounded border border-red-600 text-red-500 hover:bg-red-600/10 transition text-sm font-medium"
            title="End call for everyone"
          >
            End for All
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * RemoteVideo component - renders a remote participant's video stream
 */
const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

/**
 * VideoPlaceholder component - shows avatar when video is disabled
 */
const VideoPlaceholder = ({ name, size = 'lg' }) => {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const sizeClass = size === 'sm' ? 'w-12 h-12 text-xl' : 'w-20 h-20 text-4xl';

  return (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
      <div
        className={`${sizeClass} rounded-full bg-sky-500/20 text-sky-400 font-semibold flex items-center justify-center`}
      >
        {initial}
      </div>
    </div>
  );
};

export default VideoCallRoom;
