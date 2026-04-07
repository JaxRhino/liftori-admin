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
import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

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
    // Don't stop preview stream - pass it to the call
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
// Video Call Hook - Manages all video call state and WebRTC
// ========================

export const useVideoCall = (videoCallEvents = [], wsIncomingCall, clearWsIncomingCall, token) => {
  // Call state
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  // Media state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [mediaState, setMediaState] = useState({
    audioEnabled: true,
    videoEnabled: true,
    screenSharing: false
  });
  
  // Refs for WebRTC
  const peerConnections = useRef({});
  const activeCallRef = useRef(null);
  const localStreamRef = useRef(null);
  const pollingRef = useRef(null);
  
  // Keep refs in sync with state
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  
  // Poll for incoming calls (backup for WebSocket)
  useEffect(() => {
    if (!token || activeCall) return;
    
    const checkForCalls = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/video/calls/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.incoming_calls?.length > 0 && !incomingCall) {
          const call = response.data.incoming_calls[0];
          
          // Only show calls created within the last 60 seconds
          const createdAt = new Date(call.created_at);
          const now = new Date();
          const ageSeconds = (now - createdAt) / 1000;
          
          if (ageSeconds > 60) {
            console.log('Ignoring stale call:', call.id, 'age:', ageSeconds);
            return;
          }
          
          // Fetch full call details
          const callDetails = await axios.get(`${API_URL}/api/video/calls/${call.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const initiator = callDetails.data.participants.find(p => p.role === 'host');
          console.log('📞 Incoming call detected via polling:', call.id);
          setIncomingCall({
            session_id: call.id,
            call_type: call.call_type,
            caller_id: call.initiated_by,
            caller_name: initiator?.user_name || call.initiated_by_name || 'Unknown',
            video_enabled: call.settings?.video_enabled ?? true
          });
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    };
    
    // Poll every 2 seconds for faster response
    checkForCalls();
    pollingRef.current = setInterval(checkForCalls, 2000);
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [token, activeCall, incomingCall]);
  
  // Handle incoming call from WebSocket
  useEffect(() => {
    if (wsIncomingCall && !activeCall && !incomingCall) {
      console.log('📞 Incoming call via WebSocket:', wsIncomingCall);
      setIncomingCall(wsIncomingCall);
    }
  }, [wsIncomingCall, activeCall, incomingCall]);
  
  // Process WebSocket events
  useEffect(() => {
    if (!videoCallEvents || videoCallEvents.length === 0) return;
    
    videoCallEvents.forEach(event => {
      console.log('📨 Video call event:', event.type, event);
      
      switch (event.type) {
        case 'incoming_call':
          if (!activeCall && !incomingCall) {
            setIncomingCall(event);
          }
          break;
          
        case 'call:participant_joined':
          handleParticipantJoined(event);
          break;
          
        case 'call:participant_left':
          handleParticipantLeft(event);
          break;
          
        case 'call:ended':
          toast.info('Call ended');
          cleanup();
          break;
          
        case 'call:media_changed':
          updateParticipantMedia(event);
          break;
          
        case 'webrtc:offer':
          handleOffer(event);
          break;
          
        case 'webrtc:answer':
          handleAnswer(event);
          break;
          
        case 'webrtc:ice-candidate':
          handleIceCandidate(event);
          break;
          
        default:
          break;
      }
    });
  }, [videoCallEvents]);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up video call...');
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped track: ${track.kind}`);
      });
    }
    setLocalStream(null);
    
    // Close all peer connections
    Object.entries(peerConnections.current).forEach(([id, pc]) => {
      pc.close();
      console.log(`Closed peer connection: ${id}`);
    });
    peerConnections.current = {};
    
    // Reset state
    setActiveCall(null);
    setParticipants([]);
    setRemoteStreams({});
    setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });
    setIncomingCall(null);
    
    if (clearWsIncomingCall) clearWsIncomingCall();
  }, [clearWsIncomingCall]);
  
  // Get user media
  const getMedia = useCallback(async (video = true, audio = true) => {
    try {
      console.log(`📹 Requesting media: video=${video}, audio=${audio}`);
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      console.log('✅ Got media stream:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
      setLocalStream(stream);
      setMediaState({ audioEnabled: audio, videoEnabled: video, screenSharing: false });
      return stream;
    } catch (error) {
      console.error('❌ Media access error:', error);
      toast.error(`Camera/mic access denied: ${error.message}`);
      throw error;
    }
  }, []);
  
  // Create peer connection for a user
  const createPeerConnection = useCallback((userId, stream) => {
    console.log(`🔗 Creating peer connection for user: ${userId}`);
    
    if (peerConnections.current[userId]) {
      console.log('Peer connection already exists, closing old one');
      peerConnections.current[userId].close();
    }
    
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current[userId] = pc;
    
    // Add local tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`Adding track to peer: ${track.kind}`);
        pc.addTrack(track, stream);
      });
    }
    
    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`📺 Received remote track from ${userId}:`, event.track.kind);
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: event.streams[0]
      }));
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to ${userId}`);
        sendSignal('ice-candidate', userId, { candidate: event.candidate });
      }
    };
    
    // Log connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        toast.error(`Connection to participant failed`);
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${userId}: ${pc.iceConnectionState}`);
    };
    
    return pc;
  }, []);
  
  // Send WebRTC signal
  const sendSignal = useCallback(async (type, toUserId, data) => {
    const call = activeCallRef.current;
    if (!call) return;
    
    try {
      await axios.post(`${API_URL}/api/video/calls/${call.id}/signal`, data, {
        params: { signal_type: type, to_user_id: toUserId },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Signal error:', error);
    }
  }, [token]);
  
  // Handle WebRTC offer
  const handleOffer = useCallback(async (event) => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn('No local stream for handling offer');
      return;
    }
    
    console.log(`📥 Handling offer from ${event.from_user_id}`);
    const pc = createPeerConnection(event.from_user_id, stream);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(event.signal_data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', event.from_user_id, { sdp: pc.localDescription });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [createPeerConnection, sendSignal]);
  
  // Handle WebRTC answer
  const handleAnswer = useCallback(async (event) => {
    const pc = peerConnections.current[event.from_user_id];
    if (!pc) return;
    
    console.log(`📥 Handling answer from ${event.from_user_id}`);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(event.signal_data.sdp));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);
  
  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (event) => {
    const pc = peerConnections.current[event.from_user_id];
    if (!pc || !event.signal_data?.candidate) return;
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(event.signal_data.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);
  
  // Handle participant joined
  const handleParticipantJoined = useCallback(async (event) => {
    console.log(`👤 Participant joined: ${event.user_name}`);
    toast.info(`${event.user_name} joined the call`);
    
    setParticipants(prev => {
      const exists = prev.find(p => p.user_id === event.user_id);
      if (exists) {
        return prev.map(p => p.user_id === event.user_id ? { ...p, status: 'connected', ...event } : p);
      }
      return [...prev, { user_id: event.user_id, user_name: event.user_name, status: 'connected', media_state: event.media_state }];
    });
    
    // Initiate WebRTC connection
    const stream = localStreamRef.current;
    if (stream && activeCallRef.current) {
      const pc = createPeerConnection(event.user_id, stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal('offer', event.user_id, { sdp: pc.localDescription });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }
  }, [createPeerConnection, sendSignal]);
  
  // Handle participant left
  const handleParticipantLeft = useCallback((event) => {
    console.log(`👤 Participant left: ${event.user_name}`);
    toast.info(`${event.user_name} left the call`);
    
    setParticipants(prev => prev.filter(p => p.user_id !== event.user_id));
    
    // Close peer connection
    if (peerConnections.current[event.user_id]) {
      peerConnections.current[event.user_id].close();
      delete peerConnections.current[event.user_id];
    }
    
    // Remove remote stream
    setRemoteStreams(prev => {
      const updated = { ...prev };
      delete updated[event.user_id];
      return updated;
    });
  }, []);
  
  // Update participant media state
  const updateParticipantMedia = useCallback((event) => {
    setParticipants(prev => prev.map(p => {
      if (p.user_id === event.user_id) {
        return {
          ...p,
          media_state: {
            ...p.media_state,
            audio_enabled: event.audio_enabled ?? p.media_state?.audio_enabled,
            video_enabled: event.video_enabled ?? p.media_state?.video_enabled,
            screen_sharing: event.screen_sharing ?? p.media_state?.screen_sharing
          }
        };
      }
      return p;
    }));
  }, []);
  
  // Start a call
  const startCall = useCallback(async (participantIds, channelId = null, callType = 'one_on_one') => {
    try {
      console.log('📞 Starting call...', { participantIds, callType });
      
      // Get media first
      const stream = await getMedia(true, true);
      
      // Create call via API
      const response = await axios.post(`${API_URL}/api/video/calls`, {
        call_type: callType,
        channel_id: channelId,
        participant_user_ids: participantIds,
        video_enabled: true,
        audio_enabled: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Call created:', response.data.session.id);
      setActiveCall(response.data.session);
      setParticipants(response.data.participants);
      
      // Stop polling while in call
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Error starting call:', error);
      cleanup();
      throw error;
    }
  }, [token, getMedia, cleanup]);
  
  // Join a call
  const joinCall = useCallback(async (sessionId) => {
    try {
      console.log('📞 Joining call:', sessionId);
      
      // Get media first
      const stream = await getMedia(true, true);
      
      // Join via API
      const response = await axios.post(`${API_URL}/api/video/calls/${sessionId}/join`, {
        video_enabled: true,
        audio_enabled: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Joined call');
      setActiveCall(response.data.session);
      setParticipants(response.data.participants);
      setIncomingCall(null);
      if (clearWsIncomingCall) clearWsIncomingCall();
      
      // Stop polling while in call
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      
      // Create peer connections for existing connected participants
      const connectedParticipants = response.data.participants.filter(
        p => p.status === 'connected' && p.role !== 'host'
      );
      
      for (const participant of connectedParticipants) {
        const pc = createPeerConnection(participant.user_id, stream);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal('offer', participant.user_id, { sdp: pc.localDescription });
        } catch (error) {
          console.error('Error creating offer for existing participant:', error);
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Error joining call:', error);
      cleanup();
      throw error;
    }
  }, [token, getMedia, createPeerConnection, sendSignal, clearWsIncomingCall, cleanup]);
  
  // Leave call
  const leaveCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    
    try {
      await axios.post(`${API_URL}/api/video/calls/${call.id}/leave`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error leaving call:', error);
    }
    cleanup();
  }, [token, cleanup]);
  
  // End call (host only)
  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    
    try {
      await axios.post(`${API_URL}/api/video/calls/${call.id}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error ending call:', error);
    }
    cleanup();
  }, [token, cleanup]);
  
  // Decline call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    
    try {
      await axios.post(`${API_URL}/api/video/calls/${incomingCall.session_id}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error declining call:', error);
    }
    setIncomingCall(null);
    if (clearWsIncomingCall) clearWsIncomingCall();
  }, [incomingCall, token, clearWsIncomingCall]);
  
  // Toggle audio
  const toggleAudio = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMediaState(prev => ({ ...prev, audioEnabled: track.enabled }));
      
      // Notify server
      const call = activeCallRef.current;
      if (call) {
        try {
          await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`, 
            { audio_enabled: track.enabled },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          console.error('Error updating audio state:', error);
        }
      }
    }
  }, [token]);
  
  // Toggle video
  const toggleVideo = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMediaState(prev => ({ ...prev, videoEnabled: track.enabled }));
      
      // Notify server
      const call = activeCallRef.current;
      if (call) {
        try {
          await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`, 
            { video_enabled: track.enabled },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          console.error('Error updating video state:', error);
        }
      }
    }
  }, [token]);
  
  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    const call = activeCallRef.current;
    
    if (mediaState.screenSharing) {
      // Stop screen share, go back to camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        // Replace in all peer connections
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
        
        // Update local stream
        const oldTrack = localStreamRef.current?.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current?.addTrack(videoTrack);
        setLocalStream(localStreamRef.current);
        
        setMediaState(prev => ({ ...prev, screenSharing: false }));
        
        if (call) {
          await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`, 
            { screen_sharing: false },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
    } else {
      // Start screen share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace in all peer connections
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        
        // Handle stop from browser UI
        screenTrack.onended = () => toggleScreenShare();
        
        // Update local stream
        const oldTrack = localStreamRef.current?.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current?.addTrack(screenTrack);
        setLocalStream(localStreamRef.current);
        
        setMediaState(prev => ({ ...prev, screenSharing: true }));
        
        if (call) {
          await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`, 
            { screen_sharing: true },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
        
        toast.success('Screen sharing started');
      } catch (error) {
        if (error.name !== 'NotAllowedError') {
          console.error('Error starting screen share:', error);
          toast.error('Could not start screen sharing');
        }
      }
    }
  }, [mediaState.screenSharing, token]);
  
  return {
    activeCall,
    incomingCall,
    participants,
    localStream,
    remoteStreams,
    mediaState,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    declineCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare
  };
};

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

export default { VideoCallWindow, IncomingCallDialog, QuickCallButtons, useVideoCall };
