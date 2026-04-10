import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Phone, Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff,
  Users, Settings, Maximize2, Minimize2, X, LayoutGrid,
  Pin, PinOff, ExternalLink, MoreVertical, PhoneIncoming, ChevronDown, RefreshCw
} from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';

// WebRTC Configuration - using public STUN servers
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

// ========================
// Device Settings Storage
// ========================
const STORAGE_KEY = 'videoCallDeviceSettings';

const getStoredDevices = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const storeDevices = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
};

// ========================
// Device Picker Hook
// ========================
export const useDevices = () => {
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = deviceList.filter(d => d.kind === 'videoinput');
      const microphones = deviceList.filter(d => d.kind === 'audioinput');
      const speakers = deviceList.filter(d => d.kind === 'audiooutput');
      
      console.log('📷 Available cameras:', cameras.map(c => ({ id: c.deviceId, label: c.label })));
      console.log('🎤 Available microphones:', microphones.map(m => ({ id: m.deviceId, label: m.label })));
      
      setDevices({ cameras, microphones, speakers });
      
      // Load stored preferences or use first device
      const stored = getStoredDevices();
      
      if (cameras.length > 0) {
        const storedCamera = stored.cameraId && cameras.find(c => c.deviceId === stored.cameraId);
        setSelectedCamera(storedCamera ? stored.cameraId : cameras[0].deviceId);
      }
      
      if (microphones.length > 0) {
        const storedMic = stored.microphoneId && microphones.find(m => m.deviceId === stored.microphoneId);
        setSelectedMicrophone(storedMic ? stored.microphoneId : microphones[0].deviceId);
      }
      
    } catch (err) {
      console.error('Error loading devices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, [loadDevices]);

  const selectCamera = useCallback((deviceId) => {
    setSelectedCamera(deviceId);
    const stored = getStoredDevices();
    storeDevices({ ...stored, cameraId: deviceId });
  }, []);

  const selectMicrophone = useCallback((deviceId) => {
    setSelectedMicrophone(deviceId);
    const stored = getStoredDevices();
    storeDevices({ ...stored, microphoneId: deviceId });
  }, []);

  return {
    devices,
    selectedCamera,
    selectedMicrophone,
    selectCamera,
    selectMicrophone,
    loading,
    error,
    refresh: loadDevices
  };
};

// ========================
// Pre-Call Settings Dialog
// ========================
export const PreCallSettings = ({ onStart, onCancel, callType = 'video' }) => {
  const { devices, selectedCamera, selectedMicrophone, selectCamera, selectMicrophone, loading, error, refresh } = useDevices();
  const [previewStream, setPreviewStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [previewError, setPreviewError] = useState(null);
  const videoPreviewRef = useRef(null);
  const currentStreamRef = useRef(null);

  // Start preview when camera or microphone changes
  useEffect(() => {
    let isCancelled = false;
    
    const startPreview = async () => {
      // Don't start if no devices selected yet
      if (!selectedCamera && !selectedMicrophone) {
        console.log('🎬 No devices selected yet, skipping preview');
        return;
      }
      
      try {
        setPreviewError(null);
        
        // Stop previous stream first
        if (currentStreamRef.current) {
          console.log('🎬 Stopping previous stream');
          currentStreamRef.current.getTracks().forEach(t => {
            t.stop();
            console.log(`🎬 Stopped track: ${t.kind} - ${t.label}`);
          });
          currentStreamRef.current = null;
        }
        
        const constraints = {
          video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
          audio: selectedMicrophone ? { deviceId: { exact: selectedMicrophone } } : true
        };
        
        console.log('🎬 Requesting media with constraints:', JSON.stringify(constraints));
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (isCancelled) {
          console.log('🎬 Preview cancelled, stopping new stream');
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        console.log('🎬 Got preview stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}:${t.enabled}:${t.readyState}`));
        
        currentStreamRef.current = stream;
        setPreviewStream(stream);
        
        // Bind to video element
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          try {
            await videoPreviewRef.current.play();
            console.log('🎬 Video preview playing');
          } catch (playErr) {
            console.warn('🎬 Video play warning:', playErr.message);
          }
        }
      } catch (err) {
        console.error('🎬 Preview error:', err.name, err.message);
        setPreviewError(`${err.name}: ${err.message}`);
        
        // Try with less strict constraints if exact device fails
        if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
          console.log('🎬 Retrying with relaxed constraints...');
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (!isCancelled) {
              currentStreamRef.current = fallbackStream;
              setPreviewStream(fallbackStream);
              setPreviewError(null);
              if (videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = fallbackStream;
                await videoPreviewRef.current.play().catch(() => {});
              }
              console.log('🎬 Fallback preview working');
            } else {
              fallbackStream.getTracks().forEach(t => t.stop());
            }
          } catch (fallbackErr) {
            console.error('🎬 Fallback also failed:', fallbackErr);
          }
        }
      }
    };
    
    startPreview();
    
    return () => {
      isCancelled = true;
    };
  }, [selectedCamera, selectedMicrophone]);

  // Bind stream to video element whenever it changes
  useEffect(() => {
    if (previewStream && videoPreviewRef.current) {
      console.log('🎬 Binding stream to video element');
      const videoEl = videoPreviewRef.current;
      videoEl.srcObject = previewStream;
      
      // Ensure video plays
      const playVideo = async () => {
        try {
          await videoEl.play();
          console.log('🎬 Video element playing, dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
        } catch (e) {
          console.warn('🎬 Play failed:', e.message);
        }
      };
      
      // Play immediately and also when metadata loads
      playVideo();
      videoEl.onloadedmetadata = () => {
        console.log('🎬 Video metadata loaded, dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
        playVideo();
      };
    }
  }, [previewStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentStreamRef.current) {
        console.log('🎬 Cleanup: stopping all tracks');
        currentStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleStart = () => {
    // Clear the ref so cleanup doesn't kill the stream we're passing to the call
    currentStreamRef.current = null;
    onStart({
      stream: previewStream,
      cameraId: selectedCamera,
      microphoneId: selectedMicrophone,
      videoEnabled,
      audioEnabled
    });
  };

  const handleCancel = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
    }
    onCancel();
  };

  const togglePreviewVideo = () => {
    if (previewStream) {
      const videoTrack = previewStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const togglePreviewAudio = () => {
    if (previewStream) {
      const audioTrack = previewStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 w-[500px] max-w-[95vw] shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Join Call Settings</h2>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="h-5 w-5 text-slate-400" />
          </Button>
        </div>
        
        {/* Video Preview */}
        <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video mb-6">
          <video
            ref={videoPreviewRef}
            autoPlay
            playsInline
            muted
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror for selfie view
              display: videoEnabled ? 'block' : 'none'
            }}
          />
          {/* Show current camera info */}
          {previewStream && videoEnabled && (
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {previewStream.getVideoTracks()[0]?.label || 'Camera active'}
            </div>
          )}
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-3xl bg-slate-700">You</AvatarFallback>
              </Avatar>
            </div>
          )}
          {/* Loading state */}
          {videoEnabled && !previewStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-slate-400 text-sm">Loading camera...</div>
            </div>
          )}
          
          {/* Preview Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <Button
              variant={audioEnabled ? "secondary" : "destructive"}
              size="lg"
              className="h-12 w-12 rounded-full"
              onClick={togglePreviewAudio}
            >
              {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
            <Button
              variant={videoEnabled ? "secondary" : "destructive"}
              size="lg"
              className="h-12 w-12 rounded-full"
              onClick={togglePreviewVideo}
            >
              {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        
        {/* Device Selectors */}
        <div className="space-y-4 mb-6">
          {/* Camera Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Camera</Label>
              <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
            <Select value={selectedCamera} onValueChange={(val) => {
              console.log('Camera selected:', val);
              selectCamera(val);
            }}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="Select camera...">
                  {devices.cameras.find(c => c.deviceId === selectedCamera)?.label || 'Select camera...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 z-[300]" position="popper" sideOffset={5}>
                {devices.cameras.map(camera => (
                  <SelectItem 
                    key={camera.deviceId} 
                    value={camera.deviceId}
                    className="text-white hover:bg-slate-700 cursor-pointer"
                  >
                    {camera.label || `Camera ${devices.cameras.indexOf(camera) + 1}`}
                  </SelectItem>
                ))}
                {devices.cameras.length === 0 && (
                  <div className="text-slate-400 p-2 text-sm">No cameras found</div>
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Microphone Selector */}
          <div className="space-y-2">
            <Label className="text-slate-300">Microphone</Label>
            <Select value={selectedMicrophone} onValueChange={(val) => {
              console.log('Microphone selected:', val);
              selectMicrophone(val);
            }}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="Select microphone...">
                  {devices.microphones.find(m => m.deviceId === selectedMicrophone)?.label || 'Select microphone...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 z-[300]" position="popper" sideOffset={5}>
                {devices.microphones.map(mic => (
                  <SelectItem 
                    key={mic.deviceId} 
                    value={mic.deviceId}
                    className="text-white hover:bg-slate-700 cursor-pointer"
                  >
                    {mic.label || `Microphone ${devices.microphones.indexOf(mic) + 1}`}
                  </SelectItem>
                ))}
                {devices.microphones.length === 0 && (
                  <div className="text-slate-400 p-2 text-sm">No microphones found</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {(error || previewError) && (
          <div className="text-red-400 text-sm mb-4 p-3 bg-red-900/20 rounded-lg">
            {previewError || error}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700" 
            onClick={handleStart}
            disabled={!previewStream}
          >
            <Video className="h-4 w-4 mr-2" />
            Join Call
          </Button>
        </div>
      </div>
    </div>
  );
};

// ========================
// Video Call Hook — DEPRECATED: Use VideoCallContext instead.
// Kept as a stub for backward compatibility.
// ========================


// ========================
// Video Tile Component
// ========================

const VideoTile = ({ stream, muted = false, label, isSelf = false, audioEnabled = true, videoEnabled = true, isScreenShare = false, onPin }) => {
  const videoRef = useRef(null);
  
  // Debug: Log all props
  useEffect(() => {
    console.log(`🎥 VideoTile [${label}]: stream=${!!stream}, videoEnabled=${videoEnabled}, isScreenShare=${isScreenShare}, isSelf=${isSelf}`);
  }, [stream, videoEnabled, isScreenShare, isSelf, label]);
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream) {
      const tracks = stream.getTracks();
      console.log(`🎥 VideoTile [${label}]: Binding stream with ${tracks.length} tracks:`, tracks.map(t => `${t.kind}:${t.label}:${t.enabled}:${t.readyState}`));
      videoElement.srcObject = stream;
      
      // Ensure video plays
      const playVideo = async () => {
        try {
          await videoElement.play();
          console.log(`🎥 VideoTile [${label}]: Playing, dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        } catch (err) {
          console.warn(`🎥 VideoTile [${label}]: Play failed:`, err.message);
        }
      };
      
      playVideo();
      videoElement.onloadedmetadata = () => {
        console.log(`🎥 VideoTile [${label}]: Metadata loaded, dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        playVideo();
      };
    }
  }, [stream, label]);
  
  // Determine if we should show video - show it if we have a stream
  const hasVideoStream = stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideoStream;
  
  return (
    <div className="relative bg-slate-800 rounded-lg overflow-hidden aspect-video group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover',
          transform: isSelf ? 'scaleX(-1)' : 'none', // Mirror for self view
          display: showVideo ? 'block' : 'none'
        }}
      />
      
      {/* Avatar fallback when no video stream available */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-700">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl bg-slate-600">
              {label?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      
      {/* Label bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!audioEnabled && <MicOff className="h-4 w-4 text-red-500" />}
            <span className="text-white text-sm font-medium truncate">
              {label} {isSelf && '(You)'}
            </span>
          </div>
          {onPin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onPin}
            >
              <Pin className="h-3 w-3 text-white" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ========================
// Video Call Window
// ========================

export const VideoCallWindow = ({
  activeCall,
  participants,
  localStream,
  remoteStreams,
  mediaState,
  onLeave,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  isHost = false,
  currentUserId
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  const connectedParticipants = participants.filter(p => p.status === 'connected' && p.user_id !== currentUserId);
  const participantCount = connectedParticipants.length + 1; // +1 for self
  
  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
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
  
  // Grid layout based on participant count
  const getGridCols = () => {
    if (pinnedUserId) return 'grid-cols-4';
    if (participantCount <= 1) return 'grid-cols-1';
    if (participantCount <= 2) return 'grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };
  
  if (isMinimized) {
    return (
      <div
        className="fixed z-[100] bg-slate-900 rounded-lg shadow-2xl p-3 cursor-move border border-slate-700"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-white">
            <Video className="h-4 w-4 text-green-500" />
            <span className="text-sm">{participantCount} in call</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(false)}>
            <Maximize2 className="h-4 w-4 text-white" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onLeave}>
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className="fixed z-[100] bg-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-700"
      style={{ left: position.x, top: position.y, width: 900, height: 650, maxWidth: 'calc(100vw - 100px)', maxHeight: 'calc(100vh - 100px)' }}
    >
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between cursor-move" onMouseDown={handleMouseDown}>
        <div className="flex items-center gap-3 text-white">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="font-semibold">{activeCall?.title || 'Video Call'}</span>
          </div>
          <span className="text-slate-400">•</span>
          <span className="text-slate-300 text-sm">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300" onClick={onLeave}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Video Grid */}
      <div className="flex-1 p-3 bg-slate-900 overflow-hidden">
        <div className={cn("grid gap-2 h-full", getGridCols())}>
          {/* Pinned view */}
          {pinnedUserId && (
            <div className="col-span-3 row-span-2">
              {pinnedUserId === 'local' ? (
                <VideoTile
                  stream={localStream}
                  muted
                  label="You"
                  isSelf
                  audioEnabled={mediaState.audioEnabled}
                  videoEnabled={mediaState.videoEnabled}
                  isScreenShare={mediaState.screenSharing}
                  onPin={() => setPinnedUserId(null)}
                />
              ) : (
                <VideoTile
                  stream={remoteStreams[pinnedUserId]}
                  label={connectedParticipants.find(p => p.user_id === pinnedUserId)?.user_name}
                  audioEnabled={connectedParticipants.find(p => p.user_id === pinnedUserId)?.media_state?.audio_enabled}
                  videoEnabled={connectedParticipants.find(p => p.user_id === pinnedUserId)?.media_state?.video_enabled}
                  onPin={() => setPinnedUserId(null)}
                />
              )}
            </div>
          )}
          
          {/* Self video */}
          {(!pinnedUserId || pinnedUserId !== 'local') && (
            <VideoTile
              stream={localStream}
              muted
              label="You"
              isSelf
              audioEnabled={mediaState.audioEnabled}
              videoEnabled={mediaState.videoEnabled}
              isScreenShare={mediaState.screenSharing}
              onPin={participantCount > 1 ? () => setPinnedUserId('local') : undefined}
            />
          )}
          
          {/* Remote participants */}
          {connectedParticipants.map(p => (
            (!pinnedUserId || pinnedUserId !== p.user_id) && (
              <VideoTile
                key={p.user_id}
                stream={remoteStreams[p.user_id]}
                label={p.user_name}
                audioEnabled={p.media_state?.audio_enabled !== false}
                videoEnabled={p.media_state?.video_enabled !== false}
                isScreenShare={p.media_state?.screen_sharing === true}
                onPin={() => setPinnedUserId(p.user_id)}
              />
            )
          ))}
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-slate-800 px-6 py-4 flex items-center justify-center gap-4">
        <Button
          variant={mediaState.audioEnabled ? "secondary" : "destructive"}
          size="lg"
          className="h-12 w-12 rounded-full"
          onClick={onToggleAudio}
        >
          {mediaState.audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant={mediaState.videoEnabled ? "secondary" : "destructive"}
          size="lg"
          className="h-12 w-12 rounded-full"
          onClick={onToggleVideo}
        >
          {mediaState.videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        
        <Button
          variant={mediaState.screenSharing ? "default" : "secondary"}
          size="lg"
          className="h-12 w-12 rounded-full"
          onClick={onToggleScreenShare}
        >
          {mediaState.screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
        </Button>
        
        <div className="w-px h-10 bg-slate-600" />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="lg" className="h-12 w-12 rounded-full">
              <Users className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <div className="px-3 py-2 font-semibold">Participants ({participantCount})</div>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 flex items-center justify-between">
              <span>You (Host)</span>
              <div className="flex gap-1">
                {!mediaState.audioEnabled && <MicOff className="h-4 w-4 text-red-500" />}
                {!mediaState.videoEnabled && <VideoOff className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            {connectedParticipants.map(p => (
              <div key={p.user_id} className="px-3 py-2 flex items-center justify-between">
                <span>{p.user_name}</span>
                <div className="flex gap-1">
                  {!p.media_state?.audio_enabled && <MicOff className="h-4 w-4 text-red-500" />}
                  {!p.media_state?.video_enabled && <VideoOff className="h-4 w-4 text-red-500" />}
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="w-px h-10 bg-slate-600" />
        
        <Button variant="destructive" size="lg" className="h-12 px-6 rounded-full" onClick={isHost ? onEnd : onLeave}>
          <PhoneOff className="h-5 w-5 mr-2" />
          {isHost ? 'End Call' : 'Leave'}
        </Button>
      </div>
    </div>
  );
};

// ========================
// Incoming Call Dialog
// ========================

export const IncomingCallDialog = ({ call, onAccept, onDecline }) => {
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-8 w-96 text-center shadow-2xl border border-slate-700 animate-in zoom-in-95">
        <div className="relative mb-6">
          <div className="relative inline-block">
            <Avatar className="h-24 w-24 ring-4 ring-green-500 ring-offset-4 ring-offset-slate-800">
              <AvatarFallback className="text-3xl bg-slate-700">
                {call?.caller_name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-2 animate-pulse">
              <PhoneIncoming className="h-4 w-4 text-white" />
            </div>
          </div>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-1">{call?.caller_name || 'Unknown'}</h2>
        {call?.caller_title && (
          <p className="text-slate-300 text-sm font-medium">{call.caller_title}</p>
        )}
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
            className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
            onClick={onAccept}
          >
            <Video className="h-7 w-7" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ========================
// Quick Call Buttons
// ========================

export const QuickCallButtons = ({ onVideoCall, onVoiceCall, disabled = false }) => (
  <div className="flex items-center gap-1">
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onVoiceCall} disabled={disabled} title="Voice call">
      <Phone className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onVideoCall} disabled={disabled} title="Video call">
      <Video className="h-4 w-4" />
    </Button>
  </div>
);

export default { VideoCallWindow, IncomingCallDialog, QuickCallButtons };
