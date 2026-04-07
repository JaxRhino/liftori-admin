import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useWS } from './WebSocketContext';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_BACKEND_URL || '';

// WebRTC Configuration
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

const VideoCallContext = createContext(null);

export const useVideoCallContext = () => {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCallContext must be used within VideoCallProvider');
  }
  return context;
};

export const VideoCallProvider = ({ children }) => {
  const { token, user } = useAuth();
  const ws = useWS();

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

  // Refs
  const peerConnections = useRef({});
  const activeCallRef = useRef(null);
  const localStreamRef = useRef(null);
  const pollingRef = useRef(null);
  const pendingOffersRef = useRef([]); // Queue for offers that arrive before stream is ready

  // Keep refs synced
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up video call');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);

    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    pendingOffersRef.current = []; // Clear pending offers

    setActiveCall(null);
    setParticipants([]);
    setRemoteStreams({});
    setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });
    setIncomingCall(null);
  }, []);

  // Send WebRTC signal via API
  const sendSignal = useCallback(async (type, toUserId, data) => {
    const call = activeCallRef.current;
    if (!call) return;

    try {
      console.log(`📤 Sending ${type} signal to ${toUserId}`);
      await axios.post(`${API_URL}/api/video/calls/${call.id}/signal`, data, {
        params: { signal_type: type, to_user_id: toUserId },
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Signal error:', error);
    }
  }, [token]);

  // Create peer connection
  const createPeerConnection = useCallback((userId, stream) => {
    console.log(`🔗 Creating peer connection for: ${userId}`);

    if (peerConnections.current[userId]) {
      console.log('  Closing existing connection');
      peerConnections.current[userId].close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current[userId] = pc;

    // Add local tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`  Adding ${track.kind} track`);
        pc.addTrack(track, stream);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`📺 Received remote ${event.track.kind} from ${userId}`);
      setRemoteStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 ICE candidate for ${userId}`);
        sendSignal('ice-candidate', userId, { candidate: event.candidate });
      }
    };

    // Log connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${userId}: ${pc.iceConnectionState}`);
    };

    return pc;
  }, [sendSignal]);

  // Handle WebRTC offer
  const handleOffer = useCallback(async (event) => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn('No local stream yet, queuing offer from', event.from_user_id);
      pendingOffersRef.current.push(event);
      return;
    }

    console.log(`📥 Handling offer from ${event.from_user_id}`);
    const pc = createPeerConnection(event.from_user_id, stream);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(event.signal_data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', event.from_user_id, { sdp: pc.localDescription });
      console.log(`📤 Sent answer to ${event.from_user_id}`);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [createPeerConnection, sendSignal]);

  // Process pending offers when stream becomes available
  useEffect(() => {
    if (localStream && pendingOffersRef.current.length > 0) {
      console.log(`📥 Processing ${pendingOffersRef.current.length} pending offers`);
      const offersToProcess = [...pendingOffersRef.current];
      pendingOffersRef.current = [];
      offersToProcess.forEach(event => {
        handleOffer(event);
      });
    }
  }, [localStream, handleOffer]);

  // Handle WebRTC answer
  const handleAnswer = useCallback(async (event) => {
    const pc = peerConnections.current[event.from_user_id];
    if (!pc) {
      console.warn('No peer connection for answer');
      return;
    }

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

  // Handle participant joined - create offer for new participant
  const handleParticipantJoined = useCallback(async (event) => {
    console.log(`👤 Participant joined: ${event.user_name} (${event.user_id})`);
    toast.info(`${event.user_name} joined the call`);

    setParticipants(prev => {
      const exists = prev.find(p => p.user_id === event.user_id);
      if (exists) {
        return prev.map(p => p.user_id === event.user_id ? { ...p, status: 'connected', ...event } : p);
      }
      return [...prev, {
        user_id: event.user_id,
        user_name: event.user_name,
        status: 'connected',
        media_state: event.media_state
      }];
    });

    // Create peer connection and send offer
    const stream = localStreamRef.current;
    if (stream && activeCallRef.current) {
      console.log(`Creating offer for new participant ${event.user_id}`);
      const pc = createPeerConnection(event.user_id, stream);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal('offer', event.user_id, { sdp: pc.localDescription });
        console.log(`📤 Sent offer to ${event.user_id}`);
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

    if (peerConnections.current[event.user_id]) {
      peerConnections.current[event.user_id].close();
      delete peerConnections.current[event.user_id];
    }

    setRemoteStreams(prev => {
      const updated = { ...prev };
      delete updated[event.user_id];
      return updated;
    });
  }, []);

  // Handle media state changes
  const handleMediaChanged = useCallback((event) => {
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

  // Process WebSocket events
  useEffect(() => {
    if (!ws.videoCallEvents || ws.videoCallEvents.length === 0) return;

    // Process all pending events
    const eventsToProcess = [...ws.videoCallEvents];
    ws.clearVideoCallEvents(); // Clear immediately to prevent duplicate processing

    eventsToProcess.forEach(event => {
      console.log(`📨 WS Event: ${event.type}`, event);

      switch (event.type) {
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
          handleMediaChanged(event);
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
  }, [ws.videoCallEvents, ws.clearVideoCallEvents, handleParticipantJoined, handleParticipantLeft, handleOffer, handleAnswer, handleIceCandidate, handleMediaChanged, cleanup]);

  // Handle incoming call from WebSocket
  useEffect(() => {
    if (ws.incomingCall && !activeCall && !incomingCall) {
      console.log('📞 Incoming call via WebSocket:', ws.incomingCall);
      setIncomingCall(ws.incomingCall);
    }
  }, [ws.incomingCall, activeCall, incomingCall]);

  // Poll for incoming calls (backup)
  useEffect(() => {
    if (!token || !user || activeCall) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkForCalls = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/video/calls/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.incoming_calls?.length > 0 && !incomingCall) {
          const call = response.data.incoming_calls[0];

          // Only show calls created within the last 60 seconds
          const createdAt = new Date(call.created_at);
          const ageSeconds = (Date.now() - createdAt.getTime()) / 1000;

          if (ageSeconds > 60) return;

          console.log('📞 Incoming call via polling:', call.id);
          setIncomingCall({
            session_id: call.id,
            call_type: call.call_type,
            caller_id: call.initiated_by,
            caller_name: call.initiated_by_name || 'Unknown',
            video_enabled: call.settings?.video_enabled ?? true
          });
        }
      } catch (error) {
        // Ignore
      }
    };

    checkForCalls();
    pollingRef.current = setInterval(checkForCalls, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [token, user, activeCall, incomingCall]);

  // Get stored device preferences
  const getStoredDevices = useCallback(() => {
    try {
      const stored = localStorage.getItem('videoCallDeviceSettings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  // Get media with optional device selection
  const getMedia = useCallback(async (video = true, audio = true, options = {}) => {
    try {
      const { cameraId, microphoneId } = options;
      const storedDevices = getStoredDevices();

      // Build constraints with specific devices if provided
      const videoConstraint = video ? (
        cameraId ? { deviceId: { exact: cameraId } } :
        storedDevices.cameraId ? { deviceId: { ideal: storedDevices.cameraId } } :
        true
      ) : false;

      const audioConstraint = audio ? (
        microphoneId ? { deviceId: { exact: microphoneId } } :
        storedDevices.microphoneId ? { deviceId: { ideal: storedDevices.microphoneId } } :
        true
      ) : false;

      console.log(`📹 Requesting media with constraints:`, { video: videoConstraint, audio: audioConstraint });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint
      });

      console.log('✅ Got media stream, tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}:${t.enabled}`));
      setLocalStream(stream);
      setMediaState({ audioEnabled: audio, videoEnabled: video, screenSharing: false });
      return stream;
    } catch (error) {
      console.error('Media access error:', error);
      toast.error(`Camera/mic access denied: ${error.message}`);
      throw error;
    }
  }, [getStoredDevices]);

  // Start call with existing stream (from PreCallSettings)
  const startCallWithStream = useCallback(async (participantIds, channelId, callType, existingStream) => {
    try {
      console.log('📞 Starting call with existing stream:', { participantIds, callType });

      setLocalStream(existingStream);
      localStreamRef.current = existingStream;
      setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });

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

      return response.data;
    } catch (error) {
      console.error('Error starting call:', error);
      cleanup();
      throw error;
    }
  }, [token, cleanup]);

  // Join call with existing stream (from PreCallSettings)
  const joinCallWithStream = useCallback(async (sessionId, existingStream) => {
    try {
      console.log('📞 Joining call with existing stream:', sessionId);

      setLocalStream(existingStream);
      localStreamRef.current = existingStream;
      setMediaState({ audioEnabled: true, videoEnabled: true, screenSharing: false });

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
      ws.clearIncomingCall();

      return response.data;
    } catch (error) {
      console.error('Error joining call:', error);
      cleanup();
      throw error;
    }
  }, [token, cleanup, ws]);

  // Start call (original method - now uses stored device preferences)
  const startCall = useCallback(async (participantIds, channelId = null, callType = 'one_on_one') => {
    try {
      console.log('📞 Starting call:', { participantIds, callType });
      const stream = await getMedia(true, true);

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

      return response.data;
    } catch (error) {
      console.error('Error starting call:', error);
      cleanup();
      throw error;
    }
  }, [token, getMedia, cleanup]);

  // Join call
  const joinCall = useCallback(async (sessionId) => {
    try {
      console.log('📞 Joining call:', sessionId);
      const stream = await getMedia(true, true);

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
      ws.clearIncomingCall();

      // The host will send us an offer via WebSocket when they receive the participant_joined event
      // We just need to be ready to respond

      return response.data;
    } catch (error) {
      console.error('Error joining call:', error);
      cleanup();
      throw error;
    }
  }, [token, getMedia, cleanup, ws]);

  // Leave call
  const leaveCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (call) {
      try {
        await axios.post(`${API_URL}/api/video/calls/${call.id}/leave`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Error leaving call:', error);
      }
    }
    cleanup();
  }, [token, cleanup]);

  // End call
  const endCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (call) {
      try {
        await axios.post(`${API_URL}/api/video/calls/${call.id}/end`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Error ending call:', error);
      }
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
    ws.clearIncomingCall();
  }, [incomingCall, token, ws]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMediaState(prev => ({ ...prev, audioEnabled: track.enabled }));

      const call = activeCallRef.current;
      if (call) {
        await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`,
          { audio_enabled: track.enabled },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
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

      const call = activeCallRef.current;
      if (call) {
        await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`,
          { video_enabled: track.enabled },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }
    }
  }, [token]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    const call = activeCallRef.current;

    if (mediaState.screenSharing) {
      // Stop screen sharing, go back to camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });

        const currentStream = localStreamRef.current;
        const oldTrack = currentStream?.getVideoTracks()[0];
        if (oldTrack) {
          currentStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        currentStream?.addTrack(videoTrack);

        // Create new MediaStream to trigger React update
        const newStream = new MediaStream([
          ...currentStream.getAudioTracks(),
          videoTrack
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
        setMediaState(prev => ({ ...prev, screenSharing: false }));

        console.log('📹 Switched back to camera');
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => toggleScreenShare();

        const currentStream = localStreamRef.current;
        const oldTrack = currentStream?.getVideoTracks()[0];
        if (oldTrack) {
          currentStream.removeTrack(oldTrack);
          oldTrack.stop();
        }

        // Create new MediaStream with screen track
        const newStream = new MediaStream([
          ...currentStream.getAudioTracks(),
          screenTrack
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
        setMediaState(prev => ({ ...prev, screenSharing: true }));

        if (call) {
          await axios.patch(`${API_URL}/api/video/calls/${call.id}/media`,
            { screen_sharing: true },
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => {});
        }

        console.log('📺 Started screen sharing');
      } catch (error) {
        if (error.name !== 'NotAllowedError') {
          toast.error('Could not start screen sharing');
        }
      }
    }
  }, [mediaState.screenSharing, token]);

  const value = {
    activeCall,
    incomingCall,
    participants,
    localStream,
    remoteStreams,
    mediaState,
    startCall,
    joinCall,
    startCallWithStream,
    joinCallWithStream,
    leaveCall,
    endCall,
    declineCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    currentUserId: user?.id
  };

  return (
    <VideoCallContext.Provider value={value}>
      {children}
    </VideoCallContext.Provider>
  );
};
